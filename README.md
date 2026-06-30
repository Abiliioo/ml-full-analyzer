# ml-full-analyzer

Ferramenta web para análise de reposição de estoque no canal **Full (Fulfillment) do Mercado Livre**.

Substitui a planilha VBA `Analise FULL.xlsm` com uma interface moderna no navegador — sem instalação, sem Excel.

---

## O que faz

- Importa o **relatório de vendas** e o **relatório de estoque Full** do painel ML (drag-and-drop)
- Cruza os dados por SKU e calcula métricas de reposição automaticamente
- Identifica ruptura, risco e tendência de crescimento por anúncio (MLB)
- Gera sugestão de envio por MLB para provisão
- Exporta a provisão em `.xlsx` pronto para usar

---

## Como usar

### 1. Rodar localmente

```bash
cd frontend
npm install
npm run dev
# Abre em http://localhost:4800
```

### 2. Importar os relatórios

No painel do Mercado Livre, exporte:

| Relatório | Onde baixar |
|-----------|-------------|
| Vendas (últimos 30d) | Minha conta → Vendas → Exportar relatório |
| Estoque Full | Full → Inventário → Exportar → Resumo |

Arraste os dois arquivos nas drop zones da tela inicial.

---

## Métricas calculadas

| Métrica | Fórmula |
|--------|---------|
| Diária | L30D ÷ 30 |
| Média L7D | L7D ÷ 7 |
| Tendência | (Média L7D − Diária) ÷ Diária |
| Cobertura | Total estoque ÷ Média L7D |
| Risco | Aptas (atual) ÷ Média L7D |
| Ruptura % | MAX(0, MIN(1, 1 − Risco ÷ 9)) |
| Projeção | ⌈Média L7D × 39⌉ |
| Envio | MAX(0, Projeção − Total) |

**Lead time:** 39 dias = 30d de demanda projetada + 7d de planejamento/envio + 2d de processamento ML.

### Situação por Curva ABC

| Situação | Curva A | Curva B | Curva C |
|----------|---------|---------|---------|
| Repor estoque | < 25d | < 20d | < 15d |
| Controlado | 25–35d | 20–25d | 15–20d |
| Margem / Acima | ≥ 35d | ≥ 25d | ≥ 20d |

### Tendência

| Faixa | Classificação |
|-------|--------------|
| > +20% | ▲ Crescente |
| −20% a +20% | → Esperado |
| < −20% | ▼ Em queda |

---

## Estrutura do projeto

```
frontend/
├── src/
│   ├── lib/
│   │   ├── parser.js       # Leitura dos xlsx (vendas + estoque)
│   │   ├── analise.js      # Fórmulas: curva ABC, cobertura, projeção
│   │   ├── formatters.js   # Formatação de números, moeda, tendência
│   │   └── exportXlsx.js   # Exportação da provisão
│   ├── components/
│   │   ├── AnuncioTable.jsx   # Tabela "No Full" com sub-rows por MLB
│   │   ├── AspirantesTab.jsx  # Produtos candidatos ao Full
│   │   ├── ProvisaoTab.jsx    # Provisão com filtro e exportação
│   │   └── VisaoGeral.jsx     # Dashboard com KPIs
│   └── App.jsx
├── LOGICA.md   # Documentação detalhada das fórmulas
└── vite.config.js
```

---

## Deploy (Netlify)

O projeto está configurado para deploy automático via `netlify.toml`.

1. Conecte o repositório no [netlify.com](https://netlify.com)
2. Build command: `npm run build`
3. Publish directory: `frontend/dist`
4. Pronto — deploy automático a cada push na `main`

---

## Adicionando uma nova marca/loja

Os dados ficam nos relatórios exportados do ML — a ferramenta não tem configuração por marca. Basta importar os relatórios da loja desejada.

---

## Licença

Uso interno. Não distribuir externamente sem autorização.
