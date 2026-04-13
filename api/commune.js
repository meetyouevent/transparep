const { createClient } = require('@supabase/supabase-js');

// ─── Supabase ───────────────────────────────────────────
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// ─── Année des données (configurable via env) ────────────
// Les données DGFIP sont publiées avec ~18-24 mois de décalage.
// DGFIP_YEAR=2024 npm run dev pour forcer une année spécifique.
const DATA_YEAR = parseInt(process.env.DGFIP_YEAR || '') || (new Date().getFullYear() - 2);

// ─── APIs publiques ─────────────────────────────────────
const DGFIP_URL = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-communes-en-${DATA_YEAR}/records`;
const DECP_URL  = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp-${DATA_YEAR}-marches-valides/records`;
const SUBV_URL  = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/dispositif-de-subventions-aux-associations/records';
const GEO_URL   = 'https://geo.api.gouv.fr/communes';

// ─── Chapitres comptables M14 ───────────────────────────
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
// Échappe les guillemets et backslashes dans les valeurs des clauses WHERE ODS API v2.1.
// Évite les injections via des noms de communes contenant " ou \ (ex: Villiers-l'Évêque).
function odsEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
// Même chose + échappement des wildcards LIKE (%, _)
function odsEscLike(s) {
  return odsEsc(s).replace(/%/g, '\\%').replace(/_/g, '\\_');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  const insee = (req.query.insee || '').trim();
  if (!/^\d{5}$/.test(insee)) {
    return res.status(400).json({ error: 'Paramètre insee invalide (5 chiffres attendus)' });
  }

  try {
    const sb = createClient(SB_URL, SB_KEY);

    // ── 1. Cache hit ? ──────────────────────────────────
    const { data: cached } = await sb
      .from('cache_communes')
      .select('data, cached_at')
      .eq('insee', insee)
      .single();

    const cachedBudget = cached?.data?.budget_total ?? 0;
    if (cached && cachedBudget > 0 && (Date.now() - new Date(cached.cached_at).getTime()) < TTL_MS) {
      return res.status(200).json(cached.data);
    }

    // ── 2. Cache miss → fetch geo d'abord ──────────────
    const geoInfo = await fetchGeo(insee);
    const nomCommune = geoInfo.nom || '';

    // SIRET commune = siren (9 chiffres, fourni par geo API) + "00018" (siège principal)
    // Sans siren on ne peut pas reconstruire l'identifiant fiablement
    const siren = geoInfo.siren && /^\d+$/.test(geoInfo.siren) ? geoInfo.siren : null;
    const ident = siren ? siren + '00018' : null;

    const [balances, marches, subventions] = await Promise.all([
      fetchBalances(ident, nomCommune),
      fetchMarches(ident),
      fetchSubventions(nomCommune),
    ]);

    // ── 3. Agrégation ───────────────────────────────────
    const result = aggregate(insee, geoInfo, balances, marches, subventions);

    // ── 4. Stockage cache — uniquement si données réelles ──
    // Un budget_total=0 indique des données indisponibles : ne pas cacher
    // pour que la prochaine requête retente les APIs.
    if (result.budget_total > 0) {
      await sb.from('cache_communes').upsert({
        insee,
        nom: result.nom,
        data: result,
        cached_at: new Date().toISOString(),
      });
    } else {
      console.warn(`[commune] ${insee} (${nomCommune}): budget_total=0 — données indisponibles pour ${DATA_YEAR}, non mis en cache`);
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

async function fetchGeo(insee) {
  const r = await fetch(`${GEO_URL}/${insee}?fields=nom,population,codeDepartement,codesPostaux,siren`);
  if (!r.ok) throw new Error(`geo.api.gouv.fr ${r.status}`);
  return r.json();
}

async function fetchBalances(ident, nomCommune) {
  // Filtre prioritaire par ident (SIRET 14 chiffres) — évite les ambiguïtés de nom.
  // Retry automatique par lbudg si le SIRET est connu mais renvoie 0 résultats
  // (format légèrement différent selon les millésimes du dataset DGFIP).
  if (ident) {
    const byIdent = await fetchBalancesWhere(`ident = "${odsEsc(ident)}" AND cbudg = "1"`);
    if (byIdent.length > 0) return byIdent;
    console.warn(`[commune] fetchBalances: 0 résultats pour ident=${ident}, retry par lbudg`);
  }
  if (!nomCommune) return [];
  return fetchBalancesWhere(`lbudg = "${odsEsc(nomCommune.toUpperCase())}" AND cbudg = "1"`);
}

async function fetchBalancesWhere(where) {
  const params = new URLSearchParams({ where, select: 'compte, sd, sc', limit: '200' });
  const r = await fetch(`${DGFIP_URL}?${params}`);
  if (!r.ok) return [];
  const json = await r.json();
  return json.results || [];
}

async function fetchMarches(ident) {
  // DECP: acheteur_id = SIRET commune — sans ident on ne peut pas filtrer fiablement
  if (!ident) return [];
  const params = new URLSearchParams({
    where: `acheteur_id = "${odsEsc(ident)}"`,
    select: 'id, objet, montant, datepublicationdonnees, procedure, titulaire_denominationsociale',
    order_by: 'datepublicationdonnees DESC',
    limit: '50',
  });
  const r = await fetch(`${DECP_URL}?${params}`);
  if (!r.ok) return [];
  const json = await r.json();
  return json.results || [];
}

async function fetchSubventions(nomCommune) {
  // Dataset subventions optionnel — peut être indisponible selon la commune
  if (!nomCommune) return [];
  try {
    const params = new URLSearchParams({
      where: `nom_attribuant LIKE "${odsEscLike(nomCommune.toUpperCase())}"`,
      select: 'nom_beneficiaire, objet, montant, date_convention',
      order_by: 'date_convention DESC',
      limit: '50',
    });
    const r = await fetch(`${SUBV_URL}?${params}`);
    if (!r.ok) return [];
    const json = await r.json();
    return json.results || [];
  } catch { return []; }
}

// ═════════════════════════════════════════════════════════
//  AGRÉGATION → structure arbre frontend
// ═════════════════════════════════════════════════════════

function aggregate(insee, geo, balances, marches, subventions) {
  const nom = geo.nom || insee;
  const population = geo.population || 0;

  // ── Chapitres budgétaires ─────────────────────────────
  const chapitres = {};
  let budgetTotal = 0;

  for (const row of balances) {
    const compte = String(row.compte || '');
    let chap = null;
    for (const prefix of ['011', '012', '014', '042', '65', '66', '67', '20', '21', '23', '16']) {
      if (compte.startsWith(prefix)) { chap = prefix; break; }
    }
    if (!chap) continue;

    const depense = Math.abs(Number(row.sd || row.total_sd || 0));
    if (!Number.isFinite(depense) || depense === 0) continue;
    if (!chapitres[chap]) {
      chapitres[chap] = { lib: CHAPITRES_LIB[chap] || `Chapitre ${chap}`, depense: 0 };
    }
    chapitres[chap].depense += depense;
    budgetTotal += depense;
  }

  // ── Marchés publics ───────────────────────────────────
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

  // ── Subventions ───────────────────────────────────────
  const subvClean = subventions
    .map(s => {
      const dateConv = s.date_convention ? new Date(s.date_convention) : null;
      const annee = dateConv && !isNaN(dateConv) ? dateConv.getFullYear() : null;
      return {
        beneficiaire: s.nom_beneficiaire || '',
        objet:        s.objet || '',
        montant:      Number(s.montant) || 0,
        annee,
      };
    })
    .filter(s => s.montant > 0);

  // ── KPIs ──────────────────────────────────────────────
  const depPersonnel = (chapitres['012'] || {}).depense || 0;
  const depInvest = ['20', '21', '23'].reduce((a, c) => a + ((chapitres[c] || {}).depense || 0), 0);
  const dette = (chapitres['16'] || {}).depense || 0;

  const kpis = {
    budget_par_habitant:  population ? Math.round(budgetTotal / population) : 0,
    ratio_personnel:      budgetTotal ? +((depPersonnel / budgetTotal) * 100).toFixed(1) : 0,
    dette_par_habitant:   population ? Math.round(dette / population) : 0,
    ratio_investissement: budgetTotal ? +((depInvest / budgetTotal) * 100).toFixed(1) : 0,
    population,
  };

  // ── Anomalies automatiques ────────────────────────────
  const anomalies = [];

  // 1. Ratio de personnel élevé (> 35 %)
  if (kpis.ratio_personnel > 35) {
    anomalies.push({ type: 'ratio_personnel_eleve', valeur: kpis.ratio_personnel, seuil: 35, severite: 'warning' });
  }

  // 2. Endettement élevé (> 1 500 €/habitant)
  if (population > 0 && kpis.dette_par_habitant > 1500) {
    anomalies.push({ type: 'dette_elevee', valeur: kpis.dette_par_habitant, seuil: 1500, severite: 'warning' });
  }

  // 3. Investissement faible (< 10 % du budget, uniquement si budget > 500k)
  if (budgetTotal > 500000 && kpis.ratio_investissement < 10 && kpis.ratio_investissement > 0) {
    anomalies.push({ type: 'investissement_faible', valeur: kpis.ratio_investissement, seuil: 10, severite: 'warning' });
  }

  // 4. Marchés MAPA au-dessus du seuil légal (214 000 € HT pour les collectivités)
  const SEUIL_AO = 214000;
  for (const m of marchesClean) {
    if (m.procedure && /adapt[eé]/i.test(m.procedure) && m.montant > SEUIL_AO) {
      anomalies.push({
        type: 'marche_mapa_seuil',
        valeur: m.montant, seuil: SEUIL_AO,
        ref: m.ref, objet: m.objet, attributaire: m.attributaire,
        severite: 'error',
      });
    }
  }

  // 5. Marchés reconduits > 3 fois (même attributaire)
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

  return {
    insee,
    nom,
    annee: DATA_YEAR,
    budget_total: budgetTotal,
    chapitres,
    marches: marchesClean,
    subventions: subvClean,
    kpis,
    anomalies_auto: anomalies,
    source: `DGFIP ${DATA_YEAR} · data.economie.gouv.fr`,
    cached_at: new Date().toISOString(),
  };
}
