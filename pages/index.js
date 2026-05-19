import { useState, useEffect, useCallback } from "react";
import s from "../styles/Home.module.css";
import {
  fmt1, fmt2,
  volConcretadoPeca, pctConcretado,
  calcKPIs, calcAndares, calcBTs,
  calcDistribuicaoTipo, calcConsumoPorConcretagem,
  statusPeca,
} from "../lib/calculos";

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
const CORES = ["#e8a225","#4a9eff","#3ecf7a","#e85a4f","#a855f7","#f59e0b","#14b8a6"];

function badgeClass(status, s_) {
  if (status === "complete") return s_.badgeComplete;
  if (status === "partial")  return s_.badgePartial;
  return s_.badgePending;
}

function badgeLabel(status, pct) {
  if (status === "complete") return "Completo";
  if (status === "partial")  return `Parcial · ${fmt1(pct)}%`;
  return "Pendente";
}

// ─────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────

function KPI({ label, value, unit, sub, variant }) {
  const cls = [s.kpi, variant === "green" ? s.kpiGreen : variant === "red" ? s.kpiRed : variant === "blue" ? s.kpiBlue : ""].join(" ");
  return (
    <div className={cls}>
      <div className={s.kpiLabel}>{label}</div>
      <div className={s.kpiValue}>{value}<span className={s.kpiUnit}>{unit}</span></div>
      {sub && <div className={s.kpiSub}>{sub}</div>}
    </div>
  );
}

function ProgressoPeca({ peca, lancamentos }) {
  const vc  = Math.min(peca.volume, volConcretadoPeca(peca.id, lancamentos));
  const pct = pctConcretado(peca, lancamentos);
  const falt = Math.max(0, peca.volume - vc);
  const fillCls = pct >= 100 ? s.progressFillGreen : pct > 0 ? s.progressFill : s.progressFillBlue;

  return (
    <div className={s.progressWrap}>
      <div className={s.progressHeader}>
        <span className={s.progressName}>
          {peca.nome}
          <span className={s.progressNameSub}>[{peca.tipo}]</span>
        </span>
        <span className={s.progressPct}>{fmt1(pct)}%</span>
      </div>
      <div className={s.progressBar}>
        <div className={`${s.progressFill} ${fillCls}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className={s.progressMeta}>
        concretado {fmt2(vc)} m³ &nbsp;|&nbsp;
        faltando <span className={s.progressMetaRed}>{fmt2(falt)} m³</span> &nbsp;|&nbsp;
        projeto {fmt2(peca.volume)} m³
      </div>
    </div>
  );
}

function BarChart({ concretagens, lancamentos }) {
  if (!concretagens.length) return <div className={s.empty}>Sem concretagens</div>;
  const dados = calcConsumoPorConcretagem(concretagens, lancamentos);
  const maxVol = Math.max(...dados.map(d => d.volume), 0.01);
  return (
    <div className={s.barChart}>
      {dados.map(d => (
        <div key={d.id} className={s.barItem}>
          <div className={s.barVal}>{fmt1(d.volume)}</div>
          <div className={s.barFill} style={{ height: `${(d.volume / maxVol) * 100}%` }} />
          <div className={s.barLabel}>C{d.numero}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ pecas, lancamentos }) {
  const entries = calcDistribuicaoTipo(pecas, lancamentos);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!entries.length || total === 0) {
    return <div className={s.empty}>Sem volume concretado</div>;
  }

  const cx = 60, cy = 60, r = 40;
  let angle = -Math.PI / 2;
  const paths = entries.map(([tipo, vol], i) => {
    const slice = (vol / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + slice);
    const y2 = cy + r * Math.sin(angle + slice);
    const large = slice > Math.PI ? 1 : 0;
    const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    angle += slice;
    return <path key={tipo} d={d} fill={CORES[i % CORES.length]} opacity="0.85" />;
  });

  return (
    <div className={s.donutWrap}>
      <svg viewBox="0 0 120 120" width={120} height={120}>
        <circle cx={60} cy={60} r={48} fill="none" stroke="var(--surface2)" strokeWidth={4} />
        {paths}
        <circle cx={60} cy={60} r={20} fill="var(--surface)" />
        <text x={60} y={57} textAnchor="middle" fontFamily="'Barlow Condensed',sans-serif" fontWeight={700} fontSize={11} fill="var(--text)">{fmt1(total)}</text>
        <text x={60} y={68} textAnchor="middle" fontFamily="'Share Tech Mono',monospace" fontSize={7} fill="var(--text3)">m³</text>
      </svg>
      <div className={s.donutLegend}>
        {entries.map(([tipo, vol], i) => (
          <div key={tipo} className={s.legendItem}>
            <div className={s.legendDot} style={{ background: CORES[i % CORES.length] }} />
            <div>
              <div className={s.legendName}>{tipo}</div>
              <div className={s.legendVal}>{fmt2(vol)} m³ — {fmt1(vol / total * 100)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODAL GENÉRICO
// ─────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className={s.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.modalTitle}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return <div className={s.toast}>{msg}</div>;
}

// ─────────────────────────────────────────────
// HOOK: busca dados da API
// ─────────────────────────────────────────────
function useData() {
  const [data, setData]       = useState({ pecas: [], concretagens: [], lancamentos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Auto-refresh a cada 60s
  useEffect(() => {
    const interval = setInterval(fetch_, 60_000);
    return () => clearInterval(interval);
  }, [fetch_]);

  return { data, loading, error, refresh: fetch_ };
}

// ─────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────
export default function Home() {
  const { data, loading, error, refresh } = useData();
  const { pecas, concretagens, lancamentos } = data;

  const [tab,            setTab]          = useState("operacional");
  const [filtroAndar,    setFiltroAndar]  = useState("todos");
  const [filtroConc,     setFiltroConc]   = useState("todas");
  const [filtroAndarRel, setFiltroAndarRel] = useState("todos");
  const [toast,          setToast]        = useState("");
  const [modal,          setModal]        = useState(null); // 'peca' | 'concretagem' | 'lancamento'
  const [clock,          setClock]        = useState("");

  // Relógio
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("pt-BR"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── ANDARES disponíveis ──
  const andares = [...new Set(pecas.map(p => p.andar))].sort();

  // ── KPIs ──
  const kpis = calcKPIs(pecas, lancamentos, filtroAndar);

  // ── Último lançamento (live panel) ──
  const ultimoLan = lancamentos[lancamentos.length - 1];
  const ultimoConc = ultimoLan ? concretagens.find(c => c.id === ultimoLan.concretagemId) : null;
  const volUltimaBT = ultimoLan
    ? lancamentos.filter(l => l.concretagemId === ultimoLan.concretagemId && l.btNumero === ultimoLan.btNumero).reduce((s, l) => s + l.volume, 0)
    : 0;

  // ── Dados relatório ──
  let lansRel = lancamentos;
  let pecasRel = pecas;
  if (filtroConc !== "todas") lansRel = lansRel.filter(l => l.concretagemId === filtroConc);
  if (filtroAndarRel !== "todos") pecasRel = pecasRel.filter(p => p.andar === filtroAndarRel);
  const pecaIdsRel = new Set(pecasRel.map(p => p.id));
  lansRel = lansRel.filter(l => pecaIdsRel.has(l.pecaId));

  const relProg    = pecasRel.reduce((s, p) => s + p.volume, 0);
  const relReal    = lansRel.reduce((s, l) => s + l.volume, 0);
  const relPerda   = relReal - relProg;
  const relIndice  = relProg > 0 ? (relReal / relProg) * 100 : 0;

  // ──────────────────────
  if (loading) return (
    <div className={s.loadingWrap}>
      <div className={s.loadingText}>CARREGANDO DADOS...</div>
    </div>
  );

  if (error) return (
    <div className={s.errorPanel}>
      <div>⚠ Falha ao carregar dados do Google Sheets</div>
      <div style={{ color: "var(--text2)", marginTop: 8 }}>{error}</div>
      <button className={s.refreshBtn} onClick={refresh}>↻ Tentar novamente</button>
    </div>
  );

  return (
    <>
      {/* ── HEADER ── */}
      <header className={s.header}>
        <div>
          <span className={s.logoMark}>⬛ Concreto</span>
          <span className={s.logoSub}>Sistema de Controle de Concretagem</span>
        </div>
        <div className={s.liveBadge}>
          <div className={s.liveDot} />
          <span>{clock}</span>
          <button className={s.btnSecondary} style={{ marginLeft: 12, padding: "6px 14px", fontSize: 11 }} onClick={refresh}>↻ Atualizar</button>
        </div>
      </header>

      {/* ── NAV ── */}
      <nav className={s.nav}>
        {["operacional", "relatorios"].map(t => (
          <button key={t} className={`${s.navTab} ${tab === t ? s.navTabActive : ""}`} onClick={() => setTab(t)}>
            {t === "operacional" ? "⬡ Operacional" : "◈ Relatórios & Índices"}
          </button>
        ))}
      </nav>

      {/* ════════════════════════════════════════ */}
      {/* PÁGINA: OPERACIONAL                      */}
      {/* ════════════════════════════════════════ */}
      {tab === "operacional" && (
        <main className={`${s.page} animate-fadein`}>

          {/* KPIs */}
          <div className={s.grid4}>
            <KPI label="Volume Total Projeto" value={fmt2(kpis.totalVol)} unit="m³" sub={`${pecas.length} peças cadastradas`} />
            <KPI label="Volume Concretado"    value={fmt2(kpis.concVol)}  unit="m³" sub={`${fmt1(kpis.pctConc)}% do projeto`} variant="green" />
            <KPI label="Volume Faltando"      value={fmt2(kpis.faltVol)}  unit="m³" sub={`${fmt1(100 - kpis.pctConc)}% restante`} variant="red" />
            <KPI label="BTs Utilizadas"       value={kpis.btsUsadas}      unit=""   sub={`${concretagens.length} concretagens`} variant="blue" />
          </div>

          <div className={s.grid2}>
            {/* Coluna esquerda */}
            <div>
              {/* Chips de andar */}
              <div className={s.sectionTitle}>Filtrar por Andar</div>
              <div className={s.chips}>
                {["todos", ...andares].map(a => (
                  <button key={a} className={`${s.chip} ${filtroAndar === a ? s.chipActive : ""}`} onClick={() => setFiltroAndar(a)}>
                    {a === "todos" ? "Todos" : a}
                  </button>
                ))}
              </div>

              {/* Progresso */}
              <div className={s.panel}>
                <div className={s.panelTitle}>
                  Progresso das Peças — {filtroAndar === "todos" ? "Todos os Andares" : filtroAndar}
                </div>
                {pecas.filter(p => filtroAndar === "todos" || p.andar === filtroAndar).length === 0
                  ? <div className={s.empty}>Nenhuma peça encontrada.<br />Adicione peças na planilha Google Sheets.</div>
                  : pecas.filter(p => filtroAndar === "todos" || p.andar === filtroAndar).map(p => (
                    <ProgressoPeca key={p.id} peca={p} lancamentos={lancamentos} />
                  ))
                }
              </div>
            </div>

            {/* Coluna direita */}
            <div>
              {/* Live panel */}
              {ultimoLan && (
                <div className={s.livePanel}>
                  <div className={s.livePanelBadge}>Em Andamento</div>
                  <div className={s.panelTitle} style={{ color: "var(--accent)" }}>Concretagem Ativa</div>
                  <div className={s.livePanelGrid}>
                    <div>
                      <div className={s.kpiLabel}>Nº Concretagem</div>
                      <div className={s.liveVal}>{ultimoConc ? `Nº ${ultimoConc.numero}` : "—"}</div>
                    </div>
                    <div>
                      <div className={s.kpiLabel}>BT Atual</div>
                      <div className={`${s.liveVal} ${s.liveValNeutral}`}>BT-{ultimoLan.btNumero}</div>
                    </div>
                  </div>
                  <div className={s.divider} />
                  <div className={s.kpiLabel} style={{ marginBottom: 6 }}>Volume lançado nesta BT</div>
                  <div className={s.liveBigVal}>{fmt2(volUltimaBT)} m³</div>
                </div>
              )}

              {/* Aviso: dados só-leitura */}
              <div style={{ background: "rgba(74,158,255,0.07)", border: "1px solid rgba(74,158,255,0.25)", padding: "12px 16px", marginBottom: 24, fontFamily: "var(--mono)", fontSize: 11, color: "var(--blue)", lineHeight: 1.8 }}>
                ℹ Os dados são lidos do Google Sheets em tempo real.<br />
                Para lançar BTs ou adicionar peças, edite a planilha diretamente.
              </div>

              {/* Últimos lançamentos */}
              <div className={s.panel}>
                <div className={s.panelTitle}>Últimos Lançamentos de BT</div>
                {lancamentos.length === 0
                  ? <div className={s.empty}>Nenhum lançamento ainda</div>
                  : (
                    <div className={s.tableWrap}>
                      <table className={s.table}>
                        <thead>
                          <tr>
                            <th>Conc.</th>
                            <th>BT Nº</th>
                            <th>Peça</th>
                            <th>%</th>
                            <th>m³</th>
                            <th>Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...lancamentos].reverse().slice(0, 20).map(l => {
                            const peca = pecas.find(p => p.id === l.pecaId);
                            const conc = concretagens.find(c => c.id === l.concretagemId);
                            return (
                              <tr key={l.id}>
                                <td className={s.tdMono}>{conc ? conc.numero : "—"}</td>
                                <td className={s.tdAccent}>BT-{l.btNumero}</td>
                                <td>{peca ? peca.nome : l.pecaId}</td>
                                <td className={s.tdMono}>{fmt1(l.pct)}%</td>
                                <td className={s.tdGreen}>{fmt2(l.volume)}</td>
                                <td className={s.tdMuted}>{l.hora}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ════════════════════════════════════════ */}
      {/* PÁGINA: RELATÓRIOS                       */}
      {/* ════════════════════════════════════════ */}
      {tab === "relatorios" && (
        <main className={`${s.page} animate-fadein`}>

          {/* Filtros */}
          <div className={s.panel} style={{ marginBottom: 24 }}>
            <div className={s.panelTitle}>Filtros de Análise</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <label className={s.formLabel} style={{ display: "block", marginBottom: 6 }}>Concretagem</label>
                <select className={s.formSelect} style={{ maxWidth: 280 }} value={filtroConc} onChange={e => setFiltroConc(e.target.value)}>
                  <option value="todas">Todas as concretagens</option>
                  {concretagens.sort((a,b) => a.numero - b.numero).map(c => (
                    <option key={c.id} value={c.id}>Concretagem Nº {c.numero} — {c.data}{c.descricao ? ` | ${c.descricao}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={s.formLabel} style={{ display: "block", marginBottom: 6 }}>Andar</label>
                <select className={s.formSelect} style={{ maxWidth: 220 }} value={filtroAndarRel} onChange={e => setFiltroAndarRel(e.target.value)}>
                  <option value="todos">Todos os andares</option>
                  {andares.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* KPIs de relatório */}
          <div className={s.grid4}>
            <KPI label="Volume Programado" value={fmt2(relProg)} unit="m³" />
            <KPI label="Volume Real (BTs)" value={fmt2(relReal)} unit="m³" variant="green" />
            <KPI label="Sobra / Perda" value={fmt2(Math.abs(relPerda))} unit="m³"
              sub={relPerda >= 0 ? `+${fmt1(relPerda)} m³ acima` : `${fmt1(relPerda)} m³ abaixo`} variant="red" />
            <KPI label="Índice de Uso BT" value={fmt1(relIndice)} unit="%"
              sub={relIndice > 100 ? "acima do programado" : relIndice === 0 ? "sem dados" : "eficiência de consumo"} variant="blue" />
          </div>

          <div className={s.grid2}>
            {/* Gráfico consumo */}
            <div className={s.panel}>
              <div className={s.panelTitle}>Consumo por Concretagem (m³)</div>
              <BarChart concretagens={concretagens} lancamentos={lansRel} />
            </div>

            {/* Donut */}
            <div className={s.panel}>
              <div className={s.panelTitle}>Distribuição Volume por Tipo</div>
              <DonutChart pecas={pecasRel} lancamentos={lansRel} />
            </div>

            {/* Tabela BTs */}
            <div className={s.panel}>
              <div className={s.panelTitle}>Índice por BT</div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>BT Nº</th><th>Concretagem</th><th>Vol. Usado (m³)</th><th>Peças</th><th>% Utilização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcBTs(lansRel, concretagens).length === 0
                      ? <tr><td colSpan={5} className={s.empty} style={{ padding: "24px 16px" }}>Sem dados</td></tr>
                      : calcBTs(lansRel, concretagens).map(bt => (
                        <tr key={`${bt.concretagemId}-${bt.btNumero}`}>
                          <td className={s.tdAccent}>BT-{bt.btNumero}</td>
                          <td className={s.tdMono}>{bt.concretagem ? `Nº ${bt.concretagem.numero}` : "—"}</td>
                          <td className={s.tdGreen}>{fmt2(bt.volume)}</td>
                          <td className={s.tdMono}>{bt.pecas}</td>
                          <td className={s.tdMono}>{fmt1(bt.pctUtil)}%</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela andares */}
            <div className={s.panel}>
              <div className={s.panelTitle}>Resumo por Andar</div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Andar</th><th>Programado (m³)</th><th>Concretado (m³)</th><th>Faltando (m³)</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcAndares(pecasRel, lansRel).length === 0
                      ? <tr><td colSpan={5} className={s.empty} style={{ padding: "24px 16px" }}>Sem dados</td></tr>
                      : calcAndares(pecasRel, lansRel).map(a => {
                        const st = statusPeca(a.pct);
                        return (
                          <tr key={a.andar}>
                            <td style={{ fontWeight: 500 }}>{a.andar}</td>
                            <td className={s.tdMono}>{fmt2(a.prog)}</td>
                            <td className={s.tdGreen}>{fmt2(a.conc)}</td>
                            <td className={s.tdRed}>{fmt2(a.falt)}</td>
                            <td><span className={`${s.badge} ${badgeClass(st, s)}`}>{badgeLabel(st, a.pct)}</span></td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Tabela completa de peças */}
          <div className={s.panel}>
            <div className={s.panelTitle}>Base de Dados — Todas as Peças</div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>#</th><th>Peça</th><th>Andar</th><th>Tipo</th>
                    <th>Vol. Projeto (m³)</th><th>Vol. Concretado (m³)</th><th>% Concluído</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pecasRel.length === 0
                    ? <tr><td colSpan={8} className={s.empty} style={{ padding: "24px 16px" }}>Nenhuma peça cadastrada</td></tr>
                    : pecasRel.map((p, i) => {
                      const vc  = Math.min(p.volume, volConcretadoPeca(p.id, lancamentos));
                      const pct = pctConcretado(p, lancamentos);
                      const st  = statusPeca(pct);
                      return (
                        <tr key={p.id}>
                          <td className={s.tdMuted}>{i + 1}</td>
                          <td style={{ fontWeight: 500 }}>{p.nome}</td>
                          <td className={s.tdMono}>{p.andar}</td>
                          <td style={{ color: "var(--text2)", fontSize: 12 }}>{p.tipo}</td>
                          <td className={s.tdMono}>{fmt2(p.volume)}</td>
                          <td className={s.tdGreen}>{fmt2(vc)}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className={s.progressBar} style={{ width: 60 }}>
                                <div className={`${s.progressFill} ${pct >= 100 ? s.progressFillGreen : ""}`} style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className={s.tdMono}>{fmt1(pct)}%</span>
                            </div>
                          </td>
                          <td><span className={`${s.badge} ${badgeClass(st, s)}`}>{badgeLabel(st, pct)}</span></td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      <Toast msg={toast} onDone={() => setToast("")} />
    </>
  );
}
