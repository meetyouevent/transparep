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

// ─── APIs publiques ─────────────────────────────────────
const DGFIP_URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-communes-en-2023/records';
const DECP_URL  = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records';
const SUBV_URL  = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/subventions-versees-aux-associations/records';
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

    if (cached && (Date.now() - new Date(cached.cached_at).getTime()) < TTL_MS) {
      return res.status(200).json(cached.data);
    }

    // ── 2. Cache miss → fetch les 3 APIs en parallèle ──
    const [geoInfo, balances, marches, subventions] = await Promise.all([
      fetchGeo(insee),
      fetchBalances(insee),
      fetchMarches(insee),
      fetchSubventions(insee),
    ]);

    // ── 3. Agrégation ───────────────────────────────────
    const result = aggregate(insee, geoInfo, balances, marches, subventions);

    // ── 4. Stockage cache (upsert) ──────────────────────
    await sb.from('cache_communes').upsert({
      insee,
      nom: result.nom,
      data: result,
      cached_at: new Date().toISOString(),
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('commune API error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════════════════
//  FETCH HELPERS
// ═════════════════════════════════════════════════════════

async function fetchGeo(insee) {
  const r = await fetch(`${GEO_URL}/${insee}?fields=nom,population,codeDepartement,codesPostaux`);
  if (!r.ok) throw new Error(`geo.api.gouv.fr ${r.status}`);
  return r.json();
}

async function fetchBalances(insee) {
  // Balances comptables DGFIP — dépenses (sd=D) agrégées par chapitre
  const params = new URLSearchParams({
    where: `insee = "${insee}" AND cbudg = "1"`,
    group_by: 'compte',
    select: 'compte, SUM(sd) as total_sd, SUM(sc) as total_sc',
    limit: '200',
  });
  const r = await fetch(`${DGFIP_URL}?${params}`);
  if (!r.ok) return [];
  const json = await r.json();
  return json.results || [];
}

async function fetchMarches(insee) {
  const params = new URLSearchParams({
    where: `codeCommuneAcheteur = "${insee}"`,
    select: 'id, objet, titulaires, montant, datePublicationDonnees, nature, procedure',
    order_by: 'datePublicationDonnees DESC',
    limit: '50',
  });
  const r = await fetch(`${DECP_URL}?${params}`);
  if (!r.ok) return [];
  const json = await r.json();
  return json.results || [];
}

async function fetchSubventions(insee) {
  const params = new URLSearchParams({
    where: `codeCommune = "${insee}"`,
    select: 'nomBeneficiaire, objetSubvention, montant, dateConvention',
    order_by: 'dateConvention DESC',
    limit: '50',
  });
  const r = await fetch(`${SUBV_URL}?${params}`);
  if (!r.ok) return [];
  const json = await r.json();
  return json.results || [];
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
    // Déterminer le chapitre (2 ou 3 premiers chiffres selon la nomenclature M14)
    let chap = null;
    for (const prefix of ['011', '012', '014', '042', '65', '66', '67', '20', '21', '23', '16']) {
      if (compte.startsWith(prefix)) { chap = prefix; break; }
    }
    if (!chap) continue;

    const depense = Math.abs(Number(row.total_sd || 0));
    if (!chapitres[chap]) {
      chapitres[chap] = { lib: CHAPITRES_LIB[chap] || `Chapitre ${chap}`, depense: 0 };
    }
    chapitres[chap].depense += depense;
    budgetTotal += depense;
  }

  // ── Marchés publics ───────────────────────────────────
  const marchesClean = marches.map(m => {
    let attributaire = '';
    if (m.titulaires) {
      try {
        const t = typeof m.titulaires === 'string' ? JSON.parse(m.titulaires) : m.titulaires;
        attributaire = Array.isArray(t) ? t.map(x => x.denominationSociale || '').join(', ') : '';
      } catch { attributaire = String(m.titulaires); }
    }
    return {
      ref: m.id || '',
      objet: m.objet || '',
      attributaire,
      montant: Number(m.montant) || 0,
      date: m.datePublicationDonnees || '',
      procedure: m.procedure || m.nature || '',
    };
  });

  // ── Subventions ───────────────────────────────────────
  const subvClean = subventions.map(s => ({
    beneficiaire: s.nomBeneficiaire || '',
    objet: s.objetSubvention || '',
    montant: Number(s.montant) || 0,
    annee: s.dateConvention ? new Date(s.dateConvention).getFullYear() : null,
  }));

  // ── KPIs ──────────────────────────────────────────────
  const depPersonnel = (chapitres['012'] || {}).depense || 0;
  const depInvest = ['20', '21', '23'].reduce((a, c) => a + ((chapitres[c] || {}).depense || 0), 0);
  const dette = (chapitres['16'] || {}).depense || 0;

  const kpis = {
    budget_par_habitant: population ? Math.round(budgetTotal / population) : 0,
    ratio_personnel: budgetTotal ? +((depPersonnel / budgetTotal) * 100).toFixed(1) : 0,
    dette_par_habitant: population ? Math.round(dette / population) : 0,
    ratio_investissement: budgetTotal ? +((depInvest / budgetTotal) * 100).toFixed(1) : 0,
    population,
  };

  // ── Anomalies automatiques ────────────────────────────
  const anomalies = [];
  if (kpis.ratio_personnel > 35) {
    anomalies.push({ type: 'ratio_personnel_eleve', valeur: kpis.ratio_personnel, seuil: 35, severite: 'warning' });
  }

  // Marchés reconduits > 3 fois (même attributaire + objet similaire)
  const marcheCount = {};
  for (const m of marchesClean) {
    const key = m.attributaire.toLowerCase();
    if (key) { marcheCount[key] = (marcheCount[key] || 0) + 1; }
  }
  for (const [attr, count] of Object.entries(marcheCount)) {
    if (count > 3) {
      anomalies.push({ type: 'marche_reconduit', attributaire: attr, nombre: count, seuil: 3, severite: 'warning' });
    }
  }

  return {
    insee,
    nom,
    annee: 2023,
    budget_total: budgetTotal,
    chapitres,
    marches: marchesClean,
    subventions: subvClean,
    kpis,
    anomalies_auto: anomalies,
    source: 'DGFIP · data.economie.gouv.fr',
    cached_at: new Date().toISOString(),
  };
}
