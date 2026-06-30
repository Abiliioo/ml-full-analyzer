import React, { useMemo } from 'react';

const SIT_OPTS = [
  { value: '',               label: 'Todos',      cls: '' },
  { value: 'Ruptura',        label: 'Ruptura',    cls: 'ruptura' },
  { value: 'Repor estoque',  label: 'Repor',      cls: 'repor' },
  { value: 'Controlado',     label: 'Controlado', cls: 'controlado' },
  { value: 'Margem',         label: 'Margem',     cls: 'margem' },
  { value: 'Estoque acima',  label: 'Acima',      cls: '' },
];

const CURVA_OPTS = [
  { value: '', label: 'Todas', cls: '' },
  { value: 'A', label: 'A', cls: 'curva-a' },
  { value: 'B', label: 'B', cls: 'curva-b' },
  { value: 'C', label: 'C', cls: 'curva-c' },
];

function countBySit(items, val) {
  if (!val) return items.length;
  return items.filter(i => i.situacao === val).length;
}

function countByCurva(items, val) {
  if (!val) return items.length;
  return items.filter(i => i.curva === val).length;
}

export default function FilterBar({ filters, onChange, items }) {
  function set(key, value) {
    onChange(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="filter-bar">
      <input
        className="search-input"
        placeholder="Buscar SKU, anúncio, produto..."
        value={filters.search}
        onChange={e => set('search', e.target.value)}
      />

      <div className="filter-divider" />

      <div className="chip-group">
        <span className="chip-group__label">Situação</span>
        {SIT_OPTS.map(opt => (
          <button
            key={opt.value}
            className={`filter-chip filter-chip--${opt.cls} ${filters.situacao === opt.value ? 'filter-chip--active' : ''}`}
            onClick={() => set('situacao', opt.value)}
          >
            {opt.label}
            <span className="chip-count">{countBySit(items, opt.value)}</span>
          </button>
        ))}
      </div>

      <div className="filter-divider" />

      <div className="chip-group">
        <span className="chip-group__label">Curva</span>
        {CURVA_OPTS.map(opt => (
          <button
            key={opt.value}
            className={`filter-chip filter-chip--${opt.cls} ${filters.curva === opt.value ? 'filter-chip--active' : ''}`}
            onClick={() => set('curva', opt.value)}
          >
            {opt.label}
            <span className="chip-count">{countByCurva(items, opt.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
