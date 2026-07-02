import { describe, it, expect } from 'vitest';
import { calcularAnalise } from '../lib/analise.js';

const mkEst = (sku, aptas, pendente = 0, transf = 0) => ({
  sku, produto: sku, titulo: sku,
  aptas, pendente, transferencia: transf,
  anuncioIds: [], byMlb: {}, l30d: 0, faturamento: 0, naoAptas: 0,
});

const mkVenda = (l30d, l7d, faturamento = l30d * 10) => ({
  titulo: 'Produto Teste', l30d, l7d, faturamento, full: l30d, envios: 0, anuncios: {},
});

describe('calcularAnalise', () => {
  it('retorna lista vazia quando sem dados', () => {
    expect(calcularAnalise([], {})).toEqual([]);
  });

  it('classifica ruptura quando estoque zero e há demanda', () => {
    const result = calcularAnalise(
      [mkEst('SKU01', 0)],
      { 'SKU01': mkVenda(30, 7) }
    );
    expect(result[0].situacao).toBe('Ruptura');
    expect(result[0].rupturaPct).toBe(1);
  });

  it('classifica sem movimento quando sem vendas e sem estoque', () => {
    const result = calcularAnalise([mkEst('SKU02', 0)], {});
    expect(result[0].situacao).toBe('Sem movimento');
  });

  it('classifica excesso quando tem estoque mas sem demanda', () => {
    const result = calcularAnalise([mkEst('SKU03', 100)], {});
    expect(result[0].situacao).toBe('Excesso');
  });

  it('calcula cobertura corretamente', () => {
    // taxa = L7D/7 = 7/7 = 1 un/dia; total = 30; cobertura = 30d
    const result = calcularAnalise(
      [mkEst('SKU04', 30)],
      { 'SKU04': mkVenda(30, 7) }
    );
    expect(result[0].cobertura).toBe(30);
  });

  it('calcula projeção com 39 dias', () => {
    // mediaL7D = 7/7 = 1; projecao = ceil(1 * 39) = 39
    const result = calcularAnalise(
      [mkEst('SKU05', 50)],
      { 'SKU05': mkVenda(30, 7) }
    );
    expect(result[0].projecao).toBe(39);
  });

  it('curva ABC: top SKU (< 80% acumulado) é A; próximo (80–95%) é B', () => {
    // S1 = 69% do faturamento → A; S2 = 89% acumulado → B; demais → C
    const est = ['S1','S2','S3','S4'].map(s => mkEst(s, 10));
    const vendas = {
      'S1': mkVenda(10, 3, 7000),
      'S2': mkVenda(10, 3, 2000),
      'S3': mkVenda(10, 3, 500),
      'S4': mkVenda(10, 3, 100),
    };
    const result = calcularAnalise(est, vendas);
    expect(result.find(r => r.sku === 'S1').curva).toBe('A');
    expect(result.find(r => r.sku === 'S2').curva).toBe('B');
    expect(result.find(r => r.sku === 'S4').curva).toBe('C');
  });

  it('aspiring viável recebe envio sugerido > 0', () => {
    // Aspirante (só nas vendas, não no estoque) com L30D >= 10
    const result = calcularAnalise([], { 'SKU_ASP': mkVenda(30, 7, 600) });
    const asp = result[0];
    expect(asp.segmento).toBe('aspirante');
    expect(asp.viavel).toBe(true);
    expect(asp.envio).toBeGreaterThan(0);
  });

  it('tendência nula para produto com volume < 0.1/dia', () => {
    // L30D = 0, L7D = 0 → tendencia null
    const result = calcularAnalise(
      [mkEst('SKU_LOW', 5)],
      { 'SKU_LOW': mkVenda(0, 0, 0) }
    );
    expect(result[0].tendencia).toBeNull();
  });
});
