# Lógica de Negócio – Análise Full (Mercado Livre)

Documentação das fórmulas e regras de negócio implementadas na aplicação web de reposição Full ML.  
Arquivo de referência: `Analise FULL.xlsm` (macro `Sub MeLi30`).

---

## 1. Relatório de Vendas

**Arquivo:** relatório de vendas exportado do painel ML.

**Filtragem:** linhas com status contendo `cancelad`, `devolv`, `reembolso` ou `pacote cancelad` são excluídas.

**Janelas de tempo:**
- `L30D` = últimos 30 dias a partir da data mais recente no relatório
- `L7D`  = últimos 7 dias

**Agrupamento:** por SKU do vendedor. Dentro de cada SKU, também por ID de anúncio (MLB).

**Canais:**
- `Full`   = linhas com "Forma de entrega" = `mercado envios full`
- `Envios` = demais formas de entrega

---

## 2. Relatório de Estoque Full

**Arquivo:** `stock_general_full_*.xlsx` exportado do painel Full ML.

**Colunas utilizadas (aba Resumo):**
| Coluna       | Significado                      |
|-------------|----------------------------------|
| Aptas        | Estoque disponível para venda    |
| Pendente     | Entrada em processamento no ML   |
| Transferência| Em trânsito para o armazém       |

**Chave primária:** SKU do vendedor (col. 2 do arquivo).

---

## 3. Métricas Calculadas por SKU

### Médias de Venda

```
Diária    = L30D / 30
Média L7D = L7D  / 7
Taxa      = Média L7D  (se > 0);  senão Diária
```

### Tendência

Indica se as vendas estão acelerando ou desacelerando em relação à média histórica:

```
Tendência = (Média L7D − Diária) / Diária
```

| Faixa               | Classificação | Cor     |
|--------------------|--------------|---------|
| Tendência > +0,20   | ▲ Crescente  | Verde   |
| −0,20 ≤ T ≤ +0,20  | → Esperado   | Cinza   |
| Tendência < −0,20   | ▼ Em queda   | Vermelho|

Usado nas decisões de provisão: produtos em crescimento exigem estoque maior.

### Estoque Total (Full)

```
Total = Atual (Aptas) + Pendente + Transferência
```

### Cobertura (horizonte de planejamento)

```
Cobertura = Total / Taxa   [em dias]
```

Indica por quantos dias o estoque total aguentaria ao ritmo atual de vendas.

### Risco (cobertura real)

```
Risco = Atual (Aptas) / Taxa   [em dias]
```

Considera **apenas** o estoque já disponível — sem pendentes ou transferências.  
É o indicador mais conservador: mostra há quanto tempo o produto pode entrar em ruptura **se nenhuma reposição chegar**.

### Ruptura % (urgência)

```
Ruptura % = MAX(0, MIN(1, 1 − Risco / 9))
```

Onde **9 = 7 dias de processamento no ML + 2 dias de segurança**.

| Risco (dias) | Ruptura % |
|-------------|-----------|
| 0           | 100%      |
| 4,5         | 50%       |
| 9+          | 0%        |

A barra de cobertura exibe `⚠ Xd atual` quando Ruptura% > 10% (aviso visual de risco iminente).

---

## 4. Curva ABC

Calculada separadamente para **produtos Full** e para **Aspirantes** (ranking relativo dentro de cada grupo):

| Curva | Faturamento Acumulado |
|-------|-----------------------|
| A     | 0–80%                 |
| B     | 80–95%                |
| C     | 95–100%               |

---

## 5. Situação do SKU

Baseada na **Cobertura** (Total / Taxa) e na Curva:

| Curva | Repor Estoque | Controlado | Margem / Acima |
|-------|--------------|------------|----------------|
| A     | < 25d        | 25–35d     | ≥ 35d (Margem) |
| B     | < 20d        | 20–25d     | ≥ 25d (Acima)  |
| C     | < 15d        | 15–20d     | ≥ 20d (Acima)  |

Casos especiais:
- `Ruptura`       → Total = 0 e Diária > 0
- `Excesso`       → Diária = 0 e Total > 0
- `Sem movimento` → Diária = 0 e Total = 0

A situação do **SKU** é determinada pela **pior situação** entre todos os seus anúncios Full (MLB).

---

## 6. Projeção e Sugestão de Envio

```
Projeção = ⌈Taxa × Multiplicador⌉

| Curva | Multiplicador (dias) |
|-------|---------------------|
| A     | 35                  |
| B     | 25                  |
| C     | 20                  |

Envio = MAX(0, Projeção − Total)
```

O envio só é gerado para situações de risco:
- `Ruptura`, `Repor estoque`, `Controlado`

Para `Margem`, `Estoque acima`, `Excesso` e `Sem movimento`, o envio sugerido = 0.

---

## 7. Aspirantes ao Full

Produtos presentes no relatório de vendas mas **sem estoque no Full**.

**Critério de viabilidade** (candidatos a migrar para Full):
```
Viável = Faturamento ≥ R$ 500  OU  L30D ≥ 10 unidades
```

**Tipo:**
- `Saiu do Full` → tinha histório de vendas Full (coluna `full > 0`)
- `Potencial`    → nunca esteve no Full

---

## 8. Provisão

A aba **Provisão** consolida os SKUs com envio > 0, mostrando:
- Linha de resumo por SKU
- Sub-linhas por anúncio MLB (apenas os que participam do Full)
- Botão de cópia do ID do anúncio para pesquisa no painel ML

A decisão de **qual MLB enviar** é feita individualmente: cada anúncio tem sua própria cobertura, risco e sugestão de envio calculados com base no estoque disponível por MLB no armazém Full.

---

## Arquivos de código

| Arquivo                     | Responsabilidade                              |
|-----------------------------|-----------------------------------------------|
| `src/lib/parser.js`         | Leitura dos xlsx, parsing de vendas e estoque |
| `src/lib/analise.js`        | Todas as fórmulas: curva, métricas, situação  |
| `src/lib/formatters.js`     | Formatação de números, moeda, tendência       |
| `src/lib/exportXlsx.js`     | Exportação da provisão para xlsx              |
| `src/components/AnuncioTable.jsx` | Tabela principal (No Full)             |
| `src/components/AspirantesTab.jsx`| Aba de aspirantes                      |
| `src/components/ProvisaoTab.jsx`  | Aba de provisão com sub-linhas MLB     |
| `src/components/VisaoGeral.jsx`   | Dashboard com KPIs e gráficos          |
