const _moeda  = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const _num    = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const fmtMoeda  = v => _moeda.format(v || 0);
export const fmtNum    = v => _num.format(v || 0);

export function fmtMoedaK(v) {
  v = v || 0;
  if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (v >= 1_000)     return 'R$ ' + Math.round(v / 1_000) + 'k';
  return _moeda.format(v);
}

export function fmtUnidK(v) {
  v = v || 0;
  if (v >= 1_000) return _num.format(v / 1_000) + 'k';
  return String(v);
}

export function fmtCobertura(cob) {
  if (cob === 0)   return '0d';
  if (cob >= 999)  return '∞';
  return cob + 'd';
}

export function cobClass(cob) {
  if (cob <= 0 || cob >= 999) return 'cob-high';
  if (cob < 15)  return 'cob-low';
  if (cob < 30)  return 'cob-mid';
  if (cob < 60)  return 'cob-ok';
  return 'cob-high';
}

export function cobWidth(cob) {
  if (cob >= 999) return 100;
  return Math.min(Math.round(cob / 60 * 100), 100);
}

export function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formata tendência (variação % L7D vs L30D).
 * Retorna { txt, cls } para renderizar um badge colorido.
 */
export function fmtTendencia(t) {
  if (t === null || t === undefined || isNaN(t)) return null;
  const pct = Math.round(t * 100);
  if (t > 0.2)  return { txt: `▲ +${pct}%`, cls: 'trend-up' };
  if (t < -0.2) return { txt: `▼ ${pct}%`,  cls: 'trend-down' };
  return               { txt: `→ ${pct > 0 ? '+' : ''}${pct}%`, cls: 'trend-neutral' };
}

export const fmtPct = v => Math.round((v || 0) * 100) + '%';
