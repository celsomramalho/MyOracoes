// ===================== TELA LIGADA ENQUANTO FALA (Wake Lock) =====================
// Sem isso, o celular apaga a tela sozinho pelo tempo normal configurado nele,
// mesmo com o app aberto e falando. Pedimos pro navegador manter a tela ligada
// só enquanto a fala está realmente ativa (não pausada), e liberamos o pedido
// ao pausar/parar, pra não deixar a tela sempre acesa à toa gastando bateria.
let wakeLockAtivo = null;

async function ativarWakeLock(){
  if(!('wakeLock' in navigator)) return; // navegador sem suporte (ex: iOS antigo) — segue sem travar nada
  try{
    wakeLockAtivo = await navigator.wakeLock.request('screen');
    wakeLockAtivo.addEventListener('release', () => { wakeLockAtivo = null; });
  }catch(erro){
    wakeLockAtivo = null; // ex: bateria baixa, permissão negada — não é um erro fatal
  }
}

function desativarWakeLock(){
  if(wakeLockAtivo){
    wakeLockAtivo.release().catch(() => {});
    wakeLockAtivo = null;
  }
}

// O navegador libera o wake lock sozinho quando a aba/app fica em segundo
// plano. Se o usuário voltar e a fala ainda estiver ativa (não pausada),
// pede de novo automaticamente.
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && typeof falando !== 'undefined' && falando && !pausado){
    ativarWakeLock();
  }
});

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
        //
        // IMPORTANTE: só fazemos isso quando o bloco tem um índice PRÓPRIO
        // (dataset.secaoIdx realmente definido nele). Um bloco simples sem
        // repetição (como "contas grandes") que vive DENTRO de um repetido
        // não tem índice próprio — ele só "herda" o índice do repetido pai
        // (secaoAtualIdx aqui veio do parâmetro `secaoIdx`, não de
        // el.dataset.secaoIdx). Se colocássemos esse índice herdado na
        // cadeia de ancestrais, terminar de ler esse bloco marcaria o
        // REPETIDO PAI inteiro como concluído prematuramente (bug: uma
        // repetição de 7 voltas era dada como finalizada assim que a 1ª
        // volta terminava, pulando direto para a próxima oração).
        const temIndiceProprio = !!el.dataset.secaoIdx;
        const novosAncestrais = (temIndiceProprio && secaoAtualIdx >= 0)
          ? [...ancestraisBloco, secaoAtualIdx]
          : ancestraisBloco;
        Array.from(conteudoDiv.children).forEach(filho => {
          extrairElemento(filho, secaoAtualIdx, infoRepeticao, novosAncestrais);
        });
      }
    } else if (el.classList.contains('grupo-texto-secao')) {
      // Só usa o índice do PRÓPRIO elemento (dataset.secaoIdx). Uma linha
      // dentro de um repetido não tem índice próprio por design (não ganha
      // check individual — seu progresso é o contador de contas do
      // repetido que a envolve). Antes, ela "herdava" o índice do parâmetro
      // `secaoIdx` (o do repetido pai) como se fosse seu próprio secaoIdx —
      // isso fazia o repetido pai ser marcado como concluído assim que essa
      // linha terminava (bug: repetição de várias voltas dada como
      // finalizada já na 1ª volta). Sem índice próprio, fica -1 (sem dono):
      // o controle de "já foi lida nesta volta" continua funcionando
      // normalmente através de item.blocoEl/item.contaIdx, que apontam pro
      // repetido de verdade mais próximo (historicoRepeticoes), não por aqui.
      const secaoAtualIdx = el.dataset.secaoIdx ? parseInt(el.dataset.secaoIdx, 10) : -1;
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

// Verifica se um item da fila de fala já foi concluído — seja porque a
// seção dele já está marcada (check verde), seja porque a(s) volta(s) do(s)
// bloco(s) repetido(s) a que ele pertence já foram concluídas.
//
// IMPORTANTE (repetição dentro de repetição, ex: "setena x7" contendo
// "contas pequenas x7" dentro): um item pode pertencer a VÁRIOS blocos
// repetidos ao mesmo tempo, um aninhado no outro. O contador de voltas de
// cada bloco (localStorage `contas_<id>_<secaoIdx>`) é reaproveitado a cada
// nova volta do bloco que o contém — ou seja, o número guardado para o
// bloco interno só faz sentido dentro da volta ATUAL do bloco externo.
// Por isso é preciso percorrer a cadeia do mais externo para o mais
// interno: se a volta atual de um nível já está concluída, o item inteiro
// (e tudo que há dentro dele) já foi feito, não importa o que os
// contadores dos níveis mais internos digam (eles pertencem a uma volta
// externa diferente da que estamos verificando).
function itemJaConcluido(item){
  if(!oracaoAtualId) return false;

  // Seção com índice próprio já marcada como concluída (check verde)
  if(item.secaoIdx >= 0){
    const concluidas = progressoLeitura[oracaoAtualId] || [];
    if(concluidas.includes(item.secaoIdx)) return true;
  }

  // Cadeia de blocos repetidos, do mais externo para o mais interno
  if(item.historicoRepeticoes && item.historicoRepeticoes.length){
    const concluidasSecoes = progressoLeitura[oracaoAtualId] || [];
    for(const rep of item.historicoRepeticoes){
      const secaoIdxBloco = rep.blocoEl && rep.blocoEl.dataset.secaoIdx != null
        ? parseInt(rep.blocoEl.dataset.secaoIdx, 10)
        : -1;
      if(secaoIdxBloco < 0) continue;

      // O bloco repetido inteiro foi marcado manualmente como concluído
      // (check verde no próprio bloco) — todas as voltas e tudo dentro
      // dele conta como já feito, independente do contador de voltas.
      if(concluidasSecoes.includes(secaoIdxBloco)){
        return true;
      }

      const contasConcluidas = parseInt(
        localStorage.getItem(`contas_${oracaoAtualId}_${secaoIdxBloco}`) || '0', 10
      );

      if(rep.contaIdx <= contasConcluidas){
        // Esta volta, neste nível, já foi concluída → o item já foi feito,
        // independentemente de níveis mais internos.
        return true;
      }
      if(rep.contaIdx > contasConcluidas + 1){
        // Estado inesperado (contador mais adiantado do que deveria) —
        // não assume concluído, trata com segurança como pendente.
        return false;
      }
      // rep.contaIdx === contasConcluidas + 1: é a volta em andamento
      // neste nível. Segue verificando o próximo nível (mais interno).
    }
  }

  return false;
}

// Calcula a partir de qual linha a fala deve começar, considerando: seções
// já marcadas como concluídas (check verde), voltas já concluídas de blocos
// repetidos aninhados, E a posição exata onde a leitura parou DENTRO da
// volta em andamento — inclusive para trechos sem check próprio (como um
// texto fixo que aparece uma vez a cada volta, antes de uma sub-repetição
// interna). Retorna null se a oração já estiver 100% concluída.
//
// Como funciona a posição dentro da volta: cada vez que uma linha termina de
// ser falada, o onend (mais abaixo) incrementa um contador `subpos_<id>_<idx>`
// por bloco repetido — "quantos itens desta volta atual já foram ditos". Esse
// contador zera sempre que uma volta nova começa. Aqui, ao re-varrer a fila
// inteira do zero, contamos de novo, virtualmente, quantos itens de cada
// volta "atual" (a que ainda não terminou) já passamos na varredura — e
// comparamos com o valor salvo. Se já passamos menos do que o salvo, o item
// já foi dito de verdade; senão, é exatamente aqui que a fala deve retomar.
function calcularIndiceInicialFala(fila){
  if(!oracaoAtualId) return 0;

  const concluidas = progressoLeitura[oracaoAtualId] || [];
  const rodadaAtualPorBloco = new Map();     // blocoEl -> contaIdx da volta sendo varrida
  const posicaoNaRodadaPorBloco = new Map(); // blocoEl -> itens desta volta já varridos

  for(let i = 0; i < fila.length; i++){
    const item = fila[i];

    // Marcadores [pausa]{n} nunca contam como "ponto de retomada" — ver
    // itemJaConcluido para mais contexto sobre por que isso é necessário.
    if(item.tipo === 'pausa') continue;

    if(item.secaoIdx >= 0 && concluidas.includes(item.secaoIdx)) continue;

    let jaConcluido = false;
    let decidido = false;

    if(item.historicoRepeticoes && item.historicoRepeticoes.length){
      const repeticoes = item.historicoRepeticoes;
      for(let n = 0; n < repeticoes.length; n++){
        const rep = repeticoes[n];
        const ehNivelMaisInterno = n === repeticoes.length - 1;
        const secaoIdxBloco = rep.blocoEl && rep.blocoEl.dataset.secaoIdx != null
          ? parseInt(rep.blocoEl.dataset.secaoIdx, 10)
          : -1;

        // Mantém a contagem de posição dentro da volta atual DESTE bloco.
        // Se a volta mudou desde o último item visto, reinicia a contagem.
        if(rodadaAtualPorBloco.get(rep.blocoEl) !== rep.contaIdx){
          rodadaAtualPorBloco.set(rep.blocoEl, rep.contaIdx);
          posicaoNaRodadaPorBloco.set(rep.blocoEl, 0);
        }
        const posicaoAntes = posicaoNaRodadaPorBloco.get(rep.blocoEl) || 0;
        posicaoNaRodadaPorBloco.set(rep.blocoEl, posicaoAntes + 1);

        if(secaoIdxBloco < 0 || decidido) continue;

        // O bloco repetido inteiro foi marcado manualmente como concluído
        // (check verde no próprio bloco) — pula tudo dentro dele, mesmo que
        // o contador de voltas (contas_) não tenha sido incrementado.
        if(concluidas.includes(secaoIdxBloco)){
          jaConcluido = true;
          decidido = true;
          continue;
        }

        const contasConcluidas = parseInt(
          localStorage.getItem(`contas_${oracaoAtualId}_${secaoIdxBloco}`) || '0', 10
        );

        if(rep.contaIdx <= contasConcluidas){
          // Volta já concluída neste nível → todo o conteúdo dentro dela
          // (inclusive níveis mais internos) já foi feito.
          jaConcluido = true;
          decidido = true;
        }else if(rep.contaIdx === contasConcluidas + 1){
          // Volta em andamento neste nível. Se houver um nível mais interno
          // ainda por checar (ex: "setena x7" contendo "contas pequenas
          // x7"), NÃO decide aqui — deixa o próximo laço checar o contador
          // de voltas do nível interno, que é mais preciso (foi ele que o
          // usuário marcou manualmente, por exemplo).
          if(ehNivelMaisInterno){
            // Último nível da cadeia para ESTE item (ex: uma linha fixa
            // como "Coroa das lágrimas (pai)", que não é ela mesma um
            // bloco repetido). Antes de usar a posição salva (subpos),
            // verifica se existe um bloco repetido ANINHADO dentro desta
            // mesma volta que já tenha pelo menos uma volta própria
            // concluída (contas > 0). Se sim, isso implica que o conteúdo
            // fixo desta volta — que sempre vem ANTES do aninhado na
            // ordem de leitura — já foi necessariamente falado, mesmo que
            // o subpos ainda não saiba disso (ex: quando o progresso foi
            // marcado manualmente pelas contas, em vez de pela fala real).
            const avancouEmNivelAninhado = Array.from(
              rep.blocoEl.querySelectorAll('.bloco-ref[data-secao-idx]')
            ).some(blocoAninhado => {
              const idxAninhado = parseInt(blocoAninhado.dataset.secaoIdx, 10);
              if(Number.isNaN(idxAninhado)) return false;
              const contasAninhadas = parseInt(
                localStorage.getItem(`contas_${oracaoAtualId}_${idxAninhado}`) || '0', 10
              );
              return contasAninhadas > 0;
            });

            if(avancouEmNivelAninhado){
              jaConcluido = true;
            }else{
              const subposConcluida = parseInt(
                localStorage.getItem(`subpos_${oracaoAtualId}_${secaoIdxBloco}`) || '0', 10
              );
              jaConcluido = posicaoAntes < subposConcluida;
            }
            decidido = true;
          }
        }
        // rep.contaIdx > contasConcluidas + 1: estado inesperado — não
        // decide aqui, mantém jaConcluido=false (trata como pendente).
      }
    }


    if(!jaConcluido) return i;
  }

  return null;
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
  ativarWakeLock();
  atualizarBotaoFala();
  falarProximaLinha();
}

function pausarFala(){
  if(!falando || pausado) return;
  pausado = true;
  desativarWakeLock();
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
  ativarWakeLock();
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

  // Detecta se este item é o início de uma NOVA volta de algum bloco repetido
  // (contaIdx volta a 1) e, nesse caso, zera o contador de contas/localStorage
  // desse bloco ANTES de qualquer checagem de "pular item já concluído".
  // Isso precisa acontecer primeiro: se um bloco repetido está aninhado
  // dentro de outro (ex: "contas pequenas x7" dentro de "setena x7"), o
  // contador de contas do bloco interno chega a "completo" ao fim da 1ª
  // volta externa e fica assim guardado no localStorage. Se a checagem de
  // "já concluído" rodasse antes do reset, ela leria esse valor antigo
  // (da volta anterior) e pularia a volta INTEIRA seguinte por engano —
  // e isso em cascata pulava todas as voltas restantes do bloco de fora.
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

        // A cada NOVA volta (não só a primeira), zera a posição-dentro-da-volta
        // guardada (usada só para saber exatamente onde retomar depois de uma
        // pausa — ver `subpos_` mais abaixo, no onend). Sem isso, o valor da
        // volta anterior "vazava" para a volta nova e confundia o cálculo de
        // retomada.
        if(entrandoNovaVolta){
          const idxProprioSubpos = rep.blocoEl.dataset.secaoIdx;
          if(idxProprioSubpos != null){
            localStorage.removeItem(`subpos_${oracaoAtualId}_${idxProprioSubpos}`);
          }
        }

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
      }
    });
  }

  // Proteção: se este item já foi concluído (ex: usuário marcou manualmente
  // uma conta ou seção enquanto a fala estava em outra posição), pula para o
  // próximo sem falar — evita repetir o que o usuário já sinalizou como
  // rezado. Usa a mesma checagem hierárquica (do bloco mais externo para o
  // mais interno) usada ao retomar de uma pausa, para funcionar corretamente
  // também em repetições aninhadas (ex: "setena x7" com "contas pequenas x7"
  // dentro).
  if(itemJaConcluido(item)){
    indiceFalaAtual++;
    falarProximaLinha();
    return;
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

  if (item.repetido && item.historicoRepeticoes) {
    item.historicoRepeticoes.forEach(rep => {
      const fileira = rep.blocoEl.querySelector('.fileira-contas');
      if (fileira) {
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
        // Marca que mais um item desta volta foi concluído — usado só para
        // saber, ao retomar de uma pausa, exatamente onde parar dentro da
        // volta em andamento (ver calcularIndiceInicialFala). É reiniciado
        // sempre que uma volta nova começa (mais acima, em falarProximaLinha).
        const idxProprioSubpos = rep.blocoEl.dataset.secaoIdx;
        if(idxProprioSubpos != null){
          const chaveSubpos = `subpos_${oracaoAtualId}_${idxProprioSubpos}`;
          const posAtual = parseInt(localStorage.getItem(chaveSubpos) || '0', 10);
          localStorage.setItem(chaveSubpos, posAtual + 1);
        }

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
  desativarWakeLock();
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
