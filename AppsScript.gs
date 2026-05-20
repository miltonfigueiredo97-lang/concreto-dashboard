/**
 * CONCRETO DASHBOARD — Google Apps Script v2
 * Extensões → Apps Script → cole este código → Implantar → App da Web
 * Executar como: Eu | Acesso: Qualquer pessoa
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function buildResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) { 
  return buildResponse({ ok:true, msg:'Concreto Dashboard API v2' }); 
}

function doPost(e) {
  try {
    const raw  = e.postData.contents;
    const body = JSON.parse(raw);
    const acao = (body.acao || '').trim();

    if (acao === 'adicionarPeca')        return buildResponse(adicionarPeca(body));
    if (acao === 'adicionarPecaLote')    return buildResponse(adicionarPecaLote(body));
    if (acao === 'editarPeca')           return buildResponse(editarPeca(body));
    if (acao === 'excluirPeca')          return buildResponse(excluirPeca(body));
    if (acao === 'salvarConcretagem')    return buildResponse(salvarConcretagem(body));
    if (acao === 'editarBTConfig')       return buildResponse(editarBTConfig(body));
    if (acao === 'lancarBT')             return buildResponse(lancarBT(body));

    return buildResponse({ ok:false, erro:'Acao nao reconhecida: [' + acao + ']' });
  } catch(err) { 
    return buildResponse({ ok:false, erro:err.message }); 
  }
}

// ── HELPERS ────────────────────────────────────
function getAba(nome) {
  const aba = SS.getSheetByName(nome);
  if (!aba) throw new Error('Aba "' + nome + '" nao encontrada na planilha');
  return aba;
}

function findRowById(aba, id) {
  const data = aba.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// ── PEÇAS ──────────────────────────────────────
function adicionarPeca(b) {
  getAba('Pecas').appendRow([b.id, b.nome, b.tipo, b.andar, b.volume]);
  return { ok:true, msg:'Peca adicionada: ' + b.nome };
}

function adicionarPecaLote(b) {
  const aba = getAba('Pecas');
  b.pecas.forEach(function(p) { aba.appendRow([p.id, p.nome, p.tipo, p.andar, p.volume]); });
  return { ok:true, msg:b.pecas.length + ' pecas adicionadas' };
}

function editarPeca(b) {
  const aba = getAba('Pecas');
  const row = findRowById(aba, b.id);
  if (row < 0) throw new Error('Peca nao encontrada: ' + b.id);
  aba.getRange(row, 1, 1, 5).setValues([[b.id, b.nome, b.tipo, b.andar, b.volume]]);
  return { ok:true, msg:'Peca editada: ' + b.nome };
}

function excluirPeca(b) {
  const aba = getAba('Pecas');
  const row = findRowById(aba, b.id);
  if (row < 0) throw new Error('Peca nao encontrada: ' + b.id);
  aba.deleteRow(row);
  const abaPC = SS.getSheetByName('PecaConc');
  if (abaPC) {
    const data = abaPC.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][1]) === String(b.id)) abaPC.deleteRow(i + 1);
    }
  }
  return { ok:true, msg:'Peca excluida' };
}

// ── CONCRETAGEM COMPLETA ────────────────────────
function salvarConcretagem(b) {
  const abaConc = getAba('Concretagens');
  const abaPC   = getAba('PecaConc');
  const abaBT   = getAba('BTsConfig');

  const rowConc = findRowById(abaConc, b.id);
  const rowData = [b.id, b.numero, b.data, b.descricao];

  if (rowConc < 0) {
    abaConc.appendRow(rowData);
  } else {
    abaConc.getRange(rowConc, 1, 1, 4).setValues([rowData]);
    // Remove vinculos antigos
    const dataPC = abaPC.getDataRange().getValues();
    for (var i = dataPC.length - 1; i >= 1; i--) {
      if (String(dataPC[i][2]) === String(b.id)) abaPC.deleteRow(i + 1);
    }
    // Remove BTs antigas
    const dataBT = abaBT.getDataRange().getValues();
    for (var j = dataBT.length - 1; j >= 1; j--) {
      if (String(dataBT[j][1]) === String(b.id)) abaBT.deleteRow(j + 1);
    }
  }

  // Salva vinculos peca-concretagem
  b.pecaConcs.forEach(function(pc) {
    abaPC.appendRow([pc.id, pc.pecaId, b.id, pc.pctConcretagem]);
  });

  // Salva BTs configuradas
  b.btsConfig.forEach(function(bt) {
    abaBT.appendRow([bt.id, b.id, bt.numero, bt.volumePrevisto, bt.notaFiscal || '', bt.codigoBT || '']);
  });

  return { ok:true, msg:'Concretagem N' + b.numero + ' salva com ' + b.pecaConcs.length + ' pecas e ' + b.btsConfig.length + ' BTs' };
}

function editarBTConfig(b) {
  const aba = getAba('BTsConfig');
  const row = findRowById(aba, b.id);
  if (row < 0) throw new Error('BT nao encontrada: ' + b.id);
  aba.getRange(row, 1, 1, 6).setValues([[b.id, b.concretagemId, b.numero, b.volumePrevisto, b.notaFiscal || '', b.codigoBT || '']]);
  return { ok:true, msg:'BT-' + b.numero + ' atualizada' };
}

// ── LANÇAR BT ──────────────────────────────────
function lancarBT(b) {
  const abaBTConf = getAba('BTsConfig');
  const rowBT = findRowById(abaBTConf, b.btConfigId);
  if (rowBT > 0) {
    const rowData = abaBTConf.getRange(rowBT, 1, 1, 6).getValues()[0];
    if (b.notaFiscal) rowData[4] = b.notaFiscal;
    if (b.codigoBT)   rowData[5] = b.codigoBT;
    abaBTConf.getRange(rowBT, 1, 1, 6).setValues([rowData]);
  }
  const abaLan = getAba('Lancamentos');
  b.lancamentos.forEach(function(l) {
    abaLan.appendRow([l.id, b.btConfigId, b.concretagemId, l.pecaId, l.pct, l.volume, b.hora, b.sobraCaminhao, b.perdaObra]);
  });
  return { ok:true, msg:'BT lancada com ' + b.lancamentos.length + ' peca(s)' };
}
