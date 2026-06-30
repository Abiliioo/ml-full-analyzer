import React, { useState, useEffect, useMemo } from 'react';
import { fmtMoeda, fmtNum, fmtCobertura, isoDate } from '../lib/formatters.js';
import { formatMLBCode } from '../lib/parser.js';
import { exportProvisaoXlsx } from '../lib/exportXlsx.js';

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  function copy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setOk(true);
      setTimeout(() => setOk(false), 1400);
    });
  }
  return (
    <button className={`btn-copy btn-copy--inline ${ok ? 'btn-copy--ok' : ''}`} onClick={copy} title={`Copiar ${text}`}>
      {ok ? '✓' : '⧉'}
    </button>
  );
}

function CurvaBadge({ curva }) {
  return <span className={`badge badge--curva-${curva?.toLowerCase()}`}>{curva}</span>;
}

function SitBadge({ sit }) {
  const map = {
    'Ruptura':       'badge--ruptura',
    'Repor estoque': 'badge--repor',
    'Controlado':    'badge--controlado',
    'Margem':        'badge--margem',
    'Estoque acima': 'badge--excesso',
    'Excesso':       'badge--excesso',
    'Sem movimento': 'badge--sem-mov',
  };
  if (!sit) return null;
  return <span className={`badge ${map[sit] || ''}`}>{sit}</span>;
}

const SIT_OPTS = [
  { value: '',               label: 'Todas' },
  { value: 'Ruptura',        label: 'Ruptura',    cls: 'filter-chip--ruptura' },
  { value: 'Repor estoque',  label: 'Repor',      cls: 'filter-chip--repor' },
  { value: 'Controlado',     label: 'Controlado', cls: 'filter-chip--controlado' },
  { value: 'Margem',         label: 'Margem',     cls: 'filter-chip--margem' },
];

export default function ProvisaoTab({ items, allFull, selectedKeys, onToggleKey }) {
  // Seleção local: começa com todos marcados; reseta quando a lista de items mudar
  const [checked, setChecked] = useState(() => new Set(items.map(i => i.key)));
  const [sitFilter, setSitFilter] = useState('');

  useEffect(() => {
    setChecked(new Set(items.map(i => i.key)));
  }, [items]);

  function toggleChecked(key) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!sitFilter) return items;
    return items.filter(i => i.situacao === sitFilter);
  }, [items, sitFilter]);

  const exportItems = filtered.filter(i => checked.has(i.key));
  const totalEnvio  = exportItems.reduce((s, i) => s + i.envio, 0);
  const totalFat    = exportItems.reduce((s, i) => s + i.faturamento, 0);

  function handleExport() {
    exportProvisaoXlsx(exportItems, `provisao_full_${isoDate()}.xlsx`);
  }

  if (items.length === 0) {
    return (
      <div className="provisao-empty">
        <h3>Provisão vazia</h3>
        <p>
          Itens com envio sugerido aparecem aqui automaticamente.<br />
          Na aba <strong>No Full</strong> você pode marcar anúncios manualmente.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="table-card">
        {/* ── Toolbar ── */}
        <div className="table-toolbar">
          <div className="table-toolbar__left">
            <span className="table-info">
              <strong>{exportItems.length}</strong> selecionados ·{' '}
              <strong>{fmtNum(totalEnvio)}</strong> un ·{' '}
              {fmtMoeda(totalFat)}/mês
            </span>
            <div className="filter-divider" />
            <div className="chip-group">
              <span className="chip-group__label">Situação</span>
              {SIT_OPTS.map(opt => (
                <button
                  key={opt.value}
                  className={`filter-chip ${opt.cls || ''} ${sitFilter === opt.value ? 'filter-chip--active' : ''}`}
                  onClick={() => setSitFilter(opt.value)}
                >
                  {opt.label}
                  {opt.value && (
                    <span style={{ marginLeft: 4, opacity: .7 }}>
                      {items.filter(i => i.situacao === opt.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="table-toolbar__right">
            <button className="btn btn--primary" onClick={handleExport}>⬇ Exportar XLSX</button>
          </div>
        </div>

        {/* ── Tabela ── */}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check">✓</th>
                <th className="col-sku">SKU / MLB</th>
                <th className="col-desc">Produto</th>
                <th className="num">Curva</th>
                <th>Situação</th>
                <th className="col-cob">Cobertura</th>
                <th className="num">Enviar</th>
                <th className="num">L30D</th>
                <th className="num">Atual</th>
                <th className="num">Pend.</th>
                <th className="num">Fat. 30d</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isChecked = checked.has(item.key);
                return (
                  <React.Fragment key={item.key}>
                    {/* ── Linha SKU ── */}
                    <tr
                      className={`prov-sku-row ${isChecked ? 'row-sel' : 'row-desel'}`}
                      onClick={() => toggleChecked(item.key)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="row-check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChecked(item.key)}
                        />
                      </td>
                      <td>
                        <span className="sku-code">{item.sku}</span>
                      </td>
                      <td className="col-desc" style={{ color: 'var(--text)', fontWeight: 600 }}>
                        {item.titulo}
                      </td>
                      <td className="num"><CurvaBadge curva={item.curva} /></td>
                      <td><SitBadge sit={item.situacao} /></td>
                      <td className="col-cob">
                        <span className="cob-val">{fmtCobertura(item.cobertura)}</span>
                      </td>
                      <td className="num">
                        {item.envio > 0
                          ? <span className="envio-badge">{fmtNum(item.envio)}</span>
                          : <span style={{ color: 'var(--text-dim)' }}>–</span>}
                      </td>
                      <td className="num">{fmtNum(item.l30d)}</td>
                      <td className="num">{fmtNum(item.atual)}</td>
                      <td className="num">
                        {item.pendente > 0
                          ? <span className="stock-pend">+{fmtNum(item.pendente)}</span>
                          : '–'}
                      </td>
                      <td className="num">{fmtMoeda(item.faturamento)}</td>
                    </tr>

                    {/* ── Sub-linhas MLB ── */}
                    {(item.anuncios || []).filter(a => a.isFullMlb).map(a => (
                      <tr key={a.id} className={`sub-row prov-mlb-row ${isChecked ? '' : 'row-desel'}`}>
                        <td className="sub-row__line" />
                        <td>
                          <span className="mlb-pill">
                            <span className="mlb-pill__id">{formatMLBCode(a.id)}</span>
                            <CopyBtn text={a.id} />
                          </span>
                        </td>
                        <td className="col-desc sub-row__num">
                          {a.full   > 0 && <span className="sub-badge sub-badge--full" style={{ marginRight: 5 }}>⚡ Full {fmtNum(a.full)}</span>}
                          {a.envios > 0 && <span className="sub-badge sub-badge--env"  style={{ marginRight: 5 }}>Envios {fmtNum(a.envios)}</span>}
                        </td>
                        <td />{/* curva */}
                        <td><SitBadge sit={a.situacao} /></td>
                        <td className="col-cob">
                          {a.cobertura != null
                            ? <span className="cob-val">{fmtCobertura(a.cobertura)}</span>
                            : null}
                        </td>
                        <td className="num">
                          {a.envio > 0
                            ? <span className="envio-badge">{fmtNum(a.envio)}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>–</span>}
                        </td>
                        <td className="num sub-row__num">{fmtNum(a.l30d)}</td>
                        <td className="num sub-row__num">{fmtNum(a.aptas)}</td>
                        <td className="num sub-row__num">
                          {a.pendente > 0
                            ? <span className="stock-pend">+{fmtNum(a.pendente)}</span>
                            : '–'}
                        </td>
                        <td className="num sub-row__num">{fmtMoeda(a.faturamento)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td /><td colSpan={5}>Total ({exportItems.length} SKUs selecionados)</td>
                <td className="num">{fmtNum(totalEnvio)}</td>
                <td /><td /><td />
                <td className="num">{fmtMoeda(totalFat)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
