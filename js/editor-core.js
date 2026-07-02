// js/editor-core.js — Funções puras compartilhadas do editor de orações
// Sem dependências de outros módulos: pode ser carregado antes ou depois de
// qualquer outro script, tanto em index.html quanto em admin.html.

// ===================== URL =====================

// Garante que a URL começa com https:// (ou http://).
// Retorna string vazia se a entrada for vazia.
function normalizarUrlInserida(url){
  const limpa = (url || '').trim();
  if(!limpa) return '';
  if(/^https?:\/\//i.test(limpa)) return limpa;
  return `https://${limpa}`;
}

// ===================== MARCADORES DE REFERÊNCIA =====================

// Retorna o marcador base de uma oração: [Titulo|id]
// O id garante resolução mesmo que o título seja renomeado.
// Referências legadas sem id ([Titulo]) continuam sendo suportadas pelo render-tree.
function criarMarcadorReferencia(oracao){
  return `[${oracao.titulo}|${oracao.id}]`;
}

// Retorna o marcador de referência com repetição opcional:
//   quantidade = 1  → [Titulo|id]
//   quantidade > 1  → [Titulo|id]{N}
function montarMarcadorReferencia(oracao, quantidade){
  const base = criarMarcadorReferencia(oracao);
  return quantidade > 1 ? `${base}{${quantidade}}` : base;
}

// Retorna o marcador de leitura opcional: [Titulo|id]{opcional}
// Fica oculto por padrão e fora da narração até o usuário decidir expandir.
function montarMarcadorOpcional(oracao){
  return `${criarMarcadorReferencia(oracao)}{opcional}`;
}

// ===================== MARCADORES SIMPLES =====================

// Retorna o marcador de pausa: [pausa]{N}  (N = segundos, 1-30)
function montarMarcadorPausa(segundos){
  return `[pausa]{${segundos}}`;
}

// Retorna o marcador de link: [link:https://...]
// Aparece na tela de rezar como botão para abrir, mas não entra na narração.
function montarMarcadorLink(url){
  return `[link:${url}]`;
}

// ===================== CONTROLADOR DE INSERÇÃO =====================

function criarControladorInsercao(config) {
  let posicaoCursorSalva = null;
  let modoInserirOpcional = false;
  let aoConfirmarNumero = null;

  // Cache dos elementos DOM
  const dom = {};
  for (const [chave, id] of Object.entries(config.ids)) {
    dom[chave] = document.getElementById(id);
  }

  const sufixo = config.sufixoNovalinha ? '\n' : '';
  const preventScroll = !!config.preventScrollFocus;

  // Auxiliar para focar e restaurar a seleção/cursor no textarea
  function focarTextarea(posFinal) {
    if (!dom.textarea) return;
    if (preventScroll) {
      dom.textarea.focus({ preventScroll: true });
    } else {
      dom.textarea.focus();
    }
    if (posFinal !== undefined) {
      dom.textarea.setSelectionRange(posFinal, posFinal);
      posicaoCursorSalva = posFinal;
    }
  }

  // Auxiliar para inserir qualquer texto na posição salva ou no final
  function inserirTextoNoCursor(textoInserido) {
    const inputTexto = dom.textarea;
    if (!inputTexto) return;
    const pos = posicaoCursorSalva != null ? posicaoCursorSalva : inputTexto.value.length;
    const antes = inputTexto.value.slice(0, pos);
    const depois = inputTexto.value.slice(pos);
    inputTexto.value = antes + textoInserido + depois;
    if (config.aoInserir) config.aoInserir();
    focarTextarea(pos + textoInserido.length);
  }

  // Rastreamento contínuo do cursor (usado no Admin)
  if (config.rastrearCursorContinuamente && dom.textarea) {
    const atualizarCursor = () => {
      posicaoCursorSalva = dom.textarea.selectionStart;
    };
    dom.textarea.addEventListener('keyup', atualizarCursor);
    dom.textarea.addEventListener('click', atualizarCursor);
    dom.textarea.addEventListener('select', atualizarCursor);
  }

  // Menu "+ Inserir" dropdown
  function fecharMenuInserir() {
    if (dom.menuInserir) dom.menuInserir.classList.add('hidden');
    if (dom.btnInserir) dom.btnInserir.setAttribute('aria-expanded', 'false');
  }

  function alternarMenuInserir() {
    if (!dom.menuInserir || !dom.btnInserir) return;
    const abrindo = dom.menuInserir.classList.contains('hidden');
    dom.menuInserir.classList.toggle('hidden', !abrindo);
    dom.btnInserir.setAttribute('aria-expanded', String(abrindo));
  }

  if (dom.btnInserir) {
    dom.btnInserir.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarMenuInserir();
    });
  }

  document.addEventListener('click', (e) => {
    if (dom.menuInserir && !dom.menuInserir.classList.contains('hidden') && !dom.menuInserir.contains(e.target) && e.target !== dom.btnInserir) {
      fecharMenuInserir();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharMenuInserir();
  });

  // Modal 1: Inserir Oração / Leitura Opcional
  function abrirModalInserir(opcional) {
    modoInserirOpcional = !!opcional;
    if (!dom.textarea) return;

    if (!config.rastrearCursorContinuamente) {
      posicaoCursorSalva = dom.textarea.selectionStart;
    }
    if (posicaoCursorSalva == null) {
      posicaoCursorSalva = dom.textarea.value.length;
    }

    if (dom.modalInserirTitulo) {
      dom.modalInserirTitulo.textContent = modoInserirOpcional ? 'Inserir leitura opcional' : 'Inserir oração';
    }
    if (dom.modalInserirDica) {
      dom.modalInserirDica.textContent = modoInserirOpcional 
        ? 'Toque em uma oração para inseri-la como leitura opcional: fica oculta e fora da fala até o usuário decidir mostrar na hora de rezar.'
        : 'Toque em uma oração para inserir a referência a ela no texto.';
    }

    if (dom.inputBuscaInserir) dom.inputBuscaInserir.value = '';
    renderizarLista('');
    if (dom.modalInserir) dom.modalInserir.classList.remove('hidden');
    if (dom.inputBuscaInserir) dom.inputBuscaInserir.focus();
  }

  function fecharModalInserir() {
    if (dom.modalInserir) dom.modalInserir.classList.add('hidden');
  }

  function renderizarLista(termo) {
    if (!dom.listaModalInserir) return;
    dom.listaModalInserir.innerHTML = '';

    const disponiveis = config.listarOracoes(termo);

    if (disponiveis.length === 0) {
      dom.listaModalInserir.innerHTML = '<p class="dica">Nenhuma oração encontrada.</p>';
      return;
    }

    disponiveis.forEach(o => {
      const item = document.createElement('div');
      item.className = 'item-modal';
      if (config.renderizarItemLista) {
        item.innerHTML = config.renderizarItemLista(o);
      } else {
        item.textContent = o.titulo;
      }
      item.addEventListener('click', () => {
        if (modoInserirOpcional) {
          inserirTextoNoCursor(montarMarcadorOpcional(o) + sufixo);
          fecharModalInserir();
        } else {
          abrirModalNumero({
            titulo: 'Repetir oração',
            dica: `Quantas vezes rezar "${o.titulo}" aqui? Use 1 para rezar uma única vez.`,
            valorInicial: 1,
            min: 1,
            max: 200,
            aoConfirmar: (quantidade) => {
              inserirTextoNoCursor(montarMarcadorReferencia(o, quantidade) + sufixo);
              fecharModalInserir();
            }
          });
        }
      });
      dom.listaModalInserir.appendChild(item);
    });
  }

  if (dom.btnInserirOracao) {
    dom.btnInserirOracao.addEventListener('click', () => {
      fecharMenuInserir();
      abrirModalInserir(false);
    });
  }
  if (dom.btnInserirOpcional) {
    dom.btnInserirOpcional.addEventListener('click', () => {
      fecharMenuInserir();
      abrirModalInserir(true);
    });
  }
  if (dom.btnFecharModalInserir) {
    dom.btnFecharModalInserir.addEventListener('click', fecharModalInserir);
  }
  if (dom.inputBuscaInserir) {
    dom.inputBuscaInserir.addEventListener('input', (e) => {
      renderizarLista(e.target.value);
    });
  }

  // Modal 2: Inserir Link
  function abrirModalLink() {
    if (!dom.textarea) return;
    if (!config.rastrearCursorContinuamente) {
      posicaoCursorSalva = dom.textarea.selectionStart;
    }
    if (posicaoCursorSalva == null) {
      posicaoCursorSalva = dom.textarea.value.length;
    }

    if (dom.inputLinkUrl) dom.inputLinkUrl.value = '';
    if (dom.modalLink) dom.modalLink.classList.remove('hidden');
    if (dom.inputLinkUrl) {
      if (preventScroll) {
        dom.inputLinkUrl.focus({ preventScroll: true });
      } else {
        dom.inputLinkUrl.focus();
      }
    }
  }

  function fecharModalLink() {
    if (dom.modalLink) dom.modalLink.classList.add('hidden');
  }

  function confirmarLink() {
    if (!dom.inputLinkUrl) return;
    const url = normalizarUrlInserida(dom.inputLinkUrl.value);
    if (!url) {
      if (window.mostrarToast) {
        window.mostrarToast('Informe uma URL para inserir o link.');
      } else {
        alert('Informe uma URL para inserir o link.');
      }
      return;
    }
    inserirTextoNoCursor(montarMarcadorLink(url) + sufixo);
    fecharModalLink();
  }

  if (dom.btnInserirLink) {
    dom.btnInserirLink.addEventListener('click', () => {
      fecharMenuInserir();
      abrirModalLink();
    });
  }
  if (dom.btnCancelarLink) {
    dom.btnCancelarLink.addEventListener('click', fecharModalLink);
  }
  if (dom.btnConfirmarLink) {
    dom.btnConfirmarLink.addEventListener('click', confirmarLink);
  }
  if (dom.inputLinkUrl) {
    dom.inputLinkUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmarLink();
      if (e.key === 'Escape') fecharModalLink();
    });
  }

  // Modal 3: Modal Número
  function abrirModalNumero({ titulo, dica, valorInicial, min, max, aoConfirmar }) {
    if (!dom.modalNumero) return;
    if (dom.modalNumeroTitulo) dom.modalNumeroTitulo.textContent = titulo;
    if (dom.modalNumeroDica) dom.modalNumeroDica.textContent = dica;

    if (dom.inputNumero) {
      dom.inputNumero.min = String(min);
      dom.inputNumero.max = String(max);
      dom.inputNumero.value = String(valorInicial);
    }

    aoConfirmarNumero = () => {
      if (!dom.inputNumero) return;
      const valor = Math.min(Math.max(parseInt(dom.inputNumero.value, 10) || valorInicial, min), max);
      fecharModalNumero();
      aoConfirmar(valor);
    };

    dom.modalNumero.classList.remove('hidden');
    if (dom.inputNumero) {
      if (preventScroll) {
        dom.inputNumero.focus({ preventScroll: true });
      } else {
        dom.inputNumero.focus();
      }
      dom.inputNumero.select();
    }
  }

  function fecharModalNumero() {
    if (dom.modalNumero) dom.modalNumero.classList.add('hidden');
    aoConfirmarNumero = null;
  }

  if (dom.btnCancelarNumero) {
    dom.btnCancelarNumero.addEventListener('click', fecharModalNumero);
  }
  if (dom.btnConfirmarNumero) {
    dom.btnConfirmarNumero.addEventListener('click', () => {
      if (aoConfirmarNumero) aoConfirmarNumero();
    });
  }
  if (dom.inputNumero) {
    dom.inputNumero.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && aoConfirmarNumero) aoConfirmarNumero();
      if (e.key === 'Escape') fecharModalNumero();
    });
  }

  // Modal Número para o botão de Pausa
  if (dom.btnInserirPausa) {
    dom.btnInserirPausa.addEventListener('click', () => {
      fecharMenuInserir();
      if (!dom.textarea) return;
      if (!config.rastrearCursorContinuamente) {
        posicaoCursorSalva = dom.textarea.selectionStart;
      }
      abrirModalNumero({
        titulo: 'Inserir pausa',
        dica: 'Quantos segundos de pausa? Ex: 2 para uma pequena pausa entre uma oração e outra.',
        valorInicial: 2,
        min: 1,
        max: 30,
        aoConfirmar: (segundos) => {
          inserirTextoNoCursor(montarMarcadorPausa(segundos) + sufixo);
        }
      });
    });
  }
}
