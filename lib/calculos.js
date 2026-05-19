/**
 * lib/calculos.js — funções puras de cálculo
 */

export function fmt2(n) { return parseFloat(n || 0).toFixed(2); }
export function fmt1(n) { return parseFloat(n || 0).toFixed(1); }

/** Volume já concretado de uma peça */
export function volConcretadoPeca(pecaId, lancamentos) {
  return lancamentos
    .filter(l => l.pecaId === pecaId)
    .reduce((s, l) => s + l.volume, 0);
}

/** % concluído de uma peça */
export function pctConcretado(peca, lancamentos) {
  const vc = volConcretadoPeca(peca.id, lancamentos);
  return peca.volume > 0 ? Math.min(100, (vc / peca.volume) * 100) : 0;
}

/** KPIs gerais */
export function calcKPIs(pecas, lancamentos, bts, filtroAndar = 'todos') {
  const ps = filtroAndar === 'todos' ? pecas : pecas.filter(p => p.andar === filtroAndar);
  const totalVol  = ps.reduce((s, p) => s + p.volume, 0);
  const concVol   = ps.reduce((s, p) => s + Math.min(p.volume, volConcretadoPeca(p.id, lancamentos)), 0);
  const faltVol   = Math.max(0, totalVol - concVol);
  const pctConc   = totalVol > 0 ? (concVol / totalVol) * 100 : 0;
  const totalBTs  = bts.length;
  const totalCaminhao = bts.reduce((s, b) => s + b.volumeCaminhao, 0);
  const totalSobra    = bts.reduce((s, b) => s + b.sobraCaminhao, 0);
  const totalPerda    = bts.reduce((s, b) => s + b.perdaObra, 0);
  const indicePerda   = totalCaminhao > 0 ? (totalPerda / totalCaminhao) * 100 : 0;
  return { totalVol, concVol, faltVol, pctConc, totalBTs, totalCaminhao, totalSobra, totalPerda, indicePerda };
}

/** Resumo por andar */
export function calcAndares(pecas, lancamentos) {
  const andares = [...new Set(pecas.map(p => p.andar))].sort();
  return andares.map(a => {
    const ps   = pecas.filter(p => p.andar === a);
    const prog = ps.reduce((s, p) => s + p.volume, 0);
    const conc = ps.reduce((s, p) => s + Math.min(p.volume, volConcretadoPeca(p.id, lancamentos)), 0);
    const falt = Math.max(0, prog - conc);
    const pct  = prog > 0 ? (conc / prog) * 100 : 0;
    return { andar: a, prog, conc, falt, pct };
  });
}

/** Índice por BT — volume caminhão vs usado, sobra, perda */
export function calcRelatorioBTs(bts, lancamentos, concretagens) {
  return bts.map(bt => {
    const volUsado  = lancamentos.filter(l => l.btId === bt.id).reduce((s, l) => s + l.volume, 0);
    const conc      = concretagens.find(c => c.id === bt.concretagemId);
    const pecasAtendidas = new Set(lancamentos.filter(l => l.btId === bt.id).map(l => l.pecaId)).size;
    const pctUso    = bt.volumeCaminhao > 0 ? (volUsado / bt.volumeCaminhao) * 100 : 0;
    const pctPerda  = bt.volumeCaminhao > 0 ? (bt.perdaObra / bt.volumeCaminhao) * 100 : 0;
    return { ...bt, volUsado, conc, pecasAtendidas, pctUso, pctPerda };
  });
}

/** Distribuição de volume por tipo de peça */
export function calcDistribuicaoTipo(pecas, lancamentos) {
  const tipos = {};
  pecas.forEach(p => {
    const vc = Math.min(p.volume, volConcretadoPeca(p.id, lancamentos));
    if (vc > 0) tipos[p.tipo] = (tipos[p.tipo] || 0) + vc;
  });
  return Object.entries(tipos).sort((a, b) => b[1] - a[1]);
}

/** Consumo por concretagem */
export function calcConsumoPorConcretagem(concretagens, bts) {
  return concretagens.sort((a, b) => a.numero - b.numero).map(c => ({
    ...c,
    volume: bts.filter(b => b.concretagemId === c.id).reduce((s, b) => s + b.volumeCaminhao, 0),
    perda:  bts.filter(b => b.concretagemId === c.id).reduce((s, b) => s + b.perdaObra, 0),
    sobra:  bts.filter(b => b.concretagemId === c.id).reduce((s, b) => s + b.sobraCaminhao, 0),
  }));
}

export function statusPeca(pct) {
  if (pct >= 100) return 'complete';
  if (pct > 0)    return 'partial';
  return 'pending';
}
