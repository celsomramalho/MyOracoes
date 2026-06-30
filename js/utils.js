// js/utils.js — Funções utilitárias puras (sem dependências de outros módulos)

// ===================== ESCAPE DE HTML =====================
function escaparHTML(texto){
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// ===================== BUSCA (ignora acentos e maiúsculas/minúsculas) =====================
function normalizarBusca(texto){
  return (texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim();
}

// ===================== HELPERS DE CARD =====================
function obterInicial(titulo){
  const t = (titulo || '').trim();
  return t ? t[0].toUpperCase() : '?';
}

function primeiraLinhaUtil(texto){
  const linha = (texto || '').split('\n').map(l => l.trim()).find(l => l.length > 0);
  return linha ? linha.replace(/^V\.\s*|^R\.\s*/,'') : '';
}
