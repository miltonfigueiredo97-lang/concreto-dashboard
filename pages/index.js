import { useState, useEffect, useCallback } from 'react';
import s from '../styles/Home.module.css';
import {
  fmt1, fmt2,
  volConcretadoPeca, pctConcretado,
  calcKPIs, calcAndares, calcRelatorioBTs,
  calcDistribuicaoTipo, calcConsumoPorConcretagem,
  statusPeca,
} from '../lib/calculos';
import { apiLancarBT, apiAdicionarPeca, apiAdicionarConcretagem } from '../lib/api';

const CORES = ['#e8a225','#4a9eff','#3ecf7a','#e85a4f','#a855f7','#f59e0b','#14b8a6'];
const TIPOS = ['Pilar','Viga','Laje','Fundação','Cortina','Escada','Caixa D\'água','Outro'];

function badgeCls(status) {
  if (status === 'complete') return s.badgeComplete;
  if (status === 'partial')  return s.badgePartial;
  return s.badgePending;
}
function badgeLabel(status, pct) {
  if (status === 'complete') return 'Completo';
  if (status === 'partial')  return `Parcial · ${fmt1(pct)}%`;
  return 'Pendente';
}

// ── KPI ───────────────────────────────────────
function KPI({ label, value, unit, sub, variant }) {
  const cls = [s.kpi,
    variant === 'green'  ? s.kpiGreen  :
    variant === 'red'    ? s.kpiRed    :
    variant === 'blue'   ? s.kpiBlue   :
    variant === 'orange' ? s.kpiOrange : ''
  ].join(' ');
  return (
    <div className={cls}>
      <div className={s.kpiLabel}>{label}</div>
      <div className={s.kpiValue}>{value}<span className={s.kpiUnit}>{unit}</span></div>
      {sub && <div className={s.kpiSub}>{sub}</div>}
    </div>
  );
}

// ── PROGRESSO PEÇA ────────────────────────────
function ProgressoPeca({ peca, lancamentos }) {
  const vc   = Math.min(peca.volume, volConcretadoPeca(peca.id, lancamentos));
  const pct  = pctConcretado(peca, lancamentos);
  const falt = Math.max(0, peca.volume - vc);
  return (
    <div className={s.progressWrap}>
      <div className={s.progressHeader}>
        <span className={s.progressName}>{peca.nome} <span className={s.progressNameSub}>[{peca.tipo}]</span></span>
        <span className={s.progressPct}>{fmt1(pct)}%</span>
      </div>
      <div className={s.progressBar}>
        <div className={`${s.progressFill} ${pct >= 100 ? s.progressFillGreen : pct > 0 ? '' : s.progressFillBlue}`}
          style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className={s.progressMeta}>
        concretado {fmt2(vc)} m³ &nbsp;|&nbsp;
        faltando <span className={s.progressMetaRed}>{fmt2(falt)} m³</span> &nbsp;|&nbsp;
        projeto {fmt2(peca.volume)} m³
      </div>
    </div>
  );
}

// ── DONUT ─────────────────────────────────────
function DonutChart({ pecas, lancamentos }) {
  const entries = calcDistribuicaoTipo(pecas, lancamentos);
  const total   = entries.reduce((s,[,v]) => s+v, 0);
  if (!entries.length || !total) return <div className={s.empty}>Sem volume concretado</div>;
  const cx=60,cy=60,r=40; let angle=-Math.PI/2;
  const paths = entries.map(([tipo,vol],i) => {
    const sl=(vol/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(angle+sl),y2=cy+r*Math.sin(angle+sl);
    const d=`M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sl>Math.PI?1:0},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    angle+=sl;
    return <path key={tipo} d={d} fill={CORES[i%CORES.length]} opacity="0.85"/>;
  });
  return (
    <div className={s.donutWrap}>
      <svg viewBox="0 0 120 120" width={120} height={120}>
        <circle cx={60} cy={60} r={48} fill="none" stroke="var(--surface2)" strokeWidth={4}/>
        {paths}
        <circle cx={60} cy={60} r={20} fill="var(--surface)"/>
        <text x={60} y={57} textAnchor="middle" fontFamily="'Barlow Condensed',sans-serif" fontWeight={700} fontSize={11} fill="var(--text)">{fmt1(total)}</text>
        <text x={60} y={68} textAnchor="middle" fontFamily="'Share Tech Mono',monospace" fontSize={7} fill="var(--text3)">m³</text>
      </svg>
      <div className={s.donutLegend}>
        {entries.map(([tipo,vol],i) => (
          <div key={tipo} className={s.legendItem}>
            <div className={s.legendDot} style={{background:CORES[i%CORES.length]}}/>
            <div><div className={s.legendName}>{tipo}</div>
              <div className={s.legendVal}>{fmt2(vol)} m³ — {fmt1(vol/total*100)}%</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BAR CHART ─────────────────────────────────
function BarChart({ concretagens, bts }) {
  if (!concretagens.length) return <div className={s.empty}>Sem concretagens</div>;
  const dados=calcConsumoPorConcretagem(concretagens,bts);
  const maxVol=Math.max(...dados.map(d=>d.volume),0.01);
  return (
    <div className={s.barChart}>
      {dados.map(d=>(
        <div key={d.id} className={s.barItem}>
          <div className={s.barVal}>{fmt1(d.volume)}</div>
          <div className={s.barFill} style={{height:`${(d.volume/maxVol)*100}%`}}/>
          <div className={s.barLabel}>C{d.numero}</div>
        </div>
      ))}
    </div>
  );
}

// ── TOAST ─────────────────────────────────────
function Toast({ msg, tipo, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return <div className={`${s.toast} ${tipo === 'err' ? s.toastErr : ''}`}>{msg}</div>;
}

// ── HOOK DADOS ────────────────────────────────
function useData() {
  const [data, setData]       = useState({ pecas:[], concretagens:[], bts:[], lancamentos:[] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { const id=setInterval(fetch_,60000); return ()=>clearInterval(id); }, [fetch_]);
  return { data, loading, error, refresh: fetch_ };
}

// ── MODAL GENÉRICO ────────────────────────────
function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className={s.modalOverlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`${s.modal} ${wide?s.modalWide:''}`}>
        <div className={s.modalTitle}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── MODAL: LANÇAR BT ──────────────────────────
function ModalLancarBT({ open, onClose, pecas, concretagens, bts, onSalvo }) {
  const [step,           setStep]          = useState(1);
  const [concId,         setConcId]        = useState('');
  const [numBT,          setNumBT]         = useState('');
  const [volCaminhao,    setVolCaminhao]   = useState('8');
  const [hora,           setHora]          = useState('');
  const [linhas,         setLinhas]        = useState([{ pecaId:'', pct:'' }]);
  const [sobraCaminhao,  setSobraCaminhao] = useState('');
  const [perdaObra,      setPerdaObra]     = useState('');
  const [obs,            setObs]           = useState('');
  const [salvando,       setSalvando]      = useState(false);
  const [erro,           setErro]          = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1); setErro('');
    setConcId(concretagens.length ? concretagens[concretagens.length-1].id : '');
    const now = new Date();
    setHora(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    setLinhas([{ pecaId:'', pct:'' }]);
    setSobraCaminhao(''); setPerdaObra(''); setObs('');
  }, [open]);

  useEffect(() => {
    if (!concId) return;
    const max = bts.filter(b=>b.concretagemId===concId).reduce((m,b)=>Math.max(m,b.numero),0);
    setNumBT(String(max+1));
  }, [concId, bts]);

  const volLinha = l => {
    const peca=pecas.find(p=>p.id===l.pecaId), pct=parseFloat(l.pct);
    return peca&&!isNaN(pct) ? (pct/100)*peca.volume : 0;
  };
  const totalUsado  = linhas.reduce((s,l)=>s+volLinha(l),0);
  const volCam      = parseFloat(volCaminhao)||0;
  const sobEstimada = Math.max(0, volCam-totalUsado);

  const addLinha = ()=>setLinhas(p=>[...p,{pecaId:'',pct:''}]);
  const remLinha = i=>setLinhas(p=>p.filter((_,idx)=>idx!==i));
  const updLinha = (i,f,v)=>setLinhas(p=>p.map((l,idx)=>idx===i?{...l,[f]:v}:l));

  async function salvar() {
    setErro('');
    const linhasVal = linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0);
    if (!concId)          { setErro('Selecione a concretagem'); return; }
    if (!numBT)           { setErro('Informe o nº da BT'); return; }
    if (!volCam)          { setErro('Informe o volume do caminhão'); return; }
    if (!linhasVal.length){ setErro('Adicione ao menos 1 peça com %'); return; }
    setSalvando(true);
    try {
      await apiLancarBT({
        concId, numBT:parseInt(numBT), volCaminhao:volCam,
        sobraCaminhao:parseFloat(sobraCaminhao)||0,
        perdaObra:parseFloat(perdaObra)||0,
        hora, obs, linhas:linhasVal, pecas,
      });
      onSalvo(`✓ BT-${numBT} lançada com sucesso no Google Sheets!`);
      onClose();
    } catch(e) {
      setErro('Erro ao salvar: ' + e.message);
    } finally { setSalvando(false); }
  }

  if (!open) return null;
  return (
    <div className={s.modalOverlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`${s.modal} ${s.modalWide}`}>
        <div className={s.modalTitle}>⊕ Lançar Betonada (BT)</div>

        {/* Steps */}
        <div className={s.steps}>
          {['Dados da BT','Peças','Fechamento'].map((label,i)=>(
            <div key={i} className={`${s.step} ${step===i+1?s.stepActive:step>i+1?s.stepDone:''}`}>
              <div className={s.stepNum}>{step>i+1?'✓':i+1}</div>
              <div className={s.stepLabel}>{label}</div>
            </div>
          ))}
        </div>

        {erro && <div className={s.alertRed} style={{marginBottom:16}}>{erro}</div>}

        {/* STEP 1 */}
        {step===1 && (
          <div>
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Concretagem</label>
                <select className={s.formSelect} value={concId} onChange={e=>setConcId(e.target.value)}>
                  <option value="">— selecione —</option>
                  {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=>(
                    <option key={c.id} value={c.id}>Nº {c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Nº da BT</label>
                <input className={s.formInput} type="number" min="1" value={numBT} onChange={e=>setNumBT(e.target.value)}/>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Volume do Caminhão (m³)</label>
                <input className={s.formInput} type="number" step="0.5" min="0.5" value={volCaminhao} onChange={e=>setVolCaminhao(e.target.value)}/>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Hora</label>
                <input className={s.formInput} type="time" value={hora} onChange={e=>setHora(e.target.value)}/>
              </div>
            </div>
            <div className={s.btnRow}>
              <button className={s.btnSecondary} onClick={onClose}>Cancelar</button>
              <button className={s.btnPrimary} onClick={()=>{
                if(!concId||!numBT||!volCam){setErro('Preencha todos os campos');return;}
                setErro(''); setStep(2);
              }}>Próximo →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step===2 && (
          <div>
            <div className={s.btResumo}>
              <span style={{color:'var(--accent)',fontWeight:700}}>BT-{numBT}</span>
              <span>|</span>
              <span>{fmt2(volCam)} m³ no caminhão</span>
              <span>|</span>
              <span style={{color:totalUsado>volCam?'var(--red)':'var(--green)'}}>
                {fmt2(totalUsado)} m³ usado
              </span>
              <span>|</span>
              <span style={{color:'var(--text2)'}}>sobra estimada: {fmt2(sobEstimada)} m³</span>
            </div>

            {linhas.map((l,i)=>{
              const peca=pecas.find(p=>p.id===l.pecaId);
              const vol=volLinha(l);
              const pctJaFeito=peca?pctConcretado(peca,[]):0;
              return (
                <div key={i} className={s.pecaLinha}>
                  <div className={s.formGroup} style={{flex:2}}>
                    {i===0&&<label className={s.formLabel}>Peça</label>}
                    <select className={s.formSelect} value={l.pecaId} onChange={e=>updLinha(i,'pecaId',e.target.value)}>
                      <option value="">— selecione —</option>
                      {[...pecas].sort((a,b)=>a.andar.localeCompare(b.andar)||a.nome.localeCompare(b.nome)).map(p=>(
                        <option key={p.id} value={p.id}>{p.nome} ({p.andar}) — {fmt2(p.volume)} m³</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup} style={{width:100}}>
                    {i===0&&<label className={s.formLabel}>% nesta BT</label>}
                    <input className={s.formInput} type="number" min="0.1" max="100" step="0.5"
                      placeholder="%" value={l.pct} onChange={e=>updLinha(i,'pct',e.target.value)}/>
                  </div>
                  <div className={s.formGroup} style={{width:90}}>
                    {i===0&&<label className={s.formLabel}>m³</label>}
                    <input className={s.formInput} readOnly
                      value={vol>0?fmt2(vol):''} style={{color:'var(--accent)'}}/>
                  </div>
                  <div style={{alignSelf:'flex-end',paddingBottom:2}}>
                    {linhas.length>1&&<button className={s.btnDanger} onClick={()=>remLinha(i)}>✕</button>}
                  </div>
                </div>
              );
            })}

            <button className={s.btnSecondary} style={{marginTop:12}} onClick={addLinha}>+ Adicionar peça</button>

            {totalUsado>volCam&&(
              <div className={s.alertRed} style={{marginTop:12}}>
                ⚠ Volume usado ({fmt2(totalUsado)} m³) ultrapassa o caminhão ({fmt2(volCam)} m³).
              </div>
            )}

            <div className={s.btnRow}>
              <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(1);}}>← Voltar</button>
              <button className={s.btnPrimary} onClick={()=>{
                const val=linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0);
                if(!val.length){setErro('Adicione ao menos 1 peça');return;}
                setErro(''); setStep(3);
              }}>Próximo →</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step===3 && (
          <div>
            <div className={s.btResumo} style={{marginBottom:20}}>
              <span style={{color:'var(--accent)',fontWeight:700}}>BT-{numBT}</span>
              <span>|</span><span>{fmt2(volCam)} m³ no caminhão</span>
              <span>|</span><span style={{color:'var(--green)'}}>{fmt2(totalUsado)} m³ nas peças</span>
              <span>|</span><span style={{color:'var(--text2)'}}>sobra est.: {fmt2(sobEstimada)} m³</span>
            </div>

            {/* Resumo das peças */}
            <div style={{marginBottom:20}}>
              {linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0).map((l,i)=>{
                const peca=pecas.find(p=>p.id===l.pecaId);
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    padding:'8px 0',borderBottom:'1px solid var(--border)',
                    fontFamily:'var(--mono)',fontSize:12}}>
                    <span style={{color:'var(--text)'}}>{peca?peca.nome:l.pecaId}</span>
                    <span style={{color:'var(--accent)'}}>{l.pct}% → {fmt2(volLinha(l))} m³</span>
                  </div>
                );
              })}
            </div>

            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Sobra que foi embora com o caminhão (m³)</label>
                <input className={s.formInput} type="number" step="0.01" min="0"
                  placeholder={`sugestão: ${fmt2(sobEstimada)}`}
                  value={sobraCaminhao} onChange={e=>setSobraCaminhao(e.target.value)}/>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Perda em obra (m³)</label>
                <input className={s.formInput} type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={perdaObra} onChange={e=>setPerdaObra(e.target.value)}/>
              </div>
              <div className={`${s.formGroup} ${s.formGroupFull}`}>
                <label className={s.formLabel}>Observação (opcional)</label>
                <input className={s.formInput} type="text"
                  placeholder="ex: bombeado, vibrador travou, fck 30..."
                  value={obs} onChange={e=>setObs(e.target.value)}/>
              </div>
            </div>

            <div className={s.btnRow}>
              <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(2);}}>← Voltar</button>
              <button className={s.btnPrimary} disabled={salvando} onClick={salvar}>
                {salvando ? '⏳ Salvando no Sheets...' : '✓ Confirmar BT'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MODAL: NOVA PEÇA ──────────────────────────
function ModalNovaPeca({ open, onClose, andares, onSalvo }) {
  const [nome,     setNome]    = useState('');
  const [tipo,     setTipo]    = useState('Pilar');
  const [andar,    setAndar]   = useState('');
  const [volume,   setVolume]  = useState('');
  const [salvando, setSalvando]= useState(false);
  const [erro,     setErro]    = useState('');

  useEffect(()=>{ if(open){setNome('');setTipo('Pilar');setAndar('');setVolume('');setErro('');} },[open]);

  async function salvar() {
    if(!nome||!andar||!volume){setErro('Preencha todos os campos');return;}
    setSalvando(true);
    try {
      await apiAdicionarPeca({ nome, tipo, andar, volume: parseFloat(volume) });
      onSalvo(`✓ Peça "${nome}" adicionada!`);
      onClose();
    } catch(e){setErro('Erro: '+e.message);}
    finally{setSalvando(false);}
  }

  return (
    <Modal open={open} onClose={onClose} title="+ Nova Peça">
      {erro&&<div className={s.alertRed} style={{marginBottom:16}}>{erro}</div>}
      <div className={s.formGrid}>
        <div className={s.formGroup}>
          <label className={s.formLabel}>Nome da Peça</label>
          <input className={s.formInput} placeholder="ex: Pilar P-01" value={nome} onChange={e=>setNome(e.target.value)}/>
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>Tipo</label>
          <select className={s.formSelect} value={tipo} onChange={e=>setTipo(e.target.value)}>
            {TIPOS.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>Andar / Pavimento</label>
          <input className={s.formInput} placeholder="ex: Térreo, 1º Pavimento" value={andar}
            onChange={e=>setAndar(e.target.value)} list="andares-list"/>
          <datalist id="andares-list">{andares.map(a=><option key={a} value={a}/>)}</datalist>
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>Volume Projeto (m³)</label>
          <input className={s.formInput} type="number" step="0.01" min="0.01" placeholder="0.00"
            value={volume} onChange={e=>setVolume(e.target.value)}/>
        </div>
      </div>
      <div className={s.btnRow}>
        <button className={s.btnSecondary} onClick={onClose}>Cancelar</button>
        <button className={s.btnPrimary} disabled={salvando} onClick={salvar}>
          {salvando?'⏳ Salvando...':'Cadastrar Peça'}
        </button>
      </div>
    </Modal>
  );
}

// ── MODAL: NOVA CONCRETAGEM ───────────────────
function ModalNovaConcretagem({ open, onClose, concretagens, onSalvo }) {
  const [numero,   setNumero]  = useState('');
  const [data,     setData]    = useState('');
  const [desc,     setDesc]    = useState('');
  const [salvando, setSalvando]= useState(false);
  const [erro,     setErro]    = useState('');

  useEffect(()=>{
    if(open){
      setNumero(String(concretagens.length+1));
      setData(new Date().toISOString().slice(0,10));
      setDesc(''); setErro('');
    }
  },[open]);

  async function salvar(){
    if(!numero||!data){setErro('Preencha número e data');return;}
    setSalvando(true);
    try{
      await apiAdicionarConcretagem({numero,data,descricao:desc});
      onSalvo(`✓ Concretagem Nº ${numero} criada!`);
      onClose();
    }catch(e){setErro('Erro: '+e.message);}
    finally{setSalvando(false);}
  }

  return (
    <Modal open={open} onClose={onClose} title="◈ Nova Concretagem">
      {erro&&<div className={s.alertRed} style={{marginBottom:16}}>{erro}</div>}
      <div className={s.formGrid}>
        <div className={s.formGroup}>
          <label className={s.formLabel}>Número</label>
          <input className={s.formInput} type="number" min="1" value={numero} onChange={e=>setNumero(e.target.value)}/>
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>Data</label>
          <input className={s.formInput} type="date" value={data} onChange={e=>setData(e.target.value)}/>
        </div>
        <div className={`${s.formGroup} ${s.formGroupFull}`}>
          <label className={s.formLabel}>Descrição</label>
          <input className={s.formInput} placeholder="ex: Pilares Térreo eixos A-D"
            value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>
      </div>
      <div className={s.btnRow}>
        <button className={s.btnSecondary} onClick={onClose}>Cancelar</button>
        <button className={s.btnPrimary} disabled={salvando} onClick={salvar}>
          {salvando?'⏳ Salvando...':'Criar Concretagem'}
        </button>
      </div>
    </Modal>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────
export default function Home() {
  const { data, loading, error, refresh } = useData();
  const { pecas, concretagens, bts, lancamentos } = data;

  const [tab,            setTab]          = useState('operacional');
  const [filtroAndar,    setFiltroAndar]  = useState('todos');
  const [filtroConc,     setFiltroConc]   = useState('todas');
  const [filtroAndarRel, setFiltroAndarRel] = useState('todos');
  const [toast,          setToast]        = useState({ msg:'', tipo:'ok' });
  const [modalBT,        setModalBT]      = useState(false);
  const [modalPeca,      setModalPeca]    = useState(false);
  const [modalConc,      setModalConc]    = useState(false);
  const [clock,          setClock]        = useState('');

  useEffect(()=>{
    const tick=()=>setClock(new Date().toLocaleTimeString('pt-BR'));
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[]);

  const showToast = (msg, tipo='ok') => {
    setToast({msg,tipo});
    setTimeout(()=>refresh(), 2000); // atualiza dados após 2s
  };

  const andares = [...new Set(pecas.map(p=>p.andar))].sort();
  const kpis    = calcKPIs(pecas, lancamentos, bts, filtroAndar);

  const ultimoBT   = bts.length ? bts[bts.length-1] : null;
  const ultimoConc = ultimoBT ? concretagens.find(c=>c.id===ultimoBT.concretagemId) : null;
  const volUsadoUltimoBT = ultimoBT
    ? lancamentos.filter(l=>l.btId===ultimoBT.id).reduce((s,l)=>s+l.volume,0) : 0;

  // filtros relatório
  let lansRel=lancamentos, pecasRel=pecas, btsRel=bts;
  if(filtroConc!=='todas'){ lansRel=lansRel.filter(l=>l.concretagemId===filtroConc); btsRel=btsRel.filter(b=>b.concretagemId===filtroConc); }
  if(filtroAndarRel!=='todos') pecasRel=pecasRel.filter(p=>p.andar===filtroAndarRel);
  const pecaIdsRel=new Set(pecasRel.map(p=>p.id));
  lansRel=lansRel.filter(l=>pecaIdsRel.has(l.pecaId));

  const relReal  = btsRel.reduce((s,b)=>s+b.volumeCaminhao,0);
  const relPerda = btsRel.reduce((s,b)=>s+b.perdaObra,0);
  const relSobra = btsRel.reduce((s,b)=>s+b.sobraCaminhao,0);
  const relProg  = pecasRel.reduce((s,p)=>s+p.volume,0);

  if(loading) return <div className={s.loadingWrap}><div className={s.loadingText}>CARREGANDO DADOS...</div></div>;
  if(error)   return (
    <div className={s.errorPanel}>
      <div>⚠ Falha ao carregar dados do Google Sheets</div>
      <div style={{color:'var(--text2)',marginTop:8}}>{error}</div>
      <button className={s.refreshBtn} onClick={refresh}>↻ Tentar novamente</button>
    </div>
  );

  return (
    <>
      {/* HEADER */}
      <header className={s.header}>
        <div>
          <span className={s.logoMark}>⬛ Concreto</span>
          <span className={s.logoSub}>Controle de Concretagem</span>
        </div>
        <div className={s.liveBadge}>
          <div className={s.liveDot}/>
          <span>{clock}</span>
          <button className={s.btnSecondary} style={{marginLeft:12,padding:'6px 14px',fontSize:11}} onClick={refresh}>↻</button>
        </div>
      </header>

      {/* NAV */}
      <nav className={s.nav}>
        {['operacional','relatorios'].map(t=>(
          <button key={t} className={`${s.navTab} ${tab===t?s.navTabActive:''}`} onClick={()=>setTab(t)}>
            {t==='operacional'?'⬡ Operacional':'◈ Relatórios & Índices'}
          </button>
        ))}
      </nav>

      {/* ══ OPERACIONAL ══ */}
      {tab==='operacional'&&(
        <main className={`${s.page} animate-fadein`}>

          {/* BARRA DE AÇÕES */}
          <div className={s.launchBar}>
            <div>
              <div className={s.launchBarTitle}>Lançamento de Concretagem</div>
              <div className={s.launchBarSub}>Registre BTs, peças, sobra e perda direto no Sheets</div>
            </div>
            <div className={s.launchActions}>
              <button className={s.btnAction} onClick={()=>setModalPeca(true)}>+ Nova Peça</button>
              <button className={s.btnAction} onClick={()=>setModalConc(true)}>+ Concretagem</button>
              <button className={s.btnLaunch} onClick={()=>setModalBT(true)}>⊕ Lançar BT</button>
            </div>
          </div>

          {/* KPIs */}
          <div className={s.grid4}>
            <KPI label="Volume Total Projeto" value={fmt2(kpis.totalVol)} unit="m³" sub={`${pecas.length} peças`}/>
            <KPI label="Volume Concretado"    value={fmt2(kpis.concVol)}  unit="m³" sub={`${fmt1(kpis.pctConc)}% concluído`} variant="green"/>
            <KPI label="Volume Faltando"      value={fmt2(kpis.faltVol)}  unit="m³" sub={`${fmt1(100-kpis.pctConc)}% restante`} variant="red"/>
            <KPI label="Perda Total em Obra"  value={fmt2(kpis.totalPerda)} unit="m³" sub={`${fmt1(kpis.indicePerda)}% do volume`} variant="orange"/>
          </div>

          <div className={s.grid2}>
            {/* Esquerda: progresso */}
            <div>
              <div className={s.sectionTitle}>Filtrar por Andar</div>
              <div className={s.chips}>
                {['todos',...andares].map(a=>(
                  <button key={a} className={`${s.chip} ${filtroAndar===a?s.chipActive:''}`} onClick={()=>setFiltroAndar(a)}>
                    {a==='todos'?'Todos':a}
                  </button>
                ))}
              </div>
              <div className={s.panel}>
                <div className={s.panelTitle}>Progresso — {filtroAndar==='todos'?'Todos os Andares':filtroAndar}</div>
                {pecas.filter(p=>filtroAndar==='todos'||p.andar===filtroAndar).length===0
                  ? <div className={s.empty}>Nenhuma peça.<br/>Use "+ Peça" para cadastrar.</div>
                  : pecas.filter(p=>filtroAndar==='todos'||p.andar===filtroAndar).map(p=>(
                    <ProgressoPeca key={p.id} peca={p} lancamentos={lancamentos}/>
                  ))
                }
              </div>
            </div>

            {/* Direita: live + últimas BTs */}
            <div>
              {ultimoBT&&(
                <div className={s.livePanel}>
                  <div className={s.livePanelBadge}>Última BT</div>
                  <div className={s.panelTitle} style={{color:'var(--accent)'}}>BT-{ultimoBT.numero}</div>
                  <div className={s.livePanelGrid}>
                    <div><div className={s.kpiLabel}>Concretagem</div>
                      <div className={s.liveVal}>{ultimoConc?`Nº ${ultimoConc.numero}`:'—'}</div></div>
                    <div><div className={s.kpiLabel}>Caminhão</div>
                      <div className={`${s.liveVal} ${s.liveValNeutral}`}>{fmt2(ultimoBT.volumeCaminhao)} m³</div></div>
                    <div><div className={s.kpiLabel}>Usado nas peças</div>
                      <div style={{fontFamily:'var(--mono)',fontSize:18,color:'var(--green)'}}>{fmt2(volUsadoUltimoBT)} m³</div></div>
                    <div><div className={s.kpiLabel}>Perda em obra</div>
                      <div style={{fontFamily:'var(--mono)',fontSize:18,color:'var(--red)'}}>{fmt2(ultimoBT.perdaObra)} m³</div></div>
                  </div>
                  {ultimoBT.obs&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:8}}>obs: {ultimoBT.obs}</div>}
                </div>
              )}

              <div className={s.panel}>
                <div className={s.panelTitle}>Últimas BTs</div>
                {bts.length===0
                  ? <div className={s.empty}>Nenhuma BT lançada ainda</div>
                  : <div className={s.tableWrap}>
                      <table className={s.table}>
                        <thead><tr><th>BT</th><th>Conc.</th><th>Caminhão</th><th>Usado</th><th>Perda</th><th>Hora</th></tr></thead>
                        <tbody>
                          {[...bts].reverse().slice(0,10).map(b=>{
                            const conc=concretagens.find(c=>c.id===b.concretagemId);
                            const usado=lancamentos.filter(l=>l.btId===b.id).reduce((s,l)=>s+l.volume,0);
                            return(
                              <tr key={b.id}>
                                <td className={s.tdAccent}>BT-{b.numero}</td>
                                <td className={s.tdMono}>{conc?conc.numero:'—'}</td>
                                <td className={s.tdMono}>{fmt2(b.volumeCaminhao)}</td>
                                <td className={s.tdGreen}>{fmt2(usado)}</td>
                                <td className={b.perdaObra>0?s.tdRed:s.tdMuted}>{fmt2(b.perdaObra)}</td>
                                <td className={s.tdMuted}>{b.hora}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                }
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ══ RELATÓRIOS ══ */}
      {tab==='relatorios'&&(
        <main className={`${s.page} animate-fadein`}>
          <div className={s.panel} style={{marginBottom:24}}>
            <div className={s.panelTitle}>Filtros</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              <div>
                <label className={s.formLabel} style={{display:'block',marginBottom:6}}>Concretagem</label>
                <select className={s.formSelect} style={{maxWidth:280}} value={filtroConc} onChange={e=>setFiltroConc(e.target.value)}>
                  <option value="todas">Todas</option>
                  {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=>(
                    <option key={c.id} value={c.id}>Nº {c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={s.formLabel} style={{display:'block',marginBottom:6}}>Andar</label>
                <select className={s.formSelect} style={{maxWidth:200}} value={filtroAndarRel} onChange={e=>setFiltroAndarRel(e.target.value)}>
                  <option value="todos">Todos</option>
                  {andares.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={s.grid4}>
            <KPI label="Vol. Programado"     value={fmt2(relProg)}   unit="m³"/>
            <KPI label="Vol. Caminhões"      value={fmt2(relReal)}   unit="m³" variant="blue"/>
            <KPI label="Perda em Obra"       value={fmt2(relPerda)}  unit="m³" sub={`${fmt1(relReal>0?relPerda/relReal*100:0)}%`} variant="red"/>
            <KPI label="Sobra (foi embora)"  value={fmt2(relSobra)}  unit="m³" sub={`${fmt1(relReal>0?relSobra/relReal*100:0)}%`} variant="orange"/>
          </div>

          <div className={s.grid2}>
            <div className={s.panel}>
              <div className={s.panelTitle}>Consumo por Concretagem</div>
              <BarChart concretagens={concretagens} bts={btsRel}/>
            </div>
            <div className={s.panel}>
              <div className={s.panelTitle}>Volume por Tipo de Peça</div>
              <DonutChart pecas={pecasRel} lancamentos={lansRel}/>
            </div>
            <div className={s.panel}>
              <div className={s.panelTitle}>Índice por BT</div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th>BT</th><th>Conc.</th><th>Caminhão</th><th>Usado</th><th>Perda</th><th>Sobra</th><th>% Uso</th></tr></thead>
                  <tbody>
                    {calcRelatorioBTs(btsRel,lansRel,concretagens).length===0
                      ?<tr><td colSpan={7} className={s.empty} style={{padding:'24px 16px'}}>Sem dados</td></tr>
                      :calcRelatorioBTs(btsRel,lansRel,concretagens).map(bt=>(
                        <tr key={bt.id}>
                          <td className={s.tdAccent}>BT-{bt.numero}</td>
                          <td className={s.tdMono}>{bt.conc?bt.conc.numero:'—'}</td>
                          <td className={s.tdMono}>{fmt2(bt.volumeCaminhao)}</td>
                          <td className={s.tdGreen}>{fmt2(bt.volUsado)}</td>
                          <td className={bt.perdaObra>0?s.tdRed:s.tdMuted}>{fmt2(bt.perdaObra)}</td>
                          <td className={s.tdMuted}>{fmt2(bt.sobraCaminhao)}</td>
                          <td className={s.tdMono}>{fmt1(bt.pctUso)}%</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div className={s.panel}>
              <div className={s.panelTitle}>Resumo por Andar</div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th>Andar</th><th>Prog.</th><th>Conc.</th><th>Falt.</th><th>Status</th></tr></thead>
                  <tbody>
                    {calcAndares(pecasRel,lansRel).length===0
                      ?<tr><td colSpan={5} className={s.empty} style={{padding:'24px 16px'}}>Sem dados</td></tr>
                      :calcAndares(pecasRel,lansRel).map(a=>{
                        const st=statusPeca(a.pct);
                        return(<tr key={a.andar}>
                          <td style={{fontWeight:500}}>{a.andar}</td>
                          <td className={s.tdMono}>{fmt2(a.prog)}</td>
                          <td className={s.tdGreen}>{fmt2(a.conc)}</td>
                          <td className={s.tdRed}>{fmt2(a.falt)}</td>
                          <td><span className={`${s.badge} ${badgeCls(st)}`}>{badgeLabel(st,a.pct)}</span></td>
                        </tr>);
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={s.panel}>
            <div className={s.panelTitle}>Base de Dados — Peças</div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>#</th><th>Peça</th><th>Andar</th><th>Tipo</th><th>Proj.(m³)</th><th>Conc.(m³)</th><th>Falt.(m³)</th><th>%</th><th>Status</th></tr></thead>
                <tbody>
                  {pecasRel.length===0
                    ?<tr><td colSpan={9} className={s.empty} style={{padding:'24px 16px'}}>Sem peças</td></tr>
                    :pecasRel.map((p,i)=>{
                      const vc=Math.min(p.volume,volConcretadoPeca(p.id,lancamentos));
                      const pct=pctConcretado(p,lancamentos);
                      const st=statusPeca(pct);
                      return(<tr key={p.id}>
                        <td className={s.tdMuted}>{i+1}</td>
                        <td style={{fontWeight:500}}>{p.nome}</td>
                        <td className={s.tdMono}>{p.andar}</td>
                        <td style={{color:'var(--text2)',fontSize:12}}>{p.tipo}</td>
                        <td className={s.tdMono}>{fmt2(p.volume)}</td>
                        <td className={s.tdGreen}>{fmt2(vc)}</td>
                        <td className={s.tdRed}>{fmt2(Math.max(0,p.volume-vc))}</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div className={s.progressBar} style={{width:50}}>
                              <div className={`${s.progressFill} ${pct>=100?s.progressFillGreen:''}`} style={{width:`${Math.min(100,pct)}%`}}/>
                            </div>
                            <span className={s.tdMono}>{fmt1(pct)}%</span>
                          </div>
                        </td>
                        <td><span className={`${s.badge} ${badgeCls(st)}`}>{badgeLabel(st,pct)}</span></td>
                      </tr>);
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* MODAIS */}
      <ModalLancarBT open={modalBT} onClose={()=>setModalBT(false)}
        pecas={pecas} concretagens={concretagens} bts={bts}
        onSalvo={msg=>showToast(msg,'ok')}/>
      <ModalNovaPeca open={modalPeca} onClose={()=>setModalPeca(false)}
        andares={andares} onSalvo={msg=>showToast(msg,'ok')}/>
      <ModalNovaConcretagem open={modalConc} onClose={()=>setModalConc(false)}
        concretagens={concretagens} onSalvo={msg=>showToast(msg,'ok')}/>

      <Toast msg={toast.msg} tipo={toast.tipo} onDone={()=>setToast({msg:'',tipo:'ok'})}/>
    </>
  );
}
