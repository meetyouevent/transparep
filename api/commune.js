const { createClient } = require('@supabase/supabase-js');

// ─── Supabase (optionnel) ────────────────────────────────
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// ─── Années ─────────────────────────────────────────────
// OFGL publie les données définitives pour l'année N en mars/avril N+1
// DGFIP balances brutes publiées avec ~18-24 mois de décalage
const START_YEAR = parseInt(process.env.DGFIP_YEAR || '') || (new Date().getFullYear() - 2);
const MAX_YEAR_FALLBACK = 3;

// ─── URLs sources de données ─────────────────────────────
// OFGL : agrégats financiers consolidés 2017-2024 (source officielle, données vérifiées)
const OFGL_URL = 'https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/ofgl-base-communes/records';
// REI : taux de fiscalité locale (taxe foncière, CFE) par commune
const REI_URL  = 'https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/rei/records';
// RNE : Répertoire National des Élus — mis à jour trimestriellement
const RNE_URL  = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/donnees-du-repertoire-national-des-elus/records';
// DGFIP balances M14 (détail par chapitre comptable)
const dgfipUrl = y => `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-communes-en-${y}/records`;
// DECP : marchés publics par année
const decpUrl  = y => `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp-${y}-marches-valides/records`;
// Subventions associations
const SUBV_URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/dispositif-de-subventions-aux-associations/records';
// Géo
const GEO_URL  = 'https://geo.api.gouv.fr/communes';

// ─── Chapitres comptables M14 ────────────────────────────
const CHAPITRES_LIB = {
  '011': 'Charges à caractère général',
  '012': 'Charges de personnel',
  '014': 'Atténuations de produits',
  '65':  'Autres charges de gestion courante',
  '66':  'Charges financières',
  '67':  'Charges exceptionnelles',
  '20':  'Immobilisations incorporelles',
  '21':  'Immobilisations corporelles',
  '23':  'Immobilisations en cours',
  '16':  'Remboursement d\'emprunts',
  '042': 'Opérations d\'ordre transfert entre sections',
};

// ─── Sanitization ODS WHERE ──────────────────────────────
function odsEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function odsEscLike(s) {
  return odsEsc(s).replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ═════════════════════════════════════════════════════════
//  HANDLER
// ═════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  const insee = (req.query.insee || '').trim();
  if (!/^\d{5}$/.test(insee)) {
    return res.status(400).json({ error: 'Paramètre insee invalide (5 chiffres attendus)' });
  }

  try {
    // ── 0. Supabase optionnel ──────────────────────────────
    let sb = null;
    if (SB_URL && SB_KEY) {
      try { sb = createClient(SB_URL, SB_KEY); }
      catch (e) { console.warn('[commune] Supabase non disponible:', e.message); }
    } else {
      console.warn('[commune] SUPABASE_URL/KEY non configurées — cache désactivé');
    }

    // ── 1. Cache Supabase ──────────────────────────────────
    if (sb) {
      const { data: cached } = await sb
        .from('cache_communes')
        .select('data, cached_at')
        .eq('insee', insee)
        .single();
      const cachedBudget = cached?.data?.budget_total ?? 0;
      if (cached && cachedBudget > 0 && (Date.now() - new Date(cached.cached_at).getTime()) < TTL_MS) {
        return res.status(200).json(cached.data);
      }
    }

    // ── 2. Géo ────────────────────────────────────────────
    const geoInfo = await fetchGeo(insee);
    const nomCommune = geoInfo.nom || '';
    const siren = geoInfo.siren && /^\d+$/.test(geoInfo.siren) ? geoInfo.siren : null;
    const ident = siren ? siren + '00018' : null;

    // ── 3. Fetches parallèles ──────────────────────────────
    // OFGL (agrégats 2017-2024), REI (fiscalité), RNE (élus)
    const [ofglRows, fiscalite, elus] = await Promise.all([
      fetchOFGL(insee),
      fetchFiscalite(insee),
      fetchElus(insee),
    ]);

    // ── 4. Balances DGFIP avec fallback annuel ─────────────
    let balances = [], effectiveYear = START_YEAR;
    for (let y = START_YEAR; y >= START_YEAR - MAX_YEAR_FALLBACK; y--) {
      balances = await fetchBalances(y, ident, nomCommune);
      if (balances.length > 0) { effectiveYear = y; break; }
      console.warn(`[commune] ${insee}: 0 résultats DGFIP ${y} — essai ${y - 1}`);
    }

    // ── 5. Marchés (multi-années) + subventions ────────────
    const [marches, subventions] = await Promise.all([
      fetchMarchesMultiYear(ident, effectiveYear),
      fetchSubventions(nomCommune),
    ]);

    // ── 6. Agrégation ──────────────────────────────────────
    const result = aggregate(insee, geoInfo, balances, ofglRows, marches, subventions, fiscalite, elus, effectiveYear);

    // ── 7. Cache Supabase ──────────────────────────────────
    if (sb && result.budget_total > 0) {
      await sb.from('cache_communes').upsert({
        insee,
        nom: result.nom,
        data: result,
        cached_at: new Date().toISOString(),
      }).catch(e => console.warn('[commune] cache write error:', e.message));
    } else if (!sb && result.budget_total === 0) {
      console.warn(`[commune] ${insee} (${nomCommune}): budget_total=0 — aucune donnée DGFIP ni OFGL`);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[commune] erreur:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════
//  FETCH HELPERS
// ═════════════════════════════════════════════════════════

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchGeo(insee) {
  const r = await fetchWithTimeout(`${GEO_URL}/${insee}?fields=nom,population,codeDepartement,codesPostaux,siren`);
  if (!r.ok) throw new Error(`geo.api.gouv.fr ${r.status}`);
  return r.json();
}

// ── OFGL — agrégats 2017-2024 pour la commune ─────────────
async function fetchOFGL(insee) {
  const params = new URLSearchParams({
    where: `insee_com = "${odsEsc(insee)}"`,
    select: 'exer, agregat, montant, montant_par_habitant',
    limit: '300',
    order_by: 'exer DESC',
  });
  try {
    const r = await fetchWithTimeout(`${OFGL_URL}?${params}`, {}, 8000);
    if (!r.ok) { console.warn('[commune] OFGL HTTP', r.status); return []; }
    const json = await r.json();
    return json.results || [];
  } catch (e) { console.warn('[commune] OFGL error:', e.message); return []; }
}

// ── REI — taux de fiscalité locale ───────────────────────
async function fetchFiscalite(insee) {
  try {
    const params = new URLSearchParams({
      where: `insee_com = "${odsEsc(insee)}"`,
      select: 'annee, tfpb, tfpnb, taux_cfe',
      order_by: 'annee DESC',
      limit: '1',
    });
    const r = await fetchWithTimeout(`${REI_URL}?${params}`, {}, 5000);
    if (!r.ok) return null;
    const json = await r.json();
    return json.results?.[0] || null;
  } catch { return null; }
}

// ── RNE — élus municipaux ─────────────────────────────────
async function fetchElus(insee) {
  try {
    const params = new URLSearchParams({
      where: `code_commune = "${odsEsc(insee)}"`,
      select: 'nom_de_l_elu, prenom_de_l_elu, sexe, date_de_naissance, lib_profession, date_debut_mandat, libelle_de_la_fonction',
      limit: '100',
      order_by: 'libelle_de_la_fonction ASC',
    });
    const r = await fetchWithTimeout(`${RNE_URL}?${params}`, {}, 7000);
    if (!r.ok) { console.warn('[commune] RNE HTTP', r.status); return []; }
    const json = await r.json();
    return json.results || [];
  } catch (e) { console.warn('[commune] RNE error:', e.message); return []; }
}

// ── DGFIP balances ────────────────────────────────────────
async function fetchBalances(year, ident, nomCommune) {
  if (ident) {
    const byIdent = await fetchBalancesWhere(year, `ident = "${odsEsc(ident)}" AND cbudg = "1"`);
    if (byIdent.length > 0) return byIdent;
    console.warn(`[commune] fetchBalances ${year}: 0 résultats pour ident=${ident}, retry par lbudg`);
  }
  if (!nomCommune) return [];
  return fetchBalancesWhere(year, `lbudg = "${odsEsc(nomCommune.toUpperCase())}" AND cbudg = "1"`);
}

async function fetchBalancesWhere(year, where) {
  const params = new URLSearchParams({ where, select: 'compte, sd, sc', limit: '200' });
  try {
    const r = await fetchWithTimeout(`${dgfipUrl(year)}?${params}`);
    if (!r.ok) return [];
    const json = await r.json();
    return json.results || [];
  } catch { return []; }
}

// ── DECP marchés — essaie plusieurs années pour les plus récents ─
async function fetchMarchesMultiYear(ident, effectiveYear) {
  if (!ident) return [];
  const now = new Date().getFullYear();
  // Tente l'année effective + 2 années suivantes (marchés plus récents que le budget)
  const years = [effectiveYear + 2, effectiveYear + 1, effectiveYear, effectiveYear - 1]
    .filter(y => y >= 2019 && y <= now + 1);
  const all = [];
  for (const y of years) {
    const m = await fetchMarches(y, ident);
    all.push(...m);
    if (all.length >= 40) break;
  }
  return all.slice(0, 50);
}

async function fetchMarches(year, ident) {
  const params = new URLSearchParams({
    where: `acheteur_id = "${odsEsc(ident)}"`,
    select: 'id, objet, montant, datepublicationdonnees, procedure, titulaire_denominationsociale',
    order_by: 'datepublicationdonnees DESC',
    limit: '30',
  });
  try {
    const r = await fetchWithTimeout(`${decpUrl(year)}?${params}`, {}, 5000);
    if (!r.ok) return [];
    const json = await r.json();
    return json.results || [];
  } catch { return []; }
}

async function fetchSubventions(nomCommune) {
  if (!nomCommune) return [];
  try {
    const params = new URLSearchParams({
      where: `nom_attribuant LIKE "${odsEscLike(nomCommune.toUpperCase())}"`,
      select: 'nom_beneficiaire, objet, montant, date_convention',
      order_by: 'date_convention DESC',
      limit: '50',
    });
    const r = await fetchWithTimeout(`${SUBV_URL}?${params}`, {}, 4000);
    if (!r.ok) return [];
    const json = await r.json();
    return json.results || [];
  } catch { return []; }
}

// ═════════════════════════════════════════════════════════
//  OFGL PARSING
// ═════════════════════════════════════════════════════════

function parseOFGL(rows) {
  // Regroupe par année → agregat → montant
  const byYear = {};
  for (const row of rows) {
    const y = Number(row.exer);
    if (!y) continue;
    if (!byYear[y]) byYear[y] = {};
    const agr = (row.agregat || '').trim();
    byYear[y][agr] = Number(row.montant) || 0;
    if (row.montant_par_habitant != null)
      byYear[y][agr + '__ph'] = Number(row.montant_par_habitant) || 0;
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  return { byYear, years, latestYear: years[0] || null };
}

// Lecture souple d'un agrégat OFGL (correspondance exacte ou partielle)
function getA(row, ...candidates) {
  if (!row) return 0;
  for (const c of candidates) {
    if (row[c] !== undefined) return Number(row[c]) || 0;
  }
  // Correspondance partielle sur les 18 premiers caractères
  for (const c of candidates) {
    const prefix = c.toLowerCase().substring(0, 18);
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase().startsWith(prefix)) return Number(v) || 0;
    }
  }
  return 0;
}

// ═════════════════════════════════════════════════════════
//  AGRÉGATION
// ═════════════════════════════════════════════════════════

function aggregate(insee, geo, balances, ofglRows, marches, subventions, fiscalite, elusRaw, effectiveYear) {
  const nom = geo.nom || insee;
  const population = geo.population || 0;

  // ── OFGL parsing ─────────────────────────────────────────
  const ofgl = parseOFGL(ofglRows);
  const ofglLatestYear = ofgl.latestYear;
  const ofglLatest = ofglLatestYear ? (ofgl.byYear[ofglLatestYear] || {}) : {};

  const ofglDepFonct  = getA(ofglLatest, 'Dépenses réelles de fonctionnement',  'Dépenses de fonctionnement');
  const ofglPersonnel = getA(ofglLatest, 'dont charges de personnel',            'Charges de personnel');
  const ofglRecFonct  = getA(ofglLatest, 'Recettes réelles de fonctionnement',   'Recettes de fonctionnement');
  const ofglEpargne   = getA(ofglLatest, 'Épargne brute',                        'Epargne brute');
  const ofglInvest    = getA(ofglLatest, "Dépenses d'équipement",                "Dépenses d'investissement");
  const ofglDette     = getA(ofglLatest, 'Encours de la dette au 31/12',         'Encours de dette');
  const ofglAnnuite   = getA(ofglLatest, 'Annuité de la dette',                  'Annuité');
  const ofglDGF       = getA(ofglLatest, 'dont dotations et participations',     'DGF');
  const ofglFisc      = getA(ofglLatest, 'dont fiscalité directe',               'Fiscalité directe');

  // ── DGFIP M14 chapitres ───────────────────────────────────
  const chapitres = {};
  let budgetDGFIP = 0;

  for (const row of balances) {
    const compte = String(row.compte || '');
    let chap = null;
    for (const prefix of ['011', '012', '014', '042', '65', '66', '67', '20', '21', '23', '16']) {
      if (compte.startsWith(prefix)) { chap = prefix; break; }
    }
    if (!chap) continue;
    const depense = Math.abs(Number(row.sd || row.total_sd || 0));
    if (!Number.isFinite(depense) || depense === 0) continue;
    if (!chapitres[chap]) chapitres[chap] = { lib: CHAPITRES_LIB[chap] || `Chapitre ${chap}`, depense: 0 };
    chapitres[chap].depense += depense;
    budgetDGFIP += depense;
  }

  // Si DGFIP vide, construire des chapitres synthétiques depuis OFGL pour le camembert
  if (budgetDGFIP === 0 && ofglDepFonct > 0) {
    if (ofglPersonnel > 0)
      chapitres['012'] = { lib: 'Charges de personnel', depense: ofglPersonnel };
    const autresFonct = ofglDepFonct - ofglPersonnel;
    if (autresFonct > 0) {
      chapitres['011'] = { lib: 'Charges à caractère général', depense: autresFonct * 0.55 };
      chapitres['65']  = { lib: 'Autres charges de gestion courante', depense: autresFonct * 0.45 };
    }
    if (ofglInvest > 0)
      chapitres['21'] = { lib: 'Immobilisations corporelles (invest.)', depense: ofglInvest };
    if (ofglAnnuite > 0)
      chapitres['16'] = { lib: "Remboursement d'emprunts", depense: ofglAnnuite };
  }

  // Budget total : préférer DGFIP (détaillé) sinon OFGL (agrégat)
  const budgetTotal = budgetDGFIP > 0 ? budgetDGFIP : ofglDepFonct;
  const anneeSource = budgetDGFIP > 0 ? effectiveYear : (ofglLatestYear || effectiveYear);

  // ── Marchés publics ────────────────────────────────────────
  const marchesClean = marches
    .map(m => ({
      ref:          m.id || '',
      objet:        m.objet || '',
      attributaire: m.titulaire_denominationsociale || '',
      montant:      Number(m.montant) || 0,
      date:         m.datepublicationdonnees || '',
      procedure:    m.procedure || '',
    }))
    .filter(m => m.montant > 0);

  // ── Subventions ────────────────────────────────────────────
  const subvClean = subventions
    .map(s => {
      const d = s.date_convention ? new Date(s.date_convention) : null;
      return {
        beneficiaire: s.nom_beneficiaire || '',
        objet:        s.objet || '',
        montant:      Number(s.montant) || 0,
        annee:        d && !isNaN(d) ? d.getFullYear() : null,
      };
    })
    .filter(s => s.montant > 0);

  // ── Élus (RNE) ─────────────────────────────────────────────
  const elusClean = elusRaw.map(e => {
    const naiss  = e.date_de_naissance ? new Date(e.date_de_naissance) : null;
    const mandat = e.date_debut_mandat  ? new Date(e.date_debut_mandat)  : null;
    return {
      nom:       (e.nom_de_l_elu || '').toUpperCase().trim(),
      prenom:    (e.prenom_de_l_elu || '').trim(),
      sexe:      e.sexe || '',
      age:       naiss && !isNaN(naiss) ? new Date().getFullYear() - naiss.getFullYear() : null,
      profession: e.lib_profession || '',
      fonction:  e.libelle_de_la_fonction || '',
      depuis:    mandat && !isNaN(mandat) ? mandat.getFullYear() : null,
    };
  }).filter(e => e.nom);

  // ── Fiscalité (REI) ────────────────────────────────────────
  let fiscaliteClean = null;
  if (fiscalite) {
    const tfpb = Number(fiscalite.tfpb || fiscalite.taux_tfpb) || null;
    const tfpnb = Number(fiscalite.tfpnb || fiscalite.taux_tfpnb) || null;
    const cfe   = Number(fiscalite.taux_cfe || fiscalite.cfe) || null;
    if (tfpb || tfpnb || cfe) {
      fiscaliteClean = { annee: fiscalite.annee, tfpb, tfpnb, cfe };
    }
  }

  // ── Évolution temporelle (OFGL, toutes années disponibles) ──
  const evolution = [];
  for (const y of ofgl.years) {
    const row = ofgl.byYear[y];
    const dep = getA(row, 'Dépenses réelles de fonctionnement', 'Dépenses de fonctionnement');
    if (!dep) continue;
    evolution.push({
      annee:     y,
      dep_fonct: dep,
      invest:    getA(row, "Dépenses d'équipement", "Dépenses d'investissement"),
      dette:     getA(row, 'Encours de la dette au 31/12', 'Encours de dette'),
      epargne:   getA(row, 'Épargne brute', 'Epargne brute'),
      personnel: getA(row, 'dont charges de personnel', 'Charges de personnel'),
      recettes:  getA(row, 'Recettes réelles de fonctionnement', 'Recettes de fonctionnement'),
    });
  }
  evolution.sort((a, b) => a.annee - b.annee);

  // ── KPIs ──────────────────────────────────────────────────
  const depPersonnel = ofglPersonnel || (chapitres['012'] || {}).depense || 0;
  const depInvest    = ofglInvest    || ['20', '21', '23'].reduce((a, c) => a + ((chapitres[c] || {}).depense || 0), 0);
  const detteEncours = ofglDette     || 0;
  const epargne      = ofglEpargne   || 0;
  const recettes     = ofglRecFonct  || 0;

  const kpis = {
    budget_par_habitant:    population ? Math.round(budgetTotal / population) : 0,
    ratio_personnel:        budgetTotal ? +((depPersonnel / budgetTotal) * 100).toFixed(1) : 0,
    dette_par_habitant:     population ? Math.round(detteEncours / population) : 0,
    dette_encours:          detteEncours,
    ratio_investissement:   budgetTotal ? +((depInvest / budgetTotal) * 100).toFixed(1) : 0,
    epargne_brute:          epargne,
    epargne_par_habitant:   population ? Math.round(epargne / population) : 0,
    taux_epargne:           recettes ? +((epargne / recettes) * 100).toFixed(1) : 0,
    recettes_fonct:         recettes,
    dgf:                    ofglDGF,
    fiscalite_directe:      ofglFisc,
    population,
  };

  // ── Anomalies automatiques ─────────────────────────────────
  const anomalies = [];

  if (kpis.ratio_personnel > 35) {
    anomalies.push({ type: 'ratio_personnel_eleve', valeur: kpis.ratio_personnel, seuil: 35, severite: 'warning' });
  }
  if (population > 0 && kpis.dette_par_habitant > 1500) {
    anomalies.push({ type: 'dette_elevee', valeur: kpis.dette_par_habitant, seuil: 1500, severite: 'warning' });
  }
  if (budgetTotal > 500000 && kpis.ratio_investissement < 10 && kpis.ratio_investissement > 0) {
    anomalies.push({ type: 'investissement_faible', valeur: kpis.ratio_investissement, seuil: 10, severite: 'warning' });
  }
  if (kpis.taux_epargne > 0 && kpis.taux_epargne < 5 && recettes > 200000) {
    anomalies.push({ type: 'epargne_faible', valeur: kpis.taux_epargne, seuil: 5, severite: 'warning' });
  }

  // Hausse de la dette sur les 3 dernières années OFGL
  if (evolution.length >= 3) {
    const tail = evolution.slice(-3);
    const pct = tail[0].dette > 0 ? Math.round((tail[2].dette / tail[0].dette - 1) * 100) : 0;
    if (pct > 30 && tail[2].dette > 1000000) {
      anomalies.push({
        type: 'dette_hausse', valeur: pct,
        periode: `${tail[0].annee}–${tail[2].annee}`,
        montant: tail[2].dette, severite: 'warning',
      });
    }
  }

  const SEUIL_AO = 214000;
  for (const m of marchesClean) {
    if (m.procedure && /adapt[eé]/i.test(m.procedure) && m.montant > SEUIL_AO) {
      anomalies.push({
        type: 'marche_mapa_seuil', valeur: m.montant, seuil: SEUIL_AO,
        ref: m.ref, objet: m.objet, attributaire: m.attributaire, severite: 'error',
      });
    }
  }

  const marcheCount = {};
  for (const m of marchesClean) {
    const key = m.attributaire.toLowerCase();
    if (key) marcheCount[key] = (marcheCount[key] || 0) + 1;
  }
  for (const [attr, count] of Object.entries(marcheCount)) {
    if (count > 3) {
      anomalies.push({ type: 'marche_reconduit', attributaire: attr, nombre: count, seuil: 3, severite: 'warning' });
    }
  }

  // ── Sources ────────────────────────────────────────────────
  const sources = [];
  if (ofglLatestYear) sources.push(`OFGL ${ofglLatestYear}`);
  if (budgetDGFIP > 0) sources.push(`DGFIP ${effectiveYear}`);
  if (marchesClean.length > 0) sources.push('DECP');
  if (elusClean.length > 0) sources.push('RNE');
  if (fiscaliteClean) sources.push('REI');

  return {
    insee,
    nom,
    annee: anneeSource,
    budget_total: budgetTotal,
    chapitres,
    marches: marchesClean,
    subventions: subvClean,
    elus: elusClean,
    fiscalite: fiscaliteClean,
    evolution,
    kpis,
    anomalies_auto: anomalies,
    source: sources.length ? sources.join(' · ') : `data.economie.gouv.fr`,
    cached_at: new Date().toISOString(),
  };
}
