import * as XLSX from 'xlsx';

/* ── Datas ──────────────────────────────────────────────── */
const MESES_PT = {
  janeiro:1, fevereiro:2, 'março':3, marco:3, abril:4,
  maio:5, junho:6, julho:7, agosto:8,
  setembro:9, outubro:10, novembro:11, dezembro:12,
};

function parseBRDate(str) {
  if (!str) return null;
  const m = String(str).toLowerCase().match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const month = MESES_PT[m[2]];
  if (!month) return null;
  return new Date(parseInt(m[3]), month - 1, parseInt(m[1]));
}

/* ── Cancelamentos ──────────────────────────────────────── */
const CANCEL_KW = ['cancelad', 'devolv', 'reembolso', 'pacote cancelad'];

function isCancelled(status) {
  const s = String(status || '').toLowerCase();
  return CANCEL_KW.some(kw => s.includes(kw));
}

/* ── IDs ────────────────────────────────────────────────── */
export function normalizeAnuncioId(id) {
  return String(id || '').trim().replace(/^MLB/i, '').trim();
}

export function parseAnuncioIds(rawValue) {
  return String(rawValue || '')
    .split(/[|,;]/)
    .map(s => normalizeAnuncioId(s))
    .filter(id => /^\d{6,}$/.test(id));  // only numeric IDs with 6+ digits
}

/**
 * Formata um ID MLB para exibição:
 * - ID ≤ 12 dígitos  → "MLB{id}"  (anúncio individual)
 * - ID > 12 dígitos  → só o número (MLBU / agrupador de variações)
 */
export function formatMLBCode(id) {
  const clean = String(id || '').replace(/^MLB/i, '').trim();
  if (!/^\d+$/.test(clean)) return clean;
  return clean.length <= 12 ? 'MLB' + clean : clean;
}

/* ── SheetJS helpers ─────────────────────────────────────── */
async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        resolve(XLSX.read(data, { type: 'array', cellDates: false, raw: false }));
      } catch (err) {
        reject(new Error('Não foi possível ler o arquivo: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function sheetToRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
}

function parseNum(val) {
  if (val === '' || val == null) return 0;
  let s = String(val).replace(/[^0-9.,-]/g, '').trim();
  if (!s) return 0;
  const hasDot   = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // "1.234,56" (BR) ou "1,234.56" (US) — último separador = decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')  // BR
      : s.replace(/,/g, '');                    // US
  } else if (hasComma) {
    // só vírgula: "2,631" (3 dígitos = milhar) vs "23,99" (decimal)
    const afterComma = s.split(',').pop();
    s = afterComma.length === 3 ? s.replace(',', '') : s.replace(',', '.');
  }
  // só ponto (ex: "23.99" do ML vendas) ou inteiro → mantém como está
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function firstCol(headerRow, keywords) {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] || '').toLowerCase().trim();
    if (keywords.some(kw => cell.includes(kw.toLowerCase()))) return i;
  }
  return -1;
}

/* ══════════════════════════════════════════════════════════
 * PARSER 1 – Relatório de Vendas ML
 *
 * Retorna vendasBySku:
 *   { [sku]: { titulo, l30d, l7d, faturamento, full, envios,
 *              anuncios: { [mlbId]: { titulo, l30d, l7d, faturamento, full, envios } } } }
 *
 * Chave primária = SKU.
 * Dentro de cada SKU, mantém breakdown por MLB ID (anúncio).
 * ══════════════════════════════════════════════════════════ */
function parseVendasRaw(sheet) {
  const rows = sheetToRows(sheet);
  if (rows.length < 5) return {};

  // Encontra linha de cabeçalho: deve ter SKU + status/estado
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const lower = rows[i].map(c => String(c || '').toLowerCase().trim());
    const hasSku    = lower.some(c => c === 'sku');
    const hasStatus = lower.some(c => c.includes('estado') || c.includes('status'));
    if (hasSku && hasStatus) { headerIdx = i; break; }
  }
  // Fallback: linha começa com "N."
  if (headerIdx < 0) {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      if (String(rows[i][0] || '').trim().startsWith('N.')) { headerIdx = i; break; }
    }
  }
  if (headerIdx < 0) return {};

  const hdr = rows[headerIdx];
  const cols = {
    data:    firstCol(hdr, ['data da venda']),
    status:  firstCol(hdr, ['estado', 'status do pedido']),
    // Quantidade: busca específica para evitar pegar outros campos numéricos
    qtd:     firstCol(hdr, ['quantidade de produto', 'quantidade', 'unidades']),
    // Receita: busca específica para evitar pegar 'unidades'
    receita: firstCol(hdr, ['receita por produtos', 'receita por produto', 'receita']),
    sku:     firstCol(hdr, ['sku']),
    anuncio: firstCol(hdr, ['# de anúncio', '# anúncio', '# de anuncio', '# anuncio']),
    // Título: usa expressão bem específica para não pegar coluna "Variante" (Pequeno/Grande)
    titulo:  firstCol(hdr, ['título do anúncio', 'titulo do anuncio']),
    forma:   firstCol(hdr, ['forma de entrega']),
  };

  // Se título não encontrado pela expressão exata, tenta coluna após anúncio
  if (cols.titulo < 0 && cols.anuncio >= 0) {
    cols.titulo = cols.anuncio + 1;
  }

  const registros = [];
  let maxDate = null;
  let minDate = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.length || row.every(c => c === '')) continue;

    const sku = String(row[cols.sku] || '').trim();
    if (!sku) continue;
    if (isCancelled(row[cols.status])) continue;

    const saleDate = parseBRDate(row[cols.data]);
    if (saleDate && (!maxDate || saleDate > maxDate)) maxDate = saleDate;
    if (saleDate && (!minDate || saleDate < minDate)) minDate = saleDate;

    const anuncioRaw = cols.anuncio >= 0 ? String(row[cols.anuncio] || '') : '';
    const anuncioId  = normalizeAnuncioId(anuncioRaw) || '';
    // Valida: deve ser numérico para ser um MLB/MLBU real
    const anuncioIdClean = /^\d{6,}$/.test(anuncioId) ? anuncioId : '';

    const titulo  = cols.titulo >= 0 ? String(row[cols.titulo] || '').trim() : '';
    const qtd     = parseNum(row[cols.qtd]);
    const receita = parseNum(row[cols.receita]);
    const isFull  = String(row[cols.forma] || '').toLowerCase().trim() === 'mercado envios full';

    if (qtd <= 0) continue; // ignora linhas sem quantidade

    registros.push({ sku, anuncioId: anuncioIdClean, titulo, qtd, receita, isFull, date: saleDate });
  }

  const ref = maxDate || new Date();
  const d30 = new Date(ref); d30.setDate(d30.getDate() - 30);
  const d7  = new Date(ref); d7.setDate(d7.getDate() - 7);

  const dict = {};
  const period = { from: minDate, to: maxDate };

  for (const r of registros) {
    const inL30 = !r.date || r.date >= d30;
    if (!inL30) continue;
    const inL7 = r.date && r.date >= d7;

    if (!dict[r.sku]) {
      dict[r.sku] = { titulo: '', l30d: 0, l7d: 0, faturamento: 0, full: 0, envios: 0, anuncios: {} };
    }
    const d = dict[r.sku];
    d.l30d        += r.qtd;
    d.faturamento += r.receita;
    if (r.isFull) d.full   += r.qtd;
    else          d.envios += r.qtd;
    if (inL7)     d.l7d   += r.qtd;
    // Prefere o título mais longo/descritivo
    if (r.titulo && r.titulo.length > (d.titulo || '').length) d.titulo = r.titulo;

    // Breakdown por anúncio
    if (r.anuncioId) {
      if (!d.anuncios[r.anuncioId]) {
        d.anuncios[r.anuncioId] = { titulo: r.titulo, l30d: 0, l7d: 0, faturamento: 0, full: 0, envios: 0 };
      }
      const a = d.anuncios[r.anuncioId];
      a.l30d        += r.qtd;
      a.faturamento += r.receita;
      if (r.isFull) a.full   += r.qtd;
      else          a.envios += r.qtd;
      if (inL7)     a.l7d   += r.qtd;
      if (r.titulo && r.titulo.length > (a.titulo || '').length) a.titulo = r.titulo;
    }
  }

  return { dict, period };
}

/* ══════════════════════════════════════════════════════════
 * PARSER 2 – Relatório de Estoque Full ML  (stock_general_full)
 *
 * O arquivo ML não tem linha de cabeçalho: dados começam na linha 0.
 * Estrutura fixa detectada empiricamente:
 *   [0]  ID interno (ex: YLZQ36067)
 *   [1]  EAN
 *   [2]  SKU do vendedor  ← chave primária
 *   [3]  MLB ID(s)  (múltiplos separados por " | ")
 *   [4]  MLBU ID (16 dígitos)
 *   [5]  Título do produto
 *   [6]  Tamanho/variante  (só na aba "Resumo")
 *   [7]  Categoria          (só na aba "Resumo")
 *   [8]  Status             (só na aba "Resumo")
 *   [9]  Habilitado Full    (só na aba "Resumo")
 *
 * Colunas numéricas variam conforme aba:
 *   Resumo (29 cols):    aptas=[10], pendente=[14], transfer=[17]
 *   Boa qualidade (13):  aptas=[6],  pendente=[10], transfer=[9]
 *
 * Múltiplas linhas por SKU → agrega somando os valores.
 * ══════════════════════════════════════════════════════════ */

// Detecta se a linha parece um cabeçalho com "sku"
function hasSkuHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (rows[i].some(c => String(c || '').toLowerCase().trim() === 'sku')) return i;
  }
  return -1;
}

// Detecta o layout da aba "Resumo" vs "Boa qualidade"
// Usa nº de colunas + validação de conteúdo (col[8] tem "Ativo"/"Inativo" na aba Resumo)
function detectLayout(rows) {
  const nCols = rows[0]?.length || 0;
  const sample = rows.slice(0, 5);
  // Aba Resumo tem col[8] = status do anúncio ("Ativo" / "Inativo" / "Pausado")
  const hasStatusCol = sample.some(r => {
    const v = String(r[8] || '').toLowerCase();
    return v === 'ativo' || v === 'inativo' || v === 'pausado';
  });
  if (nCols >= 20 || hasStatusCol) {
    // Resumo (29 cols verificado empiricamente no arquivo ML):
    //   col 17 = Aptas para venda, col 14 = Entrada pendente, col 15 = Em transferência
    return { sku: 2, mlb: 3, mlbu: 4, titulo: 5, aptas: 17, pendente: 14, transferencia: 15 };
  } else {
    // Boa qualidade (13 cols): col 9=aptas, col 10=transferência (sem pendente)
    return { sku: 2, mlb: 3, mlbu: 4, titulo: 5, aptas: 9, pendente: -1, transferencia: 10 };
  }
}

function parseEstoqueRaw(sheet) {
  const rows = sheetToRows(sheet);
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim()));
  if (nonEmpty.length < 2) return [];

  // ── Verifica se existe linha de cabeçalho com "sku" ──────
  const hdrIdx = hasSkuHeader(nonEmpty);
  if (hdrIdx >= 0) {
    // Formato com cabeçalho: usa detecção dinâmica de colunas
    return parseEstoqueComCabecalho(nonEmpty, hdrIdx);
  }

  // ── Formato sem cabeçalho (stock_general_full do ML) ─────
  const layout = detectLayout(nonEmpty);

  // Valida: col 2 deve ter valores alfanuméricos curtos (SKU)
  const amostra = nonEmpty.slice(0, 5).map(r => String(r[layout.sku] || '').trim());
  const parecesku = amostra.filter(v => v && v.length > 0 && v.length <= 20).length;
  if (parecesku < 1) return [];

  // Agrega por SKU (múltiplas linhas por SKU → soma estoque)
  const dict = {};
  for (const row of nonEmpty) {
    const sku = String(row[layout.sku] || '').trim();
    if (!sku || sku.toLowerCase().startsWith('total')) continue;

    const mlbRaw   = String(row[layout.mlb] || '');
    const mlbuRaw  = String(row[layout.mlbu] || '');
    const titulo   = String(row[layout.titulo] || '').trim();
    const aptas    = parseNum(row[layout.aptas]);
    const pendente = parseNum(row[layout.pendente]);
    const transf   = parseNum(row[layout.transferencia]);

    // Coleta todos os IDs MLB (da col 3 e MLBU da col 4)
    const ids = parseAnuncioIds(mlbRaw);
    const mlbuId = normalizeAnuncioId(mlbuRaw);
    if (mlbuId && /^\d+$/.test(mlbuId) && !ids.includes(mlbuId)) ids.push(mlbuId);

    if (!dict[sku]) {
      dict[sku] = { sku, titulo: '', produto: '', anuncioIds: [], aptas: 0, pendente: 0, transferencia: 0, byMlb: {} };
    }
    const d = dict[sku];
    d.aptas         += aptas;
    d.pendente      += pendente;
    d.transferencia += transf;
    if (titulo && titulo.length > d.titulo.length) d.titulo = titulo;
    for (const id of ids) {
      if (!d.anuncioIds.includes(id)) d.anuncioIds.push(id);
      // Rastreia estoque por MLB individual
      if (!d.byMlb[id]) d.byMlb[id] = { aptas: 0, pendente: 0, transferencia: 0 };
      d.byMlb[id].aptas         += aptas;
      d.byMlb[id].pendente      += pendente;
      d.byMlb[id].transferencia += transf;
    }
  }

  return Object.values(dict).map(d => ({
    ...d,
    produto: d.titulo || d.sku,
    l30d:        0,
    faturamento: 0,
    naoAptas:    0,
  }));
}

// Fallback para arquivos com cabeçalho "sku" explícito
function parseEstoqueComCabecalho(rows, headerIdx) {
  const hdr = rows[headerIdx];
  const mergedHdr = {};
  for (let r = Math.max(0, headerIdx - 1); r <= Math.min(rows.length - 1, headerIdx + 2); r++) {
    rows[r].forEach((cell, i) => {
      const c = String(cell || '').toLowerCase().trim();
      if (c) mergedHdr[i] = ((mergedHdr[i] || '') + ' ' + c).trim();
    });
  }
  function findCol(...kwds) {
    for (const [idx, label] of Object.entries(mergedHdr)) {
      if (kwds.some(kw => label.includes(kw.toLowerCase()))) return parseInt(idx);
    }
    return -1;
  }
  const skuCol = hdr.findIndex(c => String(c || '').toLowerCase().trim() === 'sku');
  const cols = {
    sku:           skuCol >= 0 ? skuCol : findCol('sku'),
    anuncio:       findCol('anúncio', 'anuncio', 'código ml', 'id do anuncio'),
    titulo:        findCol('produto', 'descri', 'título', 'titulo', 'item'),
    pendente:      findCol('pendente', 'entrada pendente'),
    transferencia: findCol('transfer'),
    aptas:         findCol('aptas para venda', 'aptas'),
  };
  const result = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.length || row.every(c => c === '')) continue;
    const sku = String(row[cols.sku] || '').trim();
    if (!sku || sku.toLowerCase() === 'sku') continue;
    result.push({
      sku,
      anuncioIds:    cols.anuncio >= 0 ? parseAnuncioIds(row[cols.anuncio]) : [],
      produto:       cols.titulo >= 0 ? String(row[cols.titulo] || sku).trim() : sku,
      titulo:        cols.titulo >= 0 ? String(row[cols.titulo] || sku).trim() : sku,
      l30d:          0,
      faturamento:   0,
      pendente:      parseNum(cols.pendente >= 0 ? row[cols.pendente] : 0),
      transferencia: parseNum(cols.transferencia >= 0 ? row[cols.transferencia] : 0),
      aptas:         parseNum(cols.aptas >= 0 ? row[cols.aptas] : 0),
      naoAptas:      0,
    });
  }
  return result;
}

/* ── Pontos de entrada ──────────────────────────────────── */
export async function parseVendasFile(file) {
  const wb    = await readExcelFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const { dict, period } = parseVendasRaw(sheet);
  if (!Object.keys(dict).length) {
    // Tenta detectar se o usuário carregou o arquivo de estoque por engano
    const rows = sheetToRows(sheet);
    const nCols = rows[0]?.length || 0;
    if (nCols >= 10 && rows[0]?.some(c => String(c || '').length > 5 && !/data|status|sku/i.test(String(c)))) {
      throw new Error('Nenhum dado de venda encontrado. Verifique se carregou o relatório de vendas (não o de estoque).');
    }
    throw new Error('Nenhum dado de venda encontrado. Verifique se é o relatório correto.');
  }
  return { data: dict, period };
}

export async function parseEstoqueFile(file) {

  const wb = await readExcelFile(file);

  // Prefere aba "Resumo" (tem todos os itens); fallback para a maior
  const resumoName = wb.SheetNames.find(n => n.toLowerCase().includes('resumo'));
  if (resumoName) {
    const data = parseEstoqueRaw(wb.Sheets[resumoName]);
    if (data.length) return data;
  }

  // Tenta todas as abas e retorna a com mais SKUs
  let best = [];
  for (const name of wb.SheetNames) {
    const data = parseEstoqueRaw(wb.Sheets[name]);
    if (data.length > best.length) best = data;
  }

  if (!best.length) {
    // Detecta se o usuário carregou o arquivo de vendas por engano (tem coluna "status")
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = sheetToRows(firstSheet);
    const hasVendasCols = rows.slice(0, 15).some(r =>
      r.some(c => /estado|status do pedido/i.test(String(c || '')))
    );
    if (hasVendasCols) {
      throw new Error('Nenhum dado de estoque encontrado. Verifique se carregou o relatório de Estoque Full (não o de vendas).');
    }
    throw new Error('Nenhum dado de estoque encontrado. Verifique se é o relatório correto.');
  }
  return best;
}
