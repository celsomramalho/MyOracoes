
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

  // Controle do FAB: Só aparece em view-todas
  const fab = document.getElementById('fab-nova');
  if(fab){
    if(id === 'view-todas'){
      fab.style.display = '';
    } else {
      fab.style.display = 'none';
    }
  }

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
function abrirEditor(id){
  editandoId = id || null;
  const inputTitulo = document.getElementById('input-titulo');
  const inputTexto = document.getElementById('input-texto');

  if(editandoId){
    const o = ORACOES.find(x => x.id === editandoId);
    inputTitulo.value = o ? o.titulo : '';
    inputTexto.value = o ? o.texto : '';
  }else{
    inputTitulo.value = '';
    inputTexto.value = '';
  }

  editorTituloOriginal = inputTitulo.value;
  editorTextoOriginal = inputTexto.value;
  atualizarEstadoBotaoSalvar();

  mostrarView('view-editor');
  inputTitulo.focus();
}

// Compara o conteúdo atual do editor com o que havia ao abrir a tela e
// sinaliza no ícone de salvar da topbar se há alterações não salvas
function atualizarEstadoBotaoSalvar(){
  const btnSalvarTopo = document.getElementById('btn-salvar-topo');
  if(!btnSalvarTopo) return;
  const inputTitulo = document.getElementById('input-titulo');
  const inputTexto = document.getElementById('input-texto');
  const houveAlteracao = inputTitulo.value !== editorTituloOriginal || inputTexto.value !== editorTextoOriginal;
  btnSalvarTopo.classList.toggle('nao-salvo', houveAlteracao);
}

let idParaExcluir = null;

function excluirOracao(id){
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;
  idParaExcluir = id;
  document.getElementById('texto-confirmar-exclusao').textContent =
    `Excluir a oração "${o.titulo}"? Essa ação não pode ser desfeita.`;
  document.getElementById('modal-confirmar-exclusao').classList.remove('hidden');
}

function fecharModalExclusao(){
  document.getElementById('modal-confirmar-exclusao').classList.add('hidden');
  idParaExcluir = null;
}

function confirmarExclusao(){
  if(!idParaExcluir) return;
  ORACOES = ORACOES.filter(x => x.id !== idParaExcluir);
  salvarOracoes(ORACOES);
  renderizarTudo();
  fecharModalExclusao();
  mostrarView('view-todas');
}

function salvarEditor(){
  const inputTitulo = document.getElementById('input-titulo');
  const inputTexto = document.getElementById('input-texto');
  const titulo = inputTitulo.value.trim();
  const texto = inputTexto.value;

  if(!titulo){
    alert('Dê um título para a oração antes de salvar.');
    inputTitulo.focus();
    return;
  }

  // Verifica duplicata em pessoais E oficiais
  const nomeLower = titulo.toLowerCase();
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
    o.titulo = titulo;
    o.texto = texto;
  }else{
    const nova = { id: gerarId(), titulo, texto, favorita: false };
    ORACOES.push(nova);
    editandoId = nova.id; // passa a editar a oração recém-criada, sem sair da tela
  }

  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarToast('Oração salva com sucesso!', 'sucesso');

  // Permanece na tela de edição; apenas atualiza a referência do que é
  // "original" (para o ícone de salvar voltar ao estado neutro) e o
  // título da topbar (de "Nova oração" para "Editar oração", se for o caso)
  editorTituloOriginal = titulo;
  editorTextoOriginal = texto;
  atualizarEstadoBotaoSalvar();
  mostrarView('view-editor');
}


// mostrarToast → js/components/toast.js

// ===================== INSERIR REFERÊNCIA [Título] =====================
let posicaoCursorSalva = null;
let modoInserirOpcional = false; // true quando o modal foi aberto pelo botão "+ Leitura opcional"

function renderizarListaModalInserir(termo){
  const lista = document.getElementById('lista-modal-inserir');
  if(!lista) return;

  lista.innerHTML = '';

  const pessoais = ORACOES.filter(o => o.id !== editandoId)
    .map(o => ({ ...o, _tipo: 'pessoal' }));
  const oficiais = ORACOES_OFICIAIS.map(o => ({ ...o, _tipo: 'oficial' }));
  let disponiveis = [...pessoais, ...oficiais]
    .sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));

  const norm = normalizarBusca(termo || '');
  if(norm) disponiveis = disponiveis.filter(o => normalizarBusca(o.titulo).includes(norm));

  if(disponiveis.length === 0){
    lista.innerHTML = '<p class="dica">Nenhuma oração encontrada.</p>';
  }else{
    disponiveis.forEach(o => {
      const item = document.createElement('div');
      item.className = 'item-modal';
      item.innerHTML = `${escaparHTML(o.titulo)}${o._tipo === 'oficial' ? ' <span style="color:var(--texto-suave);font-size:0.8em;">📜 oficial</span>' : ''}`;
      item.addEventListener('click', () => {
        if(modoInserirOpcional){
          inserirReferenciaOpcional(o.titulo);
        }else{
          inserirReferencia(o.titulo);
        }
      });
      lista.appendChild(item);
    });
  }
}

function abrirModalInserir(opcional){
  modoInserirOpcional = !!opcional;

  const titulo = document.getElementById('modal-inserir-titulo');
  const dica = document.getElementById('modal-inserir-dica');
  if(modoInserirOpcional){
    titulo.textContent = 'Inserir leitura opcional';
    dica.textContent = 'Toque em uma oração para inseri-la como leitura opcional: fica oculta e fora da fala até o usuário decidir mostrar na hora de rezar.';
  }else{
    titulo.textContent = 'Inserir oração';
    dica.textContent = 'Toque em uma oração para inserir a referência a ela no texto.';
  }

  const inputTexto = document.getElementById('input-texto');
  posicaoCursorSalva = inputTexto.selectionStart;
  document.getElementById('input-busca-inserir').value = '';
  renderizarListaModalInserir('');
  document.getElementById('modal-inserir').classList.remove('hidden');
  document.getElementById('input-busca-inserir').focus();
}

function fecharModalInserir(){
  document.getElementById('modal-inserir').classList.add('hidden');
}

// Insere um marcador de pausa curta no texto, ex: "[pausa]{2}" para 2 segundos.
// Reaproveita a mesma sintaxe de citação de oração ([Título]{n}), só que
// com a palavra reservada "pausa" no lugar de um título.
function inserirPausa(){
  const inputTexto = document.getElementById('input-texto');
  const pos = inputTexto.selectionStart;
  const resposta = prompt(
    'Quantos segundos de pausa?\n(Ex: 2 para uma pequena pausa entre o fim de uma oração e o início de outra.)',
    '2'
  );
  if(resposta === null) return;

  const segundos = Math.min(Math.max(parseInt(resposta, 10) || 1, 1), 30);
  const marcador = `[pausa]{${segundos}}`;
  const antes = inputTexto.value.slice(0, pos);
  const depois = inputTexto.value.slice(pos);
  inputTexto.value = antes + marcador + depois;
  atualizarEstadoBotaoSalvar();
  inputTexto.focus();
  const novaPos = pos + marcador.length;
  inputTexto.setSelectionRange(novaPos, novaPos);
}

function inserirReferencia(titulo){
  const respostaQuantidade = prompt(
    `Quantas vezes rezar "${titulo}" aqui?\n(Ex: 10 para uma dezena. Deixe 1 para rezar uma única vez.)`,
    '1'
  );
  if(respostaQuantidade === null) return;

  const quantidade = Math.min(Math.max(parseInt(respostaQuantidade, 10) || 1, 1), 200);

  const inputTexto = document.getElementById('input-texto');
  const pos = posicaoCursorSalva != null ? posicaoCursorSalva : inputTexto.value.length;
  const referencia = quantidade > 1 ? `[${titulo}]{${quantidade}}` : `[${titulo}]`;
  const antes = inputTexto.value.slice(0, pos);
  const depois = inputTexto.value.slice(pos);
  inputTexto.value = antes + referencia + depois;
  atualizarEstadoBotaoSalvar();
  fecharModalInserir();
  inputTexto.focus();
  const novaPos = pos + referencia.length;
  inputTexto.setSelectionRange(novaPos, novaPos);
}

// ===================== TELA "REZAR" =====================
function abrirRezar(id, origem, tipo){
  oracaoAtualId = id;
  oracaoAtualTipo = tipo || 'pessoal';
  origemRezar = origem || 'home';

  const ehOficial = oracaoAtualTipo === 'oficial';
  const o = ehOficial
    ? ORACOES_OFICIAIS.find(x => x.id === id)
    : ORACOES.find(x => x.id === id);

  if(!o) return;

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

  // Aplica a classe de origem na área de ações para CSS controlar visibilidade
  const viewRezar = document.getElementById('view-rezar');
  viewRezar.dataset.origem = origemRezar;
  viewRezar.dataset.tipo = oracaoAtualTipo;

  mostrarView('view-rezar');
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

// adicionarLinhas, construirArvore, criarBtnCheck, agruparNos, renderizarNos,
// renderizarTextoRezar, marcarSecao, desmarcarSecao, limparProgressoLeitura,
// atualizarVisuaisProgresso, expandirParaElemento → js/render-tree.js

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
  const activeView = document.querySelector('.view-active');
  if (activeView && activeView.id === 'view-editor' && editandoId) {
    abrirRezar(editandoId, origemRezar, oracaoAtualTipo);
  } else {
    mostrarView('view-home');
  }
});

document.getElementById('btn-compartilhar-app').addEventListener('click', compartilharApp);

document.getElementById('fab-nova').addEventListener('click', () => abrirEditor(null));
document.getElementById('btn-salvar-topo').addEventListener('click', salvarEditor);
document.getElementById('input-titulo').addEventListener('input', atualizarEstadoBotaoSalvar);
document.getElementById('input-texto').addEventListener('input', atualizarEstadoBotaoSalvar);

document.getElementById('btn-inserir-pausa').addEventListener('click', inserirPausa);
document.getElementById('btn-inserir-oracao').addEventListener('click', abrirModalInserir);
document.getElementById('btn-fechar-modal').addEventListener('click', fecharModalInserir);
document.getElementById('btn-cancelar-exclusao').addEventListener('click', fecharModalExclusao);
document.getElementById('btn-confirmar-exclusao').addEventListener('click', confirmarExclusao);
document.getElementById('input-busca-inserir').addEventListener('input', (e) => {
  renderizarListaModalInserir(e.target.value);
});

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
verificarLinkImportacao();

// ===================== PWA: SERVICE WORKER =====================
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
