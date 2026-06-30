import React, { useRef, useState } from 'react';

function DropZone({ label, hint, loaded, filename, status, onFile }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`drop-zone ${over ? 'drop-zone--over' : ''} ${loaded ? 'drop-zone--loaded' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
    >
      <div className="dz-icon">{loaded ? '✅' : '📂'}</div>
      <div className="dz-title">{label}</div>
      <div className="dz-hint">{hint}</div>
      {status && (
        <div className={`dz-status dz-status--${status.type}`}>{status.msg}</div>
      )}
      {filename && !status && (
        <div className="dz-status dz-status--success">📄 {filename}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv"
        style={{ display: 'none' }}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}

export default function Upload({ vendasStatus, estoqueStatus, onVendasFile, onEstoqueFile }) {
  return (
    <div className="upload">
      <div className="upload__headline">
        <h2>Análise de Reposição Full</h2>
        <p>Importe os dois relatórios do Mercado Livre para começar a análise</p>
      </div>
      <div className="upload__zones">
        <DropZone
          label="Relatório de Vendas"
          hint="Arraste ou clique — .xlsx / .xlsm"
          loaded={vendasStatus?.type === 'success'}
          filename={vendasStatus?.filename}
          status={vendasStatus?.type !== 'success' ? vendasStatus : null}
          onFile={onVendasFile}
        />
        <DropZone
          label="Relatório de Estoque Full"
          hint="Arraste ou clique — .xlsx / .xlsm"
          loaded={estoqueStatus?.type === 'success'}
          filename={estoqueStatus?.filename}
          status={estoqueStatus?.type !== 'success' ? estoqueStatus : null}
          onFile={onEstoqueFile}
        />
      </div>
    </div>
  );
}
