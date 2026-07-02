import React from 'react';
import { fmtMoedaK } from '../lib/formatters.js';

export default function KPIStrip({ kpi, onSave, saveMsg }) {
  if (!kpi) return null;
  return (
    <div className="kpi-strip">
      <div className="kpi-card kpi-card--total">
        <span className="kpi-label">No Full</span>
        <span className="kpi-value">{kpi.totalFull}</span>
        <span className="kpi-sub">anúncios no armazém ML</span>
      </div>
      <div className="kpi-card kpi-card--ruptura">
        <span className="kpi-label">Ruptura</span>
        <span className="kpi-value">{kpi.ruptura}</span>
        <span className="kpi-sub">sem estoque no Full</span>
      </div>
      <div className="kpi-card kpi-card--repor">
        <span className="kpi-label">Repor</span>
        <span className="kpi-value">{kpi.repor}</span>
        <span className="kpi-sub">cobertura &lt; 15 dias</span>
      </div>
      <div className="kpi-card kpi-card--aspirante">
        <span className="kpi-label">Aspirantes</span>
        <span className="kpi-value">{kpi.aspirantes}</span>
        <span className="kpi-sub">candidatos ao Full</span>
      </div>
      <div className="kpi-card kpi-card--fat">
        <span className="kpi-label">Faturamento 30d</span>
        <span className="kpi-value" style={{ fontSize: kpi.fat >= 100000 ? '22px' : '30px' }}>
          {fmtMoedaK(kpi.fat)}
        </span>
        <span className="kpi-sub">todos os anúncios</span>
      </div>
      <button className={`kpi-save-btn ${saveMsg ? 'kpi-save-btn--ok' : ''}`} onClick={onSave} title="Salvar snapshot desta análise">
        {saveMsg ? '✓ Salvo' : '📸 Salvar análise'}
      </button>
    </div>
  );
}
