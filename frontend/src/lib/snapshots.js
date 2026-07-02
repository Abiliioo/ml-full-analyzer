const STORAGE_KEY  = 'analise-snapshots';
const MAX_SNAPSHOTS = 10;

const SIT_PRIO = {
  'Ruptura': 0, 'Repor estoque': 1, 'Controlado': 2,
  'Margem': 3, 'Estoque acima': 4, 'Excesso': 5, 'Sem movimento': 6,
};

function slim(item) {
  return {
    sku:        item.sku,
    titulo:     item.titulo,
    segmento:   item.segmento,
    curva:      item.curva,
    situacao:   item.situacao,
    cobertura:  item.cobertura,
    envio:      item.envio,
    faturamento: item.faturamento,
    l30d:       item.l30d,
    atual:      item.atual,
    total:      item.total,
  };
}

export function saveSnapshot(analise, { vendasFilename, estoqueFilename, label } = {}) {
  const fullItems = analise.filter(i => i.segmento === 'full');
  const snap = {
    id:               'snap_' + Date.now(),
    date:             new Date().toISOString(),
    label:            label || null,
    vendasFilename:   vendasFilename  || null,
    estoqueFilename:  estoqueFilename || null,
    kpi: {
      totalFull:  fullItems.length,
      ruptura:    fullItems.filter(i => i.situacao === 'Ruptura').length,
      repor:      fullItems.filter(i => i.situacao === 'Repor estoque').length,
      totalEnvio: fullItems.reduce((s, i) => s + i.envio, 0),
      fat:        analise.reduce((s, i) => s + i.faturamento, 0),
      cobMedia:   fullItems.length > 0
        ? Math.round(fullItems.filter(i => i.cobertura < 999).reduce((s, i) => s + i.cobertura, 0) /
            Math.max(1, fullItems.filter(i => i.cobertura < 999).length))
        : 0,
    },
    items: analise.map(slim),
  };

  const all = [snap, ...loadSnapshots()].slice(0, MAX_SNAPSHOTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // se estourar cota, descarta os mais antigos
    const trimmed = [snap, ...loadSnapshots().slice(0, 4)];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* sem espaço */ }
  }
  return snap;
}

export function loadSnapshots() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function deleteSnapshot(id) {
  const updated = loadSnapshots().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function renameSnapshot(id, label) {
  const updated = loadSnapshots().map(s => s.id === id ? { ...s, label } : s);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/* ── Comparação ──────────────────────────────────────────── */

export function compareToSnapshot(currentAnalise, snapshot) {
  const snapMap = {};
  for (const item of snapshot.items) snapMap[item.sku] = item;

  const currFull = currentAnalise.filter(i => i.segmento === 'full');
  const result   = [];

  for (const curr of currFull) {
    const prev = snapMap[curr.sku];
    if (!prev || prev.segmento !== 'full') {
      result.push({ sku: curr.sku, titulo: curr.titulo, curva: curr.curva, type: 'novo', curr, prev: null, deltaCob: null, deltaEnvio: null });
      continue;
    }

    const cp = SIT_PRIO[curr.situacao] ?? 7;
    const pp = SIT_PRIO[prev.situacao] ?? 7;
    const deltaCob   = (curr.cobertura  < 999 ? curr.cobertura  : 999) - (prev.cobertura  < 999 ? prev.cobertura  : 999);
    const deltaEnvio = curr.envio - prev.envio;

    let type = 'igual';
    if      (cp < pp) type = 'piorou';
    else if (cp > pp) type = 'melhorou';
    else if (Math.abs(deltaCob) >= 5) type = deltaCob < 0 ? 'piorou' : 'melhorou';

    result.push({ sku: curr.sku, titulo: curr.titulo, curva: curr.curva, type, curr, prev, deltaCob, deltaEnvio });
  }

  // SKUs que estavam no snapshot mas sumiram do Full atual
  for (const item of snapshot.items) {
    if (item.segmento !== 'full') continue;
    if (!currFull.find(c => c.sku === item.sku)) {
      result.push({ sku: item.sku, titulo: item.titulo, curva: item.curva, type: 'saiu', curr: null, prev: item, deltaCob: null, deltaEnvio: null });
    }
  }

  const ORDER = { piorou: 0, saiu: 1, novo: 2, melhorou: 3, igual: 4 };
  return result.sort((a, b) => (ORDER[a.type] ?? 5) - (ORDER[b.type] ?? 5));
}

export function diffKpi(currentAnalise, snapshot) {
  const fullItems  = currentAnalise.filter(i => i.segmento === 'full');
  const currKpi = {
    ruptura:    fullItems.filter(i => i.situacao === 'Ruptura').length,
    repor:      fullItems.filter(i => i.situacao === 'Repor estoque').length,
    totalEnvio: fullItems.reduce((s, i) => s + i.envio, 0),
    cobMedia:   fullItems.length > 0
      ? Math.round(fullItems.filter(i => i.cobertura < 999).reduce((s, i) => s + i.cobertura, 0) /
          Math.max(1, fullItems.filter(i => i.cobertura < 999).length))
      : 0,
    fat: currentAnalise.reduce((s, i) => s + i.faturamento, 0),
  };
  return { curr: currKpi, prev: snapshot.kpi };
}
