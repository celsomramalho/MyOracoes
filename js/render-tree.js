// ===================== ÁRVORE DE NÓS PARA RENDERIZAÇÃO =====================

function adicionarLinhas(nos, texto, estado){
  const linhas = (texto || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for(let i = 0; i < linhas.length; i++){
    const linha = linhas[i];

    // Diretiva de resposta automática para ladainhas: uma linha sozinha
    // entre chaves, ex: "{R. rogai por nós.}", liga o modo automático —
    // toda linha "V." seguinte ganha essa resposta sem precisar escrevê-la.
    // "{}" (vazio) desliga o modo automático.
    const diretiva = linha.match(/^\{(.*)\}$/);
    if(diretiva){
      estado.respostaAuto = diretiva[1].trim() || null;
      continue;
    }

    let classe = '';
    if(linha.startsWith('V.'))       classe = 'linha-v';
    else if(linha.startsWith('R.')) classe = 'linha-r';
    nos.push({ tipo: 'linha', texto: linha, classe });

    // Se o modo automático está ligado e a próxima linha não é uma
    // resposta explícita, insere a resposta automática depois da linha V.
    if(classe === 'linha-v' && estado.respostaAuto){
      const proxima = linhas[i + 1];
      const proximaEhResposta = proxima && proxima.startsWith('R.');
      if(!proximaEhResposta){
        const classeAuto = estado.respostaAuto.startsWith('V.') ? 'linha-v' : 'linha-r';
        nos.push({ tipo: 'linha', texto: estado.respostaAuto, classe: classeAuto });
      }
    }
  }
}

// Divide uma linha em partes para colorir só o prefixo ("V."/"R.") e a
// palavra "Oremos." (quando houver), deixando o restante do texto sem cor
// própria (herda o branco padrão do tema).
function criarPartesLinha(linha, classe){
  const partes = [];

  if(classe !== 'linha-v' && classe !== 'linha-r'){
    partes.push({ texto: linha, classe: null });
    return partes;
  }

  const prefixo = linha.slice(0, 2); // "V." ou "R."
  const resto = linha.slice(2);
  const classeSpan = classe === 'linha-v' ? 'rubrica' : 'resposta';
  partes.push({ texto: prefixo, classe: classeSpan });

  if(classe === 'linha-v'){
    const m = resto.match(/^(\s*)(Oremos\.?)/i);
    if(m){
      const [match, espacos, oremos] = m;
      if(espacos) partes.push({ texto: espacos, classe: null });
      partes.push({ texto: oremos, classe: 'rubrica' });
      const sobra = resto.slice(match.length);
      if(sobra) partes.push({ texto: sobra, classe: null });
      return partes;
    }
  }

  if(resto) partes.push({ texto: resto, classe: null });
  return partes;
}

function construirArvore(texto, titulosVisitados, estado){
  if(!estado) estado = { respostaAuto: null };
  const nos = [];
  const regex = /\[([^\[\]]+)\](?:\{(\d+)\})?/g;
  let ultimoIndice = 0;
  let match;

  while((match = regex.exec(texto || '')) !== null){
    const textoBefore = texto.slice(ultimoIndice, match.index);
    if(textoBefore) adicionarLinhas(nos, textoBefore, estado);

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
        // Oração referenciada ganha seu próprio estado de resposta automática,
        // independente do que estiver ligado na oração que a referencia.
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

  const textoFinal = texto ? texto.slice(ultimoIndice) : '';
  if(textoFinal) adicionarLinhas(nos, textoFinal, estado);

  return nos;
}

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

function agruparNos(nos){
  // Regras de agrupamento:
  // 1. V. + R. imediatamente seguinte → um grupo só (par inseparável)
  // 2. R. sozinho (sem V. antes, ex: "R. Amém" de fechamento) → grupo próprio
  // 3. Parágrafo livre (nem V. nem R.) → cada parágrafo é um grupo;
  //    linha que começa com minúscula cola com a linha anterior (continuação de frase)
  // 4. Blocos (bloco-ref, repetido) não são tocados — saem como estão

  const grupos = [];
  let linhasAtm = []; // acumula linhas do grupo atual

  function fecharGrupo() {
    if (linhasAtm.length > 0) {
      grupos.push({ tipo: 'grupo-linhas', linhas: linhasAtm });
      linhasAtm = [];
    }
  }

  function continuacaoDeFrase(texto) {
    // Linha é continuação se começa com letra minúscula (ignorando prefixos V./R.)
    const s = texto.replace(/^[VR]\.\s*/, '').trimStart();
    const c = s.charAt(0);
    return c !== '' && c === c.toLowerCase() && c !== c.toUpperCase();
  }

  for (let i = 0; i < nos.length; i++) {
    const no = nos[i];

    if (no.tipo !== 'linha') {
      // Bloco/repetido: fecha o grupo atual e emite o bloco
      fecharGrupo();
      grupos.push(no);
      continue;
    }

    const ehV = no.classe === 'linha-v';
    const ehR = no.classe === 'linha-r';
    const proximo = nos[i + 1];
    const proximoEhR = proximo && proximo.tipo === 'linha' && proximo.classe === 'linha-r';

    if (ehV) {
      // V. sempre inicia um grupo novo
      fecharGrupo();
      linhasAtm.push(no);
      // Absorve linhas de continuação (começam com minúscula) que fazem parte da mesma frase do V.
      while (i + 1 < nos.length && nos[i + 1].tipo === 'linha' &&
             nos[i + 1].classe !== 'linha-v' && nos[i + 1].classe !== 'linha-r' &&
             continuacaoDeFrase(nos[i + 1].texto)) {
        i++;
        linhasAtm.push(nos[i]);
      }
      // Se o próximo for R., puxa junto (par V.+R.)
      const proximoAgoraEhR = nos[i + 1] && nos[i + 1].tipo === 'linha' && nos[i + 1].classe === 'linha-r';
      if (proximoAgoraEhR) {
        i++;
        linhasAtm.push(nos[i]);
      }
      fecharGrupo();
      continue;
    }

    if (ehR) {
      // R. sozinho (não foi consumido pelo V. acima) → grupo próprio
      fecharGrupo();
      linhasAtm.push(no);
      fecharGrupo();
      continue;
    }

    // Parágrafo livre
    if (linhasAtm.length === 0) {
      // Inicia novo grupo de parágrafo
      linhasAtm.push(no);
    } else {
      const ultimaLinha = linhasAtm[linhasAtm.length - 1];
      const ultimaEhParagrafo = ultimaLinha.classe !== 'linha-v' && ultimaLinha.classe !== 'linha-r';
      if (ultimaEhParagrafo && continuacaoDeFrase(no.texto)) {
        // Continuação de frase (começa com minúscula) — cola com a linha anterior
        linhasAtm.push(no);
      } else {
        // Nova frase/parágrafo — fecha o atual e abre novo
        fecharGrupo();
        linhasAtm.push(no);
      }
    }
  }

  fecharGrupo();
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
        criarPartesLinha(no.texto, no.classe).forEach(parte => {
          if(!parte.texto) return;
          if(parte.classe){
            const span = document.createElement('span');
            span.className = parte.classe;
            span.textContent = parte.texto;
            p.appendChild(span);
          }else{
            p.appendChild(document.createTextNode(parte.texto));
          }
        });
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
        const fileira = document.createElement('div');
        fileira.className = 'fileira-contas';
        
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
            
            if(atual === contasConcluidas){
              contasConcluidas = atual - 1;
            } else {
              contasConcluidas = atual;
            }
            
            localStorage.setItem(chaveContas, contasConcluidas);
            
            fileira.querySelectorAll('.conta-terco').forEach(c => {
              const cIdx = parseInt(c.dataset.contaIdx, 10);
              c.classList.toggle('concluida', cIdx <= contasConcluidas);
            });

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
  
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith(`contas_${oracaoAtualId}_`)) {
      localStorage.removeItem(chave);
      i--;
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

    const fileira = el.querySelector('.fileira-contas');
    if(fileira) {
      const chaveContas = `contas_${oracaoId}_${idx}`;
      if (marcada) {
        fileira.querySelectorAll('.conta-terco').forEach(c => {
          c.classList.add('concluida');
        });
      } else {
        const contasConcluidas = parseInt(localStorage.getItem(chaveContas) || '0', 10);
        fileira.querySelectorAll('.conta-terco').forEach(c => {
          const cIdx = parseInt(c.dataset.contaIdx, 10);
          c.classList.toggle('concluida', cIdx <= contasConcluidas);
        });
      }
    }
  });
}

function expandirParaElemento(el){
  const ancestrais = new Set();
  let pai = el.parentElement;
  while(pai && pai.id !== 'rezar-texto'){
    if(pai.classList.contains('bloco-ref')){
      ancestrais.add(pai);
    }
    pai = pai.parentElement;
  }

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
