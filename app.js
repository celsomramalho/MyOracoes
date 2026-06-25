// ===================== DADOS PESSOAIS =====================
const CHAVE_STORAGE = 'minhas_oracoes_v1';
const CHAVE_FAVORITAS_OFICIAIS = 'minhas_oracoes_oficiais_favoritas_v1';
const CHAVE_VOZES = 'minhas_oracoes_vozes_v1';
const CHAVE_REZADAS_DIARIAMENTE = 'minhas_oracoes_rezadas_diarias_v1';

function obterDataLocalHoje() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function carregarRezadasDiarias() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_REZADAS_DIARIAMENTE) || '{}');
    const hoje = obterDataLocalHoje();
    if (dados.data === hoje) {
      return dados.ids || {};
    } else {
      const novo = { data: hoje, ids: {} };
      salvarRezadasDiarias(novo);
      return novo.ids;
    }
  } catch (e) {
    return {};
  }
}

function salvarRezadasDiarias(dados) {
  localStorage.setItem(CHAVE_REZADAS_DIARIAMENTE, JSON.stringify(dados));
}

let rezadasDiarias = carregarRezadasDiarias();

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

function carregarFavoritasOficiais(){
  try{
    const dados = JSON.parse(localStorage.getItem(CHAVE_FAVORITAS_OFICIAIS) || '[]');
    return Array.isArray(dados) ? dados : [];
  }catch(e){
    return [];
  }
}

function salvarFavoritasOficiais(ids){
  localStorage.setItem(CHAVE_FAVORITAS_OFICIAIS, JSON.stringify(ids));
}

function gerarId(){
  return 'o_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

let ORACOES = carregarOracoes();
let ORACOES_OFICIAIS = [];       // carregado via fetch
let favoritasOficiaisIds = carregarFavoritasOficiais();
let editandoId = null;     // id da oração sendo editada (null = criando nova)
let oracaoAtualId = null;  // id da oração aberta na tela "Rezar"
let oracaoAtualTipo = 'pessoal'; // 'pessoal' ou 'oficial'
let origemRezar = 'home';  // 'home', 'todas' ou 'oficiais'

// ===================== CARREGAMENTO DAS OFICIAIS =====================
async function carregarOficiais(){
  try{
    const res = await fetch('./oracoes-oficiais.json');
    if(res.ok){
      const dados = await res.json();
      ORACOES_OFICIAIS = Array.isArray(dados) ? dados : [];
    }
  }catch(e){
    ORACOES_OFICIAIS = [];
  }
  renderizarOficiais();
  renderizarFavoritas(); // re-renderiza home para incluir favoritas oficiais
  renderizarListaModalInserir(); // atualiza modal de inserir se estiver aberto
}

// ===================== NAVEGAÇÃO =====================
function mostrarView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
  document.getElementById(id).classList.add('view-active');
  pararFala();
  window.scrollTo(0,0);
}

// ===================== ESCAPE DE HTML =====================
function escaparHTML(texto){
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// ===================== RENDERIZAÇÃO DAS LISTAS =====================
function obterInicial(titulo){
  const t = (titulo || '').trim();
  return t ? t[0].toUpperCase() : '?';
}

function primeiraLinhaUtil(texto){
  const linha = (texto || '').split('\n').map(l => l.trim()).find(l => l.length > 0);
  return linha ? linha.replace(/^V\.\s*|^R\.\s*/,'') : '';
}

function criarCardOracao(oracao, origem, tipo){
  const ehOficial = tipo === 'oficial';
  const ehFavorita = ehOficial
    ? favoritasOficiaisIds.includes(oracao.id)
    : !!oracao.favorita;

  const card = document.createElement('div');
  card.className = 'card-oracao';

  // Badge de oficial
  const badgeOficial = ehOficial
    ? `<span class="badge-oficial" title="Oração Oficial">📜</span>`
    : '';

  // Badge de rezada hoje
  const horaRezada = rezadasDiarias[oracao.id];
  const badgeRezada = horaRezada
    ? `<span class="badge-rezada" title="Rezada hoje às ${horaRezada}">✓ ${horaRezada}</span>`
    : '';

  card.innerHTML = `
    <div class="card-inicial">${escaparHTML(obterInicial(oracao.titulo))}</div>
    <div class="card-corpo">
      <h3>${escaparHTML(oracao.titulo)}${badgeOficial}${badgeRezada}</h3>
      <p>${escaparHTML(primeiraLinhaUtil(oracao.texto))}</p>
    </div>
    <button class="btn-estrela-card" aria-label="Favoritar">${ehFavorita ? '★' : '☆'}</button>
  `;

  card.querySelector('.btn-estrela-card').addEventListener('click', (ev) => {
    ev.stopPropagation();
    if(ehOficial){
      alternarFavoritoOficial(oracao.id);
    } else {
      alternarFavorito(oracao.id);
    }
  });

  card.addEventListener('click', () => abrirRezar(oracao.id, origem, tipo || 'pessoal'));
  return card;
}

function renderizarFavoritas(){
  const lista = document.getElementById('lista-favoritas');
  const vazio = document.getElementById('empty-favoritas');
  lista.innerHTML = '';

  const pessoaisFav = ORACOES.filter(o => o.favorita);
  const oficaisFav = ORACOES_OFICIAIS.filter(o => favoritasOficiaisIds.includes(o.id));
  const todasFav = [
    ...pessoaisFav.map(o => ({ ...o, _tipo: 'pessoal' })),
    ...oficaisFav.map(o => ({ ...o, _tipo: 'oficial' })),
  ].sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));

  if(todasFav.length === 0){
    vazio.classList.remove('hidden');
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

function renderizarOficiais(){
  const lista = document.getElementById('lista-oficiais');
  const vazio = document.getElementById('empty-oficiais');
  lista.innerHTML = '';
  if(ORACOES_OFICIAIS.length === 0){
    vazio.classList.remove('hidden');
  }else{
    vazio.classList.add('hidden');
    ORACOES_OFICIAIS.slice().sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
      .forEach(o => lista.appendChild(criarCardOracao(o, 'oficiais', 'oficial')));
  }
}

function renderizarTudo(){
  renderizarFavoritas();
  renderizarTodas();
  renderizarOficiais();
}

function atualizarProgressoDiario(){
  const container = document.getElementById('progresso-diario');
  if(!container) return;

  const pessoaisFav = ORACOES.filter(o => o.favorita);
  const oficiaisFav = ORACOES_OFICIAIS.filter(o => favoritasOficiaisIds.includes(o.id));
  const todasFav = [
    ...pessoaisFav.map(o => ({ ...o, _tipo: 'pessoal' })),
    ...oficaisFav.map(o => ({ ...o, _tipo: 'oficial' })),
  ];

  const total = todasFav.length > 0 ? todasFav.length : (ORACOES.length + ORACOES_OFICIAIS.length);
  const rezados = todasFav.length > 0
    ? todasFav.filter(o => rezadasDiarias[o.id]).length
    : Object.keys(rezadasDiarias).length;

  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  const percent = Math.round((rezados / total) * 100);

  container.innerHTML = `
    <div class="progresso-diario-info">
      <span>${rezados} de ${total} orações rezadas hoje</span>
      <span>${percent}%</span>
    </div>
    <div class="progresso-diario-barra">
      <div class="progresso-diario-preenchimento" style="width: ${percent}%"></div>
    </div>
  `;
}

function alternarFavorito(id){
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;
  o.favorita = !o.favorita;
  salvarOracoes(ORACOES);
  renderizarFavoritas();
  renderizarTodas();
  if(oracaoAtualId === id) atualizarEstrelaRezar();
}

function alternarFavoritoOficial(id){
  const idx = favoritasOficiaisIds.indexOf(id);
  if(idx === -1){
    favoritasOficiaisIds.push(id);
  }else{
    favoritasOficiaisIds.splice(idx, 1);
  }
  salvarFavoritasOficiais(favoritasOficiaisIds);
  renderizarFavoritas();
  renderizarOficiais();
  if(oracaoAtualId === id) atualizarEstrelaRezar();
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

  // Verifica duplicata em pessoais E oficiais
  const nomeLower = titulo.toLowerCase();
  const duplicadaPessoal = ORACOES.find(o =>
    o.titulo.trim().toLowerCase() === nomeLower && o.id !== editandoId
  );
  const duplicadaOficial = ORACOES_OFICIAIS.find(o =>
    o.titulo.trim().toLowerCase() === nomeLower
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
    ORACOES.push({ id: gerarId(), titulo, texto, favorita: false });
  }

  salvarOracoes(ORACOES);
  renderizarTudo();

  if(editandoId){
    abrirRezar(editandoId, 'todas', 'pessoal');
  }else{
    const nova = ORACOES[ORACOES.length - 1];
    abrirRezar(nova.id, 'todas', 'pessoal');
  }
}

function excluirOracaoAtual(){
  if(!oracaoAtualId || oracaoAtualTipo !== 'pessoal') return;
  const o = ORACOES.find(x => x.id === oracaoAtualId);
  if(!o) return;
  if(!confirm(`Excluir a oração "${o.titulo}"? Essa ação não pode ser desfeita.`)) return;
  ORACOES = ORACOES.filter(x => x.id !== oracaoAtualId);
  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarView('view-home');
}

// ===================== TOAST NOTIFICAÇÃO =====================
function mostrarToast(msg, tipo){
  let toast = document.getElementById('toast-notificacao');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toast-notificacao';
    document.getElementById('app').appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast-notificacao' + (tipo === 'sucesso' ? ' toast-sucesso' : '');
  toast.classList.add('toast-visivel');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('toast-visivel'), 3500);
}

// ===================== INSERIR REFERÊNCIA [Título] =====================
let posicaoCursorSalva = null;

function renderizarListaModalInserir(){
  const lista = document.getElementById('lista-modal-inserir');
  if(!lista) return;

  lista.innerHTML = '';

  const pessoais = ORACOES.filter(o => o.id !== editandoId)
    .map(o => ({ ...o, _tipo: 'pessoal' }));
  const oficiais = ORACOES_OFICIAIS.map(o => ({ ...o, _tipo: 'oficial' }));
  const disponiveis = [...pessoais, ...oficiais]
    .sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));

  if(disponiveis.length === 0){
    lista.innerHTML = '<p class="dica">Você ainda não tem outras orações salvas para inserir aqui.</p>';
  }else{
    disponiveis.forEach(o => {
      const item = document.createElement('div');
      item.className = 'item-modal';
      item.innerHTML = `${escaparHTML(o.titulo)}${o._tipo === 'oficial' ? ' <span style="color:var(--texto-suave);font-size:0.8em;">📜 oficial</span>' : ''}`;
      item.addEventListener('click', () => inserirReferencia(o.titulo));
      lista.appendChild(item);
    });
  }
}

function abrirModalInserir(){
  const inputTexto = document.getElementById('input-texto');
  posicaoCursorSalva = inputTexto.selectionStart;
  renderizarListaModalInserir();
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
  if(respostaQuantidade === null) return;

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
function abrirRezar(id, origem, tipo){
  oracaoAtualId = id;
  oracaoAtualTipo = tipo || 'pessoal';
  origemRezar = origem || 'home';

  const ehOficial = oracaoAtualTipo === 'oficial';
  const o = ehOficial
    ? ORACOES_OFICIAIS.find(x => x.id === id)
    : ORACOES.find(x => x.id === id);

  if(!o) return;

  document.getElementById('rezar-titulo').textContent = o.titulo;
  atualizarEstrelaRezar();
  atualizarBotaoMarcarRezada();
  renderizarTextoRezar(o.texto);

  // Esconder/mostrar botões de editar/excluir/compartilhar conforme tipo
  const botoesEditarExcluir = document.querySelectorAll('.editar-excluir');
  botoesEditarExcluir.forEach(btn => {
    btn.style.display = ehOficial ? 'none' : '';
  });

  // Botão compartilhar: apenas em pessoais
  const btnCompartilhar = document.getElementById('btn-compartilhar-atual');
  if(btnCompartilhar) btnCompartilhar.style.display = ehOficial ? 'none' : '';

  // Badge de oficial na tela de rezar
  const badgeRezar = document.getElementById('badge-rezar-oficial');
  if(badgeRezar) badgeRezar.style.display = ehOficial ? 'inline' : 'none';

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
  if(rezada){
    btn.textContent = `✓ Rezada hoje às ${rezadasDiarias[oracaoAtualId]}`;
    btn.classList.add('rezada-ativo');
  }else{
    btn.textContent = `✓ Marcar como rezada`;
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

// ===================== ÁRVORE DE NÓS PARA RENDERIZAÇÃO =====================
// Cada nó é um dos tipos:
//   { tipo: 'linha', texto, classe }        — linha V., R. ou texto livre
//   { tipo: 'bloco', rotulo, filhos }        — referência expansível ([Título]{N})
//   { tipo: 'erro', texto }                  — referência circular ou não encontrada

function adicionarLinhas(nos, texto){
  texto.split('\n').forEach(linhaBruta => {
    const linha = linhaBruta.trim();
    if(!linha) return;
    let classe = '';
    if(linha.startsWith('V.'))       classe = 'linha-v';
    else if(linha.startsWith('R.')) classe = 'linha-r';
    nos.push({ tipo: 'linha', texto: linha, classe });
  });
}

function construirArvore(texto, titulosVisitados){
  const nos = [];
  const regex = /\[([^\[\]]+)\](?:\{(\d+)\})?/g;
  let ultimoIndice = 0;
  let match;

  while((match = regex.exec(texto || '')) !== null){
    // Texto antes do padrão → linhas normais
    const textoBefore = texto.slice(ultimoIndice, match.index);
    if(textoBefore) adicionarLinhas(nos, textoBefore);

    const tituloRef = match[1].trim();
    const nomeLower = tituloRef.toLowerCase();
    const quantidade = Math.min(Math.max(parseInt(match[2] || '1', 10) || 1, 1), 200);

    if(titulosVisitados.has(nomeLower)){
      nos.push({ tipo: 'erro', texto: `(referência circular: ${tituloRef})` });
    }else{
      const encontrada =
        ORACOES.find(o => o.titulo.trim().toLowerCase() === nomeLower) ||
        ORACOES_OFICIAIS.find(o => o.titulo.trim().toLowerCase() === nomeLower);

      if(!encontrada){
        nos.push({ tipo: 'erro', texto: `(oração "${tituloRef}" não encontrada)` });
      }else{
        const novosVisitados = new Set(titulosVisitados);
        novosVisitados.add(nomeLower);
        for(let i = 1; i <= quantidade; i++){
          const rotulo = quantidade > 1
            ? `${encontrada.titulo} — ${i}/${quantidade}`
            : encontrada.titulo;
          const filhos = construirArvore(encontrada.texto, novosVisitados);
          nos.push({ tipo: 'bloco', rotulo, filhos });
        }
      }
    }

    ultimoIndice = match.index + match[0].length;
  }

  // Texto restante depois do último padrão
  const textoFinal = texto ? texto.slice(ultimoIndice) : '';
  if(textoFinal) adicionarLinhas(nos, textoFinal);

  return nos;
}

function renderizarNos(nos, container){
  nos.forEach(no => {
    if(no.tipo === 'linha'){
      const p = document.createElement('p');
      if(no.classe) p.className = no.classe;
      p.textContent = no.texto;
      container.appendChild(p);

    }else if(no.tipo === 'bloco'){
      const divBloco = document.createElement('div');
      divBloco.className = 'bloco-ref';

      const divTitulo = document.createElement('div');
      divTitulo.className = 'bloco-ref-titulo';
      const icone = document.createElement('span');
      icone.className = 'bloco-ref-icone';
      icone.textContent = '▸';
      divTitulo.appendChild(icone);
      divTitulo.appendChild(document.createTextNode(' ' + no.rotulo));

      const divConteudo = document.createElement('div');
      divConteudo.className = 'bloco-ref-conteudo';

      divTitulo.addEventListener('click', () => {
        const aberto = divBloco.classList.toggle('aberto');
        icone.textContent = aberto ? '▾' : '▸';
      });

      renderizarNos(no.filhos, divConteudo);
      divBloco.appendChild(divTitulo);
      divBloco.appendChild(divConteudo);
      container.appendChild(divBloco);

    }else if(no.tipo === 'erro'){
      const p = document.createElement('p');
      p.className = 'linha-ref';
      p.style.opacity = '0.6';
      p.textContent = no.texto;
      container.appendChild(p);
    }
  });
}

function renderizarTextoRezar(textoOriginal){
  const container = document.getElementById('rezar-texto');
  container.innerHTML = '';

  const arvore = construirArvore(textoOriginal, new Set());
  renderizarNos(arvore, container);

  if(container.innerHTML === ''){
    container.innerHTML = '<p class="dica">Esta oração ainda não tem texto. Toque em "Editar" para escrever.</p>';
  }
}

// Expande todos os blocos-ref ancestrais de um elemento (usado pela fala em voz alta)
function expandirParaElemento(el){
  let pai = el.parentElement;
  while(pai && pai.id !== 'rezar-texto'){
    if(pai.classList.contains('bloco-ref') && !pai.classList.contains('aberto')){
      pai.classList.add('aberto');
      const icone = pai.querySelector(':scope > .bloco-ref-titulo > .bloco-ref-icone');
      if(icone) icone.textContent = '▾';
    }
    pai = pai.parentElement;
  }
}

// ===================== EXPORTAR / IMPORTAR ORAÇÕES PESSOAIS =====================
function exportarOracoes(){
  const dados = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    oracoes: ORACOES
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `minhas-oracoes-backup-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('Arquivo de backup baixado!', 'sucesso');
}

function importarOracoesDeArquivo(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const arquivo = input.files[0];
    if(!arquivo) return;
    try{
      const texto = await arquivo.text();
      const dados = JSON.parse(texto);

      // Aceita tanto array direto quanto o formato com wrapper { oracoes: [...] }
      let lista = Array.isArray(dados) ? dados : dados.oracoes;
      if(!Array.isArray(lista)){
        mostrarToast('Arquivo inválido. Certifique-se de usar um backup gerado por este app.');
        return;
      }

      let importadas = 0;
      const bloqueadas = [];

      lista.forEach(o => {
        if(!o.titulo || typeof o.titulo !== 'string') return;
        const nomeLower = o.titulo.trim().toLowerCase();

        const duplicadaPessoal = ORACOES.find(x => x.titulo.trim().toLowerCase() === nomeLower);
        const duplicadaOficial = ORACOES_OFICIAIS.find(x => x.titulo.trim().toLowerCase() === nomeLower);

        if(duplicadaPessoal || duplicadaOficial){
          bloqueadas.push(o.titulo);
          return;
        }

        ORACOES.push({
          id: gerarId(),
          titulo: o.titulo.trim(),
          texto: o.texto || '',
          favorita: !!o.favorita
        });
        importadas++;
      });

      salvarOracoes(ORACOES);
      renderizarTudo();

      let msg = '';
      if(importadas > 0) msg += `${importadas} oração(ões) importada(s) com sucesso!`;
      if(bloqueadas.length > 0){
        msg += `${msg ? '\n' : ''}${bloqueadas.length} bloqueada(s) por título já existente: "${bloqueadas.join('", "')}"`;
      }
      if(!msg) msg = 'Nenhuma oração nova encontrada no arquivo.';
      mostrarToast(msg, importadas > 0 ? 'sucesso' : '');

    }catch(e){
      mostrarToast('Erro ao ler o arquivo. Certifique-se de que é um JSON válido.');
    }
  });
  input.click();
}

// ===================== COMPARTILHAR VIA LINK MÁGICO =====================
function compartilharOracao(id){
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;

  try{
    // Codificação segura para UTF-8 (suporta acentos do português)
    const dadosStr = JSON.stringify({ titulo: o.titulo, texto: o.texto });
    const base64 = btoa(unescape(encodeURIComponent(dadosStr)));
    const link = `${window.location.origin}${window.location.pathname}?importar=${base64}`;

    const texto = `Quero compartilhar esta oração com você pelo app Minhas Orações:\n\n"${o.titulo}"\n\n${link}`;

    if(navigator.share){
      navigator.share({ title: o.titulo, text: texto }).catch(() => {
        copiarParaClipboard(link);
      });
    }else{
      // Fallback: WhatsApp Web
      const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(urlWhatsApp, '_blank');
    }
  }catch(e){
    mostrarToast('Não foi possível gerar o link de compartilhamento.');
  }
}

function copiarParaClipboard(texto){
  navigator.clipboard.writeText(texto).then(() => {
    mostrarToast('Link copiado para a área de transferência!', 'sucesso');
  }).catch(() => {
    mostrarToast('Não foi possível copiar o link automaticamente.');
  });
}

// ===================== RECEBER LINK MÁGICO (?importar=...) =====================
function verificarLinkImportacao(){
  const params = new URLSearchParams(window.location.search);
  const base64 = params.get('importar');
  if(!base64) return;

  // Limpa o parâmetro da URL sem recarregar a página
  const urlLimpa = window.location.pathname;
  history.replaceState(null, '', urlLimpa);

  try{
    const dadosStr = decodeURIComponent(escape(atob(base64)));
    const dados = JSON.parse(dadosStr);

    if(!dados.titulo || typeof dados.titulo !== 'string'){
      mostrarToast('Link inválido ou corrompido.');
      return;
    }

    // Aguarda ORACOES_OFICIAIS ser carregado antes de exibir o modal
    // (pode já estar carregado ou não; o modal lida com isso)
    exibirModalImportacaoLink(dados.titulo, dados.texto || '');
  }catch(e){
    mostrarToast('Não foi possível ler os dados do link de compartilhamento.');
  }
}

function exibirModalImportacaoLink(titulo, texto){
  const modal = document.getElementById('modal-importar-link');
  if(!modal) return;

  document.getElementById('importar-link-titulo').textContent = `"${titulo}"`;
  modal.classList.remove('hidden');

  // Remove listeners antigos para evitar duplicação
  const btnSim = document.getElementById('btn-importar-link-sim');
  const btnNao = document.getElementById('btn-importar-link-nao');
  const novoSim = btnSim.cloneNode(true);
  const novoNao = btnNao.cloneNode(true);
  btnSim.parentNode.replaceChild(novoSim, btnSim);
  btnNao.parentNode.replaceChild(novoNao, btnNao);

  novoSim.addEventListener('click', () => {
    modal.classList.add('hidden');
    importarUmaOracao(titulo, texto);
  });
  novoNao.addEventListener('click', () => modal.classList.add('hidden'));
}

function importarUmaOracao(titulo, texto){
  const nomeLower = titulo.trim().toLowerCase();
  const duplicadaPessoal = ORACOES.find(o => o.titulo.trim().toLowerCase() === nomeLower);
  const duplicadaOficial = ORACOES_OFICIAIS.find(o => o.titulo.trim().toLowerCase() === nomeLower);

  if(duplicadaPessoal || duplicadaOficial){
    mostrarToast(`Já existe uma oração com o título "${titulo}"${duplicadaOficial ? ' (oficial)' : ''}. Importação cancelada.`);
    return;
  }

  ORACOES.push({ id: gerarId(), titulo: titulo.trim(), texto: texto || '', favorita: false });
  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarToast(`Oração "${titulo}" adicionada às suas orações!`, 'sucesso');
}

// ===================== VOZES (uma para V., outra para R.) =====================
let configVozes = JSON.parse(localStorage.getItem(CHAVE_VOZES) || 'null') || { v: null, r: null };

function salvarConfigVozes(){
  localStorage.setItem(CHAVE_VOZES, JSON.stringify(configVozes));
}

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
    if(p.classList.contains('linha-ref')) return;
    let texto = p.textContent.replace(/^V\.\s*/,'').replace(/^R\.\s*/,'').trim();
    if(texto) linhas.push({ elemento: p, texto, voz2: p.classList.contains('linha-r') });
  });
  return linhas;
}

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
    if(falando && oracaoAtualId && !rezadasDiarias[oracaoAtualId]){
      const hoje = obterDataLocalHoje();
      const d = new Date();
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      rezadasDiarias[oracaoAtualId] = `${hora}:${min}`;
      salvarRezadasDiarias({ data: hoje, ids: rezadasDiarias });
      atualizarBotaoMarcarRezada();
      renderizarTudo();
      atualizarProgressoDiario();
      mostrarToast('Oração concluída e marcada como rezada!', 'sucesso');
    }
    pararFala();
    return;
  }

  const item = filaFala[indiceFalaAtual];
  // Expande blocos recolhidos que contenham a linha atual antes de destacar
  expandirParaElemento(item.elemento);
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
document.getElementById('btn-ver-oficiais').addEventListener('click', () => mostrarView('view-oficiais'));

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

document.getElementById('btn-voltar-rezar').addEventListener('click', () => {
  if(origemRezar === 'todas') mostrarView('view-todas');
  else if(origemRezar === 'oficiais') mostrarView('view-oficiais');
  else mostrarView('view-home');
});
document.getElementById('btn-favoritar-rezar').addEventListener('click', () => {
  if(!oracaoAtualId) return;
  if(oracaoAtualTipo === 'oficial'){
    alternarFavoritoOficial(oracaoAtualId);
  }else{
    alternarFavorito(oracaoAtualId);
  }
});
document.getElementById('btn-editar-atual').addEventListener('click', () => abrirEditor(oracaoAtualId));
document.getElementById('btn-excluir-atual').addEventListener('click', excluirOracaoAtual);
document.getElementById('btn-compartilhar-atual').addEventListener('click', () => compartilharOracao(oracaoAtualId));
document.getElementById('btn-falar').addEventListener('click', alternarFala);
document.getElementById('btn-ler').addEventListener('click', pararFala);
document.getElementById('btn-marcar-rezada').addEventListener('click', alternarRezadaManualmente);
document.getElementById('btn-config-vozes').addEventListener('click', abrirConfigVozes);
document.getElementById('btn-fechar-modal-vozes').addEventListener('click', fecharModalVozes);
document.getElementById('btn-salvar-vozes').addEventListener('click', salvarConfigVozesModal);

// Exportar / Importar
document.getElementById('btn-exportar-oracoes').addEventListener('click', exportarOracoes);
document.getElementById('btn-importar-oracoes').addEventListener('click', importarOracoesDeArquivo);

// ===================== INICIALIZAÇÃO =====================
renderizarTodas(); // renderiza pessoais imediatamente
carregarOficiais(); // carrega oficiais e re-renderiza tudo
verificarLinkImportacao(); // verifica se há link mágico na URL

// ===================== PWA: SERVICE WORKER =====================
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
