// ===================== SCROLL INTELIGENTE =====================

// Retorna true se o elemento já está inteiramente visível dentro da viewport
// com uma margem de conforto, evitando rolagens desnecessárias entre linhas
// consecutivas que já aparecem juntas na tela (ex: V. + R. da Ave Maria).
function estaVisivel(el, margem = 80) {
  const r = el.getBoundingClientRect();
  return r.top >= margem && r.bottom <= (window.innerHeight - margem);
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
let timeoutPausaAtual = null; // timer pendente de um marcador [pausa]{n} durante a fala

function obterLinhasParaFalar(){
  const container = document.getElementById('rezar-texto');
  const linhas = [];

  function extrairElemento(el, secaoIdx, infoRepeticao, ancestraisBloco) {
    if (!el || !el.classList) return;

    if (el.classList.contains('bloco-ref')) {
      const secaoAtualIdx = el.dataset.secaoIdx ? parseInt(el.dataset.secaoIdx, 10) : secaoIdx;
      const fileira = el.querySelector(':scope > .fileira-contas');
      const conteudoDiv = el.querySelector(':scope > .bloco-ref-conteudo');

      if (fileira && conteudoDiv) {
        const contas = fileira.querySelectorAll('.conta-terco');
        const quantidade = contas.length;

        for (let i = 1; i <= quantidade; i++) {
          const novaInfo = [...infoRepeticao, { blocoEl: el, contaIdx: i, repetido: true }];
          
          Array.from(conteudoDiv.children).forEach(filho => {
            if (filho.classList.contains('fileira-contas')) return;
            extrairElemento(filho, secaoAtualIdx, novaInfo, ancestraisBloco);
          });
        }
      } else if (conteudoDiv) {
        // Bloco simples (não repetido, ex: "Pai Nosso", "Glória ao Pai"): o
        // índice deste bloco é alocado DEPOIS dos filhos (numeração pós-fixada),
        // então cada linha interna ganha seu próprio índice individual,
        // diferente do índice do bloco-pai. Guardamos o índice do bloco-pai
        // na cadeia de ancestrais para podermos marcá-lo como concluído
        // separadamente quando todas as linhas internas forem lidas.
        const novosAncestrais = secaoAtualIdx >= 0
          ? [...ancestraisBloco, secaoAtualIdx]
          : ancestraisBloco;
        Array.from(conteudoDiv.children).forEach(filho => {
          extrairElemento(filho, secaoAtualIdx, infoRepeticao, novosAncestrais);
        });
      }
    } else if (el.classList.contains('grupo-texto-secao')) {
      const secaoAtualIdx = el.dataset.secaoIdx ? parseInt(el.dataset.secaoIdx, 10) : secaoIdx;
      el.querySelectorAll('p').forEach(p => {
        if (p.classList.contains('linha-ref')) return;
        let texto = p.textContent.replace(/^V\.\s*/,'').replace(/^R\.\s*/,'').trim();
        if(!texto) return;

        const infoMaisInterna = infoRepeticao[infoRepeticao.length - 1];
        
        linhas.push({
          tipo: 'linha',
          elemento: p,
          texto,
          voz2: p.classList.contains('linha-r'),
          secaoIdx: secaoAtualIdx,
          repetido: infoRepeticao.length > 0,
          contaIdx: infoMaisInterna ? infoMaisInterna.contaIdx : 1,
          blocoEl: infoMaisInterna ? infoMaisInterna.blocoEl : null,
          historicoRepeticoes: infoRepeticao,
          ancestraisBloco
        });
      });
    } else if (el.classList.contains('bloco-opcional')) {
      // Leitura opcional: só entra na fala se o usuário ligou o interruptor
      // (classe "aberto"). Enquanto oculta, é pulada por completo.
      if (!el.classList.contains('aberto')) return;
      const conteudoDiv = el.querySelector(':scope > .bloco-opcional-conteudo');
      if (conteudoDiv) {
        Array.from(conteudoDiv.children).forEach(filho => {
          extrairElemento(filho, secaoIdx, infoRepeticao, ancestraisBloco);
        });
      }
    } else if (el.classList.contains('link-marcador')) {
      // Links são apenas ação visual para o usuário abrir; nunca entram na fala.
      return;
    } else if (el.classList.contains('pausa-marcador')) {
      const segundos = Math.min(Math.max(parseFloat(el.dataset.segundos) || 1, 1), 30);
      linhas.push({ tipo: 'pausa', elemento: el, segundos, secaoIdx: -1 });
    } else {
      if (el.children) {
        Array.from(el.children).forEach(filho => {
          extrairElemento(filho, secaoIdx, infoRepeticao, ancestraisBloco);
        });
      }
    }
  }

  Array.from(container.children).forEach(filho => {
    extrairElemento(filho, -1, [], []);
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

// Calcula a partir de qual linha a fala deve começar, considerando as
// seções que já estão marcadas como concluídas (check verde). Retorna
// null se a oração já estiver 100% concluída (nada para continuar).
function calcularIndiceInicialFala(fila){
  if(!oracaoAtualId) return 0;
  const concluidas = new Set(progressoLeitura[oracaoAtualId] || []);

  const idx = fila.findIndex(item => {
    // Seção totalmente concluída → pula
    if(item.secaoIdx >= 0 && concluidas.has(item.secaoIdx)) return false;

    // Item de bloco repetido: verifica quantas voltas já foram concluídas
    if(item.repetido && item.blocoEl){
      const secaoIdxBloco = item.blocoEl.dataset.secaoIdx
        ? parseInt(item.blocoEl.dataset.secaoIdx, 10)
        : item.secaoIdx;
      const contasConcluidas = parseInt(
        localStorage.getItem(`contas_${oracaoAtualId}_${secaoIdxBloco}`) || '0', 10
      );
      if(item.contaIdx <= contasConcluidas) return false; // volta já feita → pula
    }

    return true; // este item ainda não foi feito → começa aqui
  });

  return idx === -1 ? null : idx;
}

async function iniciarFala(){
  const vozesDisponiveis = await aguardarVozesDisponiveis();
  if(!configVozes.v && !configVozes.r && vozesDisponiveis.length){
    configVozes = escolherVozesAutomaticas(vozesDisponiveis);
    salvarConfigVozes();
  }

  filaFala = obterLinhasParaFalar();
  if(filaFala.length === 0) return;

  const indiceInicial = calcularIndiceInicialFala(filaFala);
  if(indiceInicial === null){
    mostrarToast('Oração já concluída. Use "Reiniciar progresso" para ouvir de novo.');
    return;
  }

  indiceFalaAtual = indiceInicial;
  falando = true;
  pausado = false;
  atualizarBotaoFala();
  falarProximaLinha();
}

function pausarFala(){
  if(!falando || pausado) return;
  pausado = true;
  if(utteranciaAtual){
    utteranciaAtual.onend = null;
    utteranciaAtual.onerror = null;
  }
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  if(timeoutPausaAtual){
    clearTimeout(timeoutPausaAtual);
    timeoutPausaAtual = null;
  }
  atualizarBotaoFala();
}

function continuarFala(){
  if(!falando || !pausado) return;

  // Enquanto pausado, o usuário pode ter alterado o progresso na mão (marcado
  // contas mais à frente, ou desmarcado contas pra trás para repetir um trecho).
  // Recalcula a posição correta nos dois sentidos, em vez de simplesmente
  // retomar do ponto onde a fala foi pausada.
  const indiceRecalculado = calcularIndiceInicialFala(filaFala);
  if(indiceRecalculado === null){
    mostrarToast('Oração já concluída. Use "Reiniciar progresso" para ouvir de novo.');
    pararFala();
    return;
  }
  indiceFalaAtual = indiceRecalculado;

  pausado = false;
  atualizarBotaoFala();
  falarProximaLinha();
}

function atualizarBotaoFala(){
  const btn = document.getElementById('btn-falar');
  if(!btn) return;
  btn.classList.remove('btn-falar-tocando', 'btn-falar-pausado');
  if(!falando){
    btn.textContent = '▶';
    btn.title = 'Ouvir';
  }else if(pausado){
    btn.textContent = '▶';
    btn.title = 'Continuar';
    btn.classList.add('btn-falar-pausado');
  }else{
    btn.textContent = '⏸';
    btn.title = 'Pausar';
    btn.classList.add('btn-falar-tocando');
  }
}

// Marca um único índice de seção como concluído (sem preencher a faixa
// 0..idx como marcarSecao() faz) — usado pelo modo de fala, que percorre
// as seções na ordem em que aparecem na oração.
function adicionarSecaoConcluida(oracaoId, idx){
  if(idx == null || idx < 0) return false;
  const jaConcluida = (progressoLeitura[oracaoId] || []).includes(idx);
  if(jaConcluida) return false;
  if(!progressoLeitura[oracaoId]) progressoLeitura[oracaoId] = [];
  const set = new Set(progressoLeitura[oracaoId]);
  set.add(idx);
  progressoLeitura[oracaoId] = [...set].sort((a,b) => a-b);
  salvarProgressoLeitura();
  return true;
}

function falarProximaLinha(){
  document.querySelectorAll('.linha-falando, .titulo-falando').forEach(el => el.classList.remove('linha-falando', 'titulo-falando'));

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

  // Proteção: se a seção deste item já foi marcada como concluída (ex: usuário
  // marcou manualmente enquanto a fala estava em outra posição), pula para o próximo
  // sem falar — evita repetir o que o usuário já sinalizou como rezado.
  if(oracaoAtualId && item.secaoIdx >= 0){
    const concluidas = new Set(progressoLeitura[oracaoAtualId] || []);
    if(concluidas.has(item.secaoIdx)){
      indiceFalaAtual++;
      falarProximaLinha();
      return;
    }
    // Bloco repetido: pula voltas já concluídas pelo clique manual de conta
    if(item.repetido && item.blocoEl){
      const secaoIdxBloco = item.blocoEl.dataset.secaoIdx != null
        ? parseInt(item.blocoEl.dataset.secaoIdx, 10)
        : item.secaoIdx;
      const contasConcluidas = parseInt(
        localStorage.getItem(`contas_${oracaoAtualId}_${secaoIdxBloco}`) || '0', 10
      );
      if(item.contaIdx <= contasConcluidas){
        indiceFalaAtual++;
        falarProximaLinha();
        return;
      }
    }
  }

  if(item.tipo === 'pausa'){
    falarPausa(item);
    return;
  }

  expandirParaElemento(item.elemento);

  const blocoFechado = encontrarBlocoColapsadoNaFala(item.elemento);
  if(blocoFechado){
    // Oração conhecida (Ave Maria, Pai Nosso...) e está fechada: destaca o
    // bloco inteiro (inclui contas) em vez de abrir e destacar a linha lá dentro.
    blocoFechado.classList.add('titulo-falando');
    if(!estaVisivel(blocoFechado)) blocoFechado.scrollIntoView({ behavior:'smooth', block:'center' });
  }else{
    item.elemento.classList.add('linha-falando');
    if(!estaVisivel(item.elemento)) item.elemento.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  document.querySelectorAll('.conta-terco.ativa').forEach(c => c.classList.remove('ativa'));
  if (item.repetido && item.historicoRepeticoes) {
    const itemAnterior = indiceFalaAtual > 0 ? filaFala[indiceFalaAtual - 1] : null;
    item.historicoRepeticoes.forEach(rep => {
      const fileira = rep.blocoEl.querySelector('.fileira-contas');
      if (fileira) {
        // Verifica se esta é a PRIMEIRA LINHA de uma nova volta deste bloco,
        // comparando com o item anterior. Isso garante que o reset de contas
        // acontece apenas UMA VEZ ao entrar na volta, e não a cada linha durante ela.
        const repAnterior = itemAnterior && itemAnterior.historicoRepeticoes
          ? itemAnterior.historicoRepeticoes.find(r => r.blocoEl === rep.blocoEl)
          : null;
        const entrandoNovaVolta = !repAnterior || repAnterior.contaIdx !== rep.contaIdx;

        if (entrandoNovaVolta && rep.contaIdx === 1) {
          fileira.querySelectorAll('.conta-terco').forEach(c => c.classList.remove('concluida'));
          const blocoSecaoIdxProprio = rep.blocoEl.dataset.secaoIdx;
          if (blocoSecaoIdxProprio != null) {
            localStorage.removeItem(`contas_${oracaoAtualId}_${blocoSecaoIdxProprio}`);
          }
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
    
    const proximoItem = filaFala[indiceFalaAtual + 1];
    if (item.repetido && item.historicoRepeticoes) {
      item.historicoRepeticoes.forEach(rep => {
        const proxRep = proximoItem && proximoItem.historicoRepeticoes 
          ? proximoItem.historicoRepeticoes.find(r => r.blocoEl === rep.blocoEl)
          : null;
        
        if (!proxRep || proxRep.contaIdx !== rep.contaIdx) {
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
    if(oracaoAtualId && secaoIdxAtual >= 0 && secaoCtxAtual){
      const proximoItem = filaFala[indiceFalaAtual];
      let mudouAlgo = false;

      if(!proximoItem || proximoItem.secaoIdx !== secaoIdxAtual){
        if(adicionarSecaoConcluida(oracaoAtualId, secaoIdxAtual)) mudouAlgo = true;
      }

      // Propaga a conclusão para blocos-pai (ex: "Pai Nosso", "Glória ao Pai")
      // que estejam sendo encerrados nesta linha — ou seja, cujo índice não
      // aparece mais nos ancestrais do próximo item da fila. Sem isso, o
      // check do bloco-pai nunca era marcado pelo modo de fala, mesmo com
      // todo o conteúdo interno já lido.
      const ancestraisAtuais = item.ancestraisBloco || [];
      const ancestraisProximo = proximoItem ? (proximoItem.ancestraisBloco || []) : [];
      ancestraisAtuais.forEach(idxAncestral => {
        if(!ancestraisProximo.includes(idxAncestral)){
          if(adicionarSecaoConcluida(oracaoAtualId, idxAncestral)) mudouAlgo = true;
        }
      });

      if(mudouAlgo){
        atualizarVisuaisProgresso(oracaoAtualId, secaoCtxAtual.elementos);
      }
    }
    falarProximaLinha();
  };
  utterancia.onerror = () => {
    falando = false;
  };

  window.speechSynthesis.speak(utterancia);
}

// Aguarda os segundos configurados em um marcador [pausa]{n} antes de
// seguir para o próximo item da fila — sem chamar o sintetizador de voz.
function falarPausa(item){
  utteranciaAtual = null;
  if(item.elemento){
    if(!estaVisivel(item.elemento)) item.elemento.scrollIntoView({ behavior:'smooth', block:'center' });
    item.elemento.classList.add('linha-falando');
  }
  timeoutPausaAtual = setTimeout(() => {
    timeoutPausaAtual = null;
    if(!falando || pausado) return;
    indiceFalaAtual++;
    falarProximaLinha();
  }, item.segundos * 1000);
}

function pararFala(){
  falando = false;
  pausado = false;
  if(utteranciaAtual){
    utteranciaAtual.onend = null;
    utteranciaAtual.onerror = null;
  }
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  if(timeoutPausaAtual){
    clearTimeout(timeoutPausaAtual);
    timeoutPausaAtual = null;
  }
  document.querySelectorAll('.linha-falando, .titulo-falando').forEach(el => el.classList.remove('linha-falando', 'titulo-falando'));
  document.querySelectorAll('.conta-terco.ativa').forEach(c => c.classList.remove('ativa'));
  atualizarBotaoFala();
}
