import React, { useState, useMemo } from 'react';
import { fmtMoeda, fmtNum, fmtCobertura, cobClass, cobWidth, fmtTendencia } from '../lib/formatters.js';
import { formatMLBCode } from '../lib/parser.js';

/* ── Copy button ─────────────────────────────────────────── */
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
    <button className={`btn-copy ${ok ? 'btn-copy--ok' : ''}`} onClick={copy} title={`Copiar ${text}`}>
      {ok ? '✓' : '⧉'}
    </button>
  );
}

/* ── MLB pill (badge sólido) ─────────────────────────────── */
function MLBPill({ id }) {
  const display = formatMLBCode(id);
  return (
    <span className="mlb-pill">
      <span className="mlb-pill__id">{display}</span>
      <CopyBtn text={id} />
    </span>
  );
}

/* ── Cobertura bar ───────────────────────────────────────── */
function CobBar({ cob, riscoAtual, rupturaPct }) {
  const cls = cobClass(cob);
  const pct = cobWidth(cob);
  const txt = fmtCobertura(cob);
  return (
    <div className="cob-wrap">
      <div className="cob-track">
        <div className={`cob-fill cob-fill--${cls.replace('cob-', '')}`} style={{ width: pct + '%' }} />
      </div>
      <span className={`cob-val cob-val--${cls.replace('cob-', '')}`}>{txt}</span>
      {rupturaPct > 0.1 && riscoAtual !== cob && (
        <span className="risco-warn" title={`Estoque atual cobre apenas ${fmtCobertura(riscoAtual)} sem reposição`}>
          ⚠ {fmtCobertura(riscoAtual)}
        </span>
      )}
    </div>
  );
}

/* ── Tendência badge ─────────────────────────────────────── */
function TendenciaBadge({ tendencia }) {
  const t = fmtTendencia(tendencia);
  if (!t) return <span className="trend-neutral">—</span>;
  return <span className={t.cls}>{t.txt}</span>;
}

/* ── Badges ──────────────────────────────────────────────── */
const SIT_MAP = {
  'Ruptura':       'badge--ruptura',
  'Repor estoque': 'badge--repor',
  'Controlado':    'badge--controlado',
  'Margem':        'badge--margem',
  'Estoque acima': 'badge--excesso',
  'Excesso':       'badge--excesso',
  'Sem movimento': 'badge--sem-mov',
};

function SitBadge({ sit }) {
  if (!sit) return null;
  return <span className={`badge ${SIT_MAP[sit] || ''}`}>{sit}</span>;
}

function CurvaBadge({ curva }) {
  return <span className={`badge badge--curva-${String(curva).toLowerCase()}`}>{curva}</span>;
}

function EnvioBadge({ envio }) {
  if (!envio) return <span className="envio-badge envio-badge--zero">–</span>;
  return <span className="envio-badge">{fmtNum(envio)}</span>;
}

/* ── Filters ─────────────────────────────────────────────── */
function applyFilters(items, filters) {
  let list = items;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(i =>
      (i.sku || '').toLowerCase().includes(q) ||
      (i.titulo || '').toLowerCase().includes(q) ||
      i.anuncios?.some(a => a.id?.includes(q))
    );
  }
  if (filters.situacao) list = list.filter(i => i.situacao === filters.situacao);
  if (filters.curva)    list = list.filter(i => i.curva    === filters.curva);
  return list;
}

/* ── Sub-row: breakdown por MLB com métricas individuais ─── */
function SubRows({ anuncios, showEstoque }) {
  if (!anuncios?.length) return null;
  return anuncios.map(a => (
    <tr key={a.id} className="sub-row">
      <td className="sub-row__line" />
      {/* MLB pill + título + badges de canal (Full/Envios = VENDAS) */}
      <td colSpan={2} className="sub-row__main">
        <MLBPill id={a.id} />
        {a.titulo && <span className="sub-row__title">{a.titulo}</span>}
        <span className="sub-row__channels">
          {a.full   > 0 && <span className="sub-badge sub-badge--full">⚡ Full {fmtNum(a.full)}</span>}
          {a.envios > 0 && <span className="sub-badge sub-badge--env">Envios {fmtNum(a.envios)}</span>}
        </span>
      </td>
      <td />{/* Curva: herdada do SKU */}
      {/* Métricas Full só quando o MLB participa do Full */}
      <td>{a.isFullMlb ? <SitBadge sit={a.situacao} /> : null}</td>
      <td className="col-cob">{a.isFullMlb && a.total >= 0
        ? <CobBar cob={a.cobertura} riscoAtual={a.riscoAtual} rupturaPct={a.rupturaPct} />
        : null}
      </td>
      <td className="num">{a.isFullMlb ? <EnvioBadge envio={a.envio} /> : null}</td>
      <td className="num sub-row__num">{fmtNum(a.l30d)}</td>
      <td className="num sub-row__num">
        {a.isFullMlb ? <TendenciaBadge tendencia={a.tendencia} /> : null}
      </td>
      <td className="num sub-row__num">{fmtMoeda(a.faturamento)}</td>
      {showEstoque && (
        <td className="num sub-row__num">
          {a.isFullMlb
            ? <span className="stock-detail">
                <strong>{fmtNum(a.aptas)}</strong>
                {a.pendente > 0 && <span className="stock-pend">+{fmtNum(a.pendente)}</span>}
                {a.transferencia > 0 && <span className="stock-transf">~{fmtNum(a.transferencia)}</span>}
              </span>
            : <span className="sub-no-stock">—</span>
          }
        </td>
      )}
    </tr>
  ));
}

/* ── Sort helpers ────────────────────────────────────────── */
const SORT_FNS = {
  titulo:      (a, b) => a.titulo.localeCompare(b.titulo),
  curva:       (a, b) => a.curva.localeCompare(b.curva),
  situacao:    (a, b) => (a.situacao||'').localeCompare(b.situacao||''),
  cobertura:   (a, b) => a.cobertura - b.cobertura,
  envio:       (a, b) => b.envio - a.envio,
  l30d:        (a, b) => b.l30d - a.l30d,
  faturamento: (a, b) => b.faturamento - a.faturamento,
  total:       (a, b) => b.total - a.total,
};

function ThSort({ sortKey, label, current, onSort, cls = '' }) {
  const active = current.key === sortKey;
  return (
    <th
      className={`sortable ${cls} ${active ? 'sort-' + current.dir : ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
    </th>
  );
}

/* ═══════════════════════════════════════════════════════════
 * AnuncioTable – tabela principal com linhas expansíveis
 * ═══════════════════════════════════════════════════════════ */
export default function AnuncioTable({ items, filters = {}, selectedKeys, onToggleKey, showEstoque }) {
  const [sort, setSort]         = useState({ key: 'faturamento', dir: 'desc' });
  const [expanded, setExpanded] = useState(new Set());

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' }
    );
  }

  function toggleExpand(key, e) {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);
  const sorted   = useMemo(() => {
    const fn  = SORT_FNS[sort.key] || SORT_FNS.faturamento;
    const arr = [...filtered].sort(fn);
    return sort.dir === 'asc' ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalEnvio = sorted.reduce((s, i) => s + i.envio, 0);
  const totalFat   = sorted.reduce((s, i) => s + i.faturamento, 0);

  return (
    <div className="table-card">
      <div className="table-toolbar">
        <span className="table-info">{sorted.length} SKUs exibidos</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {onToggleKey && <th className="col-check">✓</th>}
              <th className="col-sku">SKU</th>
              <ThSort sortKey="titulo"      label="Produto"    current={sort} onSort={toggleSort} cls="col-desc" />
              <ThSort sortKey="curva"       label="Curva"      current={sort} onSort={toggleSort} cls="num" />
              <ThSort sortKey="situacao"    label="Situação"   current={sort} onSort={toggleSort} />
              <ThSort sortKey="cobertura"   label="Cobertura"  current={sort} onSort={toggleSort} cls="col-cob" />
              <ThSort sortKey="envio"       label="Enviar"     current={sort} onSort={toggleSort} cls="num" />
              <ThSort sortKey="l30d"        label="L30D"       current={sort} onSort={toggleSort} cls="num" />
              <th className="num">Tendência</th>
              <ThSort sortKey="faturamento" label="Fat. 30d"   current={sort} onSort={toggleSort} cls="num" />
              {showEstoque && <ThSort sortKey="total" label="Atual/Pend." current={sort} onSort={toggleSort} cls="num" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
              const isExpanded  = expanded.has(item.key);
              const hasAnuncios = item.anuncios?.length > 0;
              const checked     = selectedKeys?.has(item.key);
              const rowCls      = item.situacao === 'Ruptura'       ? 'row-rupt'
                : item.situacao === 'Repor estoque' ? 'row-risk'
                : item.situacao === 'Controlado'    ? 'row-ctrl' : '';

              return (
                <React.Fragment key={item.key}>
                  <tr className={`${rowCls} ${checked ? 'row-sel' : ''}`}>
                    {onToggleKey && (
                      <td className="row-check">
                        <input type="checkbox" checked={checked || false} onChange={() => onToggleKey(item.key)} />
                      </td>
                    )}
                    {/* SKU + expand integrado */}
                    <td>
                      <div
                        className={`sku-cell ${hasAnuncios ? 'sku-cell--expandable' : ''}`}
                        onClick={hasAnuncios ? e => toggleExpand(item.key, e) : undefined}
                      >
                        <button
                          className={`btn-expand ${isExpanded ? 'btn-expand--open' : ''} ${!hasAnuncios ? 'btn-expand--hidden' : ''}`}
                          onClick={e => { e.stopPropagation(); if (hasAnuncios) toggleExpand(item.key, e); }}
                          title={isExpanded ? 'Recolher' : `Ver ${item.anuncios?.length} anúncio(s)`}
                          tabIndex={hasAnuncios ? 0 : -1}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                        <span className="sku-code">{item.sku}</span>
                        {hasAnuncios && (
                          <span className={`badge-count ${isExpanded ? 'badge-count--open' : ''}`}>
                            {item.anuncios.length} MLB
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="col-desc">{item.titulo}</td>
                    <td className="num"><CurvaBadge curva={item.curva} /></td>
                    {/* Situação: ao expandir, é mostrada por MLB — linha SKU fica vazia */}
                    <td>{!isExpanded && <SitBadge sit={item.situacao} />}</td>
                    <td className="col-cob">{!isExpanded && <CobBar cob={item.cobertura} riscoAtual={item.riscoAtual} rupturaPct={item.rupturaPct} />}</td>
                    <td className="num">{!isExpanded && <EnvioBadge envio={item.envio} />}</td>
                    <td className="num">{fmtNum(item.l30d)}</td>
                    <td className="num"><TendenciaBadge tendencia={item.tendencia} /></td>
                    <td className="num">{fmtMoeda(item.faturamento)}</td>
                    {showEstoque && (
                      <td className="num">
                        <span className="stock-detail">
                          <strong>{fmtNum(item.atual)}</strong>
                          {item.pendente > 0 && <span className="stock-pend">+{fmtNum(item.pendente)}</span>}
                          {item.transf > 0 && <span className="stock-transf">~{fmtNum(item.transf)}</span>}
                        </span>
                      </td>
                    )}
                  </tr>

                  {isExpanded && (
                    <SubRows anuncios={item.anuncios} showEstoque={showEstoque} curva={item.curva} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              {onToggleKey && <td />}
              <td colSpan={4}>Total ({sorted.length} SKUs)</td>
              <td />{/* Cobertura */}
              <td className="num">{fmtNum(totalEnvio)}</td>{/* Enviar */}
              <td />{/* L30D */}
              <td />{/* Tendência */}
              <td className="num">{fmtMoeda(totalFat)}</td>{/* Fat */}
              {showEstoque && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
