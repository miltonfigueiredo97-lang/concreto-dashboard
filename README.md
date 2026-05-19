# ⬛ Concreto Dashboard

Dashboard de controle de concretagem em tempo real.  
**Stack:** Next.js (Pages Router) · Google Sheets (banco de dados) · Vercel (hospedagem)

---

## Sumário

1. [Estrutura do projeto](#1-estrutura-do-projeto)
2. [Configurar a planilha Google Sheets](#2-configurar-a-planilha-google-sheets)
3. [Obter a API Key do Google](#3-obter-a-api-key-do-google)
4. [Configurar o projeto localmente](#4-configurar-o-projeto-localmente)
5. [Subir para o GitHub](#5-subir-para-o-github)
6. [Deploy na Vercel](#6-deploy-na-vercel)
7. [Usar o dashboard](#7-usar-o-dashboard)
8. [Estrutura das abas do Sheets](#8-estrutura-das-abas-do-sheets)
9. [Perguntas frequentes](#9-perguntas-frequentes)

---

## 1. Estrutura do projeto

```
concreto-dashboard/
├── lib/
│   ├── sheets.js        ← lê o Google Sheets via API
│   └── calculos.js      ← funções de cálculo (volume, %, KPIs)
├── pages/
│   ├── _app.js
│   ├── index.js         ← dashboard principal (2 abas)
│   └── api/
│       └── data.js      ← endpoint que retorna os dados
├── styles/
│   ├── globals.css
│   └── Home.module.css
├── .env.example         ← modelo das variáveis de ambiente
├── .gitignore
├── next.config.js
└── package.json
```

---

## 2. Configurar a planilha Google Sheets

### 2.1 Criar a planilha

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma nova planilha
2. Nomeie como quiser, ex: **Controle de Concretagem**

### 2.2 Criar as 3 abas obrigatórias

Crie **3 abas** com exatamente estes nomes (sensível a maiúsculas):

#### Aba `Pecas`

| A (id) | B (nome) | C (tipo) | D (andar) | E (volume) |
|--------|----------|----------|-----------|------------|
| p1 | Pilar P-01 | Pilar | Térreo | 1.5 |
| p2 | Viga V-01 | Viga | Térreo | 2.8 |
| p3 | Laje L-01 | Laje | 1º Pavimento | 12.4 |

> **Linha 1 = cabeçalho** (escreva os nomes das colunas). Os dados começam na linha 2.  
> O campo `id` pode ser qualquer texto único: p1, p2, laje-terreo, etc.  
> `volume` usa ponto como decimal (ex: 1.5, não 1,5).

#### Aba `Concretagens`

| A (id) | B (numero) | C (data) | D (descricao) |
|--------|------------|----------|---------------|
| c1 | 1 | 2025-03-01 | Pilares Térreo |
| c2 | 2 | 2025-03-08 | Laje Térreo |

> `data` no formato `AAAA-MM-DD`.

#### Aba `Lancamentos`

| A (id) | B (concretagemId) | C (btNumero) | D (pecaId) | E (pct) | F (volume) | G (hora) |
|--------|-------------------|--------------|------------|---------|------------|----------|
| l1 | c1 | 1 | p1 | 100 | 1.5 | 08:30 |
| l2 | c1 | 1 | p2 | 60 | 1.68 | 08:45 |

> `concretagemId` = o `id` da concretagem (coluna A da aba Concretagens)  
> `pecaId` = o `id` da peça (coluna A da aba Pecas)  
> `pct` = % da peça feita nesta BT (número, ex: 35.5)  
> `volume` = m³ desta BT nesta peça (pct/100 × volume da peça)  
> `hora` = horário do lançamento (texto livre, ex: 08:30)

### 2.3 Tornar a planilha pública

1. Botão **Compartilhar** (canto superior direito)
2. Em "Acesso geral", selecione **"Qualquer pessoa com o link"**
3. Nível: **Leitor** (somente leitura — o dashboard só lê)
4. Copie o **ID da planilha** da URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_É_O_ID/edit
   ```

---

## 3. Obter a API Key do Google

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente)
3. No menu lateral: **APIs & Services → Library**
4. Busque **"Google Sheets API"** e clique em **Enable**
5. Vá em **APIs & Services → Credentials**
6. Clique em **"+ Create Credentials" → API Key**
7. Copie a chave gerada (ex: `AIzaSy...`)
8. (Opcional mas recomendado) Clique em **"Restrict Key"**:
   - Em "API restrictions", selecione "Google Sheets API"
   - Em "Website restrictions", adicione o domínio da Vercel depois do deploy

---

## 4. Configurar o projeto localmente

### 4.1 Instalar dependências

```bash
cd concreto-dashboard
npm install
```

### 4.2 Criar o arquivo de variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite o `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSy_SUA_CHAVE_AQUI
NEXT_PUBLIC_SHEET_ID=SEU_ID_DA_PLANILHA_AQUI
```

### 4.3 Rodar localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## 5. Subir para o GitHub

```bash
# Inicializar repositório (se ainda não tiver)
git init
git add .
git commit -m "feat: dashboard de concretagem"

# Criar repositório no GitHub (github.com → New repository)
# Depois linkar e subir:
git remote add origin https://github.com/SEU_USUARIO/concreto-dashboard.git
git branch -M main
git push -u origin main
```

> ⚠️ O `.env.local` está no `.gitignore` e **não será enviado ao GitHub**. As chaves ficam seguras.

---

## 6. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub
2. Clique em **"Add New Project"**
3. Selecione o repositório `concreto-dashboard`
4. Na seção **"Environment Variables"**, adicione:

   | Nome | Valor |
   |------|-------|
   | `NEXT_PUBLIC_GOOGLE_API_KEY` | sua API key |
   | `NEXT_PUBLIC_SHEET_ID` | ID da planilha |

5. Clique em **Deploy**
6. Aguarde ~2 minutos — a Vercel gera uma URL tipo:
   ```
   https://concreto-dashboard.vercel.app
   ```

### Redeploy automático

A partir de agora, toda vez que você fizer `git push`, a Vercel fará deploy automaticamente.

---

## 7. Usar o dashboard

### Aba Operacional
- **KPIs ao vivo**: volume total, concretado, faltando, BTs utilizadas
- **Filtro por andar**: clique nos chips para filtrar as barras de progresso
- **Progresso por peça**: atualiza automaticamente a cada 60 segundos
- **Painel de concretagem ativa**: mostra a última BT lançada

### Aba Relatórios & Índices
- **Filtros**: por concretagem e por andar, combinados
- **Índice de consumo**: volume programado vs real, perda/sobra
- **Gráfico de consumo** por concretagem
- **Distribuição por tipo** de peça (donut)
- **Índice por BT**: eficiência de cada betonada
- **Resumo por andar**: status (pendente/parcial/completo)

### Fluxo de trabalho no campo

Durante a concretagem, você ou alguém de escritório edita a planilha Google Sheets:

1. Se for peça nova: adicione na aba **Pecas**
2. Se for nova concretagem: adicione na aba **Concretagens**
3. A cada BT: adicione uma linha na aba **Lancamentos** com:
   - id da concretagem
   - número da BT
   - id da peça
   - % feito
   - volume em m³
   - horário

O dashboard atualiza a cada 60s automaticamente, ou clique em **↻ Atualizar**.

---

## 8. Estrutura das abas do Sheets

### Coluna `id`

Pode usar qualquer formato único. Sugestões:
- Peças: `p1`, `p2`, `pilar-01`, `laje-terreo`
- Concretagens: `c1`, `c2`, `conc-2025-03-01`
- Lançamentos: `l1`, `l2` (ou use um timestamp: `1709290800000`)

### Tipos de peça válidos (campo C da aba Pecas)

Pode ser qualquer texto, mas o donut agrupará por tipo. Sugestões:
`Pilar`, `Viga`, `Laje`, `Fundação`, `Cortina`, `Escada`, `Caixa D'água`

### Dica: calcular volume no Sheets

Na aba Lancamentos, coluna F (volume), você pode usar fórmula em vez de digitar:

```
=E2/100 * VLOOKUP(D2, Pecas!A:E, 5, FALSE)
```

Isso busca o volume da peça automaticamente e calcula pelo %.

---

## 9. Perguntas frequentes

**O dashboard está em branco / erro ao carregar**  
→ Verifique se a planilha está pública (passo 2.3)  
→ Verifique se a API Key está correta nas variáveis da Vercel  
→ Verifique se o ID da planilha está correto  
→ Verifique se as abas se chamam exatamente `Pecas`, `Concretagens`, `Lancamentos`  

**Os dados não atualizam**  
→ O dashboard faz refresh automático a cada 60s. Clique em ↻ para forçar.  
→ A API do Google tem cache de ~30s, então pode demorar até 90s para aparecer.  

**Quero que mais pessoas acessem**  
→ Basta compartilhar a URL da Vercel. Não há login.  

**Posso renomear as colunas?**  
→ Sim, mas os nomes das abas (`Pecas`, `Concretagens`, `Lancamentos`) são fixos.  
→ A ordem das colunas também deve ser mantida (A, B, C...).  

**Quero adicionar mais campos**  
→ Edite `lib/sheets.js` para ler mais colunas e `lib/calculos.js` para os cálculos.  

---

## Próximos passos planejados

- [ ] **Fase 2**: Upload de PDF pintado → IA lê áreas coloridas → preenche lançamentos automaticamente
- [ ] Autenticação simples por senha (para restrição de acesso)
- [ ] Exportar relatório em PDF diretamente do dashboard
- [ ] Notificação por WhatsApp ao atingir 100% de uma peça

---

Feito com ♥ para o canteiro de obras.
