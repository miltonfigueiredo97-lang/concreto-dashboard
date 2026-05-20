/**
 * CONCRETO DASHBOARD — Google Apps Script v2
 * Extensões → Apps Script → cole este código → Implantar → App da Web
 * Executar como: Eu | Acesso: Qualquer pessoa
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function buildResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) { return buildResponse({ ok:true, msg:'Concreto Dashboard API v2' }); }

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const acao = body.acao;
    const handlers = {
      adicionarPeca:       ()=>adicionarPeca(body),
      adicionarPecaLote:   ()=>adicionarPecaLote(body),
      editarPeca:          ()=>editarPeca(body),
      excluirPeca:         ()=>excluirPeca(body),
      salvarConcretagem:   ()=>salvarConcretagem(body),
      editarBTConfig:      ()=>editarBTConfig(body),
      lancarBT:            ()=>lancarBT(body),
    };
    if (handlers[acao]) return buildResponse(handlers[acao]());
    return buildResponse({ ok:false, erro:'Ação desconhecida: '+acao });
  } catch(err) { return buildResponse({ ok:false, erro:err.message }); }
}

// ── HELPERS ────────────────────────────────────
function getAba(nome) {
  const aba = SS.getSheetByName(nome);
  if (!aba) throw new Error(`Aba "${nome}" não encontrada na planilha`);
  return aba;
}

function findRowById(aba, id) {
  const data = aba.getDataRange().getValues();
  for (let i=1; i<data.length; i++) { if (String(data[i][0])===String(id)) return i+1; }
  return -1;
}

// ── PEÇAS ──────────────────────────────────────
function adicionarPeca(b) {
  getAba('Pecas').appendRow([b.id, b.nome, b.tipo, b.andar, b.volume]);
  return { ok:true, msg:`Peça "${b.nome}" adicionada` };
}

function adicionarPecaLote(b) {
  const aba = getAba('Pecas');
  b.pecas.forEach(p => aba.appendRow([p.id, p.nome, p.tipo, p.andar, p.volume]));
  return { ok:true, msg:`${b.pecas.length} peças adicionadas` };
}

function editarPeca(b) {
  const aba = getAba('Pecas');
  const row = findRowById(aba, b.id);
  if (row < 0) throw new Error('Peça não encontrada: '+b.id);
  aba.getRange(row, 1, 1, 5).setValues([[b.id, b.nome, b.tipo, b.andar, b.volume]]);
  return { ok:true, msg:`Peça "${b.nome}" editada` };
}

function excluirPeca(b) {
  const aba = getAba('Pecas');
  const row = findRowById(aba, b.id);
  if (row < 0) throw new Error('Peça não encontrada: '+b.id);
  aba.deleteRow(row);
  // Remover vínculos PecaConc
  const abaPC = SS.getSheetByName('PecaConc');
  if (abaPC) {
    const data = abaPC.getDataRange().getValues();
    for (let i=data.length-1; i>=1; i--) {
      if (String(data[i][1])===String(b.id)) abaPC.deleteRow(i+1);
    }
  }
  return { ok:true, msg:'Peça excluída' };
}

// ── CONCRETAGEM COMPLETA ────────────────────────
function salvarConcretagem(b) {
  const abaConc = getAba('Concretagens');
  const abaPC   = getAba('PecaConc');
  const abaBT   = getAba('BTsConfig');

  // Verifica se é edição ou criação
  const rowConc = findRowById(abaConc, b.id);
  const rowData = [b.id, b.numero, b.data, b.descricao];
  if (rowConc < 0) {
    abaConc.appendRow(rowData);
  } else {
    abaConc.getRange(rowConc, 1, 1, 4).setValues([rowData]);
    // Remove vínculos antigos
    const dataPC = abaPC.getDataRange().getValues();
    for (let i=dataPC.length-1; i>=1; i--) {
      if (String(dataPC[i][2])===String(b.id)) abaPC.deleteRow(i+1);
    }
    // Remove BTs antigas
    const dataBT = abaBT.getDataRange().getValues();
    for (let i=dataBT.length-1; i>=1; i--) {
      if (String(dataBT[i][1])===String(b.id)) abaBT.deleteRow(i+1);
    }
  }

  // Salva vínculos peça-concretagem
  b.pecaConcs.forEach(pc => {
    abaPC.appendRow([pc.id, pc.pecaId, b.id, pc.pctConcretagem]);
  });

  // Salva BTs configuradas
  b.btsConfig.forEach(bt => {
    abaBT.appendRow([bt.id, b.id, bt.numero, bt.volumePrevisto, bt.notaFiscal||'', bt.codigoBT||'']);
  });

  return { ok:true, msg:`Concretagem Nº${b.numero} salva com ${b.pecaConcs.length} peças e ${b.btsConfig.length} BTs` };
}

function editarBTConfig(b) {
  const aba = getAba('BTsConfig');
  const row = findRowById(aba, b.id);
  if (row < 0) throw new Error('BT não encontrada: '+b.id);
  aba.getRange(row, 1, 1, 6).setValues([[b.id, b.concretagemId, b.numero, b.volumePrevisto, b.notaFiscal||'', b.codigoBT||'']]);
  return { ok:true, msg:`BT-${b.numero} atualizada` };
}

// ── LANÇAR BT ──────────────────────────────────
function lancarBT(b) {
  // Atualiza nota fiscal e código na BTsConfig
  const abaBTConf = getAba('BTsConfig');
  const rowBT = findRowById(abaBTConf, b.btConfigId);
  if (rowBT > 0) {
    const rowData = abaBTConf.getRange(rowBT, 1, 1, 6).getValues()[0];
    rowData[4] = b.notaFiscal||rowData[4];
    rowData[5] = b.codigoBT||rowData[5];
    abaBTConf.getRange(rowBT, 1, 1, 6).setValues([rowData]);
  }
  // Salva lançamentos
  const abaLan = getAba('Lancamentos');
  b.lancamentos.forEach(l => {
    abaLan.appendRow([l.id, b.btConfigId, b.concretagemId, l.pecaId, l.pct, l.volume, b.hora, b.sobraCaminhao, b.perdaObra]);
  });
  return { ok:true, msg:`BT lançada com ${b.lancamentos.length} peça(s)` };
}
