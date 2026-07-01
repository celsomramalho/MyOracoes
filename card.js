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
    ? `<span class="badge-oficial-card" title="Oração Oficial">📜</span>`
    : '';

  // Badge de rezada hoje
  const horaRezada = rezadasDiarias[oracao.id];
  const badgeRezada = horaRezada
    ? `<span class="badge-rezada" title="Rezada hoje às ${horaRezada}">✓ ${horaRezada}</span>`
    : '';

  // Botão de compartilhar: só na Home e só para orações pessoais (não oficiais)
  const mostrarCompartilhar = origem === 'home' && !ehOficial;
  const botaoCompartilhar = mostrarCompartilhar
    ? `<button class="btn-compartilhar-card" aria-label="Compartilhar" title="Compartilhar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>`
    : '';

  // Botões Editar/Excluir: só na tela "Criar/Editar" (lista de orações pessoais)
  const mostrarAcoesEditar = origem === 'todas' && tipo === 'pessoal';
  const botoesAcoes = mostrarAcoesEditar
    ? `<div class="card-acoes">
        <button class="btn-secundario btn-editar-card" style="padding: 4px 10px; font-size: 0.9rem;">Editar</button>
        <button class="btn-excluir">Excluir</button>
      </div>`
    : '';

  card.innerHTML = `
    <div class="card-inicial">${escaparHTML(obterInicial(oracao.titulo))}</div>
    <div class="card-corpo">
      <h3>${escaparHTML(oracao.titulo)}${badgeRezada}</h3>
      <p>${escaparHTML(primeiraLinhaUtil(oracao.texto))}</p>
    </div>
    ${badgeOficial}
    ${botaoCompartilhar}
    ${botoesAcoes}
    <button class="btn-estrela-card" aria-label="Favoritar">${ehFavorita ? '★' : '☆'}</button>
  `;

  if(mostrarAcoesEditar){
    card.querySelector('.btn-editar-card').addEventListener('click', (ev) => {
      ev.stopPropagation();
      abrirEditor(oracao.id);
    });
    card.querySelector('.btn-excluir').addEventListener('click', (ev) => {
      ev.stopPropagation();
      excluirOracao(oracao.id);
    });
  }

  if(mostrarCompartilhar){
    card.querySelector('.btn-compartilhar-card').addEventListener('click', (ev) => {
      ev.stopPropagation();
      compartilharOracao(oracao.id);
    });
  }

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
