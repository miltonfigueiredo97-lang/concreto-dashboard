/**
 * lib/api.js
 * Funções para escrever dados via Apps Script.
 */

const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function post(body) {
  if (!SCRIPT_URL) throw new Error('NEXT_PUBLIC_APPS_SCRIPT_URL não configurada');
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script exige text/plain para evitar preflight CORS
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.erro || 'Erro desconhecido no Apps Script');
  return data;
}

export async function apiLancarBT({ concId, numBT, volCaminhao, sobraCaminhao, perdaObra, hora, obs, linhas, pecas }) {
  const btId = genId('bt');
  const lancamentos = linhas.map((l, i) => {
    const peca = pecas.find(p => p.id === l.pecaId);
    const vol  = peca ? parseFloat(((parseFloat(l.pct) / 100) * peca.volume).toFixed(4)) : 0;
    return { id: genId('lan'), pecaId: l.pecaId, pct: parseFloat(l.pct), volume: vol };
  });
  return post({
    acao: 'lancarBT',
    btId,
    concretagemId: concId,
    numero: numBT,
    volumeCaminhao: volCaminhao,
    sobraCaminhao:  sobraCaminhao,
    perdaObra:      perdaObra,
    hora,
    obs: obs || '',
    lancamentos,
  });
}

export async function apiAdicionarPeca({ nome, tipo, andar, volume }) {
  return post({ acao: 'adicionarPeca', id: genId('p'), nome, tipo, andar, volume: parseFloat(volume) });
}

export async function apiAdicionarConcretagem({ numero, data, descricao }) {
  return post({ acao: 'adicionarConcretagem', id: genId('c'), numero: parseInt(numero), data, descricao: descricao || '' });
}
