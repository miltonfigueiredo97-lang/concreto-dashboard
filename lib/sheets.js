/**
 * lib/sheets.js
 */

const API_KEY  = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID;
const BASE     = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;

async function getRange(range) {
  const url = `${BASE}/${encodeURIComponent(range)}?key=${API_KEY}`;
  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheets API error (${range}): ${await res.text()}`);
  return (await res.json()).values || [];
}

// Converte string numérica do Sheets para float
// O Google Sheets pode retornar "0,1134" (vírgula) ou "0.1134" dependendo do locale
function parseVol(val) {
  if (val === undefined || val === null || val === '') return 0;
  const s = String(val).trim();
  // Substituir vírgula por ponto
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

const skip = rows => rows.length < 2 ? [] : rows.slice(1);

export async function getPecas() {
  const rows = await getRange('Pecas!A:E');
  return skip(rows).map(r => ({
    id: r[0]||'', nome: r[1]||'', tipo: r[2]||'', andar: r[3]||'',
    volume: parseVol(r[4]),
  })).filter(p => p.id && p.nome);
}

export async function getConcretagens() {
  const rows = await getRange('Concretagens!A:D');
  return skip(rows).map(r => ({
    id: r[0]||'', numero: parseInt(r[1])||0, data: r[2]||'', descricao: r[3]||'',
  })).filter(c => c.id);
}

export async function getPecaConc() {
  const rows = await getRange('PecaConc!A:D');
  return skip(rows).map(r => ({
    id: r[0]||'', pecaId: r[1]||'', concretagemId: r[2]||'',
    pctConcretagem: parseVol(r[3]) || 100,
  })).filter(p => p.id);
}

export async function getBTsConfig() {
  const rows = await getRange('BTsConfig!A:F');
  return skip(rows).map(r => ({
    id: r[0]||'', concretagemId: r[1]||'', numero: parseInt(r[2])||0,
    volumePrevisto: parseVol(r[3]), notaFiscal: r[4]||'', codigoBT: r[5]||'',
  })).filter(b => b.id);
}

export async function getLancamentos() {
  const rows = await getRange('Lancamentos!A:J');
  return skip(rows).map(r => ({
    id: r[0]||'', btConfigId: r[1]||'', concretagemId: r[2]||'', pecaId: r[3]||'',
    pct: parseVol(r[4]), volume: parseVol(r[5]), hora: r[6]||'',
    sobraCaminhao: parseVol(r[7]), perdaObra: parseVol(r[8]),
    perdaCocho: parseVol(r[9]||0),
  })).filter(l => l.id);
}

export async function getAllData() {
  const [pecas, concretagens, pecaConc, btsConfig, lancamentos] = await Promise.all([
    getPecas(), getConcretagens(), getPecaConc(), getBTsConfig(), getLancamentos(),
  ]);
  return { pecas, concretagens, pecaConc, btsConfig, lancamentos };
}
