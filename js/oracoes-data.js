// js/oracoes-data.js — CRUD, fetch de oficiais, export/import, compartilhamento

// ===================== CARREGAMENTO DAS OFICIAIS =====================
// Os dados são embutidos diretamente em js/oracoes-oficiais-data.js como
// window.ORACOES_OFICIAIS_DATA para funcionar tanto via servidor HTTP quanto
// por arquivo local (file://), onde fetch() é bloqueado pelo navegador.
function carregarOficiais(){
  ORACOES_OFICIAIS = Array.isArray(ORACOES_OFICIAIS_DATA)
    ? ORACOES_OFICIAIS_DATA
    : [];
  renderizarOficiais('');
  renderizarFavoritas(); // re-renderiza home para incluir favoritas oficiais
  if (typeof renderizarListaModalInserir === 'function') {
    renderizarListaModalInserir(); // atualiza modal de inserir se estiver aberto
  }
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

      // Primeira passada: separa em 3 grupos antes de tocar em qualquer coisa.
      // "mesmoId" = já existe uma oração pessoal com este id (candidata a
      // atualização, não duplicata de verdade — provavelmente é a mesma
      // oração, exportada de novo depois de editada).
      const novas = [];
      const mesmoId = []; // { existente, novo }
      const bloqueadasTitulo = [];

      lista.forEach(o => {
        if(!o.titulo || typeof o.titulo !== 'string') return;
        const nomeLower = o.titulo.trim().toLowerCase();

        const existentePorId = o.id ? ORACOES.find(x => x.id === o.id) : null;
        if(existentePorId){
          mesmoId.push({ existente: existentePorId, novo: o });
          return;
        }

        const duplicadaPessoal = ORACOES.find(x => x.titulo.trim().toLowerCase() === nomeLower);
        const duplicadaOficial = ORACOES_OFICIAIS.find(x => x.titulo.trim().toLowerCase() === nomeLower);

        if(duplicadaPessoal || duplicadaOficial){
          bloqueadasTitulo.push(o.titulo);
          return;
        }

        novas.push(o);
      });

      // Um único confirm pra todo o grupo "mesmoId" (não um por oração).
      let atualizadas = 0;
      let ignoradasPorId = 0;
      if(mesmoId.length > 0){
        const sobrescrever = confirm(
          `${mesmoId.length} oração(ões) do arquivo já existe(m) no seu app (mesmo identificador). Substituir pela versão do arquivo?`
        );
        if(sobrescrever){
          mesmoId.forEach(({ existente, novo }) => {
            // Preserva o favorita atual — a pessoa já decidiu isso localmente.
            existente.titulo = novo.titulo.trim();
            existente.texto = novo.texto || '';
          });
          atualizadas = mesmoId.length;
        }else{
          ignoradasPorId = mesmoId.length;
        }
      }

      novas.forEach(o => {
        ORACOES.push({
          id: o.id || gerarId(),
          titulo: o.titulo.trim(),
          texto: o.texto || '',
          favorita: true
        });
      });

      salvarOracoes(ORACOES);
      renderizarTudo();

      const partes = [];
      if(novas.length > 0) partes.push(`${novas.length} nova(s)`);
      if(atualizadas > 0) partes.push(`${atualizadas} atualizada(s)`);
      if(bloqueadasTitulo.length > 0) partes.push(`${bloqueadasTitulo.length} bloqueada(s) por título já existente: "${bloqueadasTitulo.join('", "')}"`);
      if(ignoradasPorId > 0) partes.push(`${ignoradasPorId} ignorada(s) (já existiam)`);

      const msg = partes.length > 0 ? partes.join('\n') : 'Nenhuma oração nova encontrada no arquivo.';
      mostrarToast(msg, (novas.length > 0 || atualizadas > 0) ? 'sucesso' : '');

    }catch(e){
      mostrarToast('Erro ao ler o arquivo. Certifique-se de que é um JSON válido.');
    }
  });
  input.click();
}

// ===================== COMPARTILHAR VIA LINK MÁGICO =====================
const LINK_APP_MYORACOES = 'https://myoracoes.vercel.app/';

function compartilharApp(){
  const texto = `Quero compartilhar este aplicativo que estou usando para rezar e criar orações personalizadas.\n\n${LINK_APP_MYORACOES}`;

  // Copia o texto completo ANTES de tentar compartilhar: assim, mesmo que o
  // compartilhamento nativo não role (ex: no computador, sem app de
  // WhatsApp instalado), o texto já fica pronto na área de transferência
  // pra colar em qualquer lugar (WhatsApp Web, e-mail, etc.).
  copiarParaClipboard(texto, { silencioso: true });

  try{
    if(navigator.share){
      navigator.share({ title: 'MyOrações', text: texto }).catch(() => {
        mostrarToast('Texto copiado! Cole onde quiser.', 'sucesso');
      });
    }else{
      // Fallback: WhatsApp Web
      const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(urlWhatsApp, '_blank');
      mostrarToast('Texto copiado! Cole onde quiser.', 'sucesso');
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
    // Leva o id junto: é o que permite reconhecer, do outro lado, que uma
    // reimportação é "a mesma oração" (ex: o autor corrigiu o texto e
    // reenviou o link) em vez de tratar como duplicata por título.
    const dadosStr = JSON.stringify({ id: o.id, titulo: o.titulo, texto: o.texto });
    const base64 = btoa(unescape(encodeURIComponent(dadosStr)));
    const link = `${window.location.origin}${window.location.pathname}?importar=${base64}`;

    const texto = `Quero compartilhar esta oração com você pelo app MyOrações:\n\n"${o.titulo}"\n\n${link}`;

    // Copia o texto completo ANTES de tentar compartilhar (mesmo motivo de
    // compartilharApp): garante que o usuário sempre tem o texto pronto pra
    // colar, independente do compartilhamento nativo funcionar ou não —
    // útil sobretudo no computador, onde dá pra colar direto no WhatsApp Web.
    copiarParaClipboard(texto, { silencioso: true });

    if(navigator.share){
      navigator.share({ title: o.titulo, text: texto }).catch(() => {
        mostrarToast('Texto copiado! Cole onde quiser.', 'sucesso');
      });
    }else{
      // Fallback: WhatsApp Web
      const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(urlWhatsApp, '_blank');
      mostrarToast('Texto copiado! Cole onde quiser.', 'sucesso');
    }
  }catch(e){
    mostrarToast('Não foi possível gerar o link de compartilhamento.');
  }
}

function copiarParaClipboard(texto, opcoes){
  const silencioso = opcoes && opcoes.silencioso;
  navigator.clipboard.writeText(texto).then(() => {
    if(!silencioso) mostrarToast('Link copiado para a área de transferência!', 'sucesso');
  }).catch(() => {
    if(!silencioso) mostrarToast('Não foi possível copiar o link automaticamente.');
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

    // dados.id pode não existir em links gerados antes desta versão —
    // nesse caso cai no fluxo normal de "oração nova" (sem checagem por id).
    exibirModalImportacaoLink(dados.id || null, dados.titulo, dados.texto || '');
  }catch(e){
    mostrarToast('Não foi possível ler os dados do link de compartilhamento.');
  }
}

function exibirModalImportacaoLink(id, titulo, texto){
  const modal = document.getElementById('modal-importar-link');
  if(!modal) return;

  const existente = id ? ORACOES.find(o => o.id === id) : null;

  document.getElementById('importar-link-titulo').textContent = `"${titulo}"`;

  if(existente){
    document.getElementById('importar-link-emoji-titulo').textContent = '🔄 Oração já importada';
    document.getElementById('importar-link-intro').textContent = 'Você já tem esta oração nas suas orações pessoais:';
    document.getElementById('importar-link-pergunta').textContent = 'Importar assim mesmo e atualizar com esta versão?';
    document.getElementById('btn-importar-link-sim').textContent = 'Sim, atualizar';
  }else{
    document.getElementById('importar-link-emoji-titulo').textContent = '🎁 Oração compartilhada';
    document.getElementById('importar-link-intro').textContent = 'Alguém compartilhou uma oração com você:';
    document.getElementById('importar-link-pergunta').textContent = 'Deseja adicioná-la às suas orações pessoais?';
    document.getElementById('btn-importar-link-sim').textContent = 'Sim, adicionar';
  }

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
    importarUmaOracao(id, titulo, texto);
  });
  novoNao.addEventListener('click', () => modal.classList.add('hidden'));
}

function importarUmaOracao(id, titulo, texto){
  const existentePorId = id ? ORACOES.find(o => o.id === id) : null;

  if(existentePorId){
    // Mesma oração de antes (mesmo id) — atualiza no lugar, preservando o
    // favorita que a pessoa já tinha decidido localmente.
    existentePorId.titulo = titulo.trim();
    existentePorId.texto = texto || '';
    salvarOracoes(ORACOES);
    renderizarTudo();
    mostrarToast(`Oração "${titulo}" atualizada!`, 'sucesso');
    return;
  }

  const nomeLower = titulo.trim().toLowerCase();
  const duplicadaPessoal = ORACOES.find(o => o.titulo.trim().toLowerCase() === nomeLower);
  const duplicadaOficial = ORACOES_OFICIAIS.find(o => o.titulo.trim().toLowerCase() === nomeLower);

  if(duplicadaPessoal || duplicadaOficial){
    mostrarToast(`Já existe uma oração com o título "${titulo}"${duplicadaOficial ? ' (oficial)' : ''}. Importação cancelada.`);
    return;
  }

  // Mantém o id original do link (em vez de gerar um novo) — é o que
  // permite reconhecer uma reimportação futura desta mesma oração.
  ORACOES.push({ id: id || gerarId(), titulo: titulo.trim(), texto: texto || '', favorita: true });
  salvarOracoes(ORACOES);
  renderizarTudo();
  mostrarToast(`Oração "${titulo}" adicionada às suas orações favoritas!`, 'sucesso');
}
