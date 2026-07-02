import React, { useState, useMemo } from 'react';
import { fmtMoeda, fmtNum } from '../lib/formatters.js';
import { formatMLBCode } from '../lib/parser.js';

const VIAVEL_MIN_FAT = 500;
const VIAVEL_MIN_L30 = 10;

function TipoBadge({ tipo }) {
  if (tipo === 'saiu_do_full') return <span className="badge badge--saiu">Saiu do Full</span>;
  return <span className="badge badge--potencial">Potencial</span>;
}

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

function AnunciosPills({ anuncios }) {
  if (!anuncios?.length) return <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {anuncios.map(a => (
        <span key={a.id} className="mlb-pill" style={{ fontSize: 10 }}>
          <span className="mlb-pill__id">{formatMLBCode(a.id)}</span>
          <CopyBtn text={a.id} />
        </span>
      ))}
    </div>
  );
}

function CurvaBadge({ curva }) {
  return <span className={`badge badge--curva-${curva?.toLowerCase()}`}>{curva}</span>;
}

export default function AspirantesTab({ items }) {
  const [sort, setSort]   = useState({ key: 'faturamento', dir: 'desc' });
  const [search, setSearch] = useState('');
  const [tipo, setTipo]   = useState('');
  const [viavel, setViavel] = useState('');

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' }
    );
  }

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.titulo || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q)
      );
    }
    if (tipo) list = list.filter(i => i.tipoAspirante === tipo);
    if (viavel === 'sim') list = list.filter(i => i.viavel);
    if (viavel === 'nao') list = list.filter(i => !i.viavel);
    return list;
  }, [items, search, tipo, viavel]);

  const sorted = useMemo(() => {
    const fns = {
      faturamento: (a, b) => b.faturamento - a.faturamento,
      l30d:        (a, b) => b.l30d - a.l30d,
      titulo:      (a, b) => a.titulo.localeCompare(b.titulo),
      curva:       (a, b) => a.curva.localeCompare(b.curva),
    };
    const fn  = fns[sort.key] || fns.faturamento;
    const arr = [...filtered].sort(fn);
    return sort.dir === 'asc' ? arr.reverse() : arr;
  }, [filtered, sort]);

  const saiuCnt  = items.filter(i => i.tipoAspirante === 'saiu_do_full').length;
  const viavelCnt = items.filter(i => i.viavel).length;

  function thC(key) {
    if (sort.key !== key) return 'sortable';
    return `sortable ${sort.dir === 'asc' ? 'sort-asc' : 'sort-desc'}`;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="aspirante-header">
        <span className="aspirante-header__icon">🚀</span>
        <div>
          <div className="aspirante-header__title">Aspirantes ao Full</div>
          <div className="aspirante-header__sub">
            Critério de viabilidade: fat. ≥ R$500/mês <strong>ou</strong> ≥ 10 unidades/mês
          </div>
        </div>
        <span style={{ marginLeft: 'auto', background: 'var(--green-bg)', color: 'var(--green-text)', padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
          {viavelCnt} viáveis
        </span>
      </div>

      <div className="table-card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <div className="table-toolbar">
          <div className="table-toolbar__left">
            <input
              className="search-input"
              placeholder="Buscar produto, SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <div className="chip-group">
              {[
                { v: '',    label: `Todos (${items.length})` },
                { v: 'saiu_do_full', label: `Saiu do Full (${saiuCnt})` },
              ].map(opt => (
                <button key={opt.v}
                  className={`filter-chip ${tipo === opt.v ? 'filter-chip--active' : ''}`}
                  onClick={() => setTipo(opt.v)}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="filter-divider" />
            <div className="chip-group">
              <span className="chip-group__label">Volume</span>
              {[
                { v: '',    label: 'Todos' },
                { v: 'sim', label: `Viável (${viavelCnt})`,         cls: 'filter-chip--curva-a' },
                { v: 'nao', label: `Baixo (${items.length - viavelCnt})`, cls: 'filter-chip--curva-c' },
              ].map(opt => (
                <button key={opt.v}
                  className={`filter-chip ${opt.cls || ''} ${viavel === opt.v ? 'filter-chip--active' : ''}`}
                  onClick={() => setViavel(opt.v)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="table-toolbar__right">
            <span className="table-info">{sorted.length} exibidos</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-desc sortable" onClick={() => toggleSort('titulo')}>Produto</th>
                <th>Anúncios (MLB)</th>
                <th className={`num ${thC('curva')}`} onClick={() => toggleSort('curva')}>Curva</th>
                <th className="num">Tipo</th>
                <th className="num">Viável</th>
                <th className="num">Recomendação</th>
                <th className={`num ${thC('l30d')}`} onClick={() => toggleSort('l30d')}>L30D</th>
                <th className="num">Full (hist.)</th>
                <th className="num">Outros</th>
                <th className={`num ${thC('faturamento')}`} onClick={() => toggleSort('faturamento')}>Fat. 30d</th>
                <th className="num" title="Quantidade estimada para iniciar no Full (39 dias de demanda)">Envio p/ entrar</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => (
                <tr key={item.key} className={!item.viavel ? 'row-low-vol' : ''}>
                  <td className="col-desc" style={{ color: 'var(--text)' }}>{item.titulo}</td>
                  <td><AnunciosPills anuncios={item.anuncios} /></td>
                  <td className="num"><CurvaBadge curva={item.curva} /></td>
                  <td><TipoBadge tipo={item.tipoAspirante} /></td>
                  <td className="num">
                    {item.viavel
                      ? <span className="badge badge--margem">✓ Viável</span>
                      : <span className="badge badge--sem-mov">Baixo</span>
                    }
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: item.viavel ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                      {item.recomendacao}
                    </span>
                  </td>
                  <td className="num">{fmtNum(item.l30d)}</td>
                  <td className="num">{fmtNum(item.full)}</td>
                  <td className="num">{fmtNum(item.envios)}</td>
                  <td className="num">{fmtMoeda(item.faturamento)}</td>
                  <td className="num">
                    {item.viavel && item.envio > 0
                      ? <span className="envio-badge">{fmtNum(item.envio)}</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>Total ({sorted.length})</td>
                <td className="num">{fmtNum(sorted.reduce((s, i) => s + i.l30d, 0))}</td>
                <td /><td />
                <td className="num">{fmtMoeda(sorted.reduce((s, i) => s + i.faturamento, 0))}</td>
                <td className="num">{fmtNum(sorted.filter(i => i.viavel).reduce((s, i) => s + (i.envio || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
