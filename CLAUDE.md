# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Ferramenta de análise de reposição para o canal **Full (Fulfillment) do Mercado Livre**. Automatiza o processo que antes era feito via VBA na planilha `Analise FULL.xlsm`.

## Estrutura

```
Nova/
├── Analise FULL.xlsm     – planilha original com VBA de referência (Sub MeLi30)
├── Master/               – arquivos de apoio do marketplace
├── Merheje/              – dados da marca Merheje
└── app/                  – aplicação web (ver app/CLAUDE.md para detalhes)
    ├── index.html
    ├── css/styles.css
    └── js/  (parser, analise, estoque, resumo, ui, app)
```

## Como executar a aplicação web

```bash
# Servidor Python (porta 4800) – já configurado em .claude/launch.json
python -m http.server 4800 --directory app
```

Ou abrir `app/index.html` diretamente no Chrome.

## Fluxo de trabalho original (VBA → Web)

| Passo VBA | Equivalente Web |
|---|---|
| `Sub MeLi30()` – importa relatório de vendas | Drop Zone "Relatório de Vendas" |
| Filtra `cancel`/`devo` do status | `parser.js: CANCEL_KW` |
| Agrega por SKU: L30D, FULL, ENVIOS, FAT | `parser.js: parseVendasRaw()` |
| Importa relatório Estoque Full | Drop Zone "Relatório de Estoque Full" |
| Cruza por SKU → preenche estoque | `estoque.js + analise.js` |
| Ordena por FATURAMENTO desc | `analise.js: calcularAnalise()` |

## Planilha de referência (Analise FULL.xlsm)

Abas relevantes:
- **Analise** – 85 SKUs com métricas calculadas (pode ser importada diretamente na app)
- **Estoque Full** – 10 SKUs com inventário no armazém ML
- **Resumo / NK** – produtos selecionados para provisão (replicado na aba Provisão da web app)
- **Planilha1, Master, Meheje** – ocultas, dados auxiliares

## Fórmulas chave (analise.js)

```
Diária     = L30D / 30
Média L7D  = L7D / 7
Cobertura  = (Atual + Pendente + Transf.) / Diária   [dias]
Projeção   = Média_L7D × 30
Envio      = max(Média_L7D × 45 − Total_Estoque, 0)
Curva A    = top 80% por faturamento acumulado
```
