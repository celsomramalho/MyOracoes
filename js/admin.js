const SENHA_CORRETA = 'storosario';
const CHAVE_SESSION = 'myoracoes_admin_autenticado';

let editandoId = null;
let alteracoesNaoExportadas = false;
let filtroListaAdmin = '';

function atualizarAvisoAlteracoes(){
  const aviso = document.getElementById('aviso-alteracoes-pendentes');
  const btnExportar = document.getElementById('btn-exportar-json');
  if(aviso) aviso.classList.toggle('hidden', !alteracoesNaoExportadas);
  if(btnExportar) btnExportar.classList.toggle('nao-salvo', alteracoesNaoExportadas);
}

const btnLogout = document.getElementById('btn-admin-logout');
const btnVoltarListaAdmin = document.getElementById('btn-voltar-lista-admin');
const btnRezarAdmin = document.getElementById('btn-rezar-admin');
const btnSalvarOficialTopo = document.getElementById('btn-salvar-oficial');
const btnVoltarFormAdmin = document.getElementById('btn-voltar-form-admin');

// Verificação de autenticação na sessão
if (sessionStorage.getItem(CHAVE_SESSION) === 'true') {
  liberarAdmin();
}

// Ações de Login e Logout
document.getElementById('btn-entrar').addEventListener('click', tentarLogin);
document.getElementById('input-senha').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') tentarLogin();
});

// Botão "ver senha": alterna entre ocultar/mostrar, só quando clicado de novo
const btnVerSenha = document.getElementById('btn-ver-senha');
const inputSenha = document.getElementById('input-senha');
const ICONE_OLHO = btnVerSenha.innerHTML;
const ICONE_OLHO_FECHADO = `
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>`;

btnVerSenha.addEventListener('click', () => {
  const senhaVisivel = inputSenha.type === 'text';
  inputSenha.type = senhaVisivel ? 'password' : 'text';
  btnVerSenha.innerHTML = senhaVisivel ? ICONE_OLHO : ICONE_OLHO_FECHADO;
  btnVerSenha.title = senhaVisivel ? 'Mostrar senha' : 'Ocultar senha';
  btnVerSenha.setAttribute('aria-label', senhaVisivel ? 'Mostrar senha' : 'Ocultar senha');
});

btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem(CHAVE_SESSION);
  window.location.href = 'index.html';
});

function tentarLogin() {
  const senha = document.getElementById('input-senha').value;
  if (senha === SENHA_CORRETA) {
    sessionStorage.setItem(CHAVE_SESSION, 'true');
    liberarAdmin();
  } else {
    alert('Senha incorreta!');
    document.getElementById('input-senha').value = '';
    document.getElementById('input-senha').focus();
  }
}

function liberarAdmin() {
  mostrarView('view-admin-list');
  carregarDadosIniciais();
}

// Título da topbar: na tela de formulário, varia entre "Nova oração" e
// "Editar oração" conforme editandoId; nas demais telas, é fixo.
function atualizarTopbarTituloAdmin(id) {
  const topbarTitulo = document.getElementById('admin-topbar-titulo');
  if (!topbarTitulo) return;
  topbarTitulo.textContent = (id === 'view-admin-form')
    ? (editandoId ? 'Editar oração' : 'Nova oração')
    : (id === 'view-rezar-admin') ? 'Rezar (Preview)' : 'Orações Oficiais';
}

function mostrarView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
  document.getElementById(id).classList.add('view-active');

  // Controla visibilidade das ações de rezar na topbar do admin
  const topbarAcoesRezarAdmin = document.getElementById('topbar-acoes-rezar-admin');
  if (topbarAcoesRezarAdmin) {
    topbarAcoesRezarAdmin.classList.toggle('hidden', id !== 'view-rezar-admin');
  }

  // Na tela de edição, o botão de sair vira o botão de voltar pra lista;
  // nas demais telas (exceto login), volta a ser o botão de sair
  if (id === 'view-login') {
    btnLogout.classList.add('hidden');
    btnVoltarListaAdmin.classList.add('hidden');
    btnRezarAdmin.classList.add('hidden');
    btnSalvarOficialTopo.classList.add('hidden');
    btnVoltarFormAdmin.classList.add('hidden');
  } else if (id === 'view-admin-form') {
    btnLogout.classList.add('hidden');
    btnVoltarListaAdmin.classList.remove('hidden');
    btnRezarAdmin.classList.remove('hidden');
    btnSalvarOficialTopo.classList.remove('hidden');
    btnVoltarFormAdmin.classList.add('hidden');
  } else if (id === 'view-rezar-admin') {
    btnLogout.classList.add('hidden');
    btnVoltarListaAdmin.classList.add('hidden');
    btnRezarAdmin.classList.add('hidden');
    btnSalvarOficialTopo.classList.add('hidden');
    btnVoltarFormAdmin.classList.remove('hidden');
  } else {
    btnLogout.classList.remove('hidden');
    btnVoltarListaAdmin.classList.add('hidden');
    btnRezarAdmin.classList.add('hidden');
    btnSalvarOficialTopo.classList.add('hidden');
    btnVoltarFormAdmin.classList.add('hidden');
  }
  // Título da topbar varia conforme a tela ativa
  atualizarTopbarTituloAdmin(id);
  const listaFixo = document.querySelector('.admin-lista-fixo');
  if (listaFixo) listaFixo.classList.remove('com-sombra');
  window.scrollTo(0,0);
  // A altura da topbar pode variar (ex: botão de logout aparecendo/sumindo),
  // então remedimos depois que o navegador aplicar a troca de tela
  requestAnimationFrame(atualizarAlturaTopbarAdmin);
}

// Mede a altura real da topbar do admin e guarda numa variável CSS, para a
// fileira de ações fixa (.form-acoes-topo) encaixar exatamente abaixo dela
// (mesmo mecanismo usado em app.js para .rezar-fixo / .busca-fixa)
function atualizarAlturaTopbarAdmin(){
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  document.documentElement.style.setProperty('--topbar-altura', topbar.offsetHeight + 'px');
}
window.addEventListener('resize', atualizarAlturaTopbarAdmin);
window.addEventListener('load', atualizarAlturaTopbarAdmin);
atualizarAlturaTopbarAdmin();

// Sombra nas fileiras de ações fixas quando o conteúdo é rolado
window.addEventListener('scroll', () => {
  const listaFixo = document.querySelector('.admin-lista-fixo');
  const viewListaAtiva = document.getElementById('view-admin-list')?.classList.contains('view-active');
  if (listaFixo) listaFixo.classList.toggle('com-sombra', viewListaAtiva && window.scrollY > 4);
}, { passive: true });

async function carregarDadosIniciais() {
  try {
    // Carrega o arquivo oficial atual que já está na Vercel / localmente
    const res = await fetch('./oracoes-oficiais.json');
    if (res.ok) {
      ORACOES_OFICIAIS = await res.json();
    }
  } catch(e) {
    console.log("Não foi possível carregar orações oficiais existentes, inicializando vazio.", e);
    ORACOES_OFICIAIS = [];
  }
  renderizarListaAdmin();
}

function renderizarListaAdmin() {
  atualizarAvisoAlteracoes();
  const lista = document.getElementById('lista-admin-oficiais');
  lista.innerHTML = '';

  if (ORACOES_OFICIAIS.length === 0) {
    lista.innerHTML = '<p class="empty-state">Nenhuma oração oficial cadastrada ainda.</p>';
    return;
  }

  // Ordenar em ordem alfabética e aplicar o filtro de busca, se houver
  const ordenadas = ORACOES_OFICIAIS.slice().sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const norm = normalizarBusca(filtroListaAdmin);
  const filtradas = norm ? ordenadas.filter(o => normalizarBusca(o.titulo).includes(norm)) : ordenadas;

  if (filtradas.length === 0) {
    lista.innerHTML = '<p class="empty-state">Nenhuma oração encontrada.</p>';
    return;
  }

  filtradas.forEach(o => {
    const card = document.createElement('div');
    card.className = 'card-oracao';
    card.innerHTML = `
      <div class="card-inicial">${(o.titulo || '?')[0].toUpperCase()}</div>
      <div class="card-corpo">
        <h3>${o.titulo} ${o.oculta ? '<span style="font-size:0.75em; font-weight:normal; font-style:italic; color:var(--perigo); margin-left:4px;">(oculta)</span>' : ''} ${o.colapsarNaFala ? '<span style="font-size:0.75em; font-weight:normal; font-style:italic; color:var(--ouro-suave); margin-left:4px;">(fala: fechada)</span>' : ''}</h3>
        <p>${primeiraLinhaUtil(o.texto)}</p>
      </div>
      <div class="card-acoes">
        <button class="btn-secundario btn-editar" style="padding: 4px 10px; font-size: 0.9rem;">Editar</button>
        <button class="btn-excluir">Excluir</button>
      </div>
    `;

    card.querySelector('.btn-editar').addEventListener('click', (ev) => {
      ev.stopPropagation();
      abrirForm(o.id);
    });

    card.querySelector('.btn-excluir').addEventListener('click', (ev) => {
      ev.stopPropagation();
      excluirOficial(o.id);
    });

    card.addEventListener('click', () => abrirForm(o.id));
    lista.appendChild(card);
  });
}

let idOficialParaExcluir = null;

function excluirOficial(id) {
  const o = ORACOES_OFICIAIS.find(x => x.id === id);
  if (!o) return;
  idOficialParaExcluir = id;
  document.getElementById('texto-confirmar-exclusao').textContent =
    `Excluir a oração oficial "${o.titulo}"? Essa ação não pode ser desfeita.`;
  document.getElementById('modal-confirmar-exclusao').classList.remove('hidden');
}

function fecharModalExclusao() {
  document.getElementById('modal-confirmar-exclusao').classList.add('hidden');
  idOficialParaExcluir = null;
}

function confirmarExclusaoOficial() {
  if (!idOficialParaExcluir) return;
  ORACOES_OFICIAIS = ORACOES_OFICIAIS.filter(x => x.id !== idOficialParaExcluir);
  alteracoesNaoExportadas = true;
  renderizarListaAdmin();
  fecharModalExclusao();
}

document.getElementById('btn-cancelar-exclusao').addEventListener('click', fecharModalExclusao);
document.getElementById('btn-confirmar-exclusao').addEventListener('click', confirmarExclusaoOficial);

// Instancia o editor unificado para o contexto do Admin (Orações Oficiais)
const editorOracaoAdmin = criarEditorOracao({
  contexto: 'admin',
  ids: {
    titulo: 'input-oficial-titulo',
    texto: 'input-oficial-texto',
    botaoSalvar: 'btn-salvar-oficial',
    menuInserir: 'menu-inserir-admin',
    botaoInserir: 'btn-inserir-admin'
  },
  idsModais: {
      btnInserirOracao:      'btn-inserir-oracao-admin',
      btnInserirOpcional:    'btn-inserir-opcional-admin',
      btnInserirLink:        'btn-inserir-link-admin',
      btnInserirPausa:       'btn-inserir-pausa-admin',
      modalInserir:          'modal-inserir-admin',
      modalInserirTitulo:    'modal-inserir-admin-titulo',
      modalInserirDica:      'modal-inserir-admin-dica',
      inputBuscaInserir:     'input-busca-inserir',
      listaModalInserir:     'lista-modal-inserir-admin',
      btnFecharModalInserir: 'btn-fechar-modal-admin',
      modalLink:             'modal-link-admin',
      inputLinkUrl:          'input-link-url-admin',
      btnCancelarLink:       'btn-cancelar-link-admin',
      btnConfirmarLink:      'btn-confirmar-link-admin',
      modalNumero:           'modal-numero-admin',
      modalNumeroTitulo:     'modal-numero-admin-titulo',
      modalNumeroDica:       'modal-numero-admin-dica',
      inputNumero:           'input-numero-admin',
      btnCancelarNumero:     'btn-cancelar-numero-admin',
      btnConfirmarNumero:    'btn-confirmar-numero-admin'
  },
  recursos: {
    mostrarCamposAdmin: true,
    preview: true
  },
  camposExtras: {
    oculta: 'checkbox-oficial-oculta',
    colapsarNaFala: 'checkbox-oficial-colapsar-fala'
  },
  sufixoNovalinha: true,
  preventScrollFocus: true,
  rastrearCursorContinuamente: true,

  listarReferencias(termo) {
    const norm = normalizarBusca(termo || '');
    const lista = ORACOES_OFICIAIS
      .filter(o => o.id !== editandoId)
      .sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    return norm ? lista.filter(o => normalizarBusca(o.titulo).includes(norm)) : lista;
  },

  carregarPorId(id) {
    return ORACOES_OFICIAIS.find(x => x.id === id);
  }
});

function abrirForm(id) {
  editandoId = id || null;
  editorOracaoAdmin.abrir(editandoId);
  mostrarView('view-admin-form');
}

function previewHaAlteracaoNaoSalva() {
  return editorOracaoAdmin.verificarAlteracoesPendentes();
}

// Botão Criar Nova
document.getElementById('btn-criar-nova-oficial').addEventListener('click', () => abrirForm(null));

// Botão Cancelar Formulário (agora vive na topbar, no lugar do botão de sair)
document.getElementById('btn-voltar-lista-admin').addEventListener('click', () => {
  pararFala();
  mostrarView('view-admin-list');
});

// Botão Rezar (topbar do formulário do admin). Abre a view de rezar unificada.
document.getElementById('btn-rezar-admin').addEventListener('click', () => {
  if(!editandoId){
    mostrarToast('Salve a oração antes de pré-visualizar.');
    return;
  }
  if(previewHaAlteracaoNaoSalva()){
    mostrarToast('Para visualizar, salve a oração antes.');
    return;
  }
  pararFala();
  limparContasDoId(ID_PREVIEW);
  telaRezarAdmin.abrir(editandoId);
});

// Botão Salvar Formulário
document.getElementById('btn-salvar-oficial').addEventListener('click', () => {
  const valores = editorOracaoAdmin.obterValores();

  if (!valores.titulo) {
    alert('Dê um título para a oração.');
    return;
  }

  // Verificar duplicidade de título no conjunto de oficiais
  const duplicada = ORACOES_OFICIAIS.find(o => 
    o.titulo.trim().toLowerCase() === valores.titulo.toLowerCase() && o.id !== editandoId
  );
  if (duplicada) {
    alert('Já existe uma oração oficial com esse título.');
    return;
  }

  if (editandoId) {
    const o = ORACOES_OFICIAIS.find(x => x.id === editandoId);
    if (o) {
      o.titulo = valores.titulo;
      o.texto = valores.texto;
      o.oculta = valores.oculta;
      o.colapsarNaFala = valores.colapsarNaFala;
    }
  } else {
    const novoId = 'oficial_' + Date.now().toString(36);
    ORACOES_OFICIAIS.push({
      id: novoId,
      titulo: valores.titulo,
      texto: valores.texto,
      oculta: valores.oculta,
      colapsarNaFala: valores.colapsarNaFala
    });
    editandoId = novoId; // passa a editar a oração recém-criada, sem sair da tela
  }

  alteracoesNaoExportadas = true;
  renderizarListaAdmin();
  mostrarToast('Oração oficial salva com sucesso!', 'sucesso');

  editorOracaoAdmin.marcarComoSalvo();
  // Reabre para atualizar referências de estado original
  editorOracaoAdmin.abrir(editandoId);
  atualizarTopbarTituloAdmin('view-admin-form');
});

// ---- Geração de .zip sem dependências externas (sem CDN, sem build step) ----
// Implementação mínima do formato ZIP (método "store", sem compressão) —
// suficiente pra empacotar dois arquivos de texto pequenos. Evita depender
// de biblioteca externa (ex: JSZip) num projeto que é propositalmente
// "vanilla JS, sem frameworks e sem build step" (ver README.md).

function crc32(bytes){
  let crc = ~0;
  for(let i = 0; i < bytes.length; i++){
    crc ^= bytes[i];
    for(let j = 0; j < 8; j++){
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

// Converte um objeto Date do JS para os dois campos de 16 bits que o
// formato ZIP exige (hora e data, cada um compactado em bits específicos).
// Sem isso, o zip ficava com uma data fixa e fictícia (1980-01-01 00:00) em
// todo arquivo — o Explorer do Windows não conseguia exibir essa data
// mínima/zerada corretamente e mostrava a coluna "Data de modificação" em
// branco ao extrair.
function paraDosDataHora(data){
  const dosTime = (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2);
  const dosDate = ((data.getFullYear() - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate();
  return { dosTime, dosDate };
}

// arquivos: [{ nome: 'caminho/dentro/do/zip.ext', conteudo: 'string' }, ...]
// Caminhos com "/" viram subpastas ao extrair (ex: 'js/arquivo.js').
function criarZip(arquivos){
  const encoder = new TextEncoder();
  const partesLocais = [];
  const partesCentral = [];
  let offset = 0;
  // Mesmo instante para todos os arquivos do zip, batendo com o horário real
  // em que o download foi gerado.
  const { dosTime, dosDate } = paraDosDataHora(new Date());

  arquivos.forEach(({ nome, conteudo }) => {
    const nomeBytes = encoder.encode(nome);
    const dadoBytes = encoder.encode(conteudo);
    const crc = crc32(dadoBytes);
    const tamanho = dadoBytes.length;

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0, true);
    header.setUint16(8, 0, true);
    header.setUint16(10, dosTime, true);
    header.setUint16(12, dosDate, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, tamanho, true);
    header.setUint32(22, tamanho, true);
    header.setUint16(26, nomeBytes.length, true);
    header.setUint16(28, 0, true);
    const localHeaderBytes = new Uint8Array(header.buffer);
    partesLocais.push(localHeaderBytes, nomeBytes, dadoBytes);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0, true);
    centralHeader.setUint16(10, 0, true);
    centralHeader.setUint16(12, dosTime, true);
    centralHeader.setUint16(14, dosDate, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, tamanho, true);
    centralHeader.setUint32(24, tamanho, true);
    centralHeader.setUint16(28, nomeBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);
    partesCentral.push(new Uint8Array(centralHeader.buffer), nomeBytes);

    offset += localHeaderBytes.length + nomeBytes.length + dadoBytes.length;
  });

  const tamanhoCentral = partesCentral.reduce((acc, p) => acc + p.length, 0);
  const fimCentral = new DataView(new ArrayBuffer(22));
  fimCentral.setUint32(0, 0x06054b50, true);
  fimCentral.setUint16(8, arquivos.length, true);
  fimCentral.setUint16(10, arquivos.length, true);
  fimCentral.setUint32(12, tamanhoCentral, true);
  fimCentral.setUint32(16, offset, true);

  return new Blob([...partesLocais, ...partesCentral, new Uint8Array(fimCentral.buffer)], { type: 'application/zip' });
}

// Gera o conteúdo do js/oracoes-oficiais-data.js a partir dos mesmos dados
// exportados para o .json, no formato exato que o arquivo já usa hoje
// (cabeçalho fixo + "var ORACOES_OFICIAIS_DATA = " + JSON indentado + ";").
// Existe pra que os dois arquivos nunca mais fiquem dessincronizados: antes,
// só o .json era exportado e o .js tinha que ser atualizado à mão (ou nem
// era), o que deixava a tela Rezar exibindo dados velhos pra quem carregasse
// o app a partir do fallback embutido (ex: offline via Service Worker).
// Ver README.md, seção "Orações PWA — Camadas".
function gerarConteudoJsOficiais(dados){
  const cabecalho =
    '// Dados das oracoes oficiais - gerado automaticamente\r\n' +
    '// NAO edite este arquivo diretamente; edite oracoes-oficiais.json\r\n' +
    'var ORACOES_OFICIAIS_DATA = ';
  const corpo = JSON.stringify(dados, null, 2).replace(/\n/g, '\r\n');
  return cabecalho + corpo + ';\r\n';
}

function baixarBlob(nomeArquivo, blob){
  const url = URL.createObjectURL(blob);
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.href = url;
  dlAnchorElem.download = nomeArquivo;
  dlAnchorElem.click();
  URL.revokeObjectURL(url);
}

// Botão Baixar arquivos atualizados: um único .zip com os dois arquivos já
// nos caminhos certos (raiz do projeto + js/), sempre gerados juntos a
// partir dos mesmos dados — não tem como os dois ficarem dessincronizados.
document.getElementById('btn-exportar-json').addEventListener('click', () => {
  const zipBlob = criarZip([
    { nome: 'oracoes-oficiais.json', conteudo: JSON.stringify(ORACOES_OFICIAIS, null, 2) },
    { nome: 'js/oracoes-oficiais-data.js', conteudo: gerarConteudoJsOficiais(ORACOES_OFICIAIS) }
  ]);
  baixarBlob('oracoes-oficiais-atualizado.zip', zipBlob);

  alteracoesNaoExportadas = false;
  atualizarAvisoAlteracoes();
});

document.getElementById('input-busca-editar').addEventListener('input', e => {
  filtroListaAdmin = e.target.value;
  renderizarListaAdmin();
});

// Atualiza o botão de velocidade do admin
function atualizarBotaoVelocidadeAdmin(){
  const btn = document.getElementById('btn-velocidade-admin');
  if(btn) {
    btn.textContent = `⚡ ${velocidadeAtual.toFixed(2).replace('.00', '.0')}x`;
  }
}

function alternarVelocidadeAdmin(){
  let index = OPCOES_VELOCIDADE.indexOf(velocidadeAtual);
  if(index === -1) index = 1; // fallback para 1.0
  
  index = (index + 1) % OPCOES_VELOCIDADE.length;
  velocidadeAtual = OPCOES_VELOCIDADE[index];
  
  localStorage.setItem(CHAVE_VELOCIDADE, velocidadeAtual.toString());
  atualizarBotaoVelocidadeAdmin();
  
  if(falando && !pausado){
    if(utteranciaAtual){
      utteranciaAtual.onend = null;
      utteranciaAtual.onerror = null;
    }
    window.speechSynthesis.cancel();
    falarProximaLinha();
  }
}

// Instancia o controlador da tela Rezar unificada para o contexto do admin
const telaRezarAdmin = criarTelaRezar({
  contexto: 'admin',
  carregarOracao(id) {
    return ORACOES_OFICIAIS.find(x => x.id === id);
  },
  definirEstado(id, origem, tipo) {
    // Isola o progresso do preview sob ID_PREVIEW — não afeta dados do usuário
    oracaoAtualId = ID_PREVIEW;
    // Inicializa o ctx de seção — será recriado em atualizarUI com dados reais
    secaoCtxAtual = null;
  },
  atualizarUI(oracao, { id, origem, tipo }) {
    document.getElementById('rezar-titulo-admin').textContent = oracao.titulo;
    const container = document.getElementById('rezar-texto');
    // ctx com progresso isolado — comportamento idêntico ao usuário
    const ctx = {
      oracaoId: ID_PREVIEW,
      n: 0,
      elementos: []
    };
    renderizarTextoNaTela(oracao.texto, container, ctx, 'Esta oração ainda não tem texto.');
    secaoCtxAtual = ctx;
    atualizarBotaoVelocidadeAdmin();
  },
  mostrarTela() {
    mostrarView('view-rezar-admin');
  }
});

// Botões de ação da tela Rezar do admin
document.getElementById('btn-falar').addEventListener('click', alternarFala);
document.getElementById('btn-velocidade-admin').addEventListener('click', alternarVelocidadeAdmin);

document.getElementById('btn-rezar-admin-reiniciar').addEventListener('click', () => {
  pararFala();
  // Limpa progresso isolado de preview
  if(oracaoAtualId) delete progressoLeitura[oracaoAtualId];
  salvarProgressoLeitura();
  limparContasDoId(ID_PREVIEW);
  const o = ORACOES_OFICIAIS.find(x => x.id === editandoId);
  if (o) {
    const container = document.getElementById('rezar-texto');
    const ctx = { oracaoId: ID_PREVIEW, n: 0, elementos: [] };
    renderizarTextoNaTela(o.texto, container, ctx, 'Esta oração ainda não tem texto.');
    secaoCtxAtual = ctx;
  }
  iniciarFala();
});

// Botão de voltar da tela Rezar do admin para o editor
btnVoltarFormAdmin.addEventListener('click', () => {
  pararFala();
  limparContasDoId(ID_PREVIEW);
  mostrarView('view-admin-form');
});

// ===================== INICIALIZAÇÃO =====================
inicializarBotoesLimparBusca(); // Botão "X" nos campos de busca (js/utils.js)