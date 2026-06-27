// ===================== PROGRESSO DIÁRIO =====================

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
