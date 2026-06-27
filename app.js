
// ===================== NAVEGAÇÃO =====================
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

  // Atualização do título do cabeçalho global e do botão home da topbar
  const topbarTitulo = document.getElementById('topbar-titulo');
  const btnTopbarHome = document.getElementById('btn-topbar-home');
  
  if (topbarTitulo && btnTopbarHome) {
    if (id === 'view-home') {
      topbarTitulo.textContent = 'Minhas Orações';
      btnTopbarHome.classList.add('hidden');
    } else {
      btnTopbarHome.classList.remove('hidden');
      if (id === 'view-todas') {
        topbarTitulo.textContent = 'Minhas Orações';
      } else if (id === 'view-oficiais') {
        topbarTitulo.textContent = 'Orações Oficiais';
      } else if (id === 'view-editor') {
        topbarTitulo.textContent = editandoId ? '✏️ Criar/Editar' : '✏️ Criar/Editar';
      } else if (id === 'view-rezar') {
        topbarTitulo.textContent = '🙏 Modo Rezar';
      }
    }
  }
}

// ===================== RENDERIZAÇÃO DAS LISTAS =====================

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

  card.addEventListener('click', () => {
    if (tipo === 'pessoal' && origem === 'todas') {
      abrirEditor(oracao.id);
    } else {
      abrirRezar(oracao.id, origem, tipo || 'pessoal');
    }
  });
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
  
  // Filtra as orações oficiais para ocultar as intermediárias/auxiliares
  const visiveis = ORACOES_OFICIAIS.filter(o => !o.oculta);
  
  if(visiveis.length === 0){
    vazio.classList.remove('hidden');
  }else{
    vazio.classList.add('hidden');
    visiveis.slice().sort((a,b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
      .forEach(o => lista.appendChild(criarCardOracao(o, 'oficiais', 'oficial')));
  }
}

function renderizarTudo(){
  renderizarFavoritas();
  renderizarTodas();
  renderizarOficiais();
}

function atualizarProgressoDiario(){
  try {
    const container = document.getElementById('progresso-diario');
    if(!container) return;

    const pessoaisFav = (ORACOES || []).filter(o => o && o.favorita);
    const oficiaisFav = (ORACOES_OFICIAIS || []).filter(o => o && (favoritasOficiaisIds || []).includes(o.id));
    const todasFav = [
      ...pessoaisFav.map(o => ({ ...o, _tipo: 'pessoal' })),
      ...oficiaisFav.map(o => ({ ...o, _tipo: 'oficial' })),
    ];

    const total = todasFav.length > 0 ? todasFav.length : ((ORACOES || []).length + (ORACOES_OFICIAIS || []).length);
    const mRezadas = rezadasDiarias || {};
    const rezados = todasFav.length > 0
      ? todasFav.filter(o => o && o.id && mRezadas[o.id]).length
      : Object.keys(mRezadas).length;

    if (total === 0) {
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');

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
  } catch (e) {
    console.error("Erro ao atualizar progresso diário:", e);
  }
}

// ===================== EDITOR (CRIAR / EDITAR) =====================
function abrirEditor(id){
  editandoId = id || null;
  const inputTitulo = document.getElementById('input-titulo');
  const inputTexto = document.getElementById('input-texto');

  const btnExcluir = document.getElementById('btn-excluir-editor');
  if(editandoId){
    const o = ORACOES.find(x => x.id === editandoId);
    inputTitulo.value = o ? o.titulo : '';
    inputTexto.value = o ? o.texto : '';
    if(btnExcluir) btnExcluir.style.display = '';
  }else{
    inputTitulo.value = '';
    inputTexto.value = '';
    if(btnExcluir) btnExcluir.style.display = 'none';
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
    ORACOES.push({ id: gerarId(), titulo, texto, favorita: false });
  }

  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarToast('Oração salva com sucesso!', 'sucesso');

  if(editandoId){
    mostrarView('view-todas');
  }else{
    mostrarView('view-todas');
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
  mostrarView('view-todas');
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
        if(quantidade > 1){
          const filhos = construirArvore(encontrada.texto, novosVisitados);
          nos.push({ tipo: 'repetido', rotulo: encontrada.titulo, quantidade, filhos });
        }else{
          const filhos = construirArvore(encontrada.texto, novosVisitados);
          nos.push({ tipo: 'bloco', rotulo: encontrada.titulo, filhos });
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

// Cria botão de marcar seção rezada
function criarBtnCheck(idx, ctx){
  const btn = document.createElement('button');
  btn.className = 'btn-check-secao';
  btn.dataset.idx = idx;
  btn.title = 'Marcar como rezada';
  btn.textContent = '✓';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const marcadas = progressoLeitura[ctx.oracaoId] || [];
    if(marcadas.includes(idx)){
      desmarcarSecao(ctx.oracaoId, idx);
    }else{
      marcarSecao(ctx.oracaoId, idx);
    }
  });
  return btn;
}

// Agrupa nós consecutivos do tipo 'linha' em blocos {tipo:'grupo-linhas', linhas}
function agruparNos(nos){
  const grupos = [];
  let linhasAtm = [];
  for(const no of nos){
    if(no.tipo === 'linha'){
      linhasAtm.push(no);
    }else{
      if(linhasAtm.length > 0){
        grupos.push({ tipo: 'grupo-linhas', linhas: linhasAtm });
        linhasAtm = [];
      }
      grupos.push(no);
    }
  }
  if(linhasAtm.length > 0) grupos.push({ tipo: 'grupo-linhas', linhas: linhasAtm });
  return grupos;
}

function renderizarNos(nos, container, ctx){
  agruparNos(nos).forEach(g => {
    if(g.tipo === 'grupo-linhas'){
      const idx = ctx ? ctx.n++ : -1;
      const wrapper = document.createElement('div');
      wrapper.className = 'grupo-texto-secao';
      if(idx >= 0) wrapper.dataset.secaoIdx = idx;

      const conteudo = document.createElement('div');
      conteudo.className = 'grupo-texto-conteudo';
      g.linhas.forEach(no => {
        const p = document.createElement('p');
        if(no.classe) p.className = no.classe;
        p.textContent = no.texto;
        conteudo.appendChild(p);
      });
      wrapper.appendChild(conteudo);

      if(ctx){
        const btn = criarBtnCheck(idx, ctx);
        wrapper.appendChild(btn);
        ctx.elementos.push({ idx, el: wrapper, btn });
      }
      container.appendChild(wrapper);

    }else if(g.tipo === 'bloco' || g.tipo === 'repetido'){
      const idx = ctx ? ctx.n++ : -1;
      const divBloco = document.createElement('div');
      divBloco.className = 'bloco-ref';
      if(idx >= 0) divBloco.dataset.secaoIdx = idx;

      const divTitulo = document.createElement('div');
      divTitulo.className = 'bloco-ref-titulo';

      const icone = document.createElement('span');
      icone.className = 'bloco-ref-icone';
      icone.textContent = '▸';
      divTitulo.appendChild(icone);

      const textoSpan = document.createElement('span');
      textoSpan.className = 'bloco-ref-texto';
      textoSpan.textContent = ' ' + g.rotulo + (g.tipo === 'repetido' ? ` x${g.quantidade}` : '');
      divTitulo.appendChild(textoSpan);

      if(ctx){
        const btn = criarBtnCheck(idx, ctx);
        divTitulo.appendChild(btn);
        ctx.elementos.push({ idx, el: divBloco, btn });
      }

      const divConteudo = document.createElement('div');
      divConteudo.className = 'bloco-ref-conteudo';

      if(g.tipo === 'repetido'){
        // Criar fileira de contas
        const fileira = document.createElement('div');
        fileira.className = 'fileira-contas';
        
        // Vamos guardar o progresso desse bloco repetido no localStorage de forma reativa
        // Usaremos uma chave como: `contas_${oracaoId}_${idx}`
        const chaveContas = `contas_${oracaoAtualId}_${idx}`;
        let contasConcluidas = parseInt(localStorage.getItem(chaveContas) || '0', 10);

        for(let i = 1; i <= g.quantidade; i++){
          const conta = document.createElement('button');
          conta.className = 'conta-terco';
          conta.dataset.contaIdx = i;
          if(i <= contasConcluidas) {
            conta.classList.add('concluida');
          }
          conta.addEventListener('click', (e) => {
            e.stopPropagation();
            const atual = parseInt(conta.dataset.contaIdx, 10);
            
            // Se clicar na última já concluída, desmarca aquela e as seguintes. Caso contrário, marca até ela.
            if(atual === contasConcluidas){
              contasConcluidas = atual - 1;
            } else {
              contasConcluidas = atual;
            }
            
            localStorage.setItem(chaveContas, contasConcluidas);
            
            // Atualizar classes das contas do bloco
            fileira.querySelectorAll('.conta-terco').forEach(c => {
              const cIdx = parseInt(c.dataset.contaIdx, 10);
              c.classList.toggle('concluida', cIdx <= contasConcluidas);
            });

            // Se todas as contas foram rezadas, marcar o bloco como rezado
            if(ctx){
              if(contasConcluidas === g.quantidade){
                marcarSecao(ctx.oracaoId, idx);
              } else {
                desmarcarSecao(ctx.oracaoId, idx);
              }
            }
          });
          fileira.appendChild(conta);
        }
        divConteudo.appendChild(fileira);
      }

      divTitulo.addEventListener('click', (e) => {
        if(e.target.classList.contains('btn-check-secao')) return;
        const aberto = divBloco.classList.toggle('aberto');
        icone.textContent = aberto ? '▾' : '▸';
      });

      // Filhos NÃO recebem ctx (só nível raiz tem índices de seção)
      renderizarNos(g.filhos, divConteudo, null);
      divBloco.appendChild(divTitulo);
      divBloco.appendChild(divConteudo);
      container.appendChild(divBloco);

    }else if(g.tipo === 'erro'){
      const p = document.createElement('p');
      p.className = 'linha-ref';
      p.style.opacity = '0.6';
      p.textContent = g.texto;
      container.appendChild(p);
    }
  });
}

function renderizarTextoRezar(textoOriginal){
  const container = document.getElementById('rezar-texto');
  container.innerHTML = '';

  const arvore = construirArvore(textoOriginal, new Set());

  const ctx = oracaoAtualId ? { n: 0, oracaoId: oracaoAtualId, elementos: [] } : null;
  secaoCtxAtual = ctx;

  renderizarNos(arvore, container, ctx);

  if(ctx) atualizarVisuaisProgresso(ctx.oracaoId, ctx.elementos);

  if(container.innerHTML === ''){
    container.innerHTML = '<p class="dica">Esta oração ainda não tem texto. Toque em "Editar" para escrever.</p>';
  }
}

// ===================== MARCAÇÃO DE PROGRESSO POR SEÇÃO =====================
function marcarSecao(oracaoId, idx){
  if(!progressoLeitura[oracaoId]) progressoLeitura[oracaoId] = [];
  const set = new Set(progressoLeitura[oracaoId]);
  // Marca a seção clicada E todas as anteriores (cascata)
  for(let i = 0; i <= idx; i++) set.add(i);
  progressoLeitura[oracaoId] = [...set].sort((a,b) => a-b);
  salvarProgressoLeitura();
  if(secaoCtxAtual && secaoCtxAtual.oracaoId === oracaoId){
    atualizarVisuaisProgresso(oracaoId, secaoCtxAtual.elementos);
  }
}

function desmarcarSecao(oracaoId, idx){
  if(!progressoLeitura[oracaoId]) return;
  const set = new Set(progressoLeitura[oracaoId]);
  set.delete(idx);
  progressoLeitura[oracaoId] = [...set].sort((a,b) => a-b);
  salvarProgressoLeitura();
  if(secaoCtxAtual && secaoCtxAtual.oracaoId === oracaoId){
    atualizarVisuaisProgresso(oracaoId, secaoCtxAtual.elementos);
  }
}

function limparProgressoLeitura(){
  if(!oracaoAtualId) return;
  delete progressoLeitura[oracaoAtualId];
  salvarProgressoLeitura();
  
  // Limpar chaves de progresso de contas repetidas
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith(`contas_${oracaoAtualId}_`)) {
      localStorage.removeItem(chave);
      i--; // ajusta index pois removemos item
    }
  }

  if(secaoCtxAtual && secaoCtxAtual.oracaoId === oracaoAtualId){
    atualizarVisuaisProgresso(oracaoAtualId, secaoCtxAtual.elementos);
  }
  mostrarToast('Progresso de leitura reiniciado.');
}

function atualizarVisuaisProgresso(oracaoId, elementos){
  if(!elementos) return;
  const concluidas = new Set(progressoLeitura[oracaoId] || []);
  elementos.forEach(({ idx, el, btn }) => {
    const marcada = concluidas.has(idx);
    el.classList.toggle('secao-concluida', marcada);
    btn.classList.toggle('ativo', marcada);
    btn.title = marcada ? 'Desmarcar' : 'Marcar como rezada';

    // Se for um bloco repetido, atualizar o estado visual de suas contas
    const fileira = el.querySelector('.fileira-contas');
    if(fileira) {
      const chaveContas = `contas_${oracaoId}_${idx}`;
      if (marcada) {
        // Se a seção inteira está marcada, todas as contas ficam concluídas
        fileira.querySelectorAll('.conta-terco').forEach(c => {
          c.classList.add('concluida');
        });
      } else {
        // Senão, lê o progresso individual
        const contasConcluidas = parseInt(localStorage.getItem(chaveContas) || '0', 10);
        fileira.querySelectorAll('.conta-terco').forEach(c => {
          const cIdx = parseInt(c.dataset.contaIdx, 10);
          c.classList.toggle('concluida', cIdx <= contasConcluidas);
        });
      }
    }
  });
}

// Expande todos os blocos-ref ancestrais de um elemento e fecha os que não são
function expandirParaElemento(el){
  // 1. Identifica os blocos que devem ficar abertos (ancestrais de el)
  const ancestrais = new Set();
  let pai = el.parentElement;
  while(pai && pai.id !== 'rezar-texto'){
    if(pai.classList.contains('bloco-ref')){
      ancestrais.add(pai);
    }
    pai = pai.parentElement;
  }

  // 2. Controla o estado de todos os blocos-ref no container
  document.querySelectorAll('#rezar-texto .bloco-ref').forEach(bloco => {
    const deveAbrir = ancestrais.has(bloco);
    const estaAberto = bloco.classList.contains('aberto');

    if (deveAbrir && !estaAberto) {
      bloco.classList.add('aberto');
      const icone = bloco.querySelector(':scope > .bloco-ref-titulo > .bloco-ref-icone');
      if(icone) icone.textContent = '▾';
    } else if (!deveAbrir && estaAberto) {
      bloco.classList.remove('aberto');
      const icone = bloco.querySelector(':scope > .bloco-ref-titulo > .bloco-ref-icone');
      if(icone) icone.textContent = '▸';
    }
  });
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
let utteranciaAtual = null;

function obterLinhasParaFalar(){
  const container = document.getElementById('rezar-texto');
  const linhas = [];

  // Função recursiva para extrair as falas.
  // Se ela encontrar um bloco repetido, ela repete todo o fluxo dos filhos daquele bloco.
  // Se encontrar um parágrafo de fala direta (em grupo-texto-secao), adiciona à lista.
  // secaoIdx: índice da seção raiz (para salvar progresso principal).
  // infoRepeticao: array com informações das repetições pai [{ blocoEl, contaIdx, repetido: true }, ...]
  function extrairElemento(el, secaoIdx, infoRepeticao) {
    if (!el || !el.classList) return;

    if (el.classList.contains('bloco-ref')) {
      const secaoAtualIdx = el.dataset.secaoIdx ? parseInt(el.dataset.secaoIdx, 10) : secaoIdx;
      const fileira = el.querySelector(':scope > .bloco-ref-conteudo > .fileira-contas');
      const conteudoDiv = el.querySelector(':scope > .bloco-ref-conteudo');

      if (fileira && conteudoDiv) {
        // Bloco repetido!
        const contas = fileira.querySelectorAll('.conta-terco');
        const quantidade = contas.length;

        // Para cada repetição do bloco...
        for (let i = 1; i <= quantidade; i++) {
          const novaInfo = [...infoRepeticao, { blocoEl: el, contaIdx: i, repetido: true }];
          
          // Processa os filhos do conteúdo de forma recursiva mantendo a ordem sequencial dos elementos
          Array.from(conteudoDiv.children).forEach(filho => {
            // Ignoramos a própria fileira de contas durante a leitura das falas
            if (filho.classList.contains('fileira-contas')) return;
            extrairElemento(filho, secaoAtualIdx, novaInfo);
          });
        }
      } else if (conteudoDiv) {
        // Bloco normal
        Array.from(conteudoDiv.children).forEach(filho => {
          extrairElemento(filho, secaoAtualIdx, infoRepeticao);
        });
      }
    } else if (el.classList.contains('grupo-texto-secao')) {
      const secaoAtualIdx = el.dataset.secaoIdx ? parseInt(el.dataset.secaoIdx, 10) : secaoIdx;
      el.querySelectorAll('p').forEach(p => {
        if (p.classList.contains('linha-ref')) return;
        let texto = p.textContent.replace(/^V\.\s*/,'').replace(/^R\.\s*/,'').trim();
        if(!texto) return;

        // Se houver repetições ativas, associamos as informações da repetição mais interna (última do array)
        const infoMaisInterna = infoRepeticao[infoRepeticao.length - 1];
        
        linhas.push({
          elemento: p,
          texto,
          voz2: p.classList.contains('linha-r'),
          secaoIdx: secaoAtualIdx,
          repetido: infoRepeticao.length > 0,
          contaIdx: infoMaisInterna ? infoMaisInterna.contaIdx : 1,
          blocoEl: infoMaisInterna ? infoMaisInterna.blocoEl : null,
          historicoRepeticoes: infoRepeticao // Guardamos a pilha de repetições ativas para controle posterior
        });
      });
    } else {
      // Caso seja outro container (ex: div wrapper ou conteúdo direto)
      if (el.children) {
        Array.from(el.children).forEach(filho => {
          extrairElemento(filho, secaoIdx, infoRepeticao);
        });
      }
    }
  }

  // Inicializa varredura na raiz do container principal
  Array.from(container.children).forEach(filho => {
    extrairElemento(filho, -1, []);
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
  // No Chrome e Android, o pause/resume nativo do speechSynthesis é instável e buga frequentemente.
  // A forma robusta de pausar é parar a fala física, mas manter a flag 'pausado = true'.
  // IMPORTANTE: definir pausado=true ANTES de cancel() para que o evento 'onend' não avance o índice.
  pausado = true;
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  atualizarBotaoFala();
}

function continuarFala(){
  if(!falando || !pausado) return;
  pausado = false;
  atualizarBotaoFala();
  // Retoma a leitura recomeçando a partir do índice de fala que estava ativo
  falarProximaLinha();
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

  // Pulsar conta ativa se for bloco repetido (suporta aninhadas)
  document.querySelectorAll('.conta-terco.ativa').forEach(c => c.classList.remove('ativa'));
  if (item.repetido && item.historicoRepeticoes) {
    item.historicoRepeticoes.forEach(rep => {
      const fileira = rep.blocoEl.querySelector('.fileira-contas');
      if (fileira) {
        // Se a contaIdx atual é 1, significa que iniciamos um novo ciclo deste bloco de repetição.
        // Quando é o início de um novo ciclo, precisamos limpar:
        //   1. As contas da própria fileira (este bloco começa do zero novamente)
        //   2. As contas de sub-blocos repetidos internos (filhos aninhados)
        if (rep.contaIdx === 1) {
          // Limpa as contas da própria fileira deste bloco
          fileira.querySelectorAll('.conta-terco').forEach(c => c.classList.remove('concluida'));
          // Limpa localStorage da própria fileira
          const blocoSecaoIdxProprio = rep.blocoEl.dataset.secaoIdx;
          if (blocoSecaoIdxProprio != null) {
            localStorage.removeItem(`contas_${oracaoAtualId}_${blocoSecaoIdxProprio}`);
          }
          // Limpa também sub-fileiras (blocos repetidos internos/filhos)
          rep.blocoEl.querySelectorAll('.fileira-contas').forEach(subFileira => {
            if (subFileira !== fileira) {
              subFileira.querySelectorAll('.conta-terco').forEach(c => c.classList.remove('concluida'));
              const subBlocoRef = subFileira.closest('.bloco-ref');
              if (subBlocoRef) {
                const subSecaoIdx = subBlocoRef.dataset.secaoIdx;
                if (subSecaoIdx != null) {
                  localStorage.removeItem(`contas_${oracaoAtualId}_${subSecaoIdx}`);
                }
              }
            }
          });
        }

        const contaAtiva = fileira.querySelector(`.conta-terco[data-conta-idx="${rep.contaIdx}"]`);
        if (contaAtiva) contaAtiva.classList.add('ativa');
      }
    });
  }

  const utterancia = new SpeechSynthesisUtterance(item.texto);
  utterancia.lang = 'pt-BR';
  utterancia.rate = velocidadeAtual;
  utteranciaAtual = utterancia;

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
    const secaoIdxAtual = item.secaoIdx;
    
    // Se for repetido, atualizar o progresso de cada bloco da pilha que concluiu uma repetição
    const proximoItem = filaFala[indiceFalaAtual + 1];
    if (item.repetido && item.historicoRepeticoes) {
      item.historicoRepeticoes.forEach(rep => {
        // Encontra no próximo item a mesma repetição (mesmo bloco)
        const proxRep = proximoItem && proximoItem.historicoRepeticoes 
          ? proximoItem.historicoRepeticoes.find(r => r.blocoEl === rep.blocoEl)
          : null;
        
        // Se mudou de conta ou acabou a repetição deste bloco específico
        if (!proxRep || proxRep.contaIdx !== rep.contaIdx) {
          // Identifica o índice de seção do bloco para salvar progresso
          const blocoSecaoIdx = rep.blocoEl.dataset.secaoIdx;
          const chaveContas = `contas_${oracaoAtualId}_${blocoSecaoIdx != null ? blocoSecaoIdx : secaoIdxAtual}`;
          localStorage.setItem(chaveContas, rep.contaIdx);
          
          const fileira = rep.blocoEl.querySelector('.fileira-contas');
          if (fileira) {
            fileira.querySelectorAll('.conta-terco').forEach(c => {
              const cIdx = parseInt(c.dataset.contaIdx, 10);
              c.classList.toggle('concluida', cIdx <= rep.contaIdx);
              if (cIdx === rep.contaIdx) c.classList.remove('ativa');
            });
          }
        }
      });
    }

    indiceFalaAtual++;
    // Auto-marca a seção quando a voz termina todas as linhas dela
    if(oracaoAtualId && secaoIdxAtual >= 0 && secaoCtxAtual){
      const proximoItem = filaFala[indiceFalaAtual];
      if(!proximoItem || proximoItem.secaoIdx !== secaoIdxAtual){
        const jaConc = (progressoLeitura[oracaoAtualId] || []).includes(secaoIdxAtual);
        if(!jaConc){
          if(!progressoLeitura[oracaoAtualId]) progressoLeitura[oracaoAtualId] = [];
          const set = new Set(progressoLeitura[oracaoAtualId]);
          set.add(secaoIdxAtual);
          progressoLeitura[oracaoAtualId] = [...set].sort((a,b) => a-b);
          salvarProgressoLeitura();
          atualizarVisuaisProgresso(oracaoAtualId, secaoCtxAtual.elementos);
        }
      }
    }
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
  if(utteranciaAtual){
    utteranciaAtual.onend = null;
    utteranciaAtual.onerror = null;
  }
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.querySelectorAll('.linha-falando').forEach(el => el.classList.remove('linha-falando'));
  document.querySelectorAll('.conta-terco.ativa').forEach(c => c.classList.remove('ativa'));
  atualizarBotaoFala();
}

// ===================== LIGAÇÃO DOS BOTÕES =====================
document.getElementById('btn-ver-todas').addEventListener('click', () => mostrarView('view-todas'));
document.getElementById('btn-ver-oficiais').addEventListener('click', () => mostrarView('view-oficiais'));

document.getElementById('btn-topbar-home').addEventListener('click', () => {
  const activeView = document.querySelector('.view-active');
  if (activeView && activeView.id === 'view-editor' && editandoId) {
    abrirRezar(editandoId, origemRezar, oracaoAtualTipo);
  } else {
    mostrarView('view-home');
  }
});

document.getElementById('fab-nova').addEventListener('click', () => abrirEditor(null));
document.getElementById('btn-salvar').addEventListener('click', salvarEditor);

document.getElementById('btn-inserir-oracao').addEventListener('click', abrirModalInserir);
document.getElementById('btn-fechar-modal').addEventListener('click', fecharModalInserir);

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

// Exportar / Importar
document.getElementById('btn-exportar-oracoes').addEventListener('click', exportarOracoes);
document.getElementById('btn-importar-oracoes').addEventListener('click', importarOracoesDeArquivo);
document.getElementById('btn-excluir-editor').addEventListener('click', () => {
  if(!editandoId) return;
  const o = ORACOES.find(x => x.id === editandoId);
  if(!o) return;
  if(!confirm(`Excluir a oração "${o.titulo}"? Essa ação não pode ser desfeita.`)) return;
  ORACOES = ORACOES.filter(x => x.id !== editandoId);
  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarView('view-todas');
});

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
