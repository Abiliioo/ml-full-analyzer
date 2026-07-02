import React, { useState, useMemo, useCallback } from 'react';
import { fmtMoedaK, fmtNum, fmtCobertura } from '../lib/formatters.js';
import { deleteSnapshot, renameSnapshot, compareToSnapshot, diffKpi } from '../lib/snapshots.js';

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function Delta({ value, unit = '', invertColor = false }) {
  if (value === null || value === undefined) return <span className="delta-neutral">—</span>;
  if (value === 0) return <span className="delta-neutral">={unit}</span>;
  const pos = value > 0;
  const good = invertColor ? !pos : pos;
  const cls  = good ? 'delta-pos' : 'delta-neg';
  return <span className={cls}>{pos ? '+' : ''}{value}{unit}</span>;
}

function DeltaCob({ value }) {
  if (value === null || value === undefined) return <span className="delta-neutral">—</span>;
  if (value === 0) return <span className="delta-neutral">=</span>;
  // cobertura: positivo = melhorou (mais dias), negativo = piorou
  const cls = value > 0 ? 'delta-pos' : 'delta-neg';
  return <span className={cls}>{value > 0 ? '+' : ''}{value}d</span>;
}

const TYPE_LABEL = {
  piorou:   { label: 'Piorou',   cls: 'type-piorou' },
  melhorou: { label: 'Melhorou', cls: 'type-melhorou' },
  novo:     { label: 'Novo',     cls: 'type-novo' },
  saiu:     { label: 'Saiu',     cls: 'type-saiu' },
  igual:    { label: 'Igual',    cls: 'type-igual' },
};

const SIT_CLS = {
  'Ruptura':       'badge--ruptura',
  'Repor estoque': 'badge--repor',
  'Controlado':    'badge--controlado',
  'Margem':        'badge--margem',
  'Estoque acima': 'badge--excesso',
  'Excesso':       'badge--excesso',
  'Sem movimento': 'badge--sem-mov',
};

function SitBadge({ sit }) {
  if (!sit) return <span className="delta-neutral">—</span>;
  return <span className={`badge ${SIT_CLS[sit] || ''}`}>{sit}</span>;
}

/* ── Snapshot card ───────────────────────────────────────── */
function SnapCard({ snap, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(snap.label || '');

  function submitRename() {
    onRename(snap.id, draft.trim() || null);
    setEditing(false);
  }

  return (
    <div className={`snap-card ${active ? 'snap-card--active' : ''}`} onClick={() => onSelect(snap.id)}>
      <div className="snap-card__top">
        <div className="snap-card__meta">
          {editing ? (
            <input
              className="snap-label-input"
              value={draft}
              autoFocus
              onClick={e => e.stopPropagation()}
              onChange={e => setDraft(e.target.value)}
              onBlur={submitRename}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditing(false); }}
            />
          ) : (
            <span
              className="snap-card__label"
              onClick={e => { e.stopPropagation(); setEditing(true); setDraft(snap.label || ''); }}
              title="Clique para renomear"
            >
              {snap.label || fmtDate(snap.date)}
            </span>
          )}
          {snap.label && <span className="snap-card__date">{fmtDate(snap.date)}</span>}
        </div>
        <button
          className="snap-card__del"
          onClick={e => { e.stopPropagation(); onDelete(snap.id); }}
          title="Excluir"
        >×</button>
      </div>
      <div className="snap-card__kpis">
        <span className="snap-kpi"><strong>{snap.kpi.totalFull}</strong> SKUs</span>
        <span className={`snap-kpi ${snap.kpi.ruptura > 0 ? 'snap-kpi--ruptura' : ''}`}>
          <strong>{snap.kpi.ruptura}</strong> rupt.
        </span>
        <span className="snap-kpi"><strong>{snap.kpi.cobMedia}d</strong> cob.</span>
        <span className="snap-kpi"><strong>{fmtMoedaK(snap.kpi.fat)}</strong></span>
      </div>
      {snap.vendasFilename && (
        <div className="snap-card__files" title={snap.vendasFilename}>
          📄 {snap.vendasFilename.slice(0, 30)}{snap.vendasFilename.length > 30 ? '…' : ''}
        </div>
      )}
    </div>
  );
}

/* ── KPI diff summary ────────────────────────────────────── */
function DiffSummary({ kpi }) {
  const { curr, prev } = kpi;
  return (
    <div className="diff-summary">
      <div className="diff-kpi-card">
        <span className="diff-kpi-label">Rupturas</span>
        <span className="diff-kpi-values">
          <span className="diff-kpi-prev">{prev.ruptura}</span>
          <span className="diff-kpi-arrow">→</span>
          <span className="diff-kpi-curr">{curr.ruptura}</span>
        </span>
        <Delta value={curr.ruptura - prev.ruptura} invertColor />
      </div>
      <div className="diff-kpi-card">
        <span className="diff-kpi-label">Repor estoque</span>
        <span className="diff-kpi-values">
          <span className="diff-kpi-prev">{prev.repor}</span>
          <span className="diff-kpi-arrow">→</span>
          <span className="diff-kpi-curr">{curr.repor}</span>
        </span>
        <Delta value={curr.repor - prev.repor} invertColor />
      </div>
      <div className="diff-kpi-card">
        <span className="diff-kpi-label">Cobertura média</span>
        <span className="diff-kpi-values">
          <span className="diff-kpi-prev">{prev.cobMedia}d</span>
          <span className="diff-kpi-arrow">→</span>
          <span className="diff-kpi-curr">{curr.cobMedia}d</span>
        </span>
        <DeltaCob value={curr.cobMedia - prev.cobMedia} />
      </div>
      <div className="diff-kpi-card">
        <span className="diff-kpi-label">Envio sugerido</span>
        <span className="diff-kpi-values">
          <span className="diff-kpi-prev">{fmtNum(prev.totalEnvio)}</span>
          <span className="diff-kpi-arrow">→</span>
          <span className="diff-kpi-curr">{fmtNum(curr.totalEnvio)}</span>
        </span>
        <Delta value={curr.totalEnvio - prev.totalEnvio} invertColor />
      </div>
    </div>
  );
}

/* ── Comparison table ────────────────────────────────────── */
const FILTER_OPTS = [
  { value: '',         label: 'Todos' },
  { value: 'piorou',   label: 'Pioraram' },
  { value: 'melhorou', label: 'Melhoraram' },
  { value: 'novo',     label: 'Novos' },
  { value: 'saiu',     label: 'Saíram' },
  { value: 'igual',    label: 'Sem mudança' },
];

function ComparisonPanel({ changes, snapDate }) {
  const [filter, setFilter] = useState('');

  const counts = useMemo(() => {
    const c = {};
    for (const ch of changes) c[ch.type] = (c[ch.type] || 0) + 1;
    return c;
  }, [changes]);

  const visible = useMemo(
    () => filter ? changes.filter(c => c.type === filter) : changes,
    [changes, filter]
  );

  return (
    <div className="diff-panel">
      <div className="diff-panel__toolbar">
        <div className="chip-group">
          {FILTER_OPTS.map(opt => (
            <button
              key={opt.value}
              className={`filter-chip diff-chip--${opt.value || 'all'} ${filter === opt.value ? 'filter-chip--active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              <span className="chip-count">{opt.value ? (counts[opt.value] || 0) : changes.length}</span>
            </button>
          ))}
        </div>
        <span className="table-info">{visible.length} exibidos</span>
      </div>

      <div className="table-wrap">
        <table className="data-table diff-table">
          <thead>
            <tr>
              <th className="col-sku">SKU</th>
              <th className="col-desc">Produto</th>
              <th className="num">Curva</th>
              <th>Mudança</th>
              <th>Situação anterior</th>
              <th>Situação atual</th>
              <th className="num">Δ Cobertura</th>
              <th className="num">Δ Envio</th>
              <th className="num">Cob. atual</th>
              <th className="num">Estoque atual</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(ch => {
              const { label: tLabel, cls: tCls } = TYPE_LABEL[ch.type] || {};
              return (
                <tr key={ch.sku} className={`diff-row diff-row--${ch.type}`}>
                  <td><span className="sku-code">{ch.sku}</span></td>
                  <td className="col-desc">{ch.titulo}</td>
                  <td className="num">
                    <span className={`badge badge--curva-${(ch.curva || 'c').toLowerCase()}`}>{ch.curva || '—'}</span>
                  </td>
                  <td><span className={`type-badge ${tCls}`}>{tLabel}</span></td>
                  <td><SitBadge sit={ch.prev?.situacao} /></td>
                  <td><SitBadge sit={ch.curr?.situacao} /></td>
                  <td className="num"><DeltaCob value={ch.deltaCob} /></td>
                  <td className="num"><Delta value={ch.deltaEnvio} invertColor /></td>
                  <td className="num">
                    {ch.curr ? fmtCobertura(ch.curr.cobertura) : <span className="delta-neutral">—</span>}
                  </td>
                  <td className="num">
                    {ch.curr ? fmtNum(ch.curr.total) : <span className="delta-neutral">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * HistoricoTab
 * ═══════════════════════════════════════════════════════════ */
export default function HistoricoTab({ snapshots, analise, onSnapshotsChange }) {
  const [activeId, setActiveId] = useState(null);

  const activeSnap = snapshots.find(s => s.id === activeId) || null;

  const changes = useMemo(
    () => activeSnap ? compareToSnapshot(analise, activeSnap) : [],
    [analise, activeSnap]
  );

  const kpiDiff = useMemo(
    () => activeSnap ? diffKpi(analise, activeSnap) : null,
    [analise, activeSnap]
  );

  const handleDelete = useCallback((id) => {
    deleteSnapshot(id);
    if (activeId === id) setActiveId(null);
    onSnapshotsChange();
  }, [activeId, onSnapshotsChange]);

  const handleRename = useCallback((id, label) => {
    renameSnapshot(id, label);
    onSnapshotsChange();
  }, [onSnapshotsChange]);

  if (snapshots.length === 0) {
    return (
      <div className="hist-empty">
        <div style={{ fontSize: 40 }}>📸</div>
        <h3>Nenhum snapshot salvo</h3>
        <p>
          Clique em <strong>Salvar análise</strong> para guardar o estado atual.<br />
          A ferramenta compara automaticamente com análises anteriores.
        </p>
      </div>
    );
  }

  return (
    <div className="hist-layout">
      {/* ── Lista de snapshots ── */}
      <div className="hist-sidebar">
        <div className="hist-sidebar__title">Análises salvas</div>
        <div className="snap-list">
          {snapshots.map(snap => (
            <SnapCard
              key={snap.id}
              snap={snap}
              active={snap.id === activeId}
              onSelect={id => setActiveId(prev => prev === id ? null : id)}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
      </div>

      {/* ── Painel de comparação ── */}
      <div className="hist-main">
        {!activeSnap ? (
          <div className="diff-placeholder">
            <div style={{ fontSize: 32 }}>↩</div>
            <p>Selecione uma análise para comparar com a análise atual</p>
          </div>
        ) : (
          <>
            <div className="diff-header">
              <span className="diff-header__title">
                Atual vs <strong>{activeSnap.label || fmtDate(activeSnap.date)}</strong>
              </span>
              <span className="diff-header__meta">
                {activeSnap.kpi.totalFull} SKUs · {fmtDate(activeSnap.date)}
              </span>
            </div>
            <DiffSummary kpi={kpiDiff} />
            <ComparisonPanel changes={changes} snapDate={activeSnap.date} />
          </>
        )}
      </div>
    </div>
  );
}
