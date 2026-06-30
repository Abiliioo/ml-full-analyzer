import React from 'react';

function shortName(name) {
  if (!name) return '';
  const n = name.toLowerCase();
  if (n.includes('stock_general') || n.includes('estoque')) {
    const d = name.match(/(\d{8})/);
    return d ? `Estoque ${d[1].slice(6)}/${d[1].slice(4,6)}` : 'Estoque Full';
  }
  const d = name.match(/(\d{4})(\d{2})(\d{2})/);
  if (d) return `Vendas ${d[3]}/${d[2]}/${d[1].slice(2)}`;
  return name.slice(0, 22) + (name.length > 22 ? '…' : '');
}

export default function Header({ theme, onToggleTheme, vendasFile, estoqueFile, onFileChipClick }) {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__logo">
          <div className="logo-dot">ML</div>
          <div>
            <div className="logo-name">Análise Full</div>
            <div className="logo-sub">Reposição ML</div>
          </div>
        </div>

        <div className="header__chips">
          <div
            className={`file-chip ${vendasFile ? 'file-chip--loaded' : ''}`}
            onClick={() => onFileChipClick('vendas')}
            title={vendasFile ? vendasFile.name : 'Importar relatório de vendas'}
          >
            <span className="file-chip__dot" />
            {vendasFile ? shortName(vendasFile.name) : 'Relatório de Vendas'}
          </div>
          <div
            className={`file-chip ${estoqueFile ? 'file-chip--loaded' : ''}`}
            onClick={() => onFileChipClick('estoque')}
            title={estoqueFile ? estoqueFile.name : 'Importar relatório de estoque'}
          >
            <span className="file-chip__dot" />
            {estoqueFile ? shortName(estoqueFile.name) : 'Estoque Full'}
          </div>
        </div>

        <div className="header__right">
          <span className="header__date">
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <button className="btn-theme" onClick={onToggleTheme} title="Alternar tema">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
