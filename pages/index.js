import { useState, useEffect, useCallback, useMemo } from 'react';
import s from '../styles/Home.module.css';
import {
  fmt1, fmt2, fmt4, volLancadoPeca, pctConcretado,
  calcKPIs, calcAndares, calcPorTipo, calcBTsStatus,
  calcIndicePerda, calcVolumePrevisto, statusPeca,
} from '../lib/calculos';
import {
  apiAdicionarPeca, apiAdicionarPecaLote, apiEditarPeca, apiExcluirPeca,
  apiSalvarConcretagem, apiLancarBT,
} from '../lib/api';

const TIPOS = ['Pilar','Viga','Laje','Fundação','Cortina','Escada','Caixa D\'água','Outro'];
const CORES  = ['#e8a225','#4a9eff','#3ecf7a','#e85a4f','#a855f7','#f59e0b','#14b8a6','#06b6d4'];

const badgeCls   = st => st==='complete'?s.badgeComplete:st==='partial'?s.badgePartial:s.badgePending;
const badgeLabel = (st,pct) => st==='complete'?'Completo':st==='partial'?`Parcial · ${fmt1(pct)}%`:'Pendente';

// ── KPI ───────────────────────────────────────
function KPI({ label, value, unit, sub, variant, small }) {
  const cls=[s.kpi,variant==='green'?s.kpiGreen:variant==='red'?s.kpiRed:variant==='blue'?s.kpiBlue:variant==='orange'?s.kpiOrange:variant==='purple'?s.kpiPurple:''].join(' ');
  return <div className={cls}><div className={s.kpiLabel}>{label}</div><div className={`${s.kpiValue} ${small?s.kpiValueSm:''}`}>{value}<span className={s.kpiUnit}>{unit}</span></div>{sub&&<div className={s.kpiSub}>{sub}</div>}</div>;
}

// ── TOAST ─────────────────────────────────────
function Toast({ msg, tipo, onDone }) {
  useEffect(()=>{ if(!msg) return; const t=setTimeout(onDone,3500); return()=>clearTimeout(t); },[msg,onDone]);
  if(!msg) return null;
  return <div className={`${s.toast} ${tipo==='err'?s.toastErr:''}`}>{msg}</div>;
}

// ── MODAL ─────────────────────────────────────
function Modal({ open, onClose, title, children, wide, extraWide }) {
  if(!open) return null;
  return (
    <div className={s.modalOverlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`${s.modal} ${wide?s.modalWide:''} ${extraWide?s.modalExtraWide:''}`}>
        <div className={s.modalTitle}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── DATA HOOK (sem auto-refresh) ──────────────
function useData(pausado=false) {
  const [data,setData]=useState({pecas:[],concretagens:[],pecaConc:[],btsConfig:[],lancamentos:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const fetch_=useCallback(async()=>{
    setLoading(true);setError(null);
    try{ const res=await fetch('/api/data'); if(!res.ok) throw new Error(await res.text()); setData(await res.json()); }
    catch(e){setError(e.message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{fetch_();},[fetch_]);
  // SEM auto-refresh — só manual ou pós-ação
  return{data,loading,error,refresh:fetch_};
}

// ════════════════════════════════════════════════
// GRÁFICO OPERACIONAL — Tipos com clique p/ ver peças
// ════════════════════════════════════════════════
function GraficoTipos({ pecas, lancamentos, btsConfig }) {
  const [tipoAberto, setTipoAberto] = useState(null);
  const dados = calcPorTipo(pecas, lancamentos);
  const maxVol = Math.max(...dados.map(d=>d.prog), 0.01);

  return (
    <div>
      {dados.map((t,i) => {
        const aberto = tipoAberto === t.tipo;
        const pctBar = Math.min(100, t.pct);
        return (
          <div key={t.tipo} style={{marginBottom: 8}}>
            {/* Linha clicável do tipo */}
            <div onClick={()=>setTipoAberto(aberto?null:t.tipo)}
              style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
                background: aberto?'rgba(232,162,37,0.08)':'var(--surface2)',
                border:`1px solid ${aberto?'var(--accent)':'var(--border)'}`,
                cursor:'pointer',transition:'all 0.2s'}}>
              <div style={{width:12,height:12,background:CORES[i%CORES.length],flexShrink:0,borderRadius:2}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontFamily:'var(--cond)',fontWeight:700,fontSize:16,letterSpacing:1,textTransform:'uppercase',color:aberto?'var(--accent)':'var(--text)'}}>
                    {t.tipo}
                    <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginLeft:8,fontWeight:400}}>{t.count} peça{t.count!==1?'s':''}</span>
                  </span>
                  <div style={{display:'flex',gap:20,alignItems:'center'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--green)'}}>{fmt4(t.conc)} m³</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>/ {fmt4(t.prog)} m³</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:14,color:'var(--accent)',fontWeight:700,minWidth:48,textAlign:'right'}}>{fmt1(t.pct)}%</span>
                    <span style={{color:aberto?'var(--accent)':'var(--text3)',fontSize:12}}>{aberto?'▲':'▼'}</span>
                  </div>
                </div>
                <div style={{height:8,background:'var(--surface)',borderRadius:1,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pctBar}%`,background:t.pct>=100?'var(--green)':CORES[i%CORES.length],transition:'width 0.8s'}}/>
                </div>
              </div>
            </div>

            {/* Lista de peças expandida */}
            {aberto && (
              <div style={{border:'1px solid var(--accent)',borderTop:'none',background:'var(--surface)'}}>
                {t.pecas.map(p => {
                  const vc  = Math.min(p.volume, volLancadoPeca(p.id, lancamentos));
                  const pct = pctConcretado(p, lancamentos);
                  const falt= Math.max(0, p.volume-vc);
                  return (
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:16,padding:'10px 16px',borderBottom:'1px solid var(--border)'}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>{p.nome} <span style={{color:'var(--text3)',fontSize:11}}>· {p.andar}</span></span>
                          <span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--accent)',fontWeight:700}}>{fmt1(pct)}%</span>
                        </div>
                        <div style={{height:5,background:'var(--surface2)',borderRadius:1,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:pct>=100?'var(--green)':'var(--accent)'}}/>
                        </div>
                        <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:4}}>
                          feito {fmt4(vc)} m³ &nbsp;·&nbsp; faltando <span style={{color:'var(--red)'}}>{fmt4(falt)} m³</span> &nbsp;·&nbsp; projeto {fmt4(p.volume)} m³
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════
// GRÁFICO VISUAL BTs (operacional)
// ════════════════════════════════════════════════
function GraficoBTs({ btsConfig, lancamentos, concretagens }) {
  const concOrdenadas = [...concretagens].sort((a,b)=>a.numero-b.numero);
  if(!concOrdenadas.length) return <div className={s.empty}>Nenhuma concretagem</div>;

  return (
    <div style={{overflowX:'auto'}}>
      {concOrdenadas.map(c => {
        const bts = calcBTsStatus(btsConfig, lancamentos, c.id);
        if(!bts.length) return null;
        const volPrev = bts.reduce((s,b)=>s+b.volumePrevisto,0);
        const volUsado= bts.reduce((s,b)=>s+b.volUsado,0);
        return (
          <div key={c.id} style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontFamily:'var(--cond)',fontWeight:700,fontSize:15,letterSpacing:1,color:'var(--text)'}}>
                CONCRETAGEM Nº{c.numero} <span style={{color:'var(--text3)',fontWeight:400,fontSize:12}}>· {c.data}{c.descricao?` · ${c.descricao}`:''}</span>
              </span>
              <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text2)'}}>
                {fmt4(volUsado)} / {fmt4(volPrev)} m³
              </span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {bts.map(b => {
                const pctUso = b.volumePrevisto>0 ? Math.min(120,(b.volUsado/b.volumePrevisto)*100) : 0;
                const acima  = b.volUsado > b.volumePrevisto;
                return (
                  <div key={b.id} style={{background:'var(--surface2)',border:`1px solid ${b.lancada?acima?'var(--blue)':'var(--green)':'var(--border)'}`,padding:'10px 14px',minWidth:90,position:'relative'}}>
                    <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginBottom:4}}>BT-{b.numero}</div>
                    <div style={{fontFamily:'var(--cond)',fontWeight:700,fontSize:18,color:b.lancada?acima?'var(--blue)':'var(--green)':'var(--text2)'}}>{fmt4(b.volUsado||0)}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>/ {fmt4(b.volumePrevisto)} m³</div>
                    {b.lancada&&(
                      <>
                        <div style={{height:3,background:'var(--surface)',marginTop:6,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${Math.min(100,pctUso)}%`,background:acima?'var(--blue)':'var(--green)'}}/>
                        </div>
                        {b.perdaCaminhao!==0&&(
                          <div style={{fontFamily:'var(--mono)',fontSize:9,color:b.perdaCaminhao>0?'var(--red)':'var(--blue)',marginTop:3}}>
                            {b.perdaCaminhao>0?`▼ ${fmt4(b.perdaCaminhao)} m³`:`▲ +${fmt4(Math.abs(b.perdaCaminhao))} m³`}
                          </div>
                        )}
                      </>
                    )}
                    {!b.lancada&&<div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--text3)',marginTop:4}}>pendente</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════
// MODAL: GERENCIAR PEÇAS
// ════════════════════════════════════════════════
function ModalPecas({ open, onClose, pecas, onSalvo }) {
  const [modo,setModo]=useState('lista');
  const [editPeca,setEditPeca]=useState(null);
  const [filtro,setFiltro]=useState('');
  const [salvando,setSalvando]=useState(false);
  const [erro,setErro]=useState('');
  const [nome,setNome]=useState(''); const [tipo,setTipo]=useState('Pilar');
  const [andar,setAndar]=useState(''); const [volume,setVolume]=useState('');
  const [textoImport,setTextoImport]=useState('');
  const [previewImport,setPreviewImport]=useState([]);
  const [erroImport,setErroImport]=useState('');

  useEffect(()=>{ if(open){setModo('lista');setFiltro('');setErro('');} },[open]);

  const andares=[...new Set(pecas.map(p=>p.andar))].sort();
  const pecasFilt=pecas.filter(p=>p.nome.toLowerCase().includes(filtro.toLowerCase())||p.andar.toLowerCase().includes(filtro.toLowerCase())||p.tipo.toLowerCase().includes(filtro.toLowerCase()));

  function abrirEditar(p){setEditPeca(p);setNome(p.nome);setTipo(p.tipo);setAndar(p.andar);setVolume(String(p.volume));setErro('');setModo('editar');}
  function abrirNova(){setEditPeca(null);setNome('');setTipo('Pilar');setAndar('');setVolume('');setErro('');setModo('nova');}

  async function salvarPeca(){
    if(!nome||!andar||!volume){setErro('Preencha todos os campos');return;}
    setSalvando(true);
    try{
      if(modo==='editar'){await apiEditarPeca({id:editPeca.id,nome,tipo,andar,volume});onSalvo(`✓ "${nome}" atualizada!`);}
      else{await apiAdicionarPeca({nome,tipo,andar,volume});onSalvo(`✓ "${nome}" adicionada!`);}
      setModo('lista');
    }catch(e){setErro('Erro: '+e.message);}finally{setSalvando(false);}
  }

  async function excluir(p){
    if(!confirm(`Excluir "${p.nome}"?`)) return;
    setSalvando(true);
    try{await apiExcluirPeca(p.id);onSalvo(`"${p.nome}" excluída.`);}
    catch(e){setErro('Erro: '+e.message);}finally{setSalvando(false);}
  }

  function parsearImport(txt){
    setErroImport('');
    const linhas=txt.trim().split('\n').filter(l=>l.trim());
    const ps=[],errs=[];
    linhas.forEach((linha,i)=>{
      const cols=linha.split('\t');
      if(cols.length<4){errs.push(`L${i+1}: faltam colunas`);return;}
      const [n,t,a,vRaw]=cols.map(c=>c.trim());
      const v=parseFloat(vRaw.replace(',','.'));
      if(!n){errs.push(`L${i+1}: nome vazio`);return;}
      if(isNaN(v)){errs.push(`L${i+1}: volume inválido`);return;}
      ps.push({nome:n,tipo:t||'Outro',andar:a||'Sem andar',volume:v});
    });
    if(errs.length){setErroImport(errs.join(' | '));setPreviewImport([]);return;}
    setPreviewImport(ps);
  }

  async function salvarImport(){
    if(!previewImport.length) return;
    setSalvando(true);
    try{await apiAdicionarPecaLote(previewImport);onSalvo(`✓ ${previewImport.length} peças importadas!`);setModo('lista');setTextoImport('');setPreviewImport([]);}
    catch(e){setErroImport('Erro: '+e.message);}finally{setSalvando(false);}
  }

  return (
    <Modal open={open} onClose={onClose} title="⬡ Gerenciar Peças" wide>
      {modo==='lista'&&(
        <div>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <input className={s.formInput} style={{flex:1,minWidth:160}} placeholder="Buscar..." value={filtro} onChange={e=>setFiltro(e.target.value)}/>
            <button className={s.btnAction} onClick={abrirNova}>+ Nova</button>
            <button className={s.btnAction} onClick={()=>{setModo('importar');setTextoImport('');setPreviewImport([]);setErroImport('');}}>⊞ Importar Lote</button>
          </div>
          {erro&&<div className={s.alertRed} style={{marginBottom:10}}>{erro}</div>}
          <div style={{maxHeight:420,overflowY:'auto',border:'1px solid var(--border)'}}>
            {pecasFilt.length===0?<div className={s.empty}>Nenhuma peça.</div>
              :pecasFilt.map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{p.nome}</div><div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{p.tipo} · {p.andar} · {fmt4(p.volume)} m³</div></div>
                  <button className={s.btnAction} style={{padding:'6px 14px',fontSize:12}} onClick={()=>abrirEditar(p)}>Editar</button>
                  <button className={s.btnDanger} style={{padding:'6px 12px'}} onClick={()=>excluir(p)}>✕</button>
                </div>
              ))
            }
          </div>
          <div className={s.btnRow}><button className={s.btnSecondary} onClick={onClose}>Fechar</button></div>
        </div>
      )}
      {(modo==='nova'||modo==='editar')&&(
        <div>
          <div style={{marginBottom:14,fontFamily:'var(--mono)',fontSize:12,color:'var(--text3)'}}>{modo==='editar'?`Editando: ${editPeca.nome}`:'Nova peça'}</div>
          {erro&&<div className={s.alertRed} style={{marginBottom:12}}>{erro}</div>}
          <div className={s.formGrid}>
            <div className={s.formGroup}><label className={s.formLabel}>Nome</label><input className={s.formInput} placeholder="ex: Pilar P-01" value={nome} onChange={e=>setNome(e.target.value)}/></div>
            <div className={s.formGroup}><label className={s.formLabel}>Tipo</label><select className={s.formSelect} value={tipo} onChange={e=>setTipo(e.target.value)}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
            <div className={s.formGroup}><label className={s.formLabel}>Andar</label><input className={s.formInput} placeholder="ex: Térreo" value={andar} onChange={e=>setAndar(e.target.value)} list="al"/><datalist id="al">{andares.map(a=><option key={a} value={a}/>)}</datalist></div>
            <div className={s.formGroup}><label className={s.formLabel}>Volume (m³)</label><input className={s.formInput} type="number" step="0.0001" min="0.0001" placeholder="0.0000" value={volume} onChange={e=>setVolume(e.target.value)}/></div>
          </div>
          <div className={s.btnRow}>
            <button className={s.btnSecondary} onClick={()=>setModo('lista')}>← Voltar</button>
            <button className={s.btnPrimary} disabled={salvando} onClick={salvarPeca}>{salvando?'⏳ Salvando...':(modo==='editar'?'Salvar':'Cadastrar')}</button>
          </div>
        </div>
      )}
      {modo==='importar'&&(
        <div>
          <div className={s.infoBox} style={{marginBottom:12}}><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',lineHeight:2}}>Copie do Excel: <strong>Nome | Tipo | Andar | Volume(m³)</strong> e cole abaixo.</span></div>
          {erroImport&&<div className={s.alertRed} style={{marginBottom:10}}>{erroImport}</div>}
          <textarea style={{width:'100%',height:130,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',fontFamily:'var(--mono)',fontSize:12,padding:'10px 14px',outline:'none',resize:'vertical',lineHeight:1.8}}
            placeholder={'Pilar P-01\tPilar\tTérreo\t1.5'} value={textoImport}
            onChange={e=>{setTextoImport(e.target.value);parsearImport(e.target.value);}}/>
          {previewImport.length>0&&<div style={{marginTop:10,maxHeight:160,overflowY:'auto',border:'1px solid var(--border)'}}>
            <table className={s.table}><thead><tr><th>#</th><th>Nome</th><th>Tipo</th><th>Andar</th><th>m³</th></tr></thead>
              <tbody>{previewImport.map((p,i)=><tr key={i}><td className={s.tdMuted}>{i+1}</td><td>{p.nome}</td><td className={s.tdMono}>{p.tipo}</td><td className={s.tdMono}>{p.andar}</td><td className={s.tdAccent}>{fmt4(p.volume)}</td></tr>)}</tbody>
            </table></div>}
          <div className={s.btnRow}>
            <button className={s.btnSecondary} onClick={()=>setModo('lista')}>← Voltar</button>
            <button className={s.btnPrimary} disabled={!previewImport.length||salvando} onClick={salvarImport}>{salvando?'⏳ Importando...':`✓ Importar ${previewImport.length}`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════
// MODAL: CONCRETAGEM
// ════════════════════════════════════════════════
function ModalConcretagem({ open, onClose, pecas, concretagens, pecaConc, btsConfig, onSalvo }) {
  const [subModo,setSubModo]=useState('menu');
  const [step,setStep]=useState(1);
  const [concSel,setConcSel]=useState('');
  const [concId,setConcId]=useState('');
  const [numero,setNumero]=useState('');
  const [data,setData]=useState('');
  const [desc,setDesc]=useState('');
  const [vinculos,setVinculos]=useState([]);
  const [bts,setBts]=useState([]);
  const [filtroAndar,setFiltroAndar]=useState('todos');
  const [filtroTipo,setFiltroTipo]=useState('todos');
  const [salvando,setSalvando]=useState(false);
  const [erro,setErro]=useState('');
  const genId=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const andares=['todos',...new Set(pecas.map(p=>p.andar))].sort();
  const tipos=['todos',...new Set(pecas.map(p=>p.tipo))].sort();
  useEffect(()=>{ if(open){setSubModo('menu');setErro('');} },[open]);

  function iniciarNova(){setConcId(genId('c'));setNumero(String(concretagens.length+1));setData(new Date().toISOString().slice(0,10));setDesc('');setVinculos([]);setBts([]);setErro('');setStep(1);setFiltroAndar('todos');setFiltroTipo('todos');setSubModo('nova');}

  function iniciarEditar(){
    if(!concSel){setErro('Selecione uma concretagem');return;}
    const c=concretagens.find(x=>x.id===concSel);if(!c)return;
    setConcId(c.id);setNumero(String(c.numero));setData(c.data);setDesc(c.descricao||'');
    setVinculos(pecaConc.filter(pc=>pc.concretagemId===c.id).map(pc=>({pecaId:pc.pecaId,pctConcretagem:pc.pctConcretagem,id:pc.id})));
    setBts(btsConfig.filter(b=>b.concretagemId===c.id).map(b=>({...b})));
    setErro('');setStep(1);setFiltroAndar('todos');setFiltroTipo('todos');setSubModo('editar');
  }

  function togglePeca(pecaId){setVinculos(prev=>{if(prev.find(v=>v.pecaId===pecaId))return prev.filter(v=>v.pecaId!==pecaId);return[...prev,{pecaId,pctConcretagem:100}];});}
  function setPct(pecaId,val){setVinculos(prev=>prev.map(v=>v.pecaId===pecaId?{...v,pctConcretagem:parseFloat(val)||100}:v));}
  function toggleAndar(andar){const ids=pecas.filter(p=>p.andar===andar).map(p=>p.id);const todos=ids.every(id=>vinculos.find(v=>v.pecaId===id));if(todos)setVinculos(prev=>prev.filter(v=>!ids.includes(v.pecaId)));else{const novos=ids.filter(id=>!vinculos.find(v=>v.pecaId===id)).map(id=>({pecaId:id,pctConcretagem:100}));setVinculos(prev=>[...prev,...novos]);}}
  function addBT(){setBts(prev=>[...prev,{id:'',numero:prev.length+1,volumePrevisto:8,notaFiscal:'',codigoBT:''}]);}
  function remBT(i){setBts(prev=>prev.filter((_,idx)=>idx!==i));}
  function updBT(i,f,v){setBts(prev=>prev.map((b,idx)=>idx===i?{...b,[f]:v}:b));}

  const volTotalVinculos=vinculos.reduce((s,v)=>{const p=pecas.find(x=>x.id===v.pecaId);return s+(p?(v.pctConcretagem/100)*p.volume:0);},0);
  const volTotalBTs=bts.reduce((s,b)=>s+(parseFloat(b.volumePrevisto)||0),0);
  const pecasVisiveis=pecas.filter(p=>(filtroAndar==='todos'||p.andar===filtroAndar)&&(filtroTipo==='todos'||p.tipo===filtroTipo));

  async function salvar(){
    if(!numero||!data){setErro('Preencha número e data');return;}
    if(!vinculos.length){setErro('Vincule ao menos 1 peça');return;}
    setSalvando(true);
    try{
      await apiSalvarConcretagem({id:concId,numero,data,descricao:desc,
        pecaConcs:vinculos.map(v=>({id:v.id||'',pecaId:v.pecaId,pctConcretagem:v.pctConcretagem})),
        btsConfig:bts.map(b=>({id:b.id||'',numero:b.numero,volumePrevisto:b.volumePrevisto,notaFiscal:b.notaFiscal||'',codigoBT:b.codigoBT||''})),
      });
      onSalvo(`✓ Concretagem Nº${numero} salva!`);onClose();
    }catch(e){setErro('Erro: '+e.message);}finally{setSalvando(false);}
  }

  return (
    <Modal open={open} onClose={onClose} title="◈ Concretagens" extraWide>
      {subModo==='menu'&&(
        <div>
          {erro&&<div className={s.alertRed} style={{marginBottom:14}}>{erro}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
            <div onClick={iniciarNova} className={s.menuCard}>
              <div className={s.menuCardIcon}>+</div>
              <div className={s.menuCardTitle}>Nova Concretagem</div>
              <div className={s.menuCardSub}>Criar do zero com peças e BTs</div>
            </div>
            <div className={s.menuCard} onClick={e=>e.stopPropagation()}>
              <div className={s.menuCardIcon}>✎</div>
              <div className={s.menuCardTitle}>Editar Existente</div>
              <div className={s.menuCardSub}>Alterar peças, BTs ou dados</div>
              <select className={s.formSelect} style={{marginTop:12}} value={concSel} onChange={e=>setConcSel(e.target.value)}>
                <option value="">— selecione —</option>
                {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=><option key={c.id} value={c.id}>Nº{c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>)}
              </select>
              <button className={s.btnPrimary} style={{marginTop:10,width:'100%'}} onClick={iniciarEditar}>Editar →</button>
            </div>
          </div>
          <div className={s.btnRow}><button className={s.btnSecondary} onClick={onClose}>Fechar</button></div>
        </div>
      )}

      {(subModo==='nova'||subModo==='editar')&&(
        <div>
          <div className={s.steps}>
            {['Dados','Peças','BTs','Resumo'].map((label,i)=>(
              <div key={i} className={`${s.step} ${step===i+1?s.stepActive:step>i+1?s.stepDone:''}`}>
                <div className={s.stepNum}>{step>i+1?'✓':i+1}</div>
                <div className={s.stepLabel}>{label}</div>
              </div>
            ))}
          </div>
          {erro&&<div className={s.alertRed} style={{marginBottom:14}}>{erro}</div>}

          {step===1&&(
            <div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label className={s.formLabel}>Número</label><input className={s.formInput} type="number" min="1" value={numero} onChange={e=>setNumero(e.target.value)}/></div>
                <div className={s.formGroup}><label className={s.formLabel}>Data</label><input className={s.formInput} type="date" value={data} onChange={e=>setData(e.target.value)}/></div>
                <div className={`${s.formGroup} ${s.formGroupFull}`}><label className={s.formLabel}>Descrição</label><input className={s.formInput} placeholder="ex: Pilares Térreo eixos A-D" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
              </div>
              <div className={s.btnRow}><button className={s.btnSecondary} onClick={()=>setSubModo('menu')}>← Voltar</button><button className={s.btnPrimary} onClick={()=>{if(!numero||!data){setErro('Preencha número e data');return;}setErro('');setStep(2);}}>Próximo →</button></div>
            </div>
          )}

          {step===2&&(
            <div>
              <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--accent)',fontWeight:700}}>{vinculos.length} peças · {fmt4(volTotalVinculos)} m³</span>
                {filtroAndar!=='todos'&&<button className={s.btnAction} style={{padding:'5px 12px',fontSize:12}} onClick={()=>toggleAndar(filtroAndar)}>{pecas.filter(p=>p.andar===filtroAndar).every(p=>vinculos.find(v=>v.pecaId===p.id))?'Desmarcar tudo':'Marcar tudo do andar'}</button>}
              </div>
              <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                <select className={s.formSelect} style={{minWidth:150}} value={filtroAndar} onChange={e=>setFiltroAndar(e.target.value)}>{andares.map(a=><option key={a} value={a}>{a==='todos'?'Todos os andares':a}</option>)}</select>
                <select className={s.formSelect} style={{minWidth:130}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>{tipos.map(t=><option key={t} value={t}>{t==='todos'?'Todos os tipos':t}</option>)}</select>
              </div>
              <div style={{maxHeight:320,overflowY:'auto',border:'1px solid var(--border)'}}>
                {pecasVisiveis.length===0?<div className={s.empty}>Nenhuma peça.</div>
                  :pecasVisiveis.map(p=>{const sel=!!vinculos.find(v=>v.pecaId===p.id);const vinc=vinculos.find(v=>v.pecaId===p.id);return(
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderBottom:'1px solid var(--border)',background:sel?'rgba(232,162,37,0.06)':'transparent'}}>
                      <div onClick={()=>togglePeca(p.id)} style={{width:22,height:22,border:`2px solid ${sel?'var(--accent)':'var(--border2)'}`,background:sel?'var(--accent)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:14,color:'#0e0f11',fontWeight:700,transition:'all 0.15s'}}>{sel?'✓':''}</div>
                      <div style={{flex:1,cursor:'pointer'}} onClick={()=>togglePeca(p.id)}><div style={{fontWeight:600,fontSize:14}}>{p.nome}</div><div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{p.tipo} · {p.andar} · {fmt4(p.volume)} m³</div></div>
                      {sel&&<div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <label style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>%</label>
                        <input type="number" min="1" max="100" step="1" value={vinc.pctConcretagem} onChange={e=>setPct(p.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{width:64,background:'var(--surface2)',border:'1px solid var(--accent)',color:'var(--accent)',fontFamily:'var(--mono)',fontSize:13,padding:'4px 8px',outline:'none'}}/>
                        <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{fmt4((vinc.pctConcretagem/100)*p.volume)} m³</span>
                      </div>}
                    </div>
                  );})}
              </div>
              <div className={s.btnRow}><button className={s.btnSecondary} onClick={()=>{setErro('');setStep(1);}}>← Voltar</button><button className={s.btnPrimary} onClick={()=>{if(!vinculos.length){setErro('Vincule ao menos 1 peça');return;}setErro('');setStep(3);}}>Próximo →</button></div>
            </div>
          )}

          {step===3&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
                <div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--text2)'}}>Volume da concretagem: <span style={{color:'var(--accent)',fontWeight:700}}>{fmt4(volTotalVinculos)} m³</span>{bts.length>0&&<> · BTs: <span style={{color:Math.abs(volTotalBTs-volTotalVinculos)<0.1?'var(--green)':'var(--red)'}}>{fmt4(volTotalBTs)} m³</span></>}</div>
                <button className={s.btnAction} style={{padding:'8px 16px',fontSize:13}} onClick={addBT}>+ Adicionar BT</button>
              </div>
              {bts.length===0?<div className={s.empty}>Clique em "+ Adicionar BT".</div>
                :<div style={{maxHeight:340,overflowY:'auto'}}>
                  {bts.map((b,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'70px 130px 1fr 1fr auto',gap:10,marginBottom:10,alignItems:'end'}}>
                      <div className={s.formGroup}><label className={s.formLabel}>BT Nº</label><input className={s.formInput} type="number" min="1" value={b.numero} onChange={e=>updBT(i,'numero',e.target.value)}/></div>
                      <div className={s.formGroup}><label className={s.formLabel}>Volume (m³)</label><input className={s.formInput} type="number" step="0.5" min="0" value={b.volumePrevisto} onChange={e=>updBT(i,'volumePrevisto',e.target.value)}/></div>
                      <div className={s.formGroup}><label className={s.formLabel}>Nota Fiscal</label><input className={s.formInput} placeholder="opcional" value={b.notaFiscal} onChange={e=>updBT(i,'notaFiscal',e.target.value)}/></div>
                      <div className={s.formGroup}><label className={s.formLabel}>Código BT</label><input className={s.formInput} placeholder="opcional" value={b.codigoBT} onChange={e=>updBT(i,'codigoBT',e.target.value)}/></div>
                      <button className={s.btnDanger} style={{marginBottom:2}} onClick={()=>remBT(i)}>✕</button>
                    </div>
                  ))}
                </div>
              }
              <div className={s.btnRow}><button className={s.btnSecondary} onClick={()=>{setErro('');setStep(2);}}>← Voltar</button><button className={s.btnPrimary} onClick={()=>{setErro('');setStep(4);}}>Revisar →</button></div>
            </div>
          )}

          {step===4&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
                <div className={s.kpi}><div className={s.kpiLabel}>Concretagem</div><div className={s.kpiValue} style={{fontSize:28}}>Nº {numero}</div><div className={s.kpiSub}>{data}{desc&&` · ${desc}`}</div></div>
                <div className={`${s.kpi} ${s.kpiGreen}`}><div className={s.kpiLabel}>Volume Total</div><div className={s.kpiValue} style={{fontSize:28}}>{fmt4(volTotalVinculos)}<span className={s.kpiUnit}>m³</span></div><div className={s.kpiSub}>{vinculos.length} peças · {bts.length} BTs</div></div>
              </div>
              <div style={{marginBottom:14}}>
                {vinculos.slice(0,6).map(v=>{const p=pecas.find(x=>x.id===v.pecaId);return p?<div key={v.pecaId} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:12}}><span>{p.nome} ({p.andar})</span><span style={{color:'var(--accent)'}}>{v.pctConcretagem}% → {fmt4((v.pctConcretagem/100)*p.volume)} m³</span></div>:null;})}
                {vinculos.length>6&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:4}}>... e mais {vinculos.length-6} peças</div>}
              </div>
              {bts.length>0&&<div style={{marginBottom:14}}>{bts.map((b,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:12}}><span style={{color:'var(--accent)'}}>BT-{b.numero}</span><span>{fmt4(b.volumePrevisto)} m³{b.notaFiscal?` · NF:${b.notaFiscal}`:''}</span></div>)}</div>}
              <div className={s.btnRow}><button className={s.btnSecondary} onClick={()=>{setErro('');setStep(3);}}>← Voltar</button><button className={s.btnPrimary} disabled={salvando} onClick={salvar}>{salvando?'⏳ Salvando...':'✓ Salvar Concretagem'}</button></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════
// MODAL: LANÇAR BT
// ════════════════════════════════════════════════
function ModalLancarBT({ open, onClose, pecas, concretagens, pecaConc, btsConfig, lancamentos, onSalvo }) {
  const [step,setStep]=useState(1);
  const [concId,setConcId]=useState('');
  const [btId,setBtId]=useState('');
  const [nfEdit,setNfEdit]=useState('');
  const [codEdit,setCodEdit]=useState('');
  const [hora,setHora]=useState('');
  const [linhas,setLinhas]=useState([{pecaId:'',pct:''}]);
  const [sobra,setSobra]=useState('');
  const [perda,setPerda]=useState('');
  const [salvando,setSalvando]=useState(false);
  const [erro,setErro]=useState('');

  useEffect(()=>{
    if(!open) return;
    setStep(1);setErro('');setConcId('');setBtId('');setLinhas([{pecaId:'',pct:''}]);setSobra('');setPerda('');
    const now=new Date();
    setHora(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  },[open]);

  const btsConc=btsConfig.filter(b=>b.concretagemId===concId).sort((a,b)=>a.numero-b.numero);
  const btSel=btsConc.find(b=>b.id===btId);
  useEffect(()=>{ if(btSel){setNfEdit(btSel.notaFiscal||'');setCodEdit(btSel.codigoBT||'');} },[btId]);

  const pecasConc=useMemo(()=>{
    if(!concId) return [];
    const ids=pecaConc.filter(pc=>pc.concretagemId===concId).map(pc=>pc.pecaId);
    return pecas.filter(p=>ids.includes(p.id));
  },[concId,pecaConc,pecas]);

  const volLinha=l=>{const p=pecas.find(x=>x.id===l.pecaId);const pct=parseFloat(l.pct);return p&&!isNaN(pct)?(pct/100)*p.volume:0;};
  const totalUsado=linhas.reduce((s,l)=>s+volLinha(l),0);
  const volPrevisto=btSel?.volumePrevisto||0;
  const sobEstimada=Math.max(0,volPrevisto-totalUsado);
  // Perda do caminhão = previsto - executado (negativo = sobra inesperada)
  const perdaCaminhao=btSel?volPrevisto-totalUsado:0;

  const addLinha=()=>setLinhas(p=>[...p,{pecaId:'',pct:''}]);
  const remLinha=i=>setLinhas(p=>p.filter((_,idx)=>idx!==i));
  const updLinha=(i,f,v)=>setLinhas(p=>p.map((l,idx)=>idx===i?{...l,[f]:v}:l));

  async function salvar(){
    setErro('');
    const linhasVal=linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0);
    if(!concId||!btId){setErro('Selecione a concretagem e a BT');return;}
    if(!linhasVal.length){setErro('Adicione ao menos 1 peça');return;}
    setSalvando(true);
    try{
      await apiLancarBT({btConfigId:btId,concretagemId:concId,linhas:linhasVal,sobraCaminhao:parseFloat(sobra)||sobEstimada,perdaObra:parseFloat(perda)||0,hora,pecas,notaFiscal:nfEdit,codigoBT:codEdit});
      onSalvo(`✓ BT-${btSel?.numero} lançada!`);onClose();
    }catch(e){setErro('Erro: '+e.message);}finally{setSalvando(false);}
  }

  if(!open) return null;
  return (
    <div className={s.modalOverlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`${s.modal} ${s.modalWide}`}>
        <div className={s.modalTitle}>⊕ Lançar Betonada (BT)</div>
        <div className={s.steps}>
          {['Selecionar BT','Peças & %','Fechamento'].map((label,i)=>(
            <div key={i} className={`${s.step} ${step===i+1?s.stepActive:step>i+1?s.stepDone:''}`}>
              <div className={s.stepNum}>{step>i+1?'✓':i+1}</div><div className={s.stepLabel}>{label}</div>
            </div>
          ))}
        </div>
        {erro&&<div className={s.alertRed} style={{marginBottom:14}}>{erro}</div>}

        {step===1&&(
          <div>
            <div className={s.formGroup} style={{marginBottom:16}}>
              <label className={s.formLabel}>Concretagem</label>
              <select className={s.formSelect} value={concId} onChange={e=>{setConcId(e.target.value);setBtId('');}}>
                <option value="">— selecione —</option>
                {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=><option key={c.id} value={c.id}>Nº {c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>)}
              </select>
            </div>
            {concId&&(
              <div>
                <label className={s.formLabel} style={{display:'block',marginBottom:8}}>Selecione a BT</label>
                {btsConc.length===0?<div className={s.empty}>Nenhuma BT configurada. Configure em "Concretagens".</div>
                  :<div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                    {btsConc.map(b=>{const jafoi=lancamentos.some(l=>l.btConfigId===b.id);const sel=b.id===btId;return(
                      <div key={b.id} onClick={()=>!jafoi&&setBtId(b.id)} style={{padding:'14px 18px',border:`2px solid ${sel?'var(--accent)':jafoi?'var(--green)':'var(--border)'}`,background:sel?'rgba(232,162,37,0.1)':jafoi?'rgba(62,207,122,0.05)':'transparent',cursor:jafoi?'default':'pointer',minWidth:100,transition:'all 0.15s'}}>
                        <div style={{fontFamily:'var(--mono)',fontSize:20,color:sel?'var(--accent)':jafoi?'var(--green)':'var(--text2)',fontWeight:700}}>BT-{b.numero}</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text3)',marginTop:4}}>{fmt4(b.volumePrevisto)} m³</div>
                        {b.notaFiscal&&<div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>NF:{b.notaFiscal}</div>}
                        {jafoi&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--green)',marginTop:4}}>✓ Lançada</div>}
                      </div>
                    );})}
                  </div>
                }
                {btId&&<div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                  <div className={s.formGroup}><label className={s.formLabel}>Hora</label><input className={s.formInput} type="time" value={hora} onChange={e=>setHora(e.target.value)}/></div>
                  <div className={s.formGroup}><label className={s.formLabel}>Nota Fiscal</label><input className={s.formInput} placeholder="NF" value={nfEdit} onChange={e=>setNfEdit(e.target.value)}/></div>
                  <div className={s.formGroup}><label className={s.formLabel}>Código BT</label><input className={s.formInput} placeholder="Código" value={codEdit} onChange={e=>setCodEdit(e.target.value)}/></div>
                </div>}
              </div>
            )}
            <div className={s.btnRow}><button className={s.btnSecondary} onClick={onClose}>Cancelar</button><button className={s.btnPrimary} onClick={()=>{if(!concId||!btId){setErro('Selecione a concretagem e a BT');return;}setErro('');setStep(2);}}>Próximo →</button></div>
          </div>
        )}

        {step===2&&(
          <div>
            <div className={s.btResumo}>
              <span style={{color:'var(--accent)',fontWeight:700}}>BT-{btSel?.numero}</span><span>|</span>
              <span>{fmt4(volPrevisto)} m³ previsto</span><span>|</span>
              <span style={{color:totalUsado>volPrevisto?'var(--blue)':'var(--green)'}}>{fmt4(totalUsado)} m³ lançado</span><span>|</span>
              <span style={{color:perdaCaminhao>0?'var(--red)':perdaCaminhao<0?'var(--blue)':'var(--text3)'}}>
                {perdaCaminhao>0?`▼ perda ${fmt4(perdaCaminhao)} m³`:perdaCaminhao<0?`▲ sobra +${fmt4(Math.abs(perdaCaminhao))} m³`:'sem perda'}
              </span>
            </div>
            {linhas.map((l,i)=>{const vol=volLinha(l);return(
              <div key={i} className={s.pecaLinha}>
                <div className={s.formGroup} style={{flex:2}}>
                  {i===0&&<label className={s.formLabel}>Peça{pecasConc.length>0?' (desta concretagem)':''}</label>}
                  <select className={s.formSelect} value={l.pecaId} onChange={e=>updLinha(i,'pecaId',e.target.value)}>
                    <option value="">— selecione —</option>
                    {(pecasConc.length>0?pecasConc:pecas).sort((a,b)=>a.nome.localeCompare(b.nome)).map(p=><option key={p.id} value={p.id}>{p.nome} ({p.andar}) — {fmt4(p.volume)} m³</option>)}
                  </select>
                </div>
                <div className={s.formGroup} style={{width:100}}>
                  {i===0&&<label className={s.formLabel}>% nesta BT</label>}
                  <input className={s.formInput} type="number" min="0.01" max="100" step="0.5" placeholder="%" value={l.pct} onChange={e=>updLinha(i,'pct',e.target.value)}/>
                </div>
                <div className={s.formGroup} style={{width:100}}>
                  {i===0&&<label className={s.formLabel}>m³</label>}
                  <input className={s.formInput} readOnly value={vol>0?fmt4(vol):''} style={{color:'var(--accent)'}}/>
                </div>
                <div style={{alignSelf:'flex-end',paddingBottom:2}}>{linhas.length>1&&<button className={s.btnDanger} onClick={()=>remLinha(i)}>✕</button>}</div>
              </div>
            );})}
            <button className={s.btnSecondary} style={{marginTop:12}} onClick={addLinha}>+ Adicionar peça</button>
            {totalUsado>volPrevisto&&<div style={{marginTop:10,padding:'10px 14px',background:'rgba(74,158,255,0.08)',border:'1px solid var(--blue)',fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)'}}>ℹ Volume acima do previsto — sobra inesperada de {fmt4(totalUsado-volPrevisto)} m³ (conta como perda negativa no índice).</div>}
            <div className={s.btnRow}><button className={s.btnSecondary} onClick={()=>{setErro('');setStep(1);}}>← Voltar</button><button className={s.btnPrimary} onClick={()=>{const v=linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0);if(!v.length){setErro('Adicione ao menos 1 peça');return;}setErro('');setStep(3);}}>Próximo →</button></div>
          </div>
        )}

        {step===3&&(
          <div>
            <div className={s.btResumo} style={{marginBottom:16}}>
              <span style={{color:'var(--accent)',fontWeight:700}}>BT-{btSel?.numero}</span><span>|</span>
              <span>{fmt4(volPrevisto)} m³ previsto</span><span>|</span>
              <span style={{color:'var(--green)'}}>{fmt4(totalUsado)} m³ lançado</span><span>|</span>
              <span style={{color:perdaCaminhao>0?'var(--red)':perdaCaminhao<0?'var(--blue)':'var(--text3)'}}>
                {perdaCaminhao>0?`perda caminhão: ${fmt4(perdaCaminhao)} m³`:perdaCaminhao<0?`sobra inesperada: +${fmt4(Math.abs(perdaCaminhao))} m³`:'sem perda caminhão'}
              </span>
            </div>
            {linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0).map((l,i)=>{const p=pecas.find(x=>x.id===l.pecaId);return<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:13}}><span>{p?p.nome:l.pecaId}</span><span style={{color:'var(--accent)'}}>{l.pct}% → {fmt4(volLinha(l))} m³</span></div>;})}
            <div className={s.formGrid} style={{marginTop:16}}>
              <div className={s.formGroup}><label className={s.formLabel}>Sobra que foi embora (m³)</label><input className={s.formInput} type="number" step="0.0001" min="0" placeholder={`sugestão: ${fmt4(sobEstimada)}`} value={sobra} onChange={e=>setSobra(e.target.value)}/></div>
              <div className={s.formGroup}><label className={s.formLabel}>Perda em obra (m³)</label><input className={s.formInput} type="number" step="0.0001" min="0" placeholder="0.0000" value={perda} onChange={e=>setPerda(e.target.value)}/></div>
            </div>
            <div className={s.btnRow}><button className={s.btnSecondary} onClick={()=>{setErro('');setStep(2);}}>← Voltar</button><button className={s.btnPrimary} disabled={salvando} onClick={salvar}>{salvando?'⏳ Salvando...':'✓ Confirmar BT'}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════
export default function Home() {
  const [modalPecas,setModalPecas]=useState(false);
  const [modalConc,setModalConc]=useState(false);
  const [modalBT,setModalBT]=useState(false);
  const modalAberto=modalPecas||modalConc||modalBT;
  const{data,loading,error,refresh}=useData(modalAberto);
  const{pecas,concretagens,pecaConc,btsConfig,lancamentos}=data;

  const[tab,setTab]=useState('operacional');
  const[filtroAndar,setFiltroAndar]=useState('todos');
  const[filtroConc,setFiltroConc]=useState('todas');
  const[filtroTipoOp,setFiltroTipoOp]=useState('todos');
  const[filtroRelConc,setFiltroRelConc]=useState('todas');
  const[filtroRelAndar,setFiltroRelAndar]=useState('todos');
  const[toast,setToast]=useState({msg:'',tipo:'ok'});
  const[clock,setClock]=useState('');

  useEffect(()=>{ const t=()=>setClock(new Date().toLocaleTimeString('pt-BR')); t(); const id=setInterval(t,1000); return()=>clearInterval(id); },[]);
  const showToast=(msg,tipo='ok')=>{setToast({msg,tipo});setTimeout(()=>refresh(),1500);};

  const andares=[...new Set(pecas.map(p=>p.andar))].sort();
  const tipos=[...new Set(pecas.map(p=>p.tipo))].sort();
  const kpis=calcKPIs(pecas,lancamentos,btsConfig,filtroAndar);
  const perdaInfo=calcIndicePerda(lancamentos,btsConfig);
  const previsto=calcVolumePrevisto(btsConfig,lancamentos);

  const pecasFiltOp=pecas.filter(p=>
    (filtroAndar==='todos'||p.andar===filtroAndar)&&
    (filtroTipoOp==='todos'||p.tipo===filtroTipoOp)&&
    (filtroConc==='todas'||pecaConc.filter(pc=>pc.concretagemId===filtroConc).map(pc=>pc.pecaId).includes(p.id))
  );

  const ultimoLan=lancamentos[lancamentos.length-1];
  const ultimaBTConf=ultimoLan?btsConfig.find(b=>b.id===ultimoLan.btConfigId):null;
  const ultimaConc=ultimaBTConf?concretagens.find(c=>c.id===ultimaBTConf.concretagemId):null;
  const volUltimaBT=ultimoLan?lancamentos.filter(l=>l.btConfigId===ultimoLan.btConfigId).reduce((s,l)=>s+l.volume,0):0;

  if(loading) return <div className={s.loadingWrap}><div className={s.loadingText}>CARREGANDO DADOS...</div></div>;
  if(error) return <div className={s.errorPanel}><div>⚠ Falha ao carregar</div><div style={{color:'var(--text2)',marginTop:8,fontSize:13}}>{error}</div><button className={s.refreshBtn} onClick={refresh}>↻ Tentar novamente</button></div>;

  return (
    <>
      <header className={s.header}>
        <div><span className={s.logoMark}>⬛ Concreto</span><span className={s.logoSub}>Controle de Concretagem</span></div>
        <div className={s.liveBadge}><div className={s.liveDot}/><span>{clock}</span><button className={s.btnSecondary} style={{marginLeft:12,padding:'8px 18px',fontSize:13}} onClick={refresh}>↻ Atualizar</button></div>
      </header>

      <nav className={s.nav}>
        {['operacional','relatorios'].map(t=>(
          <button key={t} className={`${s.navTab} ${tab===t?s.navTabActive:''}`} onClick={()=>setTab(t)}>
            {t==='operacional'?'⬡ Operacional':'◈ Relatórios & Índices'}
          </button>
        ))}
      </nav>

      {tab==='operacional'&&(
        <main className={`${s.page} animate-fadein`}>

          {/* FILTROS NO TOPO */}
          <div className={s.filtrosBar}>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Andar</div>
              <div className={s.chips}>
                {['todos',...andares].map(a=><button key={a} className={`${s.chip} ${filtroAndar===a?s.chipActive:''}`} onClick={()=>setFiltroAndar(a)}>{a==='todos'?'Todos':a}</button>)}
              </div>
            </div>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Concretagem</div>
              <div className={s.chips}>
                {['todas',...[...concretagens].sort((a,b)=>a.numero-b.numero)].map(c=><button key={typeof c==='string'?c:c.id} className={`${s.chip} ${filtroConc===(typeof c==='string'?c:c.id)?s.chipActive:''}`} onClick={()=>setFiltroConc(typeof c==='string'?c:c.id)}>{typeof c==='string'?'Todas':`Nº${c.numero}`}</button>)}
              </div>
            </div>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Tipo de Peça</div>
              <div className={s.chips}>
                {['todos',...tipos].map(t=><button key={t} className={`${s.chip} ${filtroTipoOp===t?s.chipActive:''}`} onClick={()=>setFiltroTipoOp(t)}>{t==='todos'?'Todos':t}</button>)}
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÕES */}
          <div className={s.launchBar}>
            <div><div className={s.launchBarTitle}>Lançamento de Concretagem</div><div className={s.launchBarSub}>Gerencie peças, configure concretagens e lance BTs</div></div>
            <div className={s.launchActions}>
              <button className={s.btnAction} onClick={()=>setModalPecas(true)}>⬡ Peças</button>
              <button className={s.btnAction} onClick={()=>setModalConc(true)}>◈ Concretagens</button>
              <button className={s.btnLaunch} onClick={()=>setModalBT(true)}>⊕ Lançar BT</button>
            </div>
          </div>

          {/* KPIs — 6 cards */}
          <div className={s.grid6}>
            <KPI label="Vol. Projeto"      value={fmt4(kpis.totalVol)}          unit="m³" sub={`${pecas.length} peças`}/>
            <KPI label="Vol. Concretado"   value={fmt4(kpis.concVol)}           unit="m³" sub={`${fmt1(kpis.pctConc)}% concluído`} variant="green"/>
            <KPI label="Vol. Faltando"     value={fmt4(kpis.faltVol)}           unit="m³" sub={`${fmt1(100-kpis.pctConc)}% restante`} variant="red"/>
            <KPI label="BTs Previstas"     value={fmt4(previsto.total)}          unit="m³" sub={`${btsConfig.length} BTs total`} variant="blue"/>
            <KPI label="BTs Faltando"      value={fmt4(previsto.faltando)}       unit="m³" sub="volume não lançado" variant="purple"/>
            <KPI label="Índice de Perda"   value={fmt1(perdaInfo.indice)}        unit="%"  sub={`${fmt4(perdaInfo.perdaTotal)} m³ total`} variant="orange"/>
          </div>

          <div className={s.grid2}>
            {/* Progresso por tipo (clicável) */}
            <div className={s.panel}>
              <div className={s.panelTitle}>
                Progresso por Tipo
                {filtroAndar!=='todos'&&` — ${filtroAndar}`}
                {filtroConc!=='todas'&&` · Conc. Nº${concretagens.find(c=>c.id===filtroConc)?.numero||''}`}
                {filtroTipoOp!=='todos'&&` · ${filtroTipoOp}`}
                <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)',marginLeft:8,fontWeight:400}}>clique para ver peças</span>
              </div>
              <GraficoTipos pecas={pecasFiltOp} lancamentos={lancamentos} btsConfig={btsConfig}/>
            </div>

            {/* Coluna direita */}
            <div>
              {/* Última BT */}
              {ultimaBTConf&&(
                <div className={s.livePanel}>
                  <div className={s.livePanelBadge}>Última BT</div>
                  <div className={s.panelTitle} style={{color:'var(--accent)'}}>BT-{ultimaBTConf.numero}</div>
                  <div className={s.livePanelGrid}>
                    <div><div className={s.kpiLabel}>Concretagem</div><div className={s.liveVal}>{ultimaConc?`Nº ${ultimaConc.numero}`:'—'}</div></div>
                    <div><div className={s.kpiLabel}>Previsto</div><div className={`${s.liveVal} ${s.liveValNeutral}`}>{fmt4(ultimaBTConf.volumePrevisto)} m³</div></div>
                    <div><div className={s.kpiLabel}>Executado</div><div style={{fontFamily:'var(--mono)',fontSize:18,color:'var(--green)'}}>{fmt4(volUltimaBT)} m³</div></div>
                    <div><div className={s.kpiLabel}>Perda caminhão</div><div style={{fontFamily:'var(--mono)',fontSize:18,color:ultimaBTConf.volumePrevisto-volUltimaBT>0?'var(--red)':'var(--blue)'}}>{fmt4(Math.abs(ultimaBTConf.volumePrevisto-volUltimaBT))} m³</div></div>
                  </div>
                  {ultimaBTConf.notaFiscal&&<div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text3)',marginTop:8}}>NF: {ultimaBTConf.notaFiscal}{ultimaBTConf.codigoBT?` · Cód: ${ultimaBTConf.codigoBT}`:''}</div>}
                </div>
              )}

              {/* Gráfico BTs */}
              <div className={s.panel}>
                <div className={s.panelTitle}>Status das BTs por Concretagem</div>
                <GraficoBTs btsConfig={btsConfig} lancamentos={lancamentos} concretagens={concretagens}/>
              </div>
            </div>
          </div>
        </main>
      )}

      {tab==='relatorios'&&(
        <main className={`${s.page} animate-fadein`}>
          <div className={s.panel} style={{marginBottom:20}}>
            <div className={s.panelTitle}>Filtros</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              <div><label className={s.formLabel} style={{display:'block',marginBottom:6}}>Concretagem</label>
                <select className={s.formSelect} style={{maxWidth:280}} value={filtroRelConc} onChange={e=>setFiltroRelConc(e.target.value)}>
                  <option value="todas">Todas</option>
                  {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=><option key={c.id} value={c.id}>Nº {c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>)}
                </select>
              </div>
              <div><label className={s.formLabel} style={{display:'block',marginBottom:6}}>Andar</label>
                <select className={s.formSelect} style={{maxWidth:200}} value={filtroRelAndar} onChange={e=>setFiltroRelAndar(e.target.value)}>
                  <option value="todos">Todos</option>{andares.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>

          {(()=>{
            let lans=lancamentos,pcs=pecas,bts=btsConfig;
            if(filtroRelConc!=='todas'){lans=lans.filter(l=>l.concretagemId===filtroRelConc);bts=bts.filter(b=>b.concretagemId===filtroRelConc);}
            if(filtroRelAndar!=='todos') pcs=pcs.filter(p=>p.andar===filtroRelAndar);
            const pids=new Set(pcs.map(p=>p.id));lans=lans.filter(l=>pids.has(l.pecaId));
            const relProg=pcs.reduce((s,p)=>s+p.volume,0);
            const relConc=pcs.reduce((s,p)=>s+Math.min(p.volume,volLancadoPeca(p.id,lans)),0);
            const pInfo=calcIndicePerda(lans,bts);
            const relSobra=lans.reduce((s,l)=>s+l.sobraCaminhao,0);
            return <>
              <div className={s.grid4}>
                <KPI label="Vol. Programado" value={fmt4(relProg)}         unit="m³"/>
                <KPI label="Vol. Concretado" value={fmt4(relConc)}         unit="m³" variant="green"/>
                <KPI label="Perda Total"     value={fmt4(pInfo.perdaTotal)} unit="m³" sub={`obra ${fmt4(pInfo.perdaObra)} + caminhão ${fmt4(pInfo.perdaCaminhao)}`} variant="red"/>
                <KPI label="Índice de Perda" value={fmt1(pInfo.indice)}    unit="%"  sub="sobre volume previsto" variant="orange"/>
              </div>

              <div className={s.panel} style={{marginBottom:20}}>
                <div className={s.panelTitle}>Volume por Andar — Previsto vs Executado vs Projeção</div>
                <div style={{overflowX:'auto'}}><table className={s.table}>
                  <thead><tr><th>Andar</th><th>Previsto (m³)</th><th>Executado (m³)</th><th>Faltando (m³)</th><th>Proj. c/ Perda</th><th>Progresso</th></tr></thead>
                  <tbody>{calcAndares(pcs,lans,pInfo.indice).map(d=>(
                    <tr key={d.andar}>
                      <td style={{fontWeight:600,fontSize:14}}>{d.andar}</td>
                      <td className={s.tdMono}>{fmt4(d.prog)}</td>
                      <td className={s.tdGreen}>{fmt4(d.conc)}</td>
                      <td className={s.tdRed}>{fmt4(d.falt)}</td>
                      <td className={s.tdMono} style={{color:'var(--accent)'}}>{fmt4(d.projPerda)}</td>
                      <td style={{minWidth:160}}>
                        <div style={{position:'relative',height:20,background:'var(--surface2)',width:'100%',borderRadius:2}}>
                          <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${(d.conc/Math.max(d.prog,0.01))*100}%`,background:'var(--green)',opacity:0.85,borderRadius:2}}/>
                          <div style={{position:'absolute',right:6,top:2,fontFamily:'var(--mono)',fontSize:11,color:'var(--text)',lineHeight:'16px',fontWeight:700}}>{fmt1(d.pct)}%</div>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
                {pInfo.indice>0&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:10}}>* Projeção usa índice de perda atual: {fmt1(pInfo.indice)}%</div>}
              </div>

              <div className={s.panel} style={{marginBottom:20}}>
                <div className={s.panelTitle}>Resumo por Tipo de Peça</div>
                <div style={{overflowX:'auto'}}><table className={s.table}>
                  <thead><tr><th>Tipo</th><th>Qtd</th><th>Previsto (m³)</th><th>Executado (m³)</th><th>Faltando (m³)</th><th>%</th></tr></thead>
                  <tbody>{calcPorTipo(pcs,lans).map(t=>(
                    <tr key={t.tipo}>
                      <td style={{fontWeight:600,fontSize:14}}>{t.tipo}</td>
                      <td className={s.tdMono}>{t.count}</td>
                      <td className={s.tdMono}>{fmt4(t.prog)}</td>
                      <td className={s.tdGreen}>{fmt4(t.conc)}</td>
                      <td className={s.tdRed}>{fmt4(t.falt)}</td>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:60,height:8,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,t.pct)}%`,background:t.pct>=100?'var(--green)':'var(--accent)'}}/></div><span className={s.tdMono}>{fmt1(t.pct)}%</span></div></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </div>

              <div className={s.panel}>
                <div className={s.panelTitle}>Índice por BT</div>
                <div style={{overflowX:'auto'}}><table className={s.table}>
                  <thead><tr><th>BT</th><th>Conc.</th><th>NF</th><th>Código</th><th>Previsto</th><th>Executado</th><th>Perda Obra</th><th>Perda Cam.</th><th>Status</th></tr></thead>
                  <tbody>{bts.length===0?<tr><td colSpan={9} className={s.empty} style={{padding:'24px 16px'}}>Sem BTs</td></tr>
                    :bts.sort((a,b)=>a.numero-b.numero).map(b=>{
                      const conc=concretagens.find(c=>c.id===b.concretagemId);
                      const bLans=lans.filter(l=>l.btConfigId===b.id);
                      const usado=bLans.reduce((s,l)=>s+l.volume,0);
                      const perdaObra=bLans.reduce((s,l)=>s+l.perdaObra,0);
                      const perdaCam=bLans.length>0?b.volumePrevisto-usado:0;
                      const lancada=bLans.length>0;
                      const acima=usado>b.volumePrevisto;
                      return <tr key={b.id}>
                        <td className={s.tdAccent}>BT-{b.numero}</td>
                        <td className={s.tdMono}>{conc?.numero||'—'}</td>
                        <td className={s.tdMono} style={{color:'var(--text2)'}}>{b.notaFiscal||'—'}</td>
                        <td className={s.tdMono} style={{color:'var(--text2)'}}>{b.codigoBT||'—'}</td>
                        <td className={s.tdMono}>{fmt4(b.volumePrevisto)}</td>
                        <td className={lancada?(acima?s.tdBlue:s.tdGreen):s.tdMuted}>{lancada?fmt4(usado):'—'}</td>
                        <td className={perdaObra>0?s.tdRed:s.tdMuted}>{lancada?fmt4(perdaObra):'—'}</td>
                        <td className={perdaCam>0?s.tdRed:perdaCam<0?s.tdBlue:s.tdMuted}>{lancada?fmt4(Math.abs(perdaCam))+(acima?' ▲':''):'—'}</td>
                        <td><span className={`${s.badge} ${lancada?s.badgeComplete:s.badgePending}`}>{lancada?'Lançada':'Pendente'}</span></td>
                      </tr>;
                    })
                  }</tbody>
                </table></div>
              </div>
            </>;
          })()}
        </main>
      )}

      <ModalPecas       open={modalPecas} onClose={()=>setModalPecas(false)} pecas={pecas} onSalvo={msg=>showToast(msg,'ok')}/>
      <ModalConcretagem open={modalConc}  onClose={()=>setModalConc(false)}  pecas={pecas} concretagens={concretagens} pecaConc={pecaConc} btsConfig={btsConfig} onSalvo={msg=>showToast(msg,'ok')}/>
      <ModalLancarBT    open={modalBT}    onClose={()=>setModalBT(false)}    pecas={pecas} concretagens={concretagens} pecaConc={pecaConc} btsConfig={btsConfig} lancamentos={lancamentos} onSalvo={msg=>showToast(msg,'ok')}/>
      <Toast msg={toast.msg} tipo={toast.tipo} onDone={()=>setToast({msg:'',tipo:'ok'})}/>
    </>
  );
}
