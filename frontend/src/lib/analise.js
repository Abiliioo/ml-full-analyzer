// Projeção = média L7D × (30 dias de demanda + 9 dias de lead time)
// 9 = 7d planejamento/envio + 2d processamento no armazém ML
const PROJ_DIAS = 39;
const CURVA_LIM = { A: [25, 35], B: [20, 25], C: [15, 20] };

function calcularCurvaABC(items) {
  const sorted   = [...items].sort((a, b) => b.faturamento - a.faturamento);
  const totalFat = sorted.reduce((s, i) => s + i.faturamento, 0);
  let acum = 0;
  const map = {};
  for (const item of sorted) {
    acum += item.faturamento;
    const pct = totalFat > 0 ? acum / totalFat : 1;
    map[item.key] = pct <= 0.80 ? 'A' : pct <= 0.95 ? 'B' : 'C';
  }
  return map;
}

function calcularSituacao(cobertura, total, diaria, curva) {
  if (diaria === 0 && total === 0) return 'Sem movimento';
  if (diaria === 0 && total > 0)   return 'Excesso';
  if (total === 0)                  return 'Ruptura';
  const [lim1, lim2] = CURVA_LIM[curva] || [15, 20];
  if (cobertura < lim1) return 'Repor estoque';
  if (cobertura < lim2) return 'Controlado';
  return curva === 'A' ? 'Margem' : 'Estoque acima';
}

const NEEDS_SEND = new Set(['Ruptura', 'Repor estoque', 'Controlado']);

function calcMetrics(l30d, l7d, total, atual, curva) {
  const diaria   = l30d / 30;
  const mediaL7D = l7d  / 7;
  const taxa     = mediaL7D > 0 ? mediaL7D : diaria;

  // Tendência: variação relativa entre média L7D e média L30D
  const tendencia = diaria > 0 ? (mediaL7D - diaria) / diaria : (mediaL7D > 0 ? 1 : 0);

  // Cobertura: estoque total (atual + pend + transf) / taxa → horizonte de planejamento
  const cobertura = taxa > 0 ? total / taxa : (total > 0 ? 999 : 0);

  // Risco: apenas estoque aptas (sem pend/transf) / taxa → dias reais até ruptura
  const riscoAtual = taxa > 0 ? (atual || 0) / taxa : ((atual || 0) > 0 ? 999 : 0);

  // Ruptura %: MAX(0, MIN(1, 1 − risco/9)) — 9 = 7d processamento + 2d segurança
  const rupturaPct = Math.max(0, Math.min(1, 1 - riscoAtual / 9));

  const projecao = Math.ceil(taxa * PROJ_DIAS);
  const situacao = calcularSituacao(Math.round(cobertura), total, diaria, curva);
  const envio    = NEEDS_SEND.has(situacao) ? Math.max(0, projecao - total) : 0;
  return {
    diaria, mediaL7D, tendencia,
    cobertura:   Math.round(cobertura),
    riscoAtual:  Math.round(riscoAtual),
    rupturaPct,
    projecao, situacao, envio,
  };
}

export function calcularAnalise(estoqueList, vendasBySku) {
  const items = [];
  const processedSkus = new Set();

  // Índice rápido de estoque por SKU (para lookup de byMlb nos anúncios)
  const estRef = {};
  for (const est of (estoqueList || [])) estRef[est.sku] = est;

  /* ─── 1. Items no estoque Full ───────────────────────────── */
  for (const est of (estoqueList || [])) {
    const venda = vendasBySku?.[est.sku] || {};
    processedSkus.add(est.sku);

    const l30d        = venda.l30d        || est.l30d        || 0;
    const l7d         = venda.l7d         || 0;
    const faturamento = venda.faturamento  || est.faturamento || 0;
    const titulo      = venda.titulo       || est.produto     || est.sku;

    const anuncios = Object.entries(venda.anuncios || {}).map(([id, a]) => ({ id, ...a }));

    items.push({
      key: est.sku, sku: est.sku, titulo, segmento: 'full',
      l30d: Math.round(l30d), l7d: Math.round(l7d), faturamento,
      full:   Math.round(venda.full   || 0),
      envios: Math.round(venda.envios || 0),
      pendente: est.pendente      || 0,
      atual:    est.aptas         || 0,
      transf:   est.transferencia || 0,
      anuncios,
    });
  }

  /* ─── 2. Aspirantes (só nas vendas) ──────────────────────── */
  for (const [sku, venda] of Object.entries(vendasBySku || {})) {
    if (processedSkus.has(sku)) continue;
    const anuncios = Object.entries(venda.anuncios || {}).map(([id, a]) => ({ id, ...a }));
    items.push({
      key: sku, sku, titulo: venda.titulo || sku, segmento: 'aspirante',
      l30d: Math.round(venda.l30d), l7d: Math.round(venda.l7d),
      faturamento: venda.faturamento,
      full:   Math.round(venda.full),
      envios: Math.round(venda.envios),
      pendente: 0, atual: 0, transf: 0,
      anuncios,
    });
  }

  // Curva global (Full + Aspirantes juntos para ranking correto de faturamento)
  const curvas = calcularCurvaABC(items);

  // Curva separada só dos aspirantes (ranking relativo entre si)
  const aspirantes = items.filter(i => i.segmento === 'aspirante');
  const aspCurvas  = calcularCurvaABC(aspirantes);

  return items.map(item => {
    const total  = item.atual + item.pendente + item.transf;
    const curva  = item.segmento === 'full'
      ? (curvas[item.key]    || 'C')
      : (aspCurvas[item.key] || 'C');

    const skuM = calcMetrics(item.l30d, item.l7d, total, item.atual, curva);

    // Anúncios com métricas por MLB (cobertura, envio, situação individuais)
    const est = estRef[item.sku];
    const anuncios = item.anuncios.map(a => {
      const mlbStock = est?.byMlb?.[a.id] || { aptas: 0, pendente: 0, transferencia: 0 };
      const mlbTotal = mlbStock.aptas + mlbStock.pendente + mlbStock.transferencia;
      // Só mostra métricas Full se o MLB participar do Full (tem estoque ou vendas Full)
      const isFullMlb = item.segmento === 'full' && (a.full > 0 || mlbTotal > 0);
      const mlbM      = isFullMlb ? calcMetrics(a.l30d || 0, a.l7d || 0, mlbTotal, mlbStock.aptas, curva) : null;
      return {
        ...a,
        aptas:         mlbStock.aptas,
        pendente:      mlbStock.pendente,
        transferencia: mlbStock.transferencia,
        total:         mlbTotal,
        isFullMlb,
        cobertura:   isFullMlb ? mlbM.cobertura   : null,
        riscoAtual:  isFullMlb ? mlbM.riscoAtual  : null,
        rupturaPct:  isFullMlb ? mlbM.rupturaPct  : null,
        tendencia:   isFullMlb ? mlbM.tendencia   : null,
        situacao:    isFullMlb ? mlbM.situacao     : null,
        projecao:    isFullMlb ? mlbM.projecao     : null,
        envio:       isFullMlb ? mlbM.envio        : 0,
      };
    });

    // SKU envio = soma dos envios por MLB; fallback se não há byMlb
    const hasPerMlb = anuncios.some(a => a.total > 0 || a.aptas > 0);
    const envio = item.segmento !== 'full' ? 0
      : hasPerMlb
        ? anuncios.reduce((s, a) => s + a.envio, 0)
        : skuM.envio;

    // Situação do SKU = pior entre os MLBs (ou agregada se sem byMlb)
    const SIT_PRIO = ['Ruptura','Repor estoque','Controlado','Margem','Estoque acima','Excesso','Sem movimento'];
    const situacao = item.segmento !== 'full' ? null
      : hasPerMlb
        ? SIT_PRIO.find(s => anuncios.some(a => a.situacao === s)) || skuM.situacao
        : skuM.situacao;

    // Aspirantes
    const viavel = item.faturamento >= 500 || item.l30d >= 10;
    let tipoAspirante = null;
    let recomendacao  = null;
    if (item.segmento === 'aspirante') {
      tipoAspirante = item.full > 0 ? 'saiu_do_full' : 'potencial';
      if (tipoAspirante === 'saiu_do_full') {
        recomendacao = 'Era Full – reabastecer urgente';
      } else if (!viavel) {
        recomendacao = 'Volume insuficiente para Full';
      } else if (curva === 'A') {
        recomendacao = 'Alto potencial – candidato prioritário';
      } else if (curva === 'B') {
        recomendacao = 'Bom potencial – avaliar envio';
      } else {
        recomendacao = 'Potencial moderado – monitorar';
      }
    }

    return {
      key:          item.key,
      sku:          item.sku,
      titulo:       item.titulo || item.sku,
      segmento:     item.segmento,
      tipoAspirante,
      recomendacao,
      l30d:         item.l30d,
      l7d:          item.l7d,
      full:         item.full,
      envios:       item.envios,
      faturamento:  Math.round(item.faturamento * 100) / 100,
      curva,
      diaria:       Math.round(skuM.diaria   * 10) / 10,
      mediaL7D:     Math.round(skuM.mediaL7D * 10) / 10,
      tendencia:    skuM.tendencia,
      pendente:     item.pendente,
      atual:        item.atual,
      transf:       item.transf,
      total,
      cobertura:    skuM.cobertura,
      riscoAtual:   skuM.riscoAtual,
      rupturaPct:   skuM.rupturaPct,
      viavel,
      situacao,
      projecao:     skuM.projecao,
      envio,
      anuncios,
    };
  }).sort((a, b) => b.faturamento - a.faturamento);
}
