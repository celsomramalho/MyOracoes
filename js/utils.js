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
