import React from 'react';
import { fmtMoeda, fmtNum, fmtCobertura } from '../lib/formatters.js';

function SitBadge({ sit }) {
  const map = {
    'Ruptura':       'badge--ruptura',
    'Repor estoque': 'badge--repor',
    'OK':            'badge--ok',
    'Excesso':       'badge--excesso',
    'Sem movimento': 'badge--sem-mov',
  };
  return <span className={`badge ${map[sit] || ''}`}>{sit}</span>;
}

function BarRow({ label, count, total, fatStr, barClass }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <div className="stat-row__bar-bg">
        <div className={`stat-row__bar ${barClass}`} style={{ width: pct + '%' }} />
      </div>
      <span className="stat-row__count">{count}</span>
      {fatStr != null && <span className="stat-row__fat">{fatStr}</span>}
    </div>
  );
}

export default function VisaoGeral({ fullItems, aspiranteItems, analise }) {
  const urgentes = [...fullItems]
    .filter(i => i.situacao === 'Ruptura' || i.situacao === 'Repor estoque')
    .sort((a, b) => {
      if (a.situacao === 'Ruptura' && b.situacao !== 'Ruptura') return -1;
      if (b.situacao === 'Ruptura' && a.situacao !== 'Ruptura') return 1;
      return a.cobertura - b.cobertura;
    });

  const sitCounts = {};
  for (const i of fullItems) sitCounts[i.situacao] = (sitCounts[i.situacao] || 0) + 1;
  const curvaCounts = {};
  const curvaFat = {};
  for (const i of analise) {
    curvaCounts[i.curva] = (curvaCounts[i.curva] || 0) + 1;
    curvaFat[i.curva]    = (curvaFat[i.curva] || 0) + i.faturamento;
  }

  const totalFull    = fullItems.length;
  const totalAnalise = analise.length;
  const cobMedia     = fullItems.length > 0
    ? Math.round(fullItems.filter(i => i.cobertura < 999).reduce((s, i) => s + i.cobertura, 0) /
        fullItems.filter(i => i.cobertura < 999).length)
    : 0;

  return (
    <div className="overview-grid">
      {/* Plano de Ação */}
      <div className="action-panel">
        <div className="action-panel__header">
          <span className="action-panel__title">🚨 Plano de Ação</span>
          <span className="action-panel__count">{urgentes.length} itens</span>
        </div>
        <div className="action-list">
          {urgentes.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32 }}>✅</div>
              <p>Nenhuma ação urgente!</p>
            </div>
          ) : urgentes.map(item => (
            <div key={item.key} className="action-item">
              <div className="action-item__sit">
                <SitBadge sit={item.situacao} />
              </div>
              <div className="action-item__info">
                <div className="action-item__code">{item.anuncio}</div>
                <div className="action-item__name">{item.titulo}</div>
                <div className="action-item__meta">
                  <span className={`badge badge--curva-${item.curva?.toLowerCase()}`}>{item.curva}</span>
                  {' '}
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {fmtMoeda(item.faturamento)}/mês
                  </span>
                </div>
              </div>
              <div className="action-item__envio">
                <div className="action-item__qty">
                  {item.envio > 0 ? fmtNum(item.envio) : fmtCobertura(item.cobertura)}
                </div>
                <div className="action-item__unit">
                  {item.envio > 0 ? 'un.' : 'cobert.'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-panel">
        <div className="stat-card">
          <div className="stat-card__title">Situação do Estoque Full</div>
          <BarRow label="Ruptura"       count={sitCounts['Ruptura']||0}       total={totalFull} barClass="bar--ruptura" fatStr={null} />
          <BarRow label="Repor estoque" count={sitCounts['Repor estoque']||0} total={totalFull} barClass="bar--repor"   fatStr={null} />
          <BarRow label="OK"            count={sitCounts['OK']||0}            total={totalFull} barClass="bar--ok"      fatStr={null} />
          <BarRow label="Excesso"       count={sitCounts['Excesso']||0}       total={totalFull} barClass="bar--excesso" fatStr={null} />
          <BarRow label="Sem movimento" count={sitCounts['Sem movimento']||0} total={totalFull} barClass="bar--sem"     fatStr={null} />
        </div>

        <div className="stat-card">
          <div className="stat-card__title">Curva ABC (por faturamento)</div>
          <BarRow label="Curva A (top 80%)" count={curvaCounts['A']||0} total={totalAnalise} barClass="bar--a" fatStr={fmtMoeda(curvaFat['A']||0)} />
          <BarRow label="Curva B (80–95%)"  count={curvaCounts['B']||0} total={totalAnalise} barClass="bar--b" fatStr={fmtMoeda(curvaFat['B']||0)} />
          <BarRow label="Curva C (resto)"   count={curvaCounts['C']||0} total={totalAnalise} barClass="bar--c" fatStr={fmtMoeda(curvaFat['C']||0)} />
        </div>

        <div className="stat-card">
          <div className="stat-card__title">Resumo Geral</div>
          <div className="stat-row">
            <span className="stat-row__label">Cobertura média (Full)</span>
            <div className="stat-row__bar-bg">
              <div className="stat-row__bar bar--ok" style={{ width: Math.min(cobMedia / 60 * 100, 100) + '%' }} />
            </div>
            <span className="stat-row__count">{cobMedia}d</span>
          </div>
          <BarRow label="Aspirantes"  count={aspiranteItems.length} total={totalAnalise} barClass="bar--purple" fatStr={null} />
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <div>Total de anúncios: <strong style={{ color: 'var(--text)' }}>{totalAnalise}</strong></div>
            <div>No Full: <strong style={{ color: 'var(--text)' }}>{totalFull}</strong> · Fora do Full: <strong style={{ color: 'var(--text)' }}>{aspiranteItems.length}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
