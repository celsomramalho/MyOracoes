// js/components/card.js — Criação de cards de oração
// Depende de: utils.js (escaparHTML, obterInicial, primeiraLinhaUtil)
//             oracoes-data.js (alternarFavorito, alternarFavoritoOficial)
//             app.js (abrirEditor, abrirRezar)

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
