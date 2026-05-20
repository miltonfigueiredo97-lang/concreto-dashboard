/**
 * lib/sheets.js
 *
 * ABAS DO GOOGLE SHEETS:
 *
 * Pecas:        A:id | B:nome | C:tipo | D:andar | E:volume
 * Concretagens: A:id | B:numero | C:data | D:descricao
 * PecaConc:     A:id | B:pecaId | C:concretagemId | D:pctConcretagem
 * BTsConfig:    A:id | B:concretagemId | C:numero | D:volumePrevisto | E:notaFiscal | F:codigoBT
 * Lancamentos:  A:id | B:btConfigId | C:concretagemId | D:pecaId | E:pct | F:volume | G:hora | H:sobraCaminhao | I:perdaObra
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

const skip = rows => rows.length < 2 ? [] : rows.slice(1);

export async function getPecas() {
  const rows = await getRange('Pecas!A:E');
  return skip(rows).map(r => ({
    id: r[0]||'', nome: r[1]||'', tipo: r[2]||'', andar: r[3]||'', volume: parseFloat(r[4])||0,
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
    id: r[0]||'', pecaId: r[1]||'', concretagemId: r[2]||'', pctConcretagem: parseFloat(r[3])||100,
  })).filter(p => p.id);
}

export async function getBTsConfig() {
  const rows = await getRange('BTsConfig!A:F');
  return skip(rows).map(r => ({
    id: r[0]||'', concretagemId: r[1]||'', numero: parseInt(r[2])||0,
    volumePrevisto: parseFloat(r[3])||0, notaFiscal: r[4]||'', codigoBT: r[5]||'',
  })).filter(b => b.id);
}

export async function getLancamentos() {
  const rows = await getRange('Lancamentos!A:I');
  return skip(rows).map(r => ({
    id: r[0]||'', btConfigId: r[1]||'', concretagemId: r[2]||'', pecaId: r[3]||'',
    pct: parseFloat(r[4])||0, volume: parseFloat(r[5])||0, hora: r[6]||'',
    sobraCaminhao: parseFloat(r[7])||0, perdaObra: parseFloat(r[8])||0,
  })).filter(l => l.id);
}

export async function getAllData() {
  const [pecas, concretagens, pecaConc, btsConfig, lancamentos] = await Promise.all([
    getPecas(), getConcretagens(), getPecaConc(), getBTsConfig(), getLancamentos(),
  ]);
  return { pecas, concretagens, pecaConc, btsConfig, lancamentos };
}
