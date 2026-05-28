const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

async function post(body) {
  if (!SCRIPT_URL) throw new Error('NEXT_PUBLIC_APPS_SCRIPT_URL não configurada');
  const res = await fetch(SCRIPT_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error((data.erro || 'Erro desconhecido') + (data.stack ? ' | ' + data.stack.split('\n')[0] : ''));
  return data;
}

// PEÇAS
export const apiAdicionarPeca = p =>
  post({ acao:'adicionarPeca', id:genId('p'), ...p, volume:parseFloat(p.volume) });

export const apiAdicionarPecaLote = pecas =>
  post({ acao:'adicionarPecaLote', pecas: pecas.map(p=>({id:genId('p'),...p,volume:parseFloat(p.volume)})) });

export const apiEditarPeca = p =>
  post({ acao:'editarPeca', ...p, volume:parseFloat(p.volume) });

export const apiExcluirPeca = id =>
  post({ acao:'excluirPeca', id });

// CONCRETAGENS
export const apiSalvarConcretagem = ({ id, numero, data, descricao, pecaConcs, btsConfig }) =>
  post({ acao:'salvarConcretagem', id:id||genId('c'), numero:parseInt(numero), data, descricao,
    pecaConcs: pecaConcs.map(pc=>({id:pc.id||genId('pc'), pecaId:pc.pecaId, pctConcretagem:parseFloat(pc.pctConcretagem)||100})),
    btsConfig: btsConfig.map(b=>({id:b.id||genId('bt'), numero:parseInt(b.numero), volumePrevisto:parseFloat(b.volumePrevisto)||0, notaFiscal:b.notaFiscal||'', codigoBT:b.codigoBT||''})),
  });

export const apiEditarBTConfig = bt =>
  post({ acao:'editarBTConfig', ...bt, volumePrevisto:parseFloat(bt.volumePrevisto)||0 });

// LANÇAMENTOS
export const apiLancarBT = ({ btConfigId, concretagemId, linhas, sobraCaminhao, perdaObra, perdaCocho, hora, pecas, pecaConc }) => {
  const lancamentos = linhas.map(l => {
    const peca = pecas.find(p=>p.id===l.pecaId);
    if(!peca) return null;
    // Volume desta peça NESTA concretagem = volume_projeto × pctConcretagem
    const pc = pecaConc ? pecaConc.find(x=>x.pecaId===l.pecaId&&x.concretagemId===concretagemId) : null;
    const pctConc = pc ? parseFloat(pc.pctConcretagem)/100 : 1;
    const volConc = peca.volume * pctConc;
    // O % digitado é referente ao volume da concretagem
    const vol = parseFloat(((parseFloat(l.pct)/100)*volConc).toFixed(4));
    return { id:genId('lan'), pecaId:l.pecaId, pct:parseFloat(l.pct), volume:vol };
  }).filter(Boolean);
  return post({ acao:'lancarBT', btConfigId, concretagemId,
    sobraCaminhao:parseFloat(sobraCaminhao)||0, perdaObra:parseFloat(perdaObra)||0,
    perdaCocho:parseFloat(perdaCocho)||0, hora, lancamentos });
};

export const apiExcluirConcretagem = id =>
  post({ acao:'excluirConcretagem', id });
