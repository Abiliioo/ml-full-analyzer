import * as XLSX from 'xlsx';

export function exportProvisaoXlsx(items, filename = 'provisao_full.xlsx') {
  const header = [
    '# Anúncio', 'SKU', 'Produto', 'Curva',
    'Envio Sugerido', 'Situação', 'Cobertura (d)', 'Estoque Total',
    'L30D', 'L7D', 'Faturamento 30d',
  ];

  const rows = items.map(i => [
    i.anuncio,
    i.sku,
    i.titulo,
    i.curva,
    i.envio,
    i.situacao,
    i.cobertura >= 999 ? '∞' : i.cobertura,
    i.total,
    i.l30d,
    i.l7d,
    i.faturamento,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Largura de colunas
  ws['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 7 },
    { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 },
    { wch: 8  }, { wch: 8  }, { wch: 16  },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Provisão Full');
  XLSX.writeFile(wb, filename);
}

export function exportAnunciosXlsx(items, sheetName = 'Análise Full', filename = 'analise_full.xlsx') {
  const header = [
    '# Anúncio', 'SKU', 'Produto', 'Segmento', 'Curva',
    'L30D', 'L7D', 'Full', 'Envios', 'Faturamento 30d',
    'Cobertura (d)', 'Estoque Total', 'Envio Sugerido', 'Situação',
  ];

  const rows = items.map(i => [
    i.anuncio, i.sku, i.titulo, i.segmento, i.curva,
    i.l30d, i.l7d, i.full, i.envios, i.faturamento,
    i.cobertura >= 999 ? '∞' : i.cobertura, i.total, i.envio, i.situacao || '',
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 11 }, { wch: 7 },
    { wch: 8 },  { wch: 8 },  { wch: 8 },  { wch: 8 },  { wch: 16 },
    { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
