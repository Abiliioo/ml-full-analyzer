import React, { useState, useMemo, useCallback, useRef } from 'react';
import Header from './components/Header.jsx';
import Upload from './components/Upload.jsx';
import KPIStrip from './components/KPIStrip.jsx';
import FilterBar from './components/FilterBar.jsx';
import VisaoGeral from './components/VisaoGeral.jsx';
import AnuncioTable from './components/AnuncioTable.jsx';
import AspirantesTab from './components/AspirantesTab.jsx';
import ProvisaoTab from './components/ProvisaoTab.jsx';
import { parseVendasFile, parseEstoqueFile } from './lib/parser.js';
import { calcularAnalise } from './lib/analise.js';

export default function App() {
  const [theme, setTheme]         = useState(() => localStorage.getItem('analise-theme') || 'dark');
  const [vendasData, setVendasData]     = useState(() => {
    try { const s = sessionStorage.getItem('analise-vendas'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [estoqueData, setEstoqueData]   = useState(() => {
    try { const s = sessionStorage.getItem('analise-estoque'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [vendasPeriod, setVendasPeriod] = useState(() => {
    try { const s = sessionStorage.getItem('analise-vendas-period'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [vendasStatus, setVendasStatus]   = useState(() => {
    try { const s = sessionStorage.getItem('analise-vendas-status'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [estoqueStatus, setEstoqueStatus] = useState(() => {
    try { const s = sessionStorage.getItem('analise-estoque-status'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [activeTab, setActiveTab]   = useState('overview');
  const [filters, setFilters]       = useState({ search: '', situacao: '', curva: '' });
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [showUpload, setShowUpload] = useState(true);
  const uploadRef = useRef(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('analise-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);

  async function handleVendasFile(file) {
    setVendasStatus({ type: 'loading', msg: 'Processando...', filename: file.name });
    try {
      const { data, period } = await parseVendasFile(file);
      setVendasData(data);
      setVendasPeriod(period);
      const status = { type: 'success', filename: file.name };
      setVendasStatus(status);
      try {
        sessionStorage.setItem('analise-vendas', JSON.stringify(data));
        sessionStorage.setItem('analise-vendas-period', JSON.stringify(period));
        sessionStorage.setItem('analise-vendas-status', JSON.stringify(status));
      } catch { /* quota exceeded — sem persistência */ }
    } catch (e) {
      setVendasStatus({ type: 'error', msg: e.message, filename: file.name });
    }
  }

  async function handleEstoqueFile(file) {
    setEstoqueStatus({ type: 'loading', msg: 'Processando...', filename: file.name });
    try {
      const data = await parseEstoqueFile(file);
      setEstoqueData(data);
      const status = { type: 'success', filename: file.name };
      setEstoqueStatus(status);
      try {
        sessionStorage.setItem('analise-estoque', JSON.stringify(data));
        sessionStorage.setItem('analise-estoque-status', JSON.stringify(status));
      } catch { /* quota exceeded */ }
    } catch (e) {
      setEstoqueStatus({ type: 'error', msg: e.message, filename: file.name });
    }
  }

  const analise = useMemo(
    () => calcularAnalise(estoqueData || [], vendasData || {}),
    [vendasData, estoqueData]
  );

  const fullItems      = useMemo(() => analise.filter(i => i.segmento === 'full'),      [analise]);
  const aspiranteItems = useMemo(() => analise.filter(i => i.segmento === 'aspirante'), [analise]);

  const provisaoItems = useMemo(() => {
    const withEnvio = fullItems.filter(i => i.envio > 0);
    const extras    = fullItems.filter(i => selectedKeys.has(i.key) && i.envio === 0);
    const keys = new Set(withEnvio.map(i => i.key));
    return [...withEnvio, ...extras.filter(i => !keys.has(i.key))];
  }, [fullItems, selectedKeys]);

  const hasData = analise.length > 0;
  const dashboardRef = useRef(null);

  // Auto-oculta upload e sobe para o dashboard quando ambos carregados
  React.useEffect(() => {
    if (vendasData && estoqueData) {
      setShowUpload(false);
      setTimeout(() => {
        dashboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [vendasData, estoqueData]);

  function toggleKey(key) {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleFileChipClick() {
    setShowUpload(v => !v);
    setTimeout(() => {
      if (uploadRef.current) uploadRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  const kpi = useMemo(() => {
    if (!hasData) return null;
    return {
      totalFull:  fullItems.length,
      aspirantes: aspiranteItems.length,
      ruptura:    fullItems.filter(i => i.situacao === 'Ruptura').length,
      repor:      fullItems.filter(i => i.situacao === 'Repor estoque').length,
      fat:        analise.reduce((s, i) => s + i.faturamento, 0),
    };
  }, [analise, fullItems, aspiranteItems, hasData]);

  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        vendasFile={vendasStatus?.type === 'success' ? { name: vendasStatus.filename } : null}
        estoqueFile={estoqueStatus?.type === 'success' ? { name: estoqueStatus.filename } : null}
        onFileChipClick={handleFileChipClick}
      />

      {(showUpload || !hasData) && (
        <div ref={uploadRef}>
          <Upload
            vendasStatus={vendasStatus}
            estoqueStatus={estoqueStatus}
            vendasPeriod={vendasPeriod}
            onVendasFile={handleVendasFile}
            onEstoqueFile={handleEstoqueFile}
          />
        </div>
      )}

      {hasData && (
        <div className="dashboard" ref={dashboardRef}>
          <KPIStrip kpi={kpi} />

          <nav className="tab-bar">
            {[
              { id: 'overview',   label: 'Visão Geral' },
              { id: 'full',       label: 'No Full',    badge: fullItems.length,      bc: 'blue' },
              { id: 'aspirantes', label: 'Aspirantes', badge: aspiranteItems.length, bc: 'purple' },
              { id: 'provisao',   label: 'Provisão',   badge: provisaoItems.length,  bc: provisaoItems.length > 0 ? 'blue' : '' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.badge != null && (
                  <span className={`tab-badge ${tab.badge > 0 && tab.bc ? `tab-badge--${tab.bc}` : ''}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' && (
            <VisaoGeral fullItems={fullItems} aspiranteItems={aspiranteItems} analise={analise} />
          )}

          {activeTab === 'full' && (
            <>
              <FilterBar filters={filters} onChange={setFilters} items={fullItems} />
              <AnuncioTable
                items={fullItems}
                filters={filters}
                selectedKeys={selectedKeys}
                onToggleKey={toggleKey}
                showEstoque
              />
            </>
          )}

          {activeTab === 'aspirantes' && (
            <AspirantesTab items={aspiranteItems} />
          )}

          {activeTab === 'provisao' && (
            <ProvisaoTab
              items={provisaoItems}
              allFull={fullItems}
              selectedKeys={selectedKeys}
              onToggleKey={toggleKey}
            />
          )}
        </div>
      )}
    </>
  );
}
