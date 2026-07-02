import { describe, it, expect } from 'vitest';

// Testa funções exportadas do parser sem depender do SheetJS
// (as funções de parse de arquivo precisam de File/FileReader — testadas manualmente)

// Importa só as funções puras
import { normalizeAnuncioId, parseAnuncioIds, formatMLBCode } from '../lib/parser.js';

describe('normalizeAnuncioId', () => {
  it('remove prefixo MLB', () => {
    expect(normalizeAnuncioId('MLB123456')).toBe('123456');
  });
  it('remove espaços', () => {
    expect(normalizeAnuncioId('  456789  ')).toBe('456789');
  });
  it('trata valor nulo', () => {
    expect(normalizeAnuncioId(null)).toBe('');
  });
});

describe('parseAnuncioIds', () => {
  it('divide por pipe', () => {
    expect(parseAnuncioIds('1234567 | 7654321')).toEqual(['1234567', '7654321']);
  });
  it('remove prefixo MLB antes de validar', () => {
    expect(parseAnuncioIds('MLB1234567')).toEqual(['1234567']);
  });
  it('filtra IDs inválidos (< 6 dígitos)', () => {
    expect(parseAnuncioIds('123 | 1234567')).toEqual(['1234567']);
  });
  it('retorna array vazio para vazio', () => {
    expect(parseAnuncioIds('')).toEqual([]);
  });
});

describe('formatMLBCode', () => {
  it('adiciona prefixo MLB para IDs ≤ 12 dígitos', () => {
    expect(formatMLBCode('4758926507')).toBe('MLB4758926507');
  });
  it('não adiciona prefixo para IDs > 12 dígitos (MLBU)', () => {
    expect(formatMLBCode('1466726059481981')).toBe('1466726059481981');
  });
  it('não duplica MLB se já tem prefixo', () => {
    expect(formatMLBCode('MLB4758926507')).toBe('MLB4758926507');
  });
});
