import { useState, useEffect, useCallback, useMemo } from 'react';
import s from '../styles/Home.module.css';
import {
  fmt1, fmt2, volLancadoPeca, pctConcretado,
  calcKPIs, calcAndares, calcPorTipo, calcBTsStatus, calcIndicePerda, statusPeca,
} from '../lib/calculos';
import {
  apiAdicionarPeca, apiAdicionarPecaLote, apiEditarPeca, apiExcluirPeca,
  apiSalvarConcretagem, apiLancarBT,
} from '../lib/api';

// ── CONSTANTES ────────────────────────────────
const CORES_TIPO = ['#e8a225','#4a9eff','#3ecf7a','#e85a4f','#a855f7','#f59e0b','#14b8a6','#06b6d4'];
const TIPOS = ['Pilar','Viga','Laje','Fundação','Cortina','Escada','Caixa D\'água','Outro'];

// ── HELPERS ───────────────────────────────────
const badgeCls  = st => st==='complete'?s.badgeComplete:st==='partial'?s.badgePartial:s.badgePending;
const badgeLabel = (st,pct) => st==='complete'?'Completo':st==='partial'?`Parcial · ${fmt1(pct)}%`:'Pendente';

// ── KPI ───────────────────────────────────────
function KPI({ label, value, unit, sub, variant }) {
  const cls = [s.kpi, variant==='green'?s.kpiGreen:variant==='red'?s.kpiRed:variant==='blue'?s.kpiBlue:variant==='orange'?s.kpiOrange:''].join(' ');
  return <div className={cls}><div className={s.kpiLabel}>{label}</div><div className={s.kpiValue}>{value}<span className={s.kpiUnit}>{unit}</span></div>{sub&&<div className={s.kpiSub}>{sub}</div>}</div>;
}

// ── BARRA DE PROGRESSO ────────────────────────
function ProgressBar({ pct, color }) {
  return <div className={s.progressBar}><div className={s.progressFill} style={{width:`${Math.min(100,pct)}%`,background:color||'var(--accent)'}}/></div>;
}

// ── TOAST ─────────────────────────────────────
function Toast({ msg, tipo, onDone }) {
  useEffect(()=>{ if(!msg) return; const t=setTimeout(onDone,3500); return()=>clearTimeout(t); },[msg,onDone]);
  if(!msg) return null;
  return <div className={`${s.toast} ${tipo==='err'?s.toastErr:''}`}>{msg}</div>;
}

// ── MODAL WRAPPER ─────────────────────────────
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

// ── DATA HOOK ─────────────────────────────────
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
  useEffect(()=>{
    if(pausado) return; // não atualiza com modal aberto
    const id=setInterval(fetch_,60000);
    return()=>clearInterval(id);
  },[fetch_,pausado]);
  return{data,loading,error,refresh:fetch_};
}

// ════════════════════════════════════════════════
// MODAL: GERENCIAR PEÇAS
// ════════════════════════════════════════════════
function ModalPecas({ open, onClose, pecas, onSalvo }) {
  const [modo, setModo]       = useState('lista'); // lista | nova | editar | importar
  const [editPeca, setEditPeca] = useState(null);
  const [filtro,   setFiltro]  = useState('');
  const [salvando, setSalvando]= useState(false);
  const [erro,     setErro]    = useState('');
  // form
  const [nome,setNome]=useState(''); const [tipo,setTipo]=useState('Pilar');
  const [andar,setAndar]=useState(''); const [volume,setVolume]=useState('');
  // importar
  const [textoImport, setTextoImport] = useState('');
  const [previewImport, setPreviewImport] = useState([]);
  const [erroImport, setErroImport] = useState('');

  useEffect(()=>{ if(open){setModo('lista');setFiltro('');setErro('');} },[open]);

  const andares = [...new Set(pecas.map(p=>p.andar))].sort();
  const pecasFiltradas = pecas.filter(p=>
    p.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    p.andar.toLowerCase().includes(filtro.toLowerCase()) ||
    p.tipo.toLowerCase().includes(filtro.toLowerCase())
  );

  function abrirEditar(p) {
    setEditPeca(p); setNome(p.nome); setTipo(p.tipo); setAndar(p.andar); setVolume(String(p.volume));
    setErro(''); setModo('editar');
  }

  function abrirNova() {
    setEditPeca(null); setNome(''); setTipo('Pilar'); setAndar(''); setVolume('');
    setErro(''); setModo('nova');
  }

  async function salvarPeca() {
    if(!nome||!andar||!volume){setErro('Preencha todos os campos');return;}
    setSalvando(true);
    try {
      if(modo==='editar') {
        await apiEditarPeca({id:editPeca.id,nome,tipo,andar,volume});
        onSalvo(`✓ Peça "${nome}" atualizada!`);
      } else {
        await apiAdicionarPeca({nome,tipo,andar,volume});
        onSalvo(`✓ Peça "${nome}" adicionada!`);
      }
      setModo('lista');
    } catch(e){setErro('Erro: '+e.message);}
    finally{setSalvando(false);}
  }

  async function excluir(p) {
    if(!confirm(`Excluir "${p.nome}"? Isso removerá também os vínculos com concretagens.`)) return;
    setSalvando(true);
    try{ await apiExcluirPeca(p.id); onSalvo(`Peça "${p.nome}" excluída.`); }
    catch(e){setErro('Erro: '+e.message);}finally{setSalvando(false);}
  }

  function parsearImport(txt) {
    setErroImport('');
    const linhas=txt.trim().split('\n').filter(l=>l.trim());
    const ps=[]; const errs=[];
    linhas.forEach((linha,i)=>{
      const cols=linha.split('\t');
      if(cols.length<4){errs.push(`Linha ${i+1}: menos de 4 colunas`);return;}
      const [n,t,a,vRaw]=cols.map(c=>c.trim());
      const v=parseFloat(vRaw.replace(',','.'));
      if(!n){errs.push(`Linha ${i+1}: nome vazio`);return;}
      if(isNaN(v)){errs.push(`Linha ${i+1}: volume inválido "${vRaw}"`);return;}
      ps.push({nome:n,tipo:t||'Outro',andar:a||'Sem andar',volume:v});
    });
    if(errs.length){setErroImport(errs.join(' | '));setPreviewImport([]);return;}
    setPreviewImport(ps);
  }

  async function salvarImport() {
    if(!previewImport.length) return;
    setSalvando(true);
    try{
      await apiAdicionarPecaLote(previewImport);
      onSalvo(`✓ ${previewImport.length} peças importadas!`);
      setModo('lista'); setTextoImport(''); setPreviewImport([]);
    }catch(e){setErroImport('Erro: '+e.message);}finally{setSalvando(false);}
  }

  return (
    <Modal open={open} onClose={onClose} title="⬡ Gerenciar Peças" wide>
      {/* Lista */}
      {modo==='lista'&&(
        <div>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <input className={s.formInput} style={{flex:1,minWidth:160}} placeholder="Buscar peça..." value={filtro} onChange={e=>setFiltro(e.target.value)}/>
            <button className={s.btnAction} onClick={abrirNova}>+ Nova Peça</button>
            <button className={s.btnAction} onClick={()=>{setModo('importar');setTextoImport('');setPreviewImport([]);setErroImport('');}}>⊞ Importar Lote</button>
          </div>
          {erro&&<div className={s.alertRed} style={{marginBottom:12}}>{erro}</div>}
          <div style={{maxHeight:420,overflowY:'auto',border:'1px solid var(--border)'}}>
            {pecasFiltradas.length===0
              ?<div className={s.empty}>Nenhuma peça encontrada.</div>
              :pecasFiltradas.map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:13}}>{p.nome}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>{p.tipo} · {p.andar} · {fmt2(p.volume)} m³</div>
                  </div>
                  <button className={s.btnAction} style={{padding:'6px 14px',fontSize:11}} onClick={()=>abrirEditar(p)}>Editar</button>
                  <button className={s.btnDanger} style={{padding:'6px 12px'}} onClick={()=>excluir(p)}>✕</button>
                </div>
              ))
            }
          </div>
          <div className={s.btnRow}><button className={s.btnSecondary} onClick={onClose}>Fechar</button></div>
        </div>
      )}

      {/* Nova / Editar */}
      {(modo==='nova'||modo==='editar')&&(
        <div>
          <div style={{marginBottom:16,fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{modo==='editar'?`Editando: ${editPeca.nome}`:'Nova peça'}</div>
          {erro&&<div className={s.alertRed} style={{marginBottom:12}}>{erro}</div>}
          <div className={s.formGrid}>
            <div className={s.formGroup}><label className={s.formLabel}>Nome</label><input className={s.formInput} placeholder="ex: Pilar P-01" value={nome} onChange={e=>setNome(e.target.value)}/></div>
            <div className={s.formGroup}><label className={s.formLabel}>Tipo</label><select className={s.formSelect} value={tipo} onChange={e=>setTipo(e.target.value)}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
            <div className={s.formGroup}><label className={s.formLabel}>Andar</label><input className={s.formInput} placeholder="ex: Térreo" value={andar} onChange={e=>setAndar(e.target.value)} list="al"/><datalist id="al">{andares.map(a=><option key={a} value={a}/>)}</datalist></div>
            <div className={s.formGroup}><label className={s.formLabel}>Volume (m³)</label><input className={s.formInput} type="number" step="0.01" min="0.01" placeholder="0.00" value={volume} onChange={e=>setVolume(e.target.value)}/></div>
          </div>
          <div className={s.btnRow}>
            <button className={s.btnSecondary} onClick={()=>setModo('lista')}>← Voltar</button>
            <button className={s.btnPrimary} disabled={salvando} onClick={salvarPeca}>{salvando?'⏳ Salvando...':(modo==='editar'?'Salvar Alterações':'Cadastrar Peça')}</button>
          </div>
        </div>
      )}

      {/* Importar */}
      {modo==='importar'&&(
        <div>
          <div className={s.infoBox} style={{marginBottom:14}}>
            <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--blue)',lineHeight:2}}>
              Copie do Excel/Sheets as colunas: <strong>Nome | Tipo | Andar | Volume(m³)</strong> e cole abaixo.
            </span>
          </div>
          {erroImport&&<div className={s.alertRed} style={{marginBottom:10}}>{erroImport}</div>}
          <textarea style={{width:'100%',height:130,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',fontFamily:'var(--mono)',fontSize:12,padding:'10px 14px',outline:'none',resize:'vertical',lineHeight:1.8}}
            placeholder={'Pilar P-01\tPilar\tTérreo\t1.5\nViga V-01\tViga\tTérreo\t2.8'}
            value={textoImport} onChange={e=>{setTextoImport(e.target.value);parsearImport(e.target.value);}}/>
          {previewImport.length>0&&(
            <div style={{marginTop:10,maxHeight:160,overflowY:'auto',border:'1px solid var(--border)'}}>
              <table className={s.table}><thead><tr><th>#</th><th>Nome</th><th>Tipo</th><th>Andar</th><th>m³</th></tr></thead>
                <tbody>{previewImport.map((p,i)=><tr key={i}><td className={s.tdMuted}>{i+1}</td><td>{p.nome}</td><td className={s.tdMono}>{p.tipo}</td><td className={s.tdMono}>{p.andar}</td><td className={s.tdAccent}>{fmt2(p.volume)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className={s.btnRow}>
            <button className={s.btnSecondary} onClick={()=>setModo('lista')}>← Voltar</button>
            <button className={s.btnPrimary} disabled={!previewImport.length||salvando} onClick={salvarImport}>{salvando?'⏳ Importando...':`✓ Importar ${previewImport.length} peças`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════
// MODAL: GERENCIAR CONCRETAGEM (criar/editar)
// ════════════════════════════════════════════════
function ModalConcretagem({ open, onClose, pecas, concretagens, pecaConc, btsConfig, onSalvo }) {
  const [subModo,    setSubModo]   = useState('menu');    // menu | nova | editar
  const [step,       setStep]      = useState(1);         // 1=dados, 2=peças, 3=bts, 4=resumo
  const [concSel,    setConcSel]   = useState('');        // para editar
  // dados concretagem
  const [concId,     setConcId]    = useState('');
  const [numero,     setNumero]    = useState('');
  const [data,       setData]      = useState('');
  const [desc,       setDesc]      = useState('');
  // peças vinculadas: [{pecaId, pctConcretagem}]
  const [vinculos,   setVinculos]  = useState([]);
  // bts configuradas: [{id?, numero, volumePrevisto, notaFiscal, codigoBT}]
  const [bts,        setBts]       = useState([]);
  // filtros seletor peças
  const [filtroAndar,setFiltroAndar]=useState('todos');
  const [filtroTipo, setFiltroTipo]=useState('todos');
  const [salvando,   setSalvando]  = useState(false);
  const [erro,       setErro]      = useState('');

  const andares = ['todos',...new Set(pecas.map(p=>p.andar)).values()].sort();
  const tipos   = ['todos',...new Set(pecas.map(p=>p.tipo)).values()].sort();
  const genId = p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  useEffect(()=>{ if(open){setSubModo('menu');setErro('');} },[open]);

  function iniciarNova() {
    setConcId(genId('c'));
    setNumero(String(concretagens.length+1));
    setData(new Date().toISOString().slice(0,10));
    setDesc(''); setVinculos([]); setBts([]); setErro(''); setStep(1); setFiltroAndar('todos'); setFiltroTipo('todos');
    setSubModo('nova');
  }

  function iniciarEditar() {
    if(!concSel){setErro('Selecione uma concretagem');return;}
    const c = concretagens.find(x=>x.id===concSel);
    if(!c) return;
    setConcId(c.id); setNumero(String(c.numero)); setData(c.data); setDesc(c.descricao||'');
    // carrega vínculos existentes
    const vs = pecaConc.filter(pc=>pc.concretagemId===c.id).map(pc=>({pecaId:pc.pecaId,pctConcretagem:pc.pctConcretagem,id:pc.id}));
    setVinculos(vs);
    // carrega BTs existentes
    const bs = btsConfig.filter(b=>b.concretagemId===c.id).map(b=>({...b}));
    setBts(bs);
    setErro(''); setStep(1); setFiltroAndar('todos'); setFiltroTipo('todos');
    setSubModo('editar');
  }

  // Toggle peça no vínculo
  function togglePeca(pecaId) {
    setVinculos(prev => {
      if(prev.find(v=>v.pecaId===pecaId)) return prev.filter(v=>v.pecaId!==pecaId);
      return [...prev,{pecaId,pctConcretagem:100}];
    });
  }

  function setPct(pecaId, val) {
    setVinculos(prev=>prev.map(v=>v.pecaId===pecaId?{...v,pctConcretagem:parseFloat(val)||100}:v));
  }

  function toggleAndarInteiro(andar) {
    const ids=pecas.filter(p=>p.andar===andar).map(p=>p.id);
    const todos=ids.every(id=>vinculos.find(v=>v.pecaId===id));
    if(todos) setVinculos(prev=>prev.filter(v=>!ids.includes(v.pecaId)));
    else {
      const novos=ids.filter(id=>!vinculos.find(v=>v.pecaId===id)).map(id=>({pecaId:id,pctConcretagem:100}));
      setVinculos(prev=>[...prev,...novos]);
    }
  }

  // BTs
  function addBT() { setBts(prev=>[...prev,{id:'',numero:prev.length+1,volumePrevisto:8,notaFiscal:'',codigoBT:''}]); }
  function remBT(i) { setBts(prev=>prev.filter((_,idx)=>idx!==i)); }
  function updBT(i,f,v) { setBts(prev=>prev.map((b,idx)=>idx===i?{...b,[f]:v}:b)); }

  const volTotalVinculos = vinculos.reduce((s,v)=>{
    const p=pecas.find(x=>x.id===v.pecaId);
    return s+(p?(v.pctConcretagem/100)*p.volume:0);
  },0);

  const volTotalBTs = bts.reduce((s,b)=>s+(parseFloat(b.volumePrevisto)||0),0);

  async function salvar() {
    if(!numero||!data){setErro('Preencha número e data');return;}
    if(!vinculos.length){setErro('Vincule ao menos 1 peça');return;}
    setSalvando(true);
    try {
      await apiSalvarConcretagem({
        id:concId, numero, data, descricao:desc,
        pecaConcs: vinculos.map(v=>({id:v.id||'',pecaId:v.pecaId,pctConcretagem:v.pctConcretagem})),
        btsConfig: bts.map(b=>({id:b.id||'',numero:b.numero,volumePrevisto:b.volumePrevisto,notaFiscal:b.notaFiscal||'',codigoBT:b.codigoBT||''})),
      });
      onSalvo(`✓ Concretagem Nº${numero} salva!`);
      onClose();
    } catch(e){setErro('Erro: '+e.message);}finally{setSalvando(false);}
  }

  const pecasVisiveis = pecas.filter(p=>
    (filtroAndar==='todos'||p.andar===filtroAndar)&&
    (filtroTipo==='todos'||p.tipo===filtroTipo)
  );

  return (
    <Modal open={open} onClose={onClose} title="◈ Concretagens" extraWide>

      {/* MENU */}
      {subModo==='menu'&&(
        <div>
          {erro&&<div className={s.alertRed} style={{marginBottom:16}}>{erro}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
            <div onClick={iniciarNova} className={s.menuCard}>
              <div className={s.menuCardIcon}>+</div>
              <div className={s.menuCardTitle}>Nova Concretagem</div>
              <div className={s.menuCardSub}>Criar do zero com peças e BTs</div>
            </div>
            <div className={s.menuCard}>
              <div className={s.menuCardIcon}>✎</div>
              <div className={s.menuCardTitle}>Editar Existente</div>
              <div className={s.menuCardSub}>Alterar peças, BTs ou dados</div>
              <select className={s.formSelect} style={{marginTop:12}} value={concSel} onClick={e=>e.stopPropagation()} onChange={e=>setConcSel(e.target.value)}>
                <option value="">— selecione —</option>
                {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=><option key={c.id} value={c.id}>Nº{c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>)}
              </select>
              <button className={s.btnPrimary} style={{marginTop:10,width:'100%'}} onClick={iniciarEditar}>Editar →</button>
            </div>
          </div>
          <div className={s.btnRow}><button className={s.btnSecondary} onClick={onClose}>Fechar</button></div>
        </div>
      )}

      {/* NOVA / EDITAR — Steps */}
      {(subModo==='nova'||subModo==='editar')&&(
        <div>
          {/* Steps header */}
          <div className={s.steps}>
            {['Dados','Peças','BTs','Resumo'].map((label,i)=>(
              <div key={i} className={`${s.step} ${step===i+1?s.stepActive:step>i+1?s.stepDone:''}`}>
                <div className={s.stepNum}>{step>i+1?'✓':i+1}</div>
                <div className={s.stepLabel}>{label}</div>
              </div>
            ))}
          </div>
          {erro&&<div className={s.alertRed} style={{marginBottom:14}}>{erro}</div>}

          {/* STEP 1: Dados */}
          {step===1&&(
            <div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label className={s.formLabel}>Número</label><input className={s.formInput} type="number" min="1" value={numero} onChange={e=>setNumero(e.target.value)}/></div>
                <div className={s.formGroup}><label className={s.formLabel}>Data</label><input className={s.formInput} type="date" value={data} onChange={e=>setData(e.target.value)}/></div>
                <div className={`${s.formGroup} ${s.formGroupFull}`}><label className={s.formLabel}>Descrição</label><input className={s.formInput} placeholder="ex: Pilares Térreo eixos A-D" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
              </div>
              <div className={s.btnRow}>
                <button className={s.btnSecondary} onClick={()=>setSubModo('menu')}>← Voltar</button>
                <button className={s.btnPrimary} onClick={()=>{if(!numero||!data){setErro('Preencha número e data');return;}setErro('');setStep(2);}}>Próximo →</button>
              </div>
            </div>
          )}

          {/* STEP 2: Vincular Peças */}
          {step===2&&(
            <div>
              <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--accent)'}}>{vinculos.length} peças vinculadas · {fmt2(volTotalVinculos)} m³</span>
                {filtroAndar!=='todos'&&(
                  <button className={s.btnAction} style={{padding:'5px 12px',fontSize:11}} onClick={()=>toggleAndarInteiro(filtroAndar)}>
                    {pecas.filter(p=>p.andar===filtroAndar).every(p=>vinculos.find(v=>v.pecaId===p.id))
                      ?'Desmarcar tudo':'Marcar tudo do andar'}
                  </button>
                )}
              </div>
              {/* Filtros */}
              <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                <div>
                  <label className={s.formLabel} style={{display:'block',marginBottom:4}}>Andar</label>
                  <select className={s.formSelect} style={{minWidth:140}} value={filtroAndar} onChange={e=>setFiltroAndar(e.target.value)}>
                    {andares.map(a=><option key={a} value={a}>{a==='todos'?'Todos os andares':a}</option>)}
                  </select>
                </div>
                <div>
                  <label className={s.formLabel} style={{display:'block',marginBottom:4}}>Tipo</label>
                  <select className={s.formSelect} style={{minWidth:120}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
                    {tipos.map(t=><option key={t} value={t}>{t==='todos'?'Todos os tipos':t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{maxHeight:300,overflowY:'auto',border:'1px solid var(--border)'}}>
                {pecasVisiveis.length===0
                  ?<div className={s.empty}>Nenhuma peça encontrada.</div>
                  :pecasVisiveis.map(p=>{
                    const sel=!!vinculos.find(v=>v.pecaId===p.id);
                    const vinc=vinculos.find(v=>v.pecaId===p.id);
                    return(
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderBottom:'1px solid var(--border)',background:sel?'rgba(232,162,37,0.06)':'transparent'}}>
                        <div onClick={()=>togglePeca(p.id)} style={{width:20,height:20,border:`2px solid ${sel?'var(--accent)':'var(--border2)'}`,background:sel?'var(--accent)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:13,color:'#0e0f11',fontWeight:700,transition:'all 0.15s'}}>
                          {sel?'✓':''}
                        </div>
                        <div style={{flex:1,cursor:'pointer'}} onClick={()=>togglePeca(p.id)}>
                          <div style={{fontWeight:500,fontSize:13}}>{p.nome}</div>
                          <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>{p.tipo} · {p.andar} · {fmt2(p.volume)} m³</div>
                        </div>
                        {sel&&(
                          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                            <label style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>% desta conc.</label>
                            <input type="number" min="1" max="100" step="1" value={vinc.pctConcretagem}
                              onChange={e=>setPct(p.id,e.target.value)} onClick={e=>e.stopPropagation()}
                              style={{width:64,background:'var(--surface2)',border:'1px solid var(--accent)',color:'var(--accent)',fontFamily:'var(--mono)',fontSize:12,padding:'4px 8px',outline:'none'}}/>
                            <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>= {fmt2((vinc.pctConcretagem/100)*p.volume)} m³</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
              <div className={s.btnRow}>
                <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(1);}}>← Voltar</button>
                <button className={s.btnPrimary} onClick={()=>{if(!vinculos.length){setErro('Vincule ao menos 1 peça');return;}setErro('');setStep(3);}}>Próximo →</button>
              </div>
            </div>
          )}

          {/* STEP 3: Configurar BTs */}
          {step===3&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text2)'}}>
                  Volume total da concretagem: <span style={{color:'var(--accent)'}}>{fmt2(volTotalVinculos)} m³</span>
                  {bts.length>0&&<> &nbsp;|&nbsp; Previsto nas BTs: <span style={{color:Math.abs(volTotalBTs-volTotalVinculos)<0.1?'var(--green)':'var(--red)'}}>{fmt2(volTotalBTs)} m³</span></>}
                </div>
                <button className={s.btnAction} style={{padding:'8px 16px',fontSize:12}} onClick={addBT}>+ Adicionar BT</button>
              </div>
              {bts.length===0
                ?<div className={s.empty}>Clique em "+ Adicionar BT" para configurar as betonadas.</div>
                :<div style={{maxHeight:340,overflowY:'auto'}}>
                  {bts.map((b,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1fr 1fr 1fr auto',gap:10,marginBottom:10,alignItems:'end'}}>
                      <div className={s.formGroup}><label className={s.formLabel}>BT Nº</label><input className={s.formInput} type="number" min="1" value={b.numero} onChange={e=>updBT(i,'numero',e.target.value)}/></div>
                      <div className={s.formGroup}><label className={s.formLabel}>Vol. Previsto (m³)</label><input className={s.formInput} type="number" step="0.5" min="0" value={b.volumePrevisto} onChange={e=>updBT(i,'volumePrevisto',e.target.value)}/></div>
                      <div className={s.formGroup}><label className={s.formLabel}>Nota Fiscal</label><input className={s.formInput} placeholder="opcional" value={b.notaFiscal} onChange={e=>updBT(i,'notaFiscal',e.target.value)}/></div>
                      <div className={s.formGroup}><label className={s.formLabel}>Código BT</label><input className={s.formInput} placeholder="opcional" value={b.codigoBT} onChange={e=>updBT(i,'codigoBT',e.target.value)}/></div>
                      <button className={s.btnDanger} style={{marginBottom:2}} onClick={()=>remBT(i)}>✕</button>
                    </div>
                  ))}
                </div>
              }
              <div className={s.btnRow}>
                <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(2);}}>← Voltar</button>
                <button className={s.btnPrimary} onClick={()=>{setErro('');setStep(4);}}>Revisar →</button>
              </div>
            </div>
          )}

          {/* STEP 4: Resumo */}
          {step===4&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
                <div className={s.kpi}><div className={s.kpiLabel}>Concretagem</div><div className={s.kpiValue} style={{fontSize:28}}>Nº {numero}</div><div className={s.kpiSub}>{data} {desc&&`· ${desc}`}</div></div>
                <div className={`${s.kpi} ${s.kpiGreen}`}><div className={s.kpiLabel}>Volume Previsto</div><div className={s.kpiValue} style={{fontSize:28}}>{fmt2(volTotalVinculos)}<span className={s.kpiUnit}>m³</span></div><div className={s.kpiSub}>{vinculos.length} peças vinculadas</div></div>
              </div>
              <div style={{marginBottom:16}}>
                <div className={s.sectionTitle} style={{marginBottom:8}}>Peças vinculadas</div>
                {vinculos.slice(0,8).map(v=>{ const p=pecas.find(x=>x.id===v.pecaId); return p?<div key={v.pecaId} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:11}}><span>{p.nome} ({p.andar})</span><span style={{color:'var(--accent)'}}>{v.pctConcretagem}% → {fmt2((v.pctConcretagem/100)*p.volume)} m³</span></div>:null;})}
                {vinculos.length>8&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:6}}>... e mais {vinculos.length-8} peças</div>}
              </div>
              {bts.length>0&&(
                <div style={{marginBottom:16}}>
                  <div className={s.sectionTitle} style={{marginBottom:8}}>{bts.length} BTs configuradas · {fmt2(volTotalBTs)} m³ previsto</div>
                  {bts.map((b,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:11}}><span style={{color:'var(--accent)'}}>BT-{b.numero}</span><span>{fmt2(b.volumePrevisto)} m³{b.notaFiscal?` · NF:${b.notaFiscal}`:''}{b.codigoBT?` · Cód:${b.codigoBT}`:''}</span></div>)}
                </div>
              )}
              <div className={s.btnRow}>
                <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(3);}}>← Voltar</button>
                <button className={s.btnPrimary} disabled={salvando} onClick={salvar}>{salvando?'⏳ Salvando...':'✓ Salvar Concretagem'}</button>
              </div>
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
  const [step,    setStep]    = useState(1); // 1=selecionar conc+bt, 2=peças+%, 3=fechamento
  const [concId,  setConcId]  = useState('');
  const [btId,    setBtId]    = useState('');
  const [nfEdit,  setNfEdit]  = useState('');
  const [codEdit, setCodEdit] = useState('');
  const [hora,    setHora]    = useState('');
  const [linhas,  setLinhas]  = useState([{pecaId:'',pct:''}]);
  const [sobra,   setSobra]   = useState('');
  const [perda,   setPerda]   = useState('');
  const [salvando,setSalvando]= useState(false);
  const [erro,    setErro]    = useState('');

  useEffect(()=>{
    if(!open) return;
    setStep(1);setErro('');setConcId('');setBtId('');setLinhas([{pecaId:'',pct:''}]);setSobra('');setPerda('');
    const now=new Date();
    setHora(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  },[open]);

  // BTs disponíveis da concretagem selecionada (não lançadas ainda)
  const btsConc = btsConfig.filter(b=>b.concretagemId===concId).sort((a,b)=>a.numero-b.numero);
  const btSel   = btsConc.find(b=>b.id===btId);

  useEffect(()=>{
    if(btSel){setNfEdit(btSel.notaFiscal||'');setCodEdit(btSel.codigoBT||'');}
  },[btId]);

  // Peças vinculadas a esta concretagem
  const pecasConc = useMemo(()=>{
    if(!concId) return [];
    const ids = pecaConc.filter(pc=>pc.concretagemId===concId).map(pc=>pc.pecaId);
    return pecas.filter(p=>ids.includes(p.id));
  },[concId,pecaConc,pecas]);

  const volLinha = l => { const p=pecas.find(x=>x.id===l.pecaId); const pct=parseFloat(l.pct); return p&&!isNaN(pct)?(pct/100)*p.volume:0; };
  const totalUsado = linhas.reduce((s,l)=>s+volLinha(l),0);
  const volPrevisto = btSel?.volumePrevisto||0;
  const sobEstimada = Math.max(0, volPrevisto-totalUsado);

  const addLinha = ()=>setLinhas(p=>[...p,{pecaId:'',pct:''}]);
  const remLinha = i=>setLinhas(p=>p.filter((_,idx)=>idx!==i));
  const updLinha = (i,f,v)=>setLinhas(p=>p.map((l,idx)=>idx===i?{...l,[f]:v}:l));

  async function salvar(){
    setErro('');
    const linhasVal=linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0);
    if(!concId||!btId){setErro('Selecione a concretagem e a BT');return;}
    if(!linhasVal.length){setErro('Adicione ao menos 1 peça com %');return;}
    setSalvando(true);
    try{
      await apiLancarBT({
        btConfigId:btId, concretagemId:concId,
        linhas:linhasVal, sobraCaminhao:parseFloat(sobra)||sobEstimada,
        perdaObra:parseFloat(perda)||0, hora, pecas,
        notaFiscal:nfEdit, codigoBT:codEdit,
      });
      onSalvo(`✓ BT-${btSel?.numero} lançada com sucesso!`);
      onClose();
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
              <div className={s.stepNum}>{step>i+1?'✓':i+1}</div>
              <div className={s.stepLabel}>{label}</div>
            </div>
          ))}
        </div>
        {erro&&<div className={s.alertRed} style={{marginBottom:14}}>{erro}</div>}

        {/* STEP 1: Selecionar concretagem e BT */}
        {step===1&&(
          <div>
            <div className={s.formGroup} style={{marginBottom:16}}>
              <label className={s.formLabel}>Concretagem</label>
              <select className={s.formSelect} value={concId} onChange={e=>{setConcId(e.target.value);setBtId('');}}>
                <option value="">— selecione —</option>
                {[...concretagens].sort((a,b)=>a.numero-b.numero).map(c=>(
                  <option key={c.id} value={c.id}>Nº {c.numero} — {c.data}{c.descricao?` | ${c.descricao}`:''}</option>
                ))}
              </select>
            </div>

            {concId&&(
              <div>
                <label className={s.formLabel} style={{display:'block',marginBottom:8}}>Selecione a BT</label>
                {btsConc.length===0
                  ?<div className={s.empty}>Nenhuma BT configurada nesta concretagem.<br/>Configure BTs no botão "Concretagens".</div>
                  :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10}}>
                    {btsConc.map(b=>{
                      const jafoi=lancamentos.some(l=>l.btConfigId===b.id);
                      const selecionada=b.id===btId;
                      return(
                        <div key={b.id} onClick={()=>!jafoi&&setBtId(b.id)}
                          style={{padding:'14px 16px',border:`2px solid ${selecionada?'var(--accent)':jafoi?'var(--green)':'var(--border)'}`,
                            background:selecionada?'rgba(232,162,37,0.1)':jafoi?'rgba(62,207,122,0.05)':'transparent',
                            cursor:jafoi?'default':'pointer',transition:'all 0.15s'}}>
                          <div style={{fontFamily:'var(--mono)',fontSize:18,color:selecionada?'var(--accent)':jafoi?'var(--green)':'var(--text)',fontWeight:700}}>BT-{b.numero}</div>
                          <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:4}}>{fmt2(b.volumePrevisto)} m³</div>
                          {b.notaFiscal&&<div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>NF:{b.notaFiscal}</div>}
                          {jafoi&&<div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--green)',marginTop:4}}>✓ Lançada</div>}
                        </div>
                      );
                    })}
                  </div>
                }

                {btId&&(
                  <div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                    <div className={s.formGroup}><label className={s.formLabel}>Hora</label><input className={s.formInput} type="time" value={hora} onChange={e=>setHora(e.target.value)}/></div>
                    <div className={s.formGroup}><label className={s.formLabel}>Nota Fiscal</label><input className={s.formInput} placeholder="NF" value={nfEdit} onChange={e=>setNfEdit(e.target.value)}/></div>
                    <div className={s.formGroup}><label className={s.formLabel}>Código BT</label><input className={s.formInput} placeholder="Código" value={codEdit} onChange={e=>setCodEdit(e.target.value)}/></div>
                  </div>
                )}
              </div>
            )}

            <div className={s.btnRow}>
              <button className={s.btnSecondary} onClick={onClose}>Cancelar</button>
              <button className={s.btnPrimary} onClick={()=>{if(!concId||!btId){setErro('Selecione a concretagem e a BT');return;}setErro('');setStep(2);}}>Próximo →</button>
            </div>
          </div>
        )}

        {/* STEP 2: Peças */}
        {step===2&&(
          <div>
            <div className={s.btResumo}>
              <span style={{color:'var(--accent)',fontWeight:700}}>BT-{btSel?.numero}</span><span>|</span>
              <span>{fmt2(volPrevisto)} m³ previsto</span><span>|</span>
              <span style={{color:totalUsado>volPrevisto?'var(--red)':'var(--green)'}}>{fmt2(totalUsado)} m³ lançado</span><span>|</span>
              <span style={{color:'var(--text2)'}}>sobra est.: {fmt2(sobEstimada)} m³</span>
            </div>
            {linhas.map((l,i)=>{
              const vol=volLinha(l);
              return(
                <div key={i} className={s.pecaLinha}>
                  <div className={s.formGroup} style={{flex:2}}>
                    {i===0&&<label className={s.formLabel}>Peça {pecasConc.length>0?'(desta concretagem)':''}</label>}
                    <select className={s.formSelect} value={l.pecaId} onChange={e=>updLinha(i,'pecaId',e.target.value)}>
                      <option value="">— selecione —</option>
                      {(pecasConc.length>0?pecasConc:pecas).sort((a,b)=>a.nome.localeCompare(b.nome)).map(p=>(
                        <option key={p.id} value={p.id}>{p.nome} ({p.andar}) — {fmt2(p.volume)} m³</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup} style={{width:100}}>
                    {i===0&&<label className={s.formLabel}>% nesta BT</label>}
                    <input className={s.formInput} type="number" min="0.1" max="100" step="0.5" placeholder="%" value={l.pct} onChange={e=>updLinha(i,'pct',e.target.value)}/>
                  </div>
                  <div className={s.formGroup} style={{width:90}}>
                    {i===0&&<label className={s.formLabel}>m³</label>}
                    <input className={s.formInput} readOnly value={vol>0?fmt2(vol):''} style={{color:'var(--accent)'}}/>
                  </div>
                  <div style={{alignSelf:'flex-end',paddingBottom:2}}>
                    {linhas.length>1&&<button className={s.btnDanger} onClick={()=>remLinha(i)}>✕</button>}
                  </div>
                </div>
              );
            })}
            <button className={s.btnSecondary} style={{marginTop:12}} onClick={addLinha}>+ Adicionar peça</button>
            {totalUsado>volPrevisto&&<div className={s.alertRed} style={{marginTop:10}}>⚠ Volume ultrapassa o previsto ({fmt2(volPrevisto)} m³).</div>}
            <div className={s.btnRow}>
              <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(1);}}>← Voltar</button>
              <button className={s.btnPrimary} onClick={()=>{const v=linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0);if(!v.length){setErro('Adicione ao menos 1 peça');return;}setErro('');setStep(3);}}>Próximo →</button>
            </div>
          </div>
        )}

        {/* STEP 3: Fechamento */}
        {step===3&&(
          <div>
            <div className={s.btResumo} style={{marginBottom:16}}>
              <span style={{color:'var(--accent)',fontWeight:700}}>BT-{btSel?.numero}</span><span>|</span>
              <span>{fmt2(volPrevisto)} m³ previsto</span><span>|</span>
              <span style={{color:'var(--green)'}}>{fmt2(totalUsado)} m³ lançado</span>
            </div>
            {linhas.filter(l=>l.pecaId&&parseFloat(l.pct)>0).map((l,i)=>{
              const p=pecas.find(x=>x.id===l.pecaId);
              return <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:12}}><span>{p?p.nome:l.pecaId}</span><span style={{color:'var(--accent)'}}>{l.pct}% → {fmt2(volLinha(l))} m³</span></div>;
            })}
            <div className={s.formGrid} style={{marginTop:16}}>
              <div className={s.formGroup}><label className={s.formLabel}>Sobra que foi embora (m³)</label><input className={s.formInput} type="number" step="0.01" min="0" placeholder={`sugestão: ${fmt2(sobEstimada)}`} value={sobra} onChange={e=>setSobra(e.target.value)}/></div>
              <div className={s.formGroup}><label className={s.formLabel}>Perda em obra (m³)</label><input className={s.formInput} type="number" step="0.01" min="0" placeholder="0.00" value={perda} onChange={e=>setPerda(e.target.value)}/></div>
            </div>
            <div className={s.btnRow}>
              <button className={s.btnSecondary} onClick={()=>{setErro('');setStep(2);}}>← Voltar</button>
              <button className={s.btnPrimary} disabled={salvando} onClick={salvar}>{salvando?'⏳ Salvando...':'✓ Confirmar BT'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// GRÁFICO ANDARES
// ════════════════════════════════════════════════
function GraficoAndares({ pecas, lancamentos }) {
  const indicePerda = calcIndicePerda(lancamentos);
  const dados = calcAndares(pecas, lancamentos, indicePerda);
  if(!dados.length) return <div className={s.empty}>Sem dados</div>;
  const maxVol = Math.max(...dados.map(d=>Math.max(d.prog, d.projPerda)), 0.01);
  return (
    <div style={{overflowX:'auto'}}>
      <table className={s.table}>
        <thead><tr><th>Andar</th><th>Previsto (m³)</th><th>Executado (m³)</th><th>Faltando (m³)</th><th>Proj. c/ Perda</th><th>Progresso</th></tr></thead>
        <tbody>
          {dados.map(d=>(
            <tr key={d.andar}>
              <td style={{fontWeight:500}}>{d.andar}</td>
              <td className={s.tdMono}>{fmt2(d.prog)}</td>
              <td className={s.tdGreen}>{fmt2(d.conc)}</td>
              <td className={s.tdRed}>{fmt2(d.falt)}</td>
              <td className={s.tdMono} style={{color:'var(--orange,#f59e0b)'}}>{fmt2(d.projPerda)}</td>
              <td style={{minWidth:160}}>
                <div style={{position:'relative',height:18,background:'var(--surface2)',width:'100%'}}>
                  <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${(d.conc/maxVol)*100}%`,background:'var(--green)',opacity:0.8}}/>
                  <div style={{position:'absolute',left:`${(d.conc/maxVol)*100}%`,top:0,height:'100%',width:`${(d.falt/maxVol)*100}%`,background:'var(--border2)'}}/>
                  <div style={{position:'absolute',right:4,top:1,fontFamily:'var(--mono)',fontSize:10,color:'var(--text)',lineHeight:'16px'}}>{fmt1(d.pct)}%</div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {indicePerda>0&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:10}}>* Projeção usa índice de perda atual da obra: {fmt1(indicePerda)}%</div>}
    </div>
  );
}

// ════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════
export default function Home() {


  const[tab,setTab]=useState('operacional');
  const[filtroAndar,setFiltroAndar]=useState('todos');
  const[filtroConc,setFiltroConc]=useState('todas');
  const[viewTipo,setViewTipo]=useState(false);
  const[filtroTipoOp,setFiltroTipoOp]=useState('todos');
  const[filtroRelConc,setFiltroRelConc]=useState('todas');
  const[filtroRelAndar,setFiltroRelAndar]=useState('todos');
  const[toast,setToast]=useState({msg:'',tipo:'ok'});
  const[modalPecas,setModalPecas]=useState(false);
  const[modalConc,setModalConc]=useState(false);
  const[modalBT,setModalBT]=useState(false);
  const[clock,setClock]=useState('');

  const modalAberto = modalPecas||modalConc||modalBT;
  const{data,loading,error,refresh}=useData(modalAberto);
  const{pecas,concretagens,pecaConc,btsConfig,lancamentos}=data;

  useEffect(()=>{ const t=()=>setClock(new Date().toLocaleTimeString('pt-BR')); t(); const id=setInterval(t,1000); return()=>clearInterval(id); },[]);
  const showToast=(msg,tipo='ok')=>{setToast({msg,tipo});setTimeout(()=>refresh(),2000);};

  const andares=[...new Set(pecas.map(p=>p.andar))].sort();
  const tipos=[...new Set(pecas.map(p=>p.tipo))].sort();
  const kpis=calcKPIs(pecas,lancamentos,btsConfig,filtroAndar);
  const indicePerda=calcIndicePerda(lancamentos);

  // Peças filtradas para progresso
  const pecasFiltOp = pecas.filter(p=>
    (filtroAndar==='todos'||p.andar===filtroAndar)&&
    (filtroTipoOp==='todos'||p.tipo===filtroTipoOp)&&
    (filtroConc==='todas'||pecaConc.filter(pc=>pc.concretagemId===filtroConc).map(pc=>pc.pecaId).includes(p.id))
  );

  // Última BT lançada
  const ultimoLan = lancamentos[lancamentos.length-1];
  const ultimaBTConf = ultimoLan ? btsConfig.find(b=>b.id===ultimoLan.btConfigId) : null;
  const ultimaConc   = ultimaBTConf ? concretagens.find(c=>c.id===ultimaBTConf.concretagemId) : null;
  const volUltimaBT  = ultimoLan ? lancamentos.filter(l=>l.btConfigId===ultimoLan.btConfigId).reduce((s,l)=>s+l.volume,0) : 0;

  if(loading) return <div className={s.loadingWrap}><div className={s.loadingText}>CARREGANDO DADOS...</div></div>;
  if(error) return <div className={s.errorPanel}><div>⚠ Falha ao carregar dados</div><div style={{color:'var(--text2)',marginTop:8}}>{error}</div><button className={s.refreshBtn} onClick={refresh}>↻ Tentar novamente</button></div>;

  return (
    <>
      <header className={s.header}>
        <div><span className={s.logoMark}>⬛ Concreto</span><span className={s.logoSub}>Controle de Concretagem</span></div>
        <div className={s.liveBadge}><div className={s.liveDot}/><span>{clock}</span><button className={s.btnSecondary} style={{marginLeft:12,padding:'6px 14px',fontSize:11}} onClick={refresh}>↻</button></div>
      </header>

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

          {/* Filtros no topo — acima de tudo */}
          <div className={s.filtrosBar}>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Andar</div>
              <div className={s.chips} style={{marginBottom:0}}>
                {['todos',...andares].map(a=>(
                  <button key={a} className={`${s.chip} ${filtroAndar===a?s.chipActive:''}`} onClick={()=>setFiltroAndar(a)}>{a==='todos'?'Todos':a}</button>
                ))}
              </div>
            </div>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Concretagem</div>
              <div className={s.chips} style={{marginBottom:0}}>
                {['todas',...[...concretagens].sort((a,b)=>a.numero-b.numero)].map(c=>(
                  <button key={typeof c==='string'?c:c.id} className={`${s.chip} ${filtroConc===(typeof c==='string'?c:c.id)?s.chipActive:''}`}
                    onClick={()=>setFiltroConc(typeof c==='string'?c:c.id)}>
                    {typeof c==='string'?'Todas':`Nº${c.numero}`}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Tipo de Peça</div>
              <div className={s.chips} style={{marginBottom:0}}>
                {['todos',...tipos].map(t=>(
                  <button key={t} className={`${s.chip} ${filtroTipoOp===t?s.chipActive:''}`} onClick={()=>setFiltroTipoOp(t)}>
                    {t==='todos'?'Todos':t}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.filtroGrupo}>
              <div className={s.filtroLabel}>Agrupar progresso por</div>
              <div className={s.chips} style={{marginBottom:0}}>
                <button className={`${s.chip} ${!viewTipo?s.chipActive:''}`} onClick={()=>setViewTipo(false)}>Peça</button>
                <button className={`${s.chip} ${viewTipo?s.chipActive:''}`} onClick={()=>setViewTipo(true)}>Tipo</button>
              </div>
            </div>
          </div>

          {/* Barra de ações */}
          <div className={s.launchBar}>
            <div><div className={s.launchBarTitle}>Lançamento de Concretagem</div><div className={s.launchBarSub}>Gerencie peças, configure concretagens e lance BTs</div></div>
            <div className={s.launchActions}>
              <button className={s.btnAction} onClick={()=>setModalPecas(true)}>⬡ Peças</button>
              <button className={s.btnAction} onClick={()=>setModalConc(true)}>◈ Concretagens</button>
              <button className={s.btnLaunch} onClick={()=>setModalBT(true)}>⊕ Lançar BT</button>
            </div>
          </div>

          {/* KPIs */}
          <div className={s.grid4}>
            <KPI label="Volume Total Projeto" value={fmt2(kpis.totalVol)} unit="m³" sub={`${pecas.length} peças`}/>
            <KPI label="Volume Concretado"    value={fmt2(kpis.concVol)}  unit="m³" sub={`${fmt1(kpis.pctConc)}% concluído`} variant="green"/>
            <KPI label="Volume Faltando"      value={fmt2(kpis.faltVol)}  unit="m³" sub={`${fmt1(100-kpis.pctConc)}% restante`} variant="red"/>
            <KPI label="Índice de Perda"      value={fmt1(kpis.indicePerda)} unit="%" sub={`${fmt2(kpis.totalPerda)} m³ perdido`} variant="orange"/>
          </div>

          <div className={s.grid2}>
            {/* Progresso */}
            <div className={s.panel}>
              <div className={s.panelTitle}>
                Progresso — {filtroAndar==='todos'?'Todos os Andares':filtroAndar}
                {filtroConc!=='todas'&&` · Conc. Nº${concretagens.find(c=>c.id===filtroConc)?.numero}`}
              </div>

              {/* Vista por TIPO */}
              {viewTipo&&(
                calcPorTipo(pecasFiltOp,lancamentos).map(t=>(
                  <div key={t.tipo} className={s.progressWrap}>
                    <div className={s.progressHeader}>
                      <span className={s.progressName}>{t.tipo} <span className={s.progressNameSub}>[{t.count} peças]</span></span>
                      <span className={s.progressPct}>{fmt1(t.pct)}%</span>
                    </div>
                    <ProgressBar pct={t.pct} color={t.pct>=100?'var(--green)':undefined}/>
                    <div className={s.progressMeta}>concretado {fmt2(t.conc)} m³ &nbsp;|&nbsp; faltando <span className={s.progressMetaRed}>{fmt2(t.falt)} m³</span> &nbsp;|&nbsp; previsto {fmt2(t.prog)} m³</div>
                  </div>
                ))
              )}

              {/* Vista por PEÇA */}
              {!viewTipo&&(
                pecasFiltOp.length===0
                  ?<div className={s.empty}>Nenhuma peça encontrada.</div>
                  :pecasFiltOp.map(p=>{
                    const vc=Math.min(p.volume,volLancadoPeca(p.id,lancamentos));
                    const pct=pctConcretado(p,lancamentos);
                    const falt=Math.max(0,p.volume-vc);
                    return(
                      <div key={p.id} className={s.progressWrap}>
                        <div className={s.progressHeader}>
                          <span className={s.progressName}>{p.nome} <span className={s.progressNameSub}>[{p.tipo}]</span></span>
                          <span className={s.progressPct}>{fmt1(pct)}%</span>
                        </div>
                        <ProgressBar pct={pct} color={pct>=100?'var(--green)':pct>0?'var(--accent)':'var(--blue)'}/>
                        <div className={s.progressMeta}>concretado {fmt2(vc)} m³ &nbsp;|&nbsp; faltando <span className={s.progressMetaRed}>{fmt2(falt)} m³</span> &nbsp;|&nbsp; projeto {fmt2(p.volume)} m³</div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Coluna direita */}
            <div>
              {/* Live ultima BT */}
              {ultimaBTConf&&(
                <div className={s.livePanel}>
                  <div className={s.livePanelBadge}>Última BT</div>
                  <div className={s.panelTitle} style={{color:'var(--accent)'}}>BT-{ultimaBTConf.numero}</div>
                  <div className={s.livePanelGrid}>
                    <div><div className={s.kpiLabel}>Concretagem</div><div className={s.liveVal}>{ultimaConc?`Nº ${ultimaConc.numero}`:'—'}</div></div>
                    <div><div className={s.kpiLabel}>Previsto</div><div className={`${s.liveVal} ${s.liveValNeutral}`}>{fmt2(ultimaBTConf.volumePrevisto)} m³</div></div>
                    <div><div className={s.kpiLabel}>Usado nas peças</div><div style={{fontFamily:'var(--mono)',fontSize:18,color:'var(--green)'}}>{fmt2(volUltimaBT)} m³</div></div>
                    <div><div className={s.kpiLabel}>Perda em obra</div><div style={{fontFamily:'var(--mono)',fontSize:18,color:'var(--red)'}}>{fmt2(ultimoLan?.perdaObra||0)} m³</div></div>
                  </div>
                  {ultimaBTConf.notaFiscal&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:8}}>NF: {ultimaBTConf.notaFiscal}{ultimaBTConf.codigoBT?` · Cód: ${ultimaBTConf.codigoBT}`:''}</div>}
                </div>
              )}

              {/* Últimas BTs lançadas */}
              <div className={s.panel}>
                <div className={s.panelTitle}>Últimas BTs Lançadas</div>
                {lancamentos.length===0?<div className={s.empty}>Nenhuma BT lançada ainda</div>:(
                  <div className={s.tableWrap}><table className={s.table}>
                    <thead><tr><th>BT</th><th>Conc.</th><th>Previsto</th><th>Usado</th><th>Perda</th><th>Hora</th></tr></thead>
                    <tbody>{
                      // agrupa lancamentos por btConfigId
                      [...new Map(lancamentos.map(l=>[l.btConfigId,l])).values()].reverse().slice(0,8).map(l=>{
                        const bt=btsConfig.find(b=>b.id===l.btConfigId);
                        const conc=concretagens.find(c=>c.id===l.concretagemId);
                        const volUsado=lancamentos.filter(x=>x.btConfigId===l.btConfigId).reduce((s,x)=>s+x.volume,0);
                        return <tr key={l.btConfigId}>
                          <td className={s.tdAccent}>BT-{bt?.numero||'?'}</td>
                          <td className={s.tdMono}>{conc?.numero||'—'}</td>
                          <td className={s.tdMono}>{fmt2(bt?.volumePrevisto||0)}</td>
                          <td className={s.tdGreen}>{fmt2(volUsado)}</td>
                          <td className={l.perdaObra>0?s.tdRed:s.tdMuted}>{fmt2(l.perdaObra)}</td>
                          <td className={s.tdMuted}>{l.hora}</td>
                        </tr>;
                      })
                    }</tbody>
                  </table></div>
                )}
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

          {/* KPIs relatório */}
          {(()=>{
            let lans=lancamentos, pcs=pecas, bts=btsConfig;
            if(filtroRelConc!=='todas'){lans=lans.filter(l=>l.concretagemId===filtroRelConc);bts=bts.filter(b=>b.concretagemId===filtroRelConc);}
            if(filtroRelAndar!=='todos') pcs=pcs.filter(p=>p.andar===filtroRelAndar);
            const pids=new Set(pcs.map(p=>p.id)); lans=lans.filter(l=>pids.has(l.pecaId));
            const relProg=pcs.reduce((s,p)=>s+p.volume,0);
            const relConc=pcs.reduce((s,p)=>s+Math.min(p.volume,volLancadoPeca(p.id,lans)),0);
            const relPerda=lans.reduce((s,l)=>s+l.perdaObra,0);
            const relSobra=lans.reduce((s,l)=>s+l.sobraCaminhao,0);
            const relVolBTs=bts.reduce((s,b)=>s+b.volumePrevisto,0);
            return <>
              <div className={s.grid4}>
                <KPI label="Vol. Programado"    value={fmt2(relProg)}   unit="m³"/>
                <KPI label="Vol. Concretado"    value={fmt2(relConc)}   unit="m³" variant="green"/>
                <KPI label="Perda em Obra"      value={fmt2(relPerda)}  unit="m³" sub={`${fmt1(relConc>0?relPerda/relConc*100:0)}%`} variant="red"/>
                <KPI label="Sobra (foi embora)" value={fmt2(relSobra)}  unit="m³" sub={`${fmt1(relConc>0?relSobra/relConc*100:0)}%`} variant="orange"/>
              </div>

              {/* Gráfico andares */}
              <div className={s.panel} style={{marginBottom:24}}>
                <div className={s.panelTitle}>Volume por Andar — Previsto vs Executado vs Projeção</div>
                <GraficoAndares pecas={pcs} lancamentos={lans}/>
              </div>

              {/* Resumo por tipo */}
              <div className={s.panel} style={{marginBottom:24}}>
                <div className={s.panelTitle}>Resumo por Tipo de Peça</div>
                <div className={s.tableWrap}><table className={s.table}>
                  <thead><tr><th>Tipo</th><th>Qtd</th><th>Previsto (m³)</th><th>Executado (m³)</th><th>Faltando (m³)</th><th>%</th></tr></thead>
                  <tbody>{calcPorTipo(pcs,lans).map(t=>(
                    <tr key={t.tipo}><td style={{fontWeight:500}}>{t.tipo}</td><td className={s.tdMono}>{t.count}</td><td className={s.tdMono}>{fmt2(t.prog)}</td><td className={s.tdGreen}>{fmt2(t.conc)}</td><td className={s.tdRed}>{fmt2(t.falt)}</td>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className={s.progressBar} style={{width:60}}><div className={s.progressFill} style={{width:`${Math.min(100,t.pct)}%`,background:t.pct>=100?'var(--green)':'var(--accent)'}}/></div><span className={s.tdMono}>{fmt1(t.pct)}%</span></div></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </div>

              {/* Tabela BTs */}
              <div className={s.panel}>
                <div className={s.panelTitle}>Índice por BT</div>
                <div className={s.tableWrap}><table className={s.table}>
                  <thead><tr><th>BT</th><th>Conc.</th><th>NF</th><th>Código</th><th>Previsto</th><th>Usado</th><th>Perda</th><th>Sobra</th><th>Status</th></tr></thead>
                  <tbody>{bts.length===0?<tr><td colSpan={9} className={s.empty} style={{padding:'24px 16px'}}>Sem BTs</td></tr>
                    :bts.sort((a,b)=>a.numero-b.numero).map(b=>{
                      const conc=concretagens.find(c=>c.id===b.concretagemId);
                      const bLans=lans.filter(l=>l.btConfigId===b.id);
                      const usado=bLans.reduce((s,l)=>s+l.volume,0);
                      const perda=bLans.reduce((s,l)=>s+l.perdaObra,0);
                      const sobra=bLans.reduce((s,l)=>s+l.sobraCaminhao,0);
                      const lancada=bLans.length>0;
                      return <tr key={b.id}>
                        <td className={s.tdAccent}>BT-{b.numero}</td>
                        <td className={s.tdMono}>{conc?.numero||'—'}</td>
                        <td className={s.tdMono} style={{color:'var(--text2)'}}>{b.notaFiscal||'—'}</td>
                        <td className={s.tdMono} style={{color:'var(--text2)'}}>{b.codigoBT||'—'}</td>
                        <td className={s.tdMono}>{fmt2(b.volumePrevisto)}</td>
                        <td className={s.tdGreen}>{lancada?fmt2(usado):'—'}</td>
                        <td className={perda>0?s.tdRed:s.tdMuted}>{lancada?fmt2(perda):'—'}</td>
                        <td className={s.tdMuted}>{lancada?fmt2(sobra):'—'}</td>
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

      {/* MODAIS */}
      <ModalPecas        open={modalPecas} onClose={()=>setModalPecas(false)} pecas={pecas} onSalvo={msg=>showToast(msg,'ok')}/>
      <ModalConcretagem  open={modalConc}  onClose={()=>setModalConc(false)}  pecas={pecas} concretagens={concretagens} pecaConc={pecaConc} btsConfig={btsConfig} onSalvo={msg=>showToast(msg,'ok')}/>
      <ModalLancarBT     open={modalBT}    onClose={()=>setModalBT(false)}    pecas={pecas} concretagens={concretagens} pecaConc={pecaConc} btsConfig={btsConfig} lancamentos={lancamentos} onSalvo={msg=>showToast(msg,'ok')}/>
      <Toast msg={toast.msg} tipo={toast.tipo} onDone={()=>setToast({msg:'',tipo:'ok'})}/>
    </>
  );
}
