export const fmt2 = n => parseFloat(n||0).toFixed(2);
export const fmt1 = n => parseFloat(n||0).toFixed(1);

/** Volume já lançado de uma peça */
export function volLancadoPeca(pecaId, lancamentos) {
  return lancamentos.filter(l => l.pecaId === pecaId).reduce((s,l) => s+l.volume, 0);
}

/** % concluído de uma peça */
export function pctConcretado(peca, lancamentos) {
  const vc = volLancadoPeca(peca.id, lancamentos);
  return peca.volume > 0 ? Math.min(100, (vc/peca.volume)*100) : 0;
}

/** KPIs gerais */
export function calcKPIs(pecas, lancamentos, btsConfig, filtroAndar='todos', filtroConc='todas') {
  let ps = pecas;
  if (filtroAndar !== 'todos') ps = ps.filter(p => p.andar === filtroAndar);
  const totalVol   = ps.reduce((s,p) => s+p.volume, 0);
  const concVol    = ps.reduce((s,p) => s+Math.min(p.volume, volLancadoPeca(p.id, lancamentos)), 0);
  const faltVol    = Math.max(0, totalVol - concVol);
  const pctConc    = totalVol > 0 ? (concVol/totalVol)*100 : 0;
  const totalBTs   = btsConfig.length;
  const totalPerda = lancamentos.reduce((s,l) => s+l.perdaObra, 0);
  const totalReal  = lancamentos.reduce((s,l) => s+l.volume, 0);
  const indicePerda = totalReal > 0 ? (totalPerda/totalReal)*100 : 0;
  return { totalVol, concVol, faltVol, pctConc, totalBTs, totalPerda, indicePerda };
}

/** Resumo por andar com projeção de perda */
export function calcAndares(pecas, lancamentos, indicePerda=0) {
  const andares = [...new Set(pecas.map(p=>p.andar))].sort();
  return andares.map(a => {
    const ps   = pecas.filter(p => p.andar === a);
    const prog = ps.reduce((s,p) => s+p.volume, 0);
    const conc = ps.reduce((s,p) => s+Math.min(p.volume, volLancadoPeca(p.id,lancamentos)), 0);
    const falt = Math.max(0, prog-conc);
    const pct  = prog > 0 ? (conc/prog)*100 : 0;
    // Projeção: volume faltando + perda média estimada
    const projPerda = falt * (1 + indicePerda/100);
    return { andar:a, prog, conc, falt, pct, projPerda };
  });
}

/** Resumo por tipo de peça */
export function calcPorTipo(pecas, lancamentos) {
  const tipos = [...new Set(pecas.map(p=>p.tipo))].sort();
  return tipos.map(t => {
    const ps   = pecas.filter(p => p.tipo === t);
    const prog = ps.reduce((s,p) => s+p.volume, 0);
    const conc = ps.reduce((s,p) => s+Math.min(p.volume, volLancadoPeca(p.id,lancamentos)), 0);
    const falt = Math.max(0, prog-conc);
    const pct  = prog > 0 ? (conc/prog)*100 : 0;
    return { tipo:t, prog, conc, falt, pct, count:ps.length };
  });
}

/** BTs de uma concretagem com status */
export function calcBTsStatus(btsConfig, lancamentos, concretagemId) {
  return btsConfig
    .filter(b => b.concretagemId === concretagemId)
    .sort((a,b) => a.numero-b.numero)
    .map(b => {
      const lans = lancamentos.filter(l => l.btConfigId === b.id);
      const volUsado = lans.reduce((s,l) => s+l.volume, 0);
      const lancada  = lans.length > 0;
      const perda    = lans.reduce((s,l) => s+l.perdaObra, 0);
      const sobra    = lans.reduce((s,l) => s+l.sobraCaminhao, 0);
      return { ...b, volUsado, lancada, perda, sobra, lans };
    });
}

/** Índice de perda atual da obra */
export function calcIndicePerda(lancamentos) {
  const totalVol   = lancamentos.reduce((s,l) => s+l.volume, 0);
  const totalPerda = lancamentos.reduce((s,l) => s+l.perdaObra, 0);
  return totalVol > 0 ? (totalPerda/totalVol)*100 : 0;
}

export function statusPeca(pct) {
  return pct >= 100 ? 'complete' : pct > 0 ? 'partial' : 'pending';
}
