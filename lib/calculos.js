/**
 * lib/calculos.js
 * Funções puras de cálculo. Não dependem de React nem de Sheets.
 */

export function fmt2(n) { return parseFloat(n || 0).toFixed(2); }
export function fmt1(n) { return parseFloat(n || 0).toFixed(1); }

/** Volume já concretado de uma peça específica */
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

/** KPIs gerais filtrando por andar (ou 'todos') */
export function calcKPIs(pecas, lancamentos, filtroAndar = 'todos') {
  const ps = filtroAndar === 'todos' ? pecas : pecas.filter(p => p.andar === filtroAndar);
  const totalVol   = ps.reduce((s, p) => s + p.volume, 0);
  const concVol    = ps.reduce((s, p) => s + Math.min(p.volume, volConcretadoPeca(p.id, lancamentos)), 0);
  const faltVol    = Math.max(0, totalVol - concVol);
  const pctConc    = totalVol > 0 ? (concVol / totalVol) * 100 : 0;
  const btsUsadas  = new Set(lancamentos.map(l => `${l.concretagemId}-${l.btNumero}`)).size;
  return { totalVol, concVol, faltVol, pctConc, btsUsadas };
}

/** Resumo por andar */
export function calcAndares(pecas, lancamentos) {
  const andares = [...new Set(pecas.map(p => p.andar))].sort();
  return andares.map(a => {
    const ps   = pecas.filter(p => p.andar === a);
    const prog = ps.reduce((s, p) => s + p.volume, 0);
    const conc = ps.reduce((s, p) => {
      const vc = lancamentos.filter(l => l.pecaId === p.id).reduce((ss, l) => ss + l.volume, 0);
      return s + Math.min(p.volume, vc);
    }, 0);
    const falt = Math.max(0, prog - conc);
    const pct  = prog > 0 ? (conc / prog) * 100 : 0;
    return { andar: a, prog, conc, falt, pct };
  });
}

/** Índice por BT */
export function calcBTs(lancamentos, concretagens) {
  const bts = {};
  lancamentos.forEach(l => {
    const key = `${l.concretagemId}-${l.btNumero}`;
    if (!bts[key]) bts[key] = { concretagemId: l.concretagemId, btNumero: l.btNumero, volume: 0, pecas: new Set() };
    bts[key].volume += l.volume;
    bts[key].pecas.add(l.pecaId);
  });
  return Object.values(bts).map(bt => {
    const conc = concretagens.find(c => c.id === bt.concretagemId);
    const volConc = lancamentos.filter(l => l.concretagemId === bt.concretagemId).reduce((s, l) => s + l.volume, 0);
    const pctUtil = volConc > 0 ? (bt.volume / volConc) * 100 : 0;
    return { ...bt, pecas: bt.pecas.size, concretagem: conc, pctUtil };
  }).sort((a, b) => a.btNumero - b.btNumero);
}

/** Distribuição de volume concretado por tipo de peça */
export function calcDistribuicaoTipo(pecas, lancamentos) {
  const tipos = {};
  pecas.forEach(p => {
    const vc = Math.min(p.volume, lancamentos.filter(l => l.pecaId === p.id).reduce((s, l) => s + l.volume, 0));
    if (vc > 0) tipos[p.tipo] = (tipos[p.tipo] || 0) + vc;
  });
  return Object.entries(tipos).sort((a, b) => b[1] - a[1]);
}

/** Consumo por concretagem (para gráfico de barras) */
export function calcConsumoPorConcretagem(concretagens, lancamentos) {
  return concretagens
    .sort((a, b) => a.numero - b.numero)
    .map(c => ({
      ...c,
      volume: lancamentos.filter(l => l.concretagemId === c.id).reduce((s, l) => s + l.volume, 0),
    }));
}

/** Status de uma peça */
export function statusPeca(pct) {
  if (pct >= 100) return 'complete';
  if (pct > 0)    return 'partial';
  return 'pending';
}
