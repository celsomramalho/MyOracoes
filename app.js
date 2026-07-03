
// ===================== NAVEGAÇÃO =====================

// Ícone exibido na topbar para cada tela (a Home usa a vela animada, definida no CSS)
const ICONE_CRIAR_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>';

const ICONES_TELA = {
  'view-todas': ICONE_CRIAR_SVG,
  'view-oficiais': '📜',
  'view-editor': '✏️',
  'view-rezar': '🙏',
};

function mostrarView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
  document.getElementById(id).classList.add('view-active');
  pararFala();
  window.scrollTo(0,0);

  // Marca a tela ativa no #app (controla via CSS: vela só aparece na Home)
  const appEl = document.getElementById('app');
  appEl.dataset.tela = (id === 'view-home') ? 'home' : 'outra';

  // Atualização do título do cabeçalho global e do botão home da topbar
  const topbarTitulo = document.getElementById('topbar-titulo');
  const topbarIconeTela = document.getElementById('topbar-icone-tela');
  const btnTopbarHome = document.getElementById('btn-topbar-home');
  const btnCompartilharApp = document.getElementById('btn-compartilhar-app');

  if (topbarTitulo && btnTopbarHome) {
    let textoTitulo = 'MyOrações';

    if (id === 'view-home') {
      textoTitulo = 'MyOrações';
      btnTopbarHome.classList.add('hidden');
      if (btnCompartilharApp) btnCompartilharApp.classList.remove('hidden');
    } else {
      btnTopbarHome.classList.remove('hidden');
      if (btnCompartilharApp) btnCompartilharApp.classList.add('hidden');
      if (id === 'view-todas') {
        textoTitulo = 'Criar';
      } else if (id === 'view-oficiais') {
        textoTitulo = 'Orações Oficiais';
      } else if (id === 'view-editor') {
        textoTitulo = editandoId ? 'Editar oração' : 'Nova oração';
      } else if (id === 'view-rezar') {
        textoTitulo = 'Rezar';
      }
    }

    topbarTitulo.textContent = textoTitulo;
    topbarTitulo.title = textoTitulo; // tooltip com o nome completo, caso seja cortado
    if (topbarIconeTela) topbarIconeTela.innerHTML = ICONES_TELA[id] || '';
  }

  // Botões de ação do Modo Rezar (Ouvir / Velocidade) só aparecem na topbar
  // quando a tela ativa é o próprio Modo Rezar
  const topbarAcoesRezar = document.getElementById('topbar-acoes-rezar');
  if (topbarAcoesRezar) {
    topbarAcoesRezar.classList.toggle('hidden', id !== 'view-rezar');
  }

  // Botão de salvar (ícone) só aparece na tela de Criar/Editar oração
  const btnSalvarTopo = document.getElementById('btn-salvar-topo');
  if (btnSalvarTopo) {
    btnSalvarTopo.classList.toggle('hidden', id !== 'view-editor');
  }

  // Cabeçalho fixo do Modo Rezar: começa sem sombra ao entrar na tela
  const rezarFixo = document.getElementById('rezar-fixo');
  if (rezarFixo) rezarFixo.classList.remove('com-sombra');

  // A altura da topbar pode mudar de tela pra tela (ex: Modo Rezar tem 2 botões
  // extras), então remedimos depois que o navegador aplicar a troca de tela
  requestAnimationFrame(atualizarAlturaTopbar);
}

// Mede a altura real da topbar e guarda numa variável CSS, para o
// cabeçalho fixo do Modo Rezar encaixar exatamente abaixo dela
// (refeito a cada redimensionamento/zoom, já que pode variar com a fonte do usuário)
function atualizarAlturaTopbar(){
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  document.documentElement.style.setProperty('--topbar-altura', topbar.offsetHeight + 'px');
}
window.addEventListener('resize', atualizarAlturaTopbar);
window.addEventListener('load', atualizarAlturaTopbar);
atualizarAlturaTopbar();

// Sombra nos cabeçalhos fixos (Modo Rezar / busca de Orações Oficiais)
// quando o conteúdo é rolado
window.addEventListener('scroll', () => {
  const rezarFixo = document.getElementById('rezar-fixo');
  const viewRezarAtiva = document.getElementById('view-rezar')?.classList.contains('view-active');
  if (rezarFixo) rezarFixo.classList.toggle('com-sombra', viewRezarAtiva && window.scrollY > 4);

  const oficiaisFixo = document.getElementById('oficiais-busca-fixa');
  const viewOficiaisAtiva = document.getElementById('view-oficiais')?.classList.contains('view-active');
  if (oficiaisFixo) oficiaisFixo.classList.toggle('com-sombra', viewOficiaisAtiva && window.scrollY > 4);
}, { passive: true });


// ===================== RENDERIZAÇÃO DAS LISTAS =====================
function renderizarFavoritas(termo){
  const lista = document.getElementById('lista-favoritas');
  const vazio = document.getElementById('empty-favoritas');
  lista.innerHTML = '';

  const pessoaisFav = ORACOES.filter(o => o.favorita);
  const oficaisFav = ORACOES_OFICIAIS.filter(o => favoritasOficiaisIds.includes(o.id));
  let todasFav = [
    ...pessoaisFav.map(o => ({ ...o, _tipo: 'pessoal' })),
    ...oficaisFav.map(o => ({ ...o, _tipo: 'oficial' })),
  ].sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));

  const norm = normalizarBusca(termo || '');
  if(norm) todasFav = todasFav.filter(o => normalizarBusca(o.titulo).includes(norm));

  if(todasFav.length === 0){
    vazio.classList.remove('hidden');
    vazio.innerHTML = norm
      ? 'Nenhuma oração encontrada.'
      : 'Você ainda não tem orações favoritas.<br>Toque na estrela de uma oração para marcá-la aqui, ou crie uma nova.';
  }else{
    vazio.classList.add('hidden');
    todasFav.forEach(o => lista.appendChild(criarCardOracao(o, 'home', o._tipo)));
  }
  atualizarProgressoDiario();
}

function renderizarTodas(){
  const lista = document.getElementById('lista-todas');
  const vazio = document.getElementById('empty-todas');
  lista.innerHTML = '';
  if(ORACOES.length === 0){
    vazio.classList.remove('hidden');
  }else{
    vazio.classList.add('hidden');
    ORACOES.slice().sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
      .forEach(o => lista.appendChild(criarCardOracao(o, 'todas', 'pessoal')));
  }
}

function renderizarOficiais(termo){
  const lista = document.getElementById('lista-oficiais');
  const vazio = document.getElementById('empty-oficiais');
  lista.innerHTML = '';

  // Filtra as orações oficiais para ocultar as intermediárias/auxiliares
  const visiveis = ORACOES_OFICIAIS.filter(o => !o.oculta);

  const norm = normalizarBusca(termo);
  const filtradas = norm ? visiveis.filter(o => normalizarBusca(o.titulo).includes(norm)) : visiveis;

  if(filtradas.length === 0){
    vazio.classList.remove('hidden');
    vazio.textContent = norm ? 'Nenhuma oração encontrada.' : 'Nenhuma oração oficial cadastrada ainda.';
  }else{
    vazio.classList.add('hidden');
    filtradas.slice().sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
      .forEach(o => lista.appendChild(criarCardOracao(o, 'oficiais', 'oficial')));
  }
}

function renderizarTudo(){
  renderizarFavoritas();
  renderizarTodas();
  renderizarOficiais();
}

// atualizarProgressoDiario → js/components/progresso.js

// ===================== EDITOR (CRIAR / EDITAR) =====================
// Instancia o editor unificado para o contexto do Usuário
const editorOracao = criarEditorOracao({
  contexto: 'usuario',
  ids: {
    titulo: 'input-titulo',
    texto: 'input-texto',
    botaoSalvar: 'btn-salvar-topo',
    menuInserir: 'menu-inserir',
    botaoInserir: 'btn-inserir',
    idsModais: {
      btnInserirOracao:      'btn-inserir-oracao',
      btnInserirOpcional:    'btn-inserir-opcional',
      btnInserirLink:        'btn-inserir-link',
      btnInserirPausa:       'btn-inserir-pausa',
      modalInserir:          'modal-inserir',
      modalInserirTitulo:    'modal-inserir-titulo',
      modalInserirDica:      'modal-inserir-dica',
      inputBuscaInserir:     'input-busca-inserir',
      listaModalInserir:     'lista-modal-inserir',
      btnFecharModalInserir: 'btn-fechar-modal',
      modalLink:             'modal-link',
      inputLinkUrl:          'input-link-url',
      btnCancelarLink:       'btn-cancelar-link',
      btnConfirmarLink:      'btn-confirmar-link',
      modalNumero:           'modal-numero',
      modalNumeroTitulo:     'modal-numero-titulo',
      modalNumeroDica:       'modal-numero-dica',
      inputNumero:           'input-numero',
      btnCancelarNumero:     'btn-cancelar-numero',
      btnConfirmarNumero:    'btn-confirmar-numero'
    }
  },
  recursos: {
    mostrarCamposAdmin: false,
    preview: false
  },
  sufixoNovalinha: false,
  preventScrollFocus: false,
  rastrearCursorContinuamente: false,

  listarReferencias(termo) {
    const pessoais = ORACOES.filter(o => o.id !== editandoId)
      .map(o => ({ ...o, _tipo: 'pessoal' }));
    const oficiais = ORACOES_OFICIAIS.map(o => ({ ...o, _tipo: 'oficial' }));
    let lista = [...pessoais, ...oficiais]
      .sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    const norm = normalizarBusca(termo || '');
    return norm ? lista.filter(o => normalizarBusca(o.titulo).includes(norm)) : lista;
  },

  renderizarItemListaReferencia(o) {
    return `${escaparHTML(o.titulo)}${
      o._tipo === 'oficial'
        ? ' <span style="color:var(--texto-suave);font-size:0.8em;">📜 oficial</span>'
        : ''
    }`;
  },

  carregarPorId(id) {
    return ORACOES.find(x => x.id === id);
  }
});

function abrirEditor(id){
  editandoId = id || null;
  editorOracao.abrir(editandoId);
  mostrarView('view-editor');
}

function salvarEditor(){
  const valores = editorOracao.obterValores();

  if(!valores.titulo){
    alert('Dê um título para a oração antes de salvar.');
    document.getElementById('input-titulo').focus();
    return;
  }

  // Verifica duplicata em pessoais E oficiais
  const nomeLower = valores.titulo.toLowerCase();
  const duplicadaPessoal = ORACOES.find(o =>
    o.titulo && o.titulo.trim().toLowerCase() === nomeLower && o.id !== editandoId
  );
  const duplicadaOficial = ORACOES_OFICIAIS.find(o =>
    o.titulo && o.titulo.trim().toLowerCase() === nomeLower
  );
  if(duplicadaPessoal || duplicadaOficial){
    mostrarToast(`Já existe uma oração com esse título${duplicadaOficial ? ' (oficial)' : ''}. Escolha um título diferente.`);
    return;
  }

  if(editandoId){
    const o = ORACOES.find(x => x.id === editandoId);
    o.titulo = valores.titulo;
    o.texto = valores.texto;
  }else{
    const nova = { id: gerarId(), titulo: valores.titulo, texto: valores.texto, favorita: false };
    ORACOES.push(nova);
    editandoId = nova.id; // passa a editar a oração recém-criada, sem sair da tela
  }

  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarToast('Oração salva com sucesso!', 'sucesso');

  editorOracao.marcarComoSalvo();
  // Atualiza para o novo ID se foi criada agora
  editorOracao.abrir(editandoId);
  mostrarView('view-editor');
}


// ===================== TELA "REZAR" =====================
// Etapa 4 do PLANO-UNIFICACAO-TELA-REZAR.md: abrirRezar deixou de conter a
// lógica da tela Rezar diretamente — agora é um wrapper fino em torno do
// controlador genérico criarTelaRezar (js/rezar-core.js), configurado para
// o contexto do usuário. mostrarView continua com o mesmo id de view
// ('view-rezar') e os checks hardcoded que dependem dele em outros lugares
// do app não mudam nesta etapa (isso só muda na Etapa 5, com
// 'view-rezar-admin'). As globais oracaoAtualId/oracaoAtualTipo/origemRezar
// continuam existindo do mesmo jeito, só que agora setadas via callback de
// config em vez de direto no corpo de abrirRezar.
const telaRezarUsuario = criarTelaRezar({
  contexto: 'usuario',

  definirEstado(id, origem, tipo){
    // Mesma ordem e mesmos defaults do abrirRezar original: as globais são
    // setadas antes mesmo de saber se a oração existe.
    oracaoAtualId = id;
    oracaoAtualTipo = tipo || 'pessoal';
    origemRezar = origem || 'home';
  },

  carregarOracao(id, tipo){
    const ehOficial = (tipo || 'pessoal') === 'oficial';
    return ehOficial
      ? ORACOES_OFICIAIS.find(x => x.id === id)
      : ORACOES.find(x => x.id === id);
  },

  atualizarUI(o){
    const ehOficial = oracaoAtualTipo === 'oficial';

    const tituloEl = document.getElementById('rezar-titulo');
    tituloEl.textContent = o.titulo;
    tituloEl.title = o.titulo;
    atualizarEstrelaRezar();
    atualizarBotaoMarcarRezada();
    atualizarBotaoVelocidade();
    renderizarTextoRezar(o.texto);

    // Botão compartilhar: apenas em pessoais
    const btnCompartilhar = document.getElementById('btn-compartilhar-atual');
    if(btnCompartilhar) btnCompartilhar.style.display = ehOficial ? 'none' : '';

    // Aplica a origem/tipo já defaultados (não os parâmetros crus recebidos
    // por abrir()) na área de ações, para CSS controlar visibilidade — os
    // mesmos valores e a mesma ordem que o abrirRezar original usava.
    const viewRezar = document.getElementById('view-rezar');
    viewRezar.dataset.origem = origemRezar;
    viewRezar.dataset.tipo = oracaoAtualTipo;
  },

  mostrarTela(){
    mostrarView('view-rezar');
  }
});

function abrirRezar(id, origem, tipo){
  telaRezarUsuario.abrir(id, origem, tipo);
}

function atualizarEstrelaRezar(){
  const ehOficial = oracaoAtualTipo === 'oficial';
  const ehFav = ehOficial
    ? favoritasOficiaisIds.includes(oracaoAtualId)
    : !!ORACOES.find(x => x.id === oracaoAtualId)?.favorita;
  document.getElementById('btn-favoritar-rezar').textContent = ehFav ? '★' : '☆';
}

function atualizarBotaoMarcarRezada(){
  const btn = document.getElementById('btn-marcar-rezada');
  if(!btn || !oracaoAtualId) return;

  const rezada = !!rezadasDiarias[oracaoAtualId];
  btn.textContent = '✓';
  if(rezada){
    btn.title = `Rezada hoje às ${rezadasDiarias[oracaoAtualId]}`;
    btn.classList.add('rezada-ativo');
  }else{
    btn.title = 'Marcar como rezada';
    btn.classList.remove('rezada-ativo');
  }
}

function alternarRezadaManualmente(){
  if(!oracaoAtualId) return;
  const hoje = obterDataLocalHoje();
  
  if(rezadasDiarias[oracaoAtualId]){
    delete rezadasDiarias[oracaoAtualId];
    mostrarToast('Oração marcada como não rezada hoje.');
  }else{
    const d = new Date();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    rezadasDiarias[oracaoAtualId] = `${hora}:${min}`;
    mostrarToast('Oração marcada como rezada hoje!', 'sucesso');
  }
  
  salvarRezadasDiarias({ data: hoje, ids: rezadasDiarias });
  atualizarBotaoMarcarRezada();
  renderizarTudo();
  atualizarProgressoDiario();
}

function atualizarBotaoVelocidade(){
  const btn = document.getElementById('btn-velocidade');
  if(btn) {
    btn.textContent = `⚡ ${velocidadeAtual.toFixed(2).replace('.00', '.0')}x`;
  }
}

function alternarVelocidade(){
  let index = OPCOES_VELOCIDADE.indexOf(velocidadeAtual);
  if(index === -1) index = 1; // fallback para 1.0
  
  index = (index + 1) % OPCOES_VELOCIDADE.length;
  velocidadeAtual = OPCOES_VELOCIDADE[index];
  
  localStorage.setItem(CHAVE_VELOCIDADE, velocidadeAtual.toString());
  atualizarBotaoVelocidade();
  
  if(falando && !pausado){
    if(utteranciaAtual){
      utteranciaAtual.onend = null;
      utteranciaAtual.onerror = null;
    }
    window.speechSynthesis.cancel();
    falarProximaLinha();
  }
}

// Monta o contexto de progresso a partir da oração aberta agora e delega a
// renderização em si para o núcleo compartilhado com o preview do admin
// (js/rezar-core.js, Etapa 2 do PLANO-UNIFICACAO-TELA-REZAR.md).
function renderizarTextoRezar(textoOriginal){
  const container = document.getElementById('rezar-texto');
  const ctx = criarContextoProgresso(oracaoAtualId);
  secaoCtxAtual = ctx;

  renderizarTextoNaTela(
    textoOriginal,
    container,
    ctx,
    'Esta oração ainda não tem texto. Toque em "Editar" para escrever.'
  );

  if(ctx) atualizarVisuaisProgresso(ctx.oracaoId, ctx.elementos);
}

// adicionarLinhas, construirArvore, criarBtnCheck, agruparNos, renderizarNos,
// marcarSecao, desmarcarSecao, limparProgressoLeitura,
// atualizarVisuaisProgresso, expandirParaElemento → js/render-tree.js
// renderizarTextoNaTela, criarContextoProgresso, limparContasDoId,
// ID_PREVIEW_REZAR → js/rezar-core.js

// configVozes, salvarConfigVozes, aguardarVozesDisponiveis, ordenarVozesPtPrimeiro,
// escolherVozesAutomaticas, abrirConfigVozes, fecharModalVozes, salvarConfigVozesModal,
// filaFala, indiceFalaAtual, falando, pausado, utteranciaAtual,
// obterLinhasParaFalar, alternarFala, iniciarFala, pausarFala, continuarFala,
// atualizarBotaoFala, falarProximaLinha, pararFala → js/speech.js

// ===================== LIGAÇÃO DOS BOTÕES =====================
document.getElementById('btn-ver-todas').addEventListener('click', () => mostrarView('view-todas'));
document.getElementById('btn-ver-oficiais').addEventListener('click', () => {
  const inputBusca = document.getElementById('input-busca-oficiais');
  inputBusca.value = '';
  renderizarOficiais('');
  mostrarView('view-oficiais');
});

document.getElementById('input-busca-oficiais').addEventListener('input', (e) => {
  renderizarOficiais(e.target.value);
});

document.getElementById('input-busca-favoritas').addEventListener('input', (e) => {
  renderizarFavoritas(e.target.value);
});

document.getElementById('btn-topbar-home').addEventListener('click', () => {
  mostrarView('view-home');
});

document.getElementById('btn-compartilhar-app').addEventListener('click', compartilharApp);

document.getElementById('fab-nova').addEventListener('click', () => abrirEditor(null));
document.getElementById('btn-salvar-topo').addEventListener('click', salvarEditor);
document.getElementById('input-titulo').addEventListener('input', atualizarEstadoBotaoSalvar);
document.getElementById('input-texto').addEventListener('input', atualizarEstadoBotaoSalvar);
document.getElementById('btn-cancelar-exclusao').addEventListener('click', fecharModalExclusao);
document.getElementById('btn-confirmar-exclusao').addEventListener('click', confirmarExclusao);

document.getElementById('btn-favoritar-rezar').addEventListener('click', () => {
  if(!oracaoAtualId) return;
  if(oracaoAtualTipo === 'oficial'){
    alternarFavoritoOficial(oracaoAtualId);
  }else{
    alternarFavorito(oracaoAtualId);
  }
});
document.getElementById('btn-compartilhar-atual').addEventListener('click', () => compartilharOracao(oracaoAtualId));
document.getElementById('btn-falar').addEventListener('click', alternarFala);
document.getElementById('btn-ler').addEventListener('click', pararFala);
document.getElementById('btn-marcar-rezada').addEventListener('click', alternarRezadaManualmente);
document.getElementById('btn-reiniciar-progresso').addEventListener('click', limparProgressoLeitura);
document.getElementById('btn-velocidade').addEventListener('click', alternarVelocidade);
document.getElementById('btn-config-vozes').addEventListener('click', abrirConfigVozes);
document.getElementById('btn-fechar-modal-vozes').addEventListener('click', fecharModalVozes);
document.getElementById('btn-salvar-vozes').addEventListener('click', salvarConfigVozesModal);

document.getElementById('btn-exportar-oracoes').addEventListener('click', exportarOracoes);
document.getElementById('btn-importar-oracoes').addEventListener('click', importarOracoesDeArquivo);

// ===================== INICIALIZAÇÃO =====================
renderizarTodas();
carregarOficiais();
renderizarFavoritas(); // Garante o carregamento inicial correto das favoritas oficiais na Home
verificarLinkImportacao();

// ===================== PWA: SERVICE WORKER =====================
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
