// js/oracoes-data.js — CRUD, fetch de oficiais, export/import, compartilhamento

// ===================== CARREGAMENTO DAS OFICIAIS =====================
async function carregarOficiais(){
  try{
    const res = await fetch('./oracoes-oficiais.json');
    if(res.ok){
      const dados = await res.json();
      ORACOES_OFICIAIS = Array.isArray(dados) ? dados : [];
    }
  }catch(e){
    ORACOES_OFICIAIS = [];
  }
  renderizarOficiais();
  renderizarFavoritas(); // re-renderiza home para incluir favoritas oficiais
  renderizarListaModalInserir(); // atualiza modal de inserir se estiver aberto
}

// ===================== FAVORITOS =====================
function alternarFavorito(id){
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;
  o.favorita = !o.favorita;
  salvarOracoes(ORACOES);
  renderizarFavoritas();
  renderizarTodas();
  if(oracaoAtualId === id) atualizarEstrelaRezar();
}

function alternarFavoritoOficial(id){
  const idx = favoritasOficiaisIds.indexOf(id);
  if(idx === -1){
    favoritasOficiaisIds.push(id);
  }else{
    favoritasOficiaisIds.splice(idx, 1);
  }
  salvarFavoritasOficiais(favoritasOficiaisIds);
  renderizarFavoritas();
  renderizarOficiais();
  if(oracaoAtualId === id) atualizarEstrelaRezar();
}

// ===================== EXPORTAR / IMPORTAR ORAÇÕES PESSOAIS =====================
function exportarOracoes(){
  const dados = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    oracoes: ORACOES
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `minhas-oracoes-backup-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('Arquivo de backup baixado!', 'sucesso');
}

function importarOracoesDeArquivo(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const arquivo = input.files[0];
    if(!arquivo) return;
    try{
      const texto = await arquivo.text();
      const dados = JSON.parse(texto);

      // Aceita tanto array direto quanto o formato com wrapper { oracoes: [...] }
      let lista = Array.isArray(dados) ? dados : dados.oracoes;
      if(!Array.isArray(lista)){
        mostrarToast('Arquivo inválido. Certifique-se de usar um backup gerado por este app.');
        return;
      }

      let importadas = 0;
      const bloqueadas = [];

      lista.forEach(o => {
        if(!o.titulo || typeof o.titulo !== 'string') return;
        const nomeLower = o.titulo.trim().toLowerCase();

        const duplicadaPessoal = ORACOES.find(x => x.titulo.trim().toLowerCase() === nomeLower);
        const duplicadaOficial = ORACOES_OFICIAIS.find(x => x.titulo.trim().toLowerCase() === nomeLower);

        if(duplicadaPessoal || duplicadaOficial){
          bloqueadas.push(o.titulo);
          return;
        }

        ORACOES.push({
          id: gerarId(),
          titulo: o.titulo.trim(),
          texto: o.texto || '',
          favorita: !!o.favorita
        });
        importadas++;
      });

      salvarOracoes(ORACOES);
      renderizarTudo();

      let msg = '';
      if(importadas > 0) msg += `${importadas} oração(ões) importada(s) com sucesso!`;
      if(bloqueadas.length > 0){
        msg += `${msg ? '\n' : ''}${bloqueadas.length} bloqueada(s) por título já existente: "${bloqueadas.join('", "')}"`;
      }
      if(!msg) msg = 'Nenhuma oração nova encontrada no arquivo.';
      mostrarToast(msg, importadas > 0 ? 'sucesso' : '');

    }catch(e){
      mostrarToast('Erro ao ler o arquivo. Certifique-se de que é um JSON válido.');
    }
  });
  input.click();
}

// ===================== COMPARTILHAR VIA LINK MÁGICO =====================
const LINK_APP_MYORACOES = 'https://myoracoes.vercel.app/';

function compartilharApp(){
  const texto = `Quero compartilhar este aplicativo que estou usando para rezar e criar orações personalizadas chamado MyOrações.\n\n${LINK_APP_MYORACOES}`;

  try{
    if(navigator.share){
      navigator.share({ title: 'MyOrações', text: texto }).catch(() => {
        copiarParaClipboard(LINK_APP_MYORACOES);
      });
    }else{
      // Fallback: WhatsApp Web
      const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(urlWhatsApp, '_blank');
    }
  }catch(e){
    mostrarToast('Não foi possível compartilhar o link.');
  }
}

function compartilharOracao(id){
  const o = ORACOES.find(x => x.id === id);
  if(!o) return;

  try{
    // Codificação segura para UTF-8 (suporta acentos do português)
    const dadosStr = JSON.stringify({ titulo: o.titulo, texto: o.texto });
    const base64 = btoa(unescape(encodeURIComponent(dadosStr)));
    const link = `${window.location.origin}${window.location.pathname}?importar=${base64}`;

    const texto = `Quero compartilhar esta oração com você pelo app MyOrações:\n\n"${o.titulo}"\n\n${link}`;

    if(navigator.share){
      navigator.share({ title: o.titulo, text: texto }).catch(() => {
        copiarParaClipboard(link);
      });
    }else{
      // Fallback: WhatsApp Web
      const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(urlWhatsApp, '_blank');
    }
  }catch(e){
    mostrarToast('Não foi possível gerar o link de compartilhamento.');
  }
}

function copiarParaClipboard(texto){
  navigator.clipboard.writeText(texto).then(() => {
    mostrarToast('Link copiado para a área de transferência!', 'sucesso');
  }).catch(() => {
    mostrarToast('Não foi possível copiar o link automaticamente.');
  });
}

// ===================== RECEBER LINK MÁGICO (?importar=...) =====================
function verificarLinkImportacao(){
  const params = new URLSearchParams(window.location.search);
  const base64 = params.get('importar');
  if(!base64) return;

  // Limpa o parâmetro da URL sem recarregar a página
  const urlLimpa = window.location.pathname;
  history.replaceState(null, '', urlLimpa);

  try{
    const dadosStr = decodeURIComponent(escape(atob(base64)));
    const dados = JSON.parse(dadosStr);

    if(!dados.titulo || typeof dados.titulo !== 'string'){
      mostrarToast('Link inválido ou corrompido.');
      return;
    }

    exibirModalImportacaoLink(dados.titulo, dados.texto || '');
  }catch(e){
    mostrarToast('Não foi possível ler os dados do link de compartilhamento.');
  }
}

function exibirModalImportacaoLink(titulo, texto){
  const modal = document.getElementById('modal-importar-link');
  if(!modal) return;

  document.getElementById('importar-link-titulo').textContent = `"${titulo}"`;
  modal.classList.remove('hidden');

  // Remove listeners antigos para evitar duplicação
  const btnSim = document.getElementById('btn-importar-link-sim');
  const btnNao = document.getElementById('btn-importar-link-nao');
  const novoSim = btnSim.cloneNode(true);
  const novoNao = btnNao.cloneNode(true);
  btnSim.parentNode.replaceChild(novoSim, btnSim);
  btnNao.parentNode.replaceChild(novoNao, btnNao);

  novoSim.addEventListener('click', () => {
    modal.classList.add('hidden');
    importarUmaOracao(titulo, texto);
  });
  novoNao.addEventListener('click', () => modal.classList.add('hidden'));
}

function importarUmaOracao(titulo, texto){
  const nomeLower = titulo.trim().toLowerCase();
  const duplicadaPessoal = ORACOES.find(o => o.titulo.trim().toLowerCase() === nomeLower);
  const duplicadaOficial = ORACOES_OFICIAIS.find(o => o.titulo.trim().toLowerCase() === nomeLower);

  if(duplicadaPessoal || duplicadaOficial){
    mostrarToast(`Já existe uma oração com o título "${titulo}"${duplicadaOficial ? ' (oficial)' : ''}. Importação cancelada.`);
    return;
  }

  ORACOES.push({ id: gerarId(), titulo: titulo.trim(), texto: texto || '', favorita: false });
  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarToast(`Oração "${titulo}" adicionada às suas orações!`, 'sucesso');
}
