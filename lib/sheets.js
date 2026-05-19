/**
 * lib/sheets.js
 * Lê dados do Google Sheets via API REST pública (sem autenticação OAuth).
 * A planilha deve ser pública (qualquer pessoa com o link pode ver).
 *
 * ESTRUTURA ESPERADA DAS ABAS:
 *
 * Aba "Pecas":
 *   A: id | B: nome | C: tipo | D: andar | E: volume
 *
 * Aba "Concretagens":
 *   A: id | B: numero | C: data | D: descricao
 *
 * Aba "Lancamentos":
 *   A: id | B: concretagemId | C: btNumero | D: pecaId | E: pct | F: volume | G: hora
 */

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID;

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;

async function getRange(range) {
  const url = `${BASE}/${encodeURIComponent(range)}?key=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 30 } }); // cache 30s
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error (${range}): ${err}`);
  }
  const data = await res.json();
  return data.values || [];
}

// Remove a linha de cabeçalho (primeira linha)
function parseRows(rows) {
  if (rows.length < 2) return [];
  return rows.slice(1);
}

export async function getPecas() {
  const rows = await getRange("Pecas!A:E");
  return parseRows(rows).map(r => ({
    id:     r[0] || "",
    nome:   r[1] || "",
    tipo:   r[2] || "",
    andar:  r[3] || "",
    volume: parseFloat(r[4]) || 0,
  })).filter(p => p.id && p.nome);
}

export async function getConcretagens() {
  const rows = await getRange("Concretagens!A:D");
  return parseRows(rows).map(r => ({
    id:        r[0] || "",
    numero:    parseInt(r[1]) || 0,
    data:      r[2] || "",
    descricao: r[3] || "",
  })).filter(c => c.id);
}

export async function getLancamentos() {
  const rows = await getRange("Lancamentos!A:G");
  return parseRows(rows).map(r => ({
    id:             r[0] || "",
    concretagemId:  r[1] || "",
    btNumero:       parseInt(r[2]) || 0,
    pecaId:         r[3] || "",
    pct:            parseFloat(r[4]) || 0,
    volume:         parseFloat(r[5]) || 0,
    hora:           r[6] || "",
  })).filter(l => l.id);
}

export async function getAllData() {
  const [pecas, concretagens, lancamentos] = await Promise.all([
    getPecas(),
    getConcretagens(),
    getLancamentos(),
  ]);
  return { pecas, concretagens, lancamentos };
}
