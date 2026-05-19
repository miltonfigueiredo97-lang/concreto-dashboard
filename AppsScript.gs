/**
 * CONCRETO DASHBOARD — Google Apps Script
 *
 * COMO INSTALAR:
 * 1. Na sua planilha Google Sheets: Extensões → Apps Script
 * 2. Apague tudo que estiver lá e cole este código inteiro
 * 3. Salve (Ctrl+S)
 * 4. Clique em "Implantar" → "Nova implantação"
 * 5. Tipo: "App da Web"
 * 6. Executar como: "Eu (sua conta)"
 * 7. Quem tem acesso: "Qualquer pessoa"
 * 8. Clique em "Implantar" e copie a URL gerada
 * 9. Cole essa URL na variável NEXT_PUBLIC_APPS_SCRIPT_URL no Vercel
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── CORS: responde OPTIONS ──────────────────
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader ? buildResponse('') : buildResponse('');
}

function buildResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── GET: leitura (não usado — usamos Sheets API) ──
function doGet(e) {
  return buildResponse({ ok: true, msg: 'Concreto Dashboard API ativa' });
}

// ── POST: escrita ───────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const acao = body.acao;

    if (acao === 'lancarBT')       return buildResponse(lancarBT(body));
    if (acao === 'adicionarPeca')  return buildResponse(adicionarPeca(body));
    if (acao === 'adicionarConcretagem') return buildResponse(adicionarConcretagem(body));

    return buildResponse({ ok: false, erro: 'Ação desconhecida: ' + acao });
  } catch (err) {
    return buildResponse({ ok: false, erro: err.message });
  }
}

// ── LANÇAR BT (+ lançamentos das peças) ────
function lancarBT(body) {
  const { btId, concretagemId, numero, volumeCaminhao, sobraCaminhao, perdaObra, hora, obs, lancamentos } = body;

  // Aba BTs
  const abaBTs = SS.getSheetByName('BTs');
  if (!abaBTs) throw new Error('Aba "BTs" não encontrada');
  abaBTs.appendRow([btId, concretagemId, numero, volumeCaminhao, sobraCaminhao, perdaObra, hora, obs || '']);

  // Aba Lancamentos
  const abaLan = SS.getSheetByName('Lancamentos');
  if (!abaLan) throw new Error('Aba "Lancamentos" não encontrada');
  lancamentos.forEach(l => {
    abaLan.appendRow([l.id, btId, concretagemId, l.pecaId, l.pct, l.volume, hora]);
  });

  return { ok: true, msg: `BT-${numero} lançada com ${lancamentos.length} peça(s)` };
}

// ── ADICIONAR PEÇA ──────────────────────────
function adicionarPeca(body) {
  const { id, nome, tipo, andar, volume } = body;
  const aba = SS.getSheetByName('Pecas');
  if (!aba) throw new Error('Aba "Pecas" não encontrada');
  aba.appendRow([id, nome, tipo, andar, volume]);
  return { ok: true, msg: `Peça "${nome}" adicionada` };
}

// ── ADICIONAR CONCRETAGEM ───────────────────
function adicionarConcretagem(body) {
  const { id, numero, data, descricao } = body;
  const aba = SS.getSheetByName('Concretagens');
  if (!aba) throw new Error('Aba "Concretagens" não encontrada');
  aba.appendRow([id, numero, data, descricao || '']);
  return { ok: true, msg: `Concretagem Nº ${numero} criada` };
}
