export const fmt2 = n => parseFloat(n||0).toFixed(2);
export const fmt1 = n => parseFloat(n||0).toFixed(1);
export const fmt4 = n => {
  const v = parseFloat(n||0);
  if (v === 0) return '0';
  if (Math.abs(v) < 0.01) return v.toFixed(4);
  if (Math.abs(v) < 0.1)  return v.toFixed(3);
  return v.toFixed(2);
};

export function volLancadoPeca(pecaId, lancamentos) {
  return lancamentos.filter(l => l.pecaId === pecaId).reduce((s,l) => s+l.volume, 0);
}

export function pctConcretado(peca, lancamentos) {
  const vc = volLancadoPeca(peca.id, lancamentos);
  return peca.volume > 0 ? Math.min(100, (vc/peca.volume)*100) : 0;
}

/**
 * Volume previsto total = soma volumePrevisto de todas as BTsConfig
 * Volume previsto lançado = soma volumePrevisto das BTs que JÁ foram lançadas
 * Volume previsto faltando = soma volumePrevisto das BTs AINDA não lançadas
 */
export function calcVolumePrevisto(btsConfig, lancamentos) {
  const btIdsLancadas = new Set(lancamentos.map(l => l.btConfigId));
  const total    = btsConfig.reduce((s,b) => s + b.volumePrevisto, 0);
  const lancado  = btsConfig.filter(b => btIdsLancadas.has(b.id)).reduce((s,b) => s + b.volumePrevisto, 0);
  const faltando = btsConfig.filter(b => !btIdsLancadas.has(b.id)).reduce((s,b) => s + b.volumePrevisto, 0);
  return { total, lancado, faltando };
}

export function calcKPIs(pecas, lancamentos, btsConfig, filtroAndar='todos') {
  let ps = filtroAndar==='todos' ? pecas : pecas.filter(p=>p.andar===filtroAndar);
  const totalVol  = ps.reduce((s,p)=>s+p.volume, 0);
  const concVol   = ps.reduce((s,p)=>s+Math.min(p.volume,volLancadoPeca(p.id,lancamentos)), 0);
  const faltVol   = Math.max(0, totalVol-concVol);
  const pctConc   = totalVol>0 ? (concVol/totalVol)*100 : 0;
  const totalPerda  = lancamentos.reduce((s,l)=>s+l.perdaObra, 0);
  const totalReal   = lancamentos.reduce((s,l)=>s+l.volume, 0);
  const indicePerda = totalReal>0 ? (totalPerda/totalReal)*100 : 0;
  const prev = calcVolumePrevisto(btsConfig, lancamentos);
  return { totalVol, concVol, faltVol, pctConc, totalPerda, indicePerda,
    volPrevisto: prev.total, volPrevistoFaltando: prev.faltando };
}

export function calcAndares(pecas, lancamentos, indicePerda=0) {
  const andares = [...new Set(pecas.map(p=>p.andar))].sort();
  return andares.map(a => {
    const ps   = pecas.filter(p=>p.andar===a);
    const prog = ps.reduce((s,p)=>s+p.volume, 0);
    const conc = ps.reduce((s,p)=>s+Math.min(p.volume,volLancadoPeca(p.id,lancamentos)), 0);
    const falt = Math.max(0, prog-conc);
    const pct  = prog>0 ? (conc/prog)*100 : 0;
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
    const pct  = prog>0 ? (conc/prog)*100 : 0;
    return { tipo:t, prog, conc, falt, pct, count:ps.length, pecas:ps };
  });
}

export function calcBTsStatus(btsConfig, lancamentos, concretagemId) {
  return btsConfig.filter(b=>b.concretagemId===concretagemId).sort((a,b)=>a.numero-b.numero).map(b => {
    const lans    = lancamentos.filter(l=>l.btConfigId===b.id);
    const volUsado = lans.reduce((s,l)=>s+l.volume, 0);
    const lancada  = lans.length>0;
    const perdaObra   = lans.reduce((s,l)=>s+l.perdaObra, 0);
    const sobraCam    = lans.reduce((s,l)=>s+l.sobraCaminhao, 0);
    // Perda do caminhão = previsto - executado (pode ser negativo = sobra inesperada)
    const perdaCaminhao = lancada ? b.volumePrevisto - volUsado : 0;
    const perdaTotal    = lancada ? perdaObra + Math.max(0, perdaCaminhao) : 0;
    return { ...b, volUsado, lancada, perdaObra, sobraCam, perdaCaminhao, perdaTotal, lans };
  });
}

export function calcIndicePerda(lancamentos, btsConfig) {
  // Inclui perda do caminhão no índice
  let totalPrevisto = 0, totalExecutado = 0, totalPerdaObra = 0;
  const btIdsLancadas = new Set(lancamentos.map(l=>l.btConfigId));
  btsConfig.filter(b=>btIdsLancadas.has(b.id)).forEach(b => {
    const lans = lancamentos.filter(l=>l.btConfigId===b.id);
    const usado = lans.reduce((s,l)=>s+l.volume, 0);
    totalPrevisto  += b.volumePrevisto;
    totalExecutado += usado;
    totalPerdaObra += lans.reduce((s,l)=>s+l.perdaObra, 0);
  });
  const perdaCaminhao = Math.max(0, totalPrevisto - totalExecutado);
  const perdaTotal    = totalPerdaObra + perdaCaminhao;
  const indice        = totalPrevisto>0 ? (perdaTotal/totalPrevisto)*100 : 0;
  return { indice, perdaTotal, perdaCaminhao, perdaObra:totalPerdaObra, totalPrevisto, totalExecutado };
}

export function statusPeca(pct) {
  return pct>=100?'complete':pct>0?'partial':'pending';
}
