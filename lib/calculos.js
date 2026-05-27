// v1779287372
export const fmt2 = n => parseFloat(n||0).toFixed(2);
export const fmt1 = n => parseFloat(n||0).toFixed(1);
export const fmt4 = n => {
  const v = parseFloat(n||0);
  if (v === 0) return '0';
  if (Math.abs(v) < 0.01) return v.toFixed(4);
  if (Math.abs(v) < 0.1)  return v.toFixed(3);
  return v.toFixed(2);
};

/** Ordena andares pela ordem padrão de obra */
export function ordenarAndares(andares, ordemCustom=[]) {
  if (ordemCustom.length > 0) {
    // Usa a ordem customizada, andares não listados vão para o final
    return [...andares].sort((a, b) => {
      const ia = ordemCustom.indexOf(a);
      const ib = ordemCustom.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }
  // Ordem padrão obra
  const prioridade = ['subsolo','sub-solo','subsolos','fundação','fundacao','fundações','fundacoes',
    'infraestrutura','infra','pilotis','térreo','terreo','terreo','piso 0','pavimento 0',
    'mezanino','mez'];
  function score(a) {
    const al = a.toLowerCase();
    for (let i=0; i<prioridade.length; i++) if (al.includes(prioridade[i])) return -1000 + i;
    // Extrai número do andar: 1º, 2º, 1°, 1 PAV, etc
    const m = al.match(/(\d+)/);
    return m ? parseInt(m[1]) : 9999;
  }
  return [...andares].sort((a, b) => score(a) - score(b));
}

export function volLancadoPeca(pecaId, lancamentos) {
  return lancamentos.filter(l => l.pecaId === pecaId).reduce((s,l) => s+l.volume, 0);
}

export function pctConcretado(peca, lancamentos) {
  const vc = volLancadoPeca(peca.id, lancamentos);
  return peca.volume > 0 ? Math.min(100, (vc/peca.volume)*100) : 0;
}

export function calcVolumePrevisto(btsConfig, lancamentos) {
  const btIdsLancadas = new Set(lancamentos.map(l => l.btConfigId));
  const total    = btsConfig.reduce((s,b) => s+b.volumePrevisto, 0);
  const lancado  = btsConfig.filter(b => btIdsLancadas.has(b.id)).reduce((s,b) => s+b.volumePrevisto, 0);
  const faltando = btsConfig.filter(b => !btIdsLancadas.has(b.id)).reduce((s,b) => s+b.volumePrevisto, 0);
  return { total, lancado, faltando };
}

/**
 * Índice de perda = média da diferença (previsto - executado) / previsto por BT
 * BTs que executaram mais que previsto = índice positivo (sobra inesperada)
 * BTs que executaram menos = índice negativo (perda)
 */
export function calcIndicePerda(lancamentos, btsConfig) {
  const btIdsLancadas = new Set(lancamentos.map(l => l.btConfigId));
  const btsLancadas = btsConfig.filter(b => btIdsLancadas.has(b.id));
  if (!btsLancadas.length) return { indice:0, perdaTotal:0, perdaCaminhao:0, perdaObra:0, totalPrevisto:0, totalExecutado:0, detalhes:[] };

  let totalPrevisto=0, totalExecutado=0, totalPerdaObra=0;
  const detalhes = btsLancadas.map(b => {
    const lans  = lancamentos.filter(l => l.btConfigId === b.id);
    const usado = lans.reduce((s,l) => s+l.volume, 0);
    const perdaO= lans.reduce((s,l) => s+l.perdaObra, 0);
    // diferença: positivo = fez mais (sobra inesperada), negativo = fez menos (perda caminhão)
    const difCam = usado - b.volumePrevisto; // + = sobra, - = perda
    totalPrevisto  += b.volumePrevisto;
    totalExecutado += usado;
    totalPerdaObra += perdaO;
    return { bt:b, usado, perdaObra:perdaO, difCaminhao:difCam };
  });

  const perdaCaminhao = totalPrevisto - totalExecutado; // + = perda, - = sobra
  const perdaTotal    = totalPerdaObra + Math.max(0, perdaCaminhao);
  // Índice global: (totalPrevisto - totalExecutado) / totalPrevisto × 100
  const indice = totalPrevisto>0 ? (perdaCaminhao / totalPrevisto) * 100 : 0;

  return { indice, perdaTotal, perdaCaminhao, perdaObra:totalPerdaObra, totalPrevisto, totalExecutado, detalhes };
}

export function calcKPIs(pecas, lancamentos, btsConfig, filtroAndar='todos') {
  const ps = filtroAndar==='todos' ? pecas : pecas.filter(p=>p.andar===filtroAndar);
  const totalVol = ps.reduce((s,p)=>s+p.volume, 0);
  // Volume real concretado = soma de lançamentos LIMITADO ao volume do projeto por peça
  // Se ultrapassou 100% de uma peça, conta só até 100%
  const concVol = ps.reduce((s,p)=>s+Math.min(p.volume, volLancadoPeca(p.id,lancamentos)), 0);
  // Detectar peças com excesso (lançado > volume projeto)
  const pecasExcesso = ps.filter(p=>volLancadoPeca(p.id,lancamentos)>p.volume*1.001)
    .map(p=>({...p, lanTotal:volLancadoPeca(p.id,lancamentos), excesso:volLancadoPeca(p.id,lancamentos)-p.volume}));
  // Volume projeto faltando = projeto - BTs executadas (previsto)
  const prev = calcVolumePrevisto(btsConfig, lancamentos);
  const projFaltando = Math.max(0, totalVol - prev.lancado);
  // Volume real faltando = projeto - real concretado
  const realFaltando = Math.max(0, totalVol - concVol);
  const pctConc = totalVol>0?(concVol/totalVol)*100:0;
  const perdaInfo = calcIndicePerda(lancamentos, btsConfig);
  return { totalVol, concVol, projFaltando, realFaltando, pctConc,
    volPrevisto:prev.total, volPrevistoFaltando:prev.faltando, perdaInfo, pecasExcesso };
}

export function calcAndares(pecas, lancamentos, ordemAndares=[], indicePerda=0) {
  const andares = ordenarAndares([...new Set(pecas.map(p=>p.andar))], ordemAndares);
  return andares.map(a => {
    const ps   = pecas.filter(p=>p.andar===a);
    const prog = ps.reduce((s,p)=>s+p.volume, 0);
    const conc = ps.reduce((s,p)=>s+Math.min(p.volume,volLancadoPeca(p.id,lancamentos)), 0);
    const falt = Math.max(0, prog-conc);
    const pct  = prog>0?(conc/prog)*100:0;
    const projPerda = falt*(1+indicePerda/100);
    return { andar:a, prog, conc, falt, pct, projPerda };
  });
}

export function calcPorTipo(pecas, lancamentos) {
  const tipos = [...new Set(pecas.map(p=>p.tipo))].sort();
  return tipos.map(t => {
    const ps   = pecas.filter(p=>p.tipo===t);
    const prog = ps.reduce((s,p)=>s+p.volume, 0);
    const conc = ps.reduce((s,p)=>s+Math.min(p.volume,volLancadoPeca(p.id,lancamentos)), 0);
    const falt = Math.max(0, prog-conc);
    const pct  = prog>0?(conc/prog)*100:0;
    return { tipo:t, prog, conc, falt, pct, count:ps.length, pecas:ps };
  });
}

export function statusPeca(pct) {
  return pct>=100?'complete':pct>0?'partial':'pending';
}
