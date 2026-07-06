// js/utils.js — Funções utilitárias puras (sem dependências de outros módulos)

// ===================== ESCAPE DE HTML =====================
function escaparHTML(texto){
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// ===================== HELPERS DE CARD =====================
function obterInicial(titulo){
  const t = (titulo || '').trim();
  return t ? t[0].toUpperCase() : '?';
}

// Remove marcações internas do texto (ex: [Título|id]{n} -> Título; [pausa]{n} -> removido)
// para exibição em listagens/prévias. O id após "|" é controle interno e nunca deve aparecer.
function limparMarcacoesTexto(texto){
  return (texto || '').replace(/\[([^\[\]]+)\](?:\{(?:\d+|opcional)\})?/gi, (match, conteudo) => {
    const partes = conteudo.split('|');
    const titulo = partes[0].trim();
    return /^pausa$/i.test(titulo) ? '' : titulo;
  });
}

function primeiraLinhaUtil(texto){
  const linha = limparMarcacoesTexto(texto).split('\n').map(l => l.trim()).find(l => l.length > 0);
  return linha ? linha.replace(/^V\.\s*|^R\.\s*/,'') : '';
}

// ===================== BUSCA (acento/caixa-insensível) =====================
function normalizarBusca(texto){
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

// ===================== BOTÃO "X" PARA LIMPAR CAMPOS DE BUSCA =====================
// Identifica automaticamente todo campo de busca (placeholder com o emoji 🔎),
// envolve o input num wrapper e injeta um botão "✕" à direita para limpar o
// texto digitado. Não é preciso alterar cada tela: basta o input já existir
// no HTML com um placeholder que comece com 🔎.
function inicializarBotoesLimparBusca(raiz){
  const escopo = raiz || document;
  const campos = escopo.querySelectorAll('input[type="text"]');

  campos.forEach(input => {
    if (!input.placeholder || !input.placeholder.includes('🔎')) return;
    if (input.dataset.limparBuscaPronto) return; // evita duplicar se a função rodar mais de uma vez
    input.dataset.limparBuscaPronto = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'campo-busca-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const btnLimpar = document.createElement('button');
    btnLimpar.type = 'button';
    btnLimpar.className = 'btn-limpar-busca';
    btnLimpar.setAttribute('aria-label', 'Limpar busca');
    btnLimpar.textContent = '✕';
    wrapper.appendChild(btnLimpar);

    function atualizarVisibilidade(){
      btnLimpar.classList.toggle('visivel', input.value.length > 0);
    }

    btnLimpar.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      atualizarVisibilidade();
    });

    input.addEventListener('input', atualizarVisibilidade);
    atualizarVisibilidade();
  });
}
