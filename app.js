// ===================== DADOS =====================
const CHAVE_STORAGE = 'minhas_oracoes_v1';

function carregarOracoes(){
  try{
    const dados = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || '[]');
    return Array.isArray(dados) ? dados : [];
  }catch(e){
    return [];
  }
}

function salvarOracoes(lista){
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(lista));
}

function gerarId(){
  return 'o_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

let ORACOES = carregarOracoes();
let editandoId = null;     // id da oração sendo editada (null = criando nova)
let oracaoAtualId = null;  // id da oração aberta na tela "Rezar"

// ===================== NAVEGAÇÃO =====================
function mostrarView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
  document.getElementById(id).classList.add('view-active');
  pararFala();
  window.scrollTo(0,0);
}

// ===================== RENDERIZAÇÃO DAS LISTAS =====================
function obterInicial(titulo){
  const t = (titulo || '').trim();
  return t ? t[0].toUpperCase() : '?';
}

function criarCardOracao(oracao){
  const card = document.createElement('div');
  card.className = 'card-oracao';
  card.innerHTML = `
    <div class="card-inicial">${escaparHTML(obterInicial(oracao.titulo))}</div>
    <div class="card-corpo">
      <h3>${escaparHTML(oracao.titulo)}</h3>
      <p>${escaparHTML(primeiraLinhaUtil(oracao.texto))}</p>
    </div>
    <button class="btn-estrela-card" aria-label="Favoritar">${oracao.favorita ? '★' : '☆'}</button>
  `;
  card.querySelector('.btn-estrela-card').addEventListener('click', (ev) => {
    ev.stopPropagation();
    alternarFavorito(oracao.id);
  });
  card.addEventListener('click', () => abrirRezar(oracao.id));
  return card;
}

function primeiraLinhaUtil(texto){
  const linha = (texto || '').split('\n').map(l => l.trim()).find(l => l.length > 0);
  return linha ? linha.replace(/^V\.\s*|^R\.\s*/,'') : '';
}

function renderizarFavoritas(){
  const lista = document.getElementById('lista-favoritas');
  const vazio = document.getElementById('empty-favoritas');
  lista.innerHTML = '';
  const favoritas = ORACOES.filter(o => o.favorita);
  if(favoritas.length === 0){
    vazio.classList.remove('hidden');
  }else{
    vazio.classList.add('hidden');
    favoritas.forEach(o => lista.appendChild(criarCardOracao(o)));
  }
}

function renderizarTodas(){
  const lista = document.getElementById('lista-todas');
  const vazio = document.getElementById('empty-todas');
  lista.innerHTML = '';
  if(ORACOES.length === 0){
    vazio.classList.remove('hidden');
  }else{
    vazio.classList.add('hidden');
    ORACOES.slice().sort((a,b)=> a.titulo.localeCompare(b.titulo, 'pt-BR'))
      .forEach(o => lista.appendChild(criarCardOracao(o)));
  }
}

function renderizarTudo(){
  renderizarFavoritas();
  renderizarTodas();
}

function alternarFavorito(id){
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;
  o.favorita = !o.favorita;
  salvarOracoes(ORACOES);
  renderizarTudo();
  if(oracaoAtualId === id) atualizarEstrelaRezar();
}

// ===================== ESCAPE DE HTML =====================
function escaparHTML(texto){
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// ===================== EDITOR (CRIAR / EDITAR) =====================
function abrirEditor(id){
  editandoId = id || null;
  const titulo = document.getElementById('editor-cabecalho');
  const inputTitulo = document.getElementById('input-titulo');
  const inputTexto = document.getElementById('input-texto');

  if(editandoId){
    const o = ORACOES.find(x => x.id === editandoId);
    titulo.textContent = 'Editar oração';
    inputTitulo.value = o ? o.titulo : '';
    inputTexto.value = o ? o.texto : '';
  }else{
    titulo.textContent = 'Nova oração';
    inputTitulo.value = '';
    inputTexto.value = '';
  }
  mostrarView('view-editor');
  inputTitulo.focus();
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

  const duplicada = ORACOES.find(o =>
    o.titulo.trim().toLowerCase() === titulo.toLowerCase() && o.id !== editandoId
  );
  if(duplicada){
    alert('Já existe uma oração com esse título. Escolha um título diferente, ou edite a oração existente.');
    return;
  }

  if(editandoId){
    const o = ORACOES.find(x => x.id === editandoId);
    o.titulo = titulo;
    o.texto = texto;
  }else{
    ORACOES.push({ id: gerarId(), titulo, texto, favorita: false });
  }

  salvarOracoes(ORACOES);
  renderizarTudo();

  if(editandoId){
    abrirRezar(editandoId);
  }else{
    const nova = ORACOES[ORACOES.length - 1];
    abrirRezar(nova.id);
  }
}

function excluirOracaoAtual(){
  if(!oracaoAtualId) return;
  const o = ORACOES.find(x => x.id === oracaoAtualId);
  if(!o) return;
  if(!confirm(`Excluir a oração "${o.titulo}"? Essa ação não pode ser desfeita.`)) return;
  ORACOES = ORACOES.filter(x => x.id !== oracaoAtualId);
  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarView('view-home');
}

// ===================== INSERIR REFERÊNCIA [Título] =====================
let posicaoCursorSalva = null;

function abrirModalInserir(){
  const inputTexto = document.getElementById('input-texto');
  posicaoCursorSalva = inputTexto.selectionStart;

  const lista = document.getElementById('lista-modal-inserir');
  lista.innerHTML = '';

  const disponiveis = ORACOES.filter(o => o.id !== editandoId)
    .slice().sort((a,b)=> a.titulo.localeCompare(b.titulo, 'pt-BR'));

  if(disponiveis.length === 0){
    lista.innerHTML = '<p class="dica">Você ainda não tem outras orações salvas para inserir aqui.</p>';
  }else{
    disponiveis.forEach(o => {
      const item = document.createElement('div');
      item.className = 'item-modal';
      item.textContent = o.titulo;
      item.addEventListener('click', () => inserirReferencia(o.titulo));
      lista.appendChild(item);
    });
  }
  document.getElementById('modal-inserir').classList.remove('hidden');
}

function fecharModalInserir(){
  document.getElementById('modal-inserir').classList.add('hidden');
}

function inserirReferencia(titulo){
  const respostaQuantidade = prompt(
    `Quantas vezes rezar "${titulo}" aqui?\n(Ex: 10 para uma dezena. Deixe 1 para rezar uma única vez.)`,
    '1'
  );
  if(respostaQuantidade === null) return; // usuário cancelou

  const quantidade = Math.min(Math.max(parseInt(respostaQuantidade, 10) || 1, 1), 200);

  const inputTexto = document.getElementById('input-texto');
  const pos = posicaoCursorSalva != null ? posicaoCursorSalva : inputTexto.value.length;
  const referencia = quantidade > 1 ? `[${titulo}]{${quantidade}}` : `[${titulo}]`;
  const antes = inputTexto.value.slice(0, pos);
  const depois = inputTexto.value.slice(pos);
  inputTexto.value = antes + referencia + depois;
  fecharModalInserir();
  inputTexto.focus();
  const novaPos = pos + referencia.length;
  inputTexto.setSelectionRange(novaPos, novaPos);
}

// ===================== TELA "REZAR" =====================
function abrirRezar(id){
  oracaoAtualId = id;
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;

  document.getElementById('rezar-titulo').textContent = o.titulo;
  atualizarEstrelaRezar();
  renderizarTextoRezar(o.texto);
  mostrarView('view-rezar');
}

function atualizarEstrelaRezar(){
  const o = ORACOES.find(x => x.id === oracaoAtualId);
  document.getElementById('btn-favoritar-rezar').textContent = (o && o.favorita) ? '★' : '☆';
}

// Expande [Título] e [Título]{N} recursivamente, evitando referência circular
function expandirTexto(texto, titulosVisitados){
  return (texto || '').replace(/\[([^\[\]]+)\](?:\{(\d+)\})?/g, (match, tituloRef, quantStr) => {
    const nomeBuscado = tituloRef.trim().toLowerCase();
    if(titulosVisitados.has(nomeBuscado)){
      return `(referência circular: ${tituloRef})`;
    }
    const encontrada = ORACOES.find(o => o.titulo.trim().toLowerCase() === nomeBuscado);
    if(!encontrada){
      return `(oração "${tituloRef}" não encontrada)`;
    }

    const quantidade = Math.min(Math.max(parseInt(quantStr || '1', 10) || 1, 1), 200);
    const novosVisitados = new Set(titulosVisitados);
    novosVisitados.add(nomeBuscado);
    const conteudo = expandirTexto(encontrada.texto, novosVisitados);

    let blocos = '';
    for(let i = 1; i <= quantidade; i++){
      const rotulo = quantidade > 1 ? `${encontrada.titulo} — ${i}/${quantidade}` : encontrada.titulo;
      blocos += `\n[[INICIO_REF:${rotulo}]]\n${conteudo}\n[[FIM_REF]]\n`;
    }
    return blocos;
  });
}

function renderizarTextoRezar(textoOriginal){
  const container = document.getElementById('rezar-texto');
  const expandido = expandirTexto(textoOriginal, new Set());
  const linhas = expandido.split('\n');
  container.innerHTML = '';

  let dentroDeReferencia = false;

  linhas.forEach(linhaBruta => {
    const linha = linhaBruta.trim();
    if(linha === '') return;

    if(linha.startsWith('[[INICIO_REF:')){
      dentroDeReferencia = true;
      const nomeRef = linha.replace('[[INICIO_REF:','').replace(']]','');
      const titulo = document.createElement('p');
      titulo.className = 'linha-ref';
      titulo.textContent = nomeRef;
      container.appendChild(titulo);
      return;
    }
    if(linha === '[[FIM_REF]]'){
      dentroDeReferencia = false;
      return;
    }

    const p = document.createElement('p');
    if(linha.startsWith('V.')){
      p.className = 'linha-v';
    }else if(linha.startsWith('R.')){
      p.className = 'linha-r';
    }else if(dentroDeReferencia){
      p.className = 'linha-ref';
    }
    p.textContent = linha;
    container.appendChild(p);
  });

  if(container.innerHTML === ''){
    container.innerHTML = '<p class="dica">Esta oração ainda não tem texto. Toque em "Editar" para escrever.</p>';
  }
}

// ===================== VOZES (uma para V., outra para R.) =====================
const CHAVE_VOZES = 'minhas_oracoes_vozes_v1';
let configVozes = JSON.parse(localStorage.getItem(CHAVE_VOZES) || 'null') || { v: null, r: null };

function salvarConfigVozes(){
  localStorage.setItem(CHAVE_VOZES, JSON.stringify(configVozes));
}

// As vozes do navegador às vezes demoram a carregar; espera elas ficarem prontas
function aguardarVozesDisponiveis(){
  return new Promise((resolve) => {
    if(!('speechSynthesis' in window)){ resolve([]); return; }
    const vozesAtuais = window.speechSynthesis.getVoices();
    if(vozesAtuais.length){ resolve(vozesAtuais); return; }
    const aoMudar = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', aoMudar);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', aoMudar);
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

function ordenarVozesPtPrimeiro(vozes){
  return vozes.slice().sort((a,b) => {
    const aPt = a.lang.toLowerCase().startsWith('pt') ? 0 : 1;
    const bPt = b.lang.toLowerCase().startsWith('pt') ? 0 : 1;
    if(aPt !== bPt) return aPt - bPt;
    return a.name.localeCompare(b.name);
  });
}

// Escolhe duas vozes diferentes automaticamente, priorizando português
function escolherVozesAutomaticas(vozes){
  const portugues = vozes.filter(v => v.lang.toLowerCase().startsWith('pt'));
  if(portugues.length >= 2) return { v: portugues[0].name, r: portugues[1].name };
  if(portugues.length === 1) return { v: portugues[0].name, r: portugues[0].name };
  if(vozes.length >= 2) return { v: vozes[0].name, r: vozes[1].name };
  if(vozes.length === 1) return { v: vozes[0].name, r: vozes[0].name };
  return { v: null, r: null };
}

async function abrirConfigVozes(){
  const vozes = await aguardarVozesDisponiveis();

  if(!configVozes.v && !configVozes.r && vozes.length){
    configVozes = escolherVozesAutomaticas(vozes);
    salvarConfigVozes();
  }

  const ordenadas = ordenarVozesPtPrimeiro(vozes);
  const selV = document.getElementById('select-voz-v');
  const selR = document.getElementById('select-voz-r');
  selV.innerHTML = '';
  selR.innerHTML = '';

  if(ordenadas.length === 0){
    selV.innerHTML = '<option value="">Nenhuma voz encontrada no aparelho</option>';
    selR.innerHTML = '<option value="">Nenhuma voz encontrada no aparelho</option>';
  }else{
    ordenadas.forEach(v => {
      const rotulo = `${v.name} (${v.lang})`;

      const optV = document.createElement('option');
      optV.value = v.name;
      optV.textContent = rotulo;
      if(v.name === configVozes.v) optV.selected = true;
      selV.appendChild(optV);

      const optR = document.createElement('option');
      optR.value = v.name;
      optR.textContent = rotulo;
      if(v.name === configVozes.r) optR.selected = true;
      selR.appendChild(optR);
    });
  }

  document.getElementById('modal-vozes').classList.remove('hidden');
}

function fecharModalVozes(){
  document.getElementById('modal-vozes').classList.add('hidden');
}

function salvarConfigVozesModal(){
  const selV = document.getElementById('select-voz-v');
  const selR = document.getElementById('select-voz-r');
  configVozes = { v: selV.value || null, r: selR.value || null };
  salvarConfigVozes();
  fecharModalVozes();
}

// ===================== FALAR EM VOZ ALTA (Web Speech API) =====================
let filaFala = [];
let indiceFalaAtual = 0;
let falando = false;
let pausado = false;

function obterLinhasParaFalar(){
  const paragrafos = document.querySelectorAll('#rezar-texto p');
  const linhas = [];
  paragrafos.forEach(p => {
    if(p.classList.contains('linha-ref')) return; // título de referência não é falado
    let texto = p.textContent.replace(/^V\.\s*/,'').replace(/^R\.\s*/,'').trim();
    if(texto) linhas.push({ elemento: p, texto, voz2: p.classList.contains('linha-r') });
  });
  return linhas;
}

// Decide o que o botão deve fazer de acordo com o estado atual
async function alternarFala(){
  if(!('speechSynthesis' in window)){
    alert('Seu navegador não tem suporte a leitura em voz alta.');
    return;
  }

  if(!falando){
    await iniciarFala();
  }else if(pausado){
    continuarFala();
  }else{
    pausarFala();
  }
}

async function iniciarFala(){
  const vozesDisponiveis = await aguardarVozesDisponiveis();
  if(!configVozes.v && !configVozes.r && vozesDisponiveis.length){
    configVozes = escolherVozesAutomaticas(vozesDisponiveis);
    salvarConfigVozes();
  }

  filaFala = obterLinhasParaFalar();
  if(filaFala.length === 0) return;

  indiceFalaAtual = 0;
  falando = true;
  pausado = false;
  atualizarBotaoFala();
  falarProximaLinha();
}

function pausarFala(){
  if(!falando || pausado) return;
  window.speechSynthesis.pause();
  pausado = true;
  atualizarBotaoFala();
}

function continuarFala(){
  if(!falando || !pausado) return;
  window.speechSynthesis.resume();
  pausado = false;
  atualizarBotaoFala();
}

function atualizarBotaoFala(){
  const btn = document.getElementById('btn-falar');
  if(!btn) return;
  if(!falando){
    btn.textContent = '🔊 Rezar em voz alta';
    btn.classList.remove('tocando');
  }else if(pausado){
    btn.textContent = '▶ Continuar';
    btn.classList.add('tocando');
  }else{
    btn.textContent = '⏸ Pausar';
    btn.classList.add('tocando');
  }
}

function falarProximaLinha(){
  document.querySelectorAll('.linha-falando').forEach(el => el.classList.remove('linha-falando'));

  if(!falando || indiceFalaAtual >= filaFala.length){
    pararFala();
    return;
  }

  const item = filaFala[indiceFalaAtual];
  item.elemento.classList.add('linha-falando');
  item.elemento.scrollIntoView({ behavior:'smooth', block:'center' });

  const utterancia = new SpeechSynthesisUtterance(item.texto);
  utterancia.lang = 'pt-BR';
  utterancia.rate = 0.95;

  const vozes = window.speechSynthesis.getVoices();
  const nomeVozDesejada = item.voz2 ? configVozes.r : configVozes.v;
  const vozEncontrada = nomeVozDesejada ? vozes.find(v => v.name === nomeVozDesejada) : null;

  if(vozEncontrada){
    utterancia.voice = vozEncontrada;
    utterancia.pitch = 1.0;
  }else{
    // Contingência: não há duas vozes distintas disponíveis, diferencia pelo tom
    utterancia.pitch = item.voz2 ? 1.25 : 1.0;
  }

  utterancia.onend = () => {
    if(!falando || pausado) return;
    indiceFalaAtual++;
    falarProximaLinha();
  };
  utterancia.onerror = () => {
    falando = false;
  };

  window.speechSynthesis.speak(utterancia);
}

function pararFala(){
  falando = false;
  pausado = false;
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.querySelectorAll('.linha-falando').forEach(el => el.classList.remove('linha-falando'));
  atualizarBotaoFala();
}

// ===================== LIGAÇÃO DOS BOTÕES =====================
document.getElementById('btn-ver-todas').addEventListener('click', () => mostrarView('view-todas'));
document.querySelectorAll('[data-voltar]').forEach(btn => {
  btn.addEventListener('click', () => mostrarView(btn.dataset.voltar));
});

document.getElementById('fab-nova').addEventListener('click', () => abrirEditor(null));
document.getElementById('btn-cancelar-editor').addEventListener('click', () => {
  mostrarView(editandoId ? 'view-rezar' : 'view-home');
});
document.getElementById('btn-salvar').addEventListener('click', salvarEditor);

document.getElementById('btn-inserir-oracao').addEventListener('click', abrirModalInserir);
document.getElementById('btn-fechar-modal').addEventListener('click', fecharModalInserir);

document.getElementById('btn-voltar-rezar').addEventListener('click', () => mostrarView('view-home'));
document.getElementById('btn-favoritar-rezar').addEventListener('click', () => {
  if(oracaoAtualId) alternarFavorito(oracaoAtualId);
});
document.getElementById('btn-editar-atual').addEventListener('click', () => abrirEditor(oracaoAtualId));
document.getElementById('btn-excluir-atual').addEventListener('click', excluirOracaoAtual);
document.getElementById('btn-falar').addEventListener('click', alternarFala);
document.getElementById('btn-config-vozes').addEventListener('click', abrirConfigVozes);
document.getElementById('btn-fechar-modal-vozes').addEventListener('click', fecharModalVozes);
document.getElementById('btn-salvar-vozes').addEventListener('click', salvarConfigVozesModal);

// ===================== INICIALIZAÇÃO =====================
renderizarTudo();

// ===================== PWA: SERVICE WORKER =====================
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
