import { describe, it, expect } from 'vitest';
import { fmtCobertura, cobClass, cobWidth, fmtTendencia } from '../lib/formatters.js';

describe('fmtCobertura', () => {
  it('retorna "0d" para zero', () => expect(fmtCobertura(0)).toBe('0d'));
  it('retorna "∞" para >= 999', () => expect(fmtCobertura(999)).toBe('∞'));
  it('retorna valor com "d"', () => expect(fmtCobertura(25)).toBe('25d'));
});

describe('cobClass', () => {
  it('cob-low para < 15', () => expect(cobClass(10)).toBe('cob-low'));
  it('cob-mid para 15–29', () => expect(cobClass(20)).toBe('cob-mid'));
  it('cob-ok para 30–59', () => expect(cobClass(45)).toBe('cob-ok'));
  it('cob-high para >= 60', () => expect(cobClass(90)).toBe('cob-high'));
  it('cob-high para 0 (ruptura)', () => expect(cobClass(0)).toBe('cob-high'));
});

describe('cobWidth', () => {
  it('retorna 100 para >= 999', () => expect(cobWidth(999)).toBe(100));
  it('retorna 50 para 30 dias (50% de 60)', () => expect(cobWidth(30)).toBe(50));
  it('limita em 100', () => expect(cobWidth(120)).toBe(100));
});

describe('fmtTendencia', () => {
  it('retorna null para undefined', () => expect(fmtTendencia(undefined)).toBeNull());
  it('seta trend-up para > 20%', () => {
    const r = fmtTendencia(0.5);
    expect(r.cls).toBe('trend-up');
    expect(r.txt).toContain('▲');
  });
  it('seta trend-down para < -20%', () => {
    const r = fmtTendencia(-0.5);
    expect(r.cls).toBe('trend-down');
    expect(r.txt).toContain('▼');
  });
  it('seta trend-neutral para -20% a +20%', () => {
    const r = fmtTendencia(0.1);
    expect(r.cls).toBe('trend-neutral');
    expect(r.txt).toContain('→');
  });
});
