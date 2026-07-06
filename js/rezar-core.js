// js/rezar-core.js — Núcleo compartilhado da tela "Rezar"
// Sem dependências de outros módulos ao nível de definição (só usa
// construirArvore/renderizarNos, de js/render-tree.js, dentro do corpo das
// funções — resolvidos em tempo de chamada, não de carregamento). Por isso
// pode ser incluído em qualquer ordem em relação a render-tree.js, tanto em
// index.html quanto em admin.html.
//
// Etapa 2 do PLANO-UNIFICACAO-TELA-REZAR.md: partes puras e já
// compartilháveis (renderização de texto + isolamento de progresso).
// Etapa 4: controlador genérico da "casca" da tela (criarTelaRezar), hoje
// usado só pelo contexto do usuário — o contexto do admin (Etapa 5) vai
// reaproveitar a mesma função com outra config, sem duplicar lógica.

// ID reservado para isolar o progresso de leitura de uma pré-visualização
// (ex: preview do admin) do progresso real de qualquer oração do usuário.
// Nenhuma oração de verdade deve usar este id.
const ID_PREVIEW_REZAR = '__preview_admin__';

// Renderiza o texto de uma oração dentro de um container, usando a mesma
// árvore/engine (construirArvore + renderizarNos) tanto para a tela Rezar
// do usuário quanto para o preview do admin — hoje eram duas cópias quase
// idênticas (renderizarTextoRezar em app.js e previewRenderizarTexto em
// admin.html), esta função substitui as duas.
//
// container: elemento DOM onde o texto renderizado entra.
// ctx: contexto de progresso, no mesmo formato que renderizarNos espera:
//   - um objeto { n, oracaoId, elementos } → habilita os checks (✓) de
//     progresso, associados a oracaoId (ver criarContextoProgresso);
//   - null → renderização "somente leitura", sem checks nem progresso
//     (é o que o preview do admin sempre usa, e o que a tela do usuário usa
//     enquanto não há oração aberta).
// mensagemVazio: texto mostrado quando a oração ainda não tem conteúdo
// (o usuário e o admin usam frases ligeiramente diferentes aqui).
function renderizarTextoNaTela(textoOriginal, container, ctx, mensagemVazio){
  container.innerHTML = '';

  const arvore = construirArvore(textoOriginal, new Set());
  renderizarNos(arvore, container, ctx);

  if(container.innerHTML.trim() === ''){
    container.innerHTML = `<p class="dica">${mensagemVazio}</p>`;
  }
}

// Formaliza a estratégia de isolamento de progresso como um recurso
// configurável: quem está abrindo a tela decide, passando ou não um
// oracaoId, se quer progresso real (ctx habilitado) ou uma renderização
// sem progresso (ctx null) — é a mesma decisão que hoje é tomada "na mão"
// em cada lugar (renderizarTextoRezar sempre monta ctx a partir de
// oracaoAtualId; previewAbrir do admin sempre fixa secaoCtxAtual = null).
//
// Uso típico:
//   - tela do usuário: criarContextoProgresso(oracaoAtualId) → progresso real
//   - preview do admin: null direto (sem chamar esta função), ou
//     criarContextoProgresso(ID_PREVIEW_REZAR) nas etapas futuras, quando o
//     preview passar a ter sua própria barra de progresso isolada
function criarContextoProgresso(oracaoId){
  return oracaoId ? { n: 0, oracaoId, elementos: [] } : null;
}

// Remove do localStorage todas as chaves de contagem de contas/terço
// ("contas_<id>_<secao>") E de posição-dentro-da-volta ("subpos_<id>_<secao>")
// pertencentes a um id específico. Usado tanto para reiniciar o progresso
// real de uma oração (usuário) quanto para limpar o "lixo" acumulado sob o
// id de preview isolado a cada nova sessão de teste (admin) — hoje eram dois
// laços idênticos escrevendo a mesma coisa duas vezes (limparProgressoLeitura
// em render-tree.js e limparContasPreview em admin.html).
//
// IMPORTANTE: "subpos_" precisa ser limpo junto com "contas_". Ele guarda a
// posição exata dentro da volta em andamento (usada por calcularIndiceInicialFala
// em js/speech.js para retomar depois de uma pausa). Se ficasse órfão de uma
// sessão anterior, um valor antigo poderia "vazar" para uma nova rodada de
// progresso marcado manualmente e fazer a fala retomar num ponto errado.
function limparContasDoId(id){
  for(let i = localStorage.length - 1; i >= 0; i--){
    const chave = localStorage.key(i);
    if(chave && (chave.startsWith(`contas_${id}_`) || chave.startsWith(`subpos_${id}_`))){
      localStorage.removeItem(chave);
    }
  }
}

// Etapa 4 do PLANO-UNIFICACAO-TELA-REZAR.md: controlador genérico da tela
// Rezar, parametrizado por contexto ('usuario' hoje, 'admin' na Etapa 5).
//
// criarTelaRezar(config) não abre nada sozinho — só monta e devolve um
// objeto com o método abrir(id, origem, tipo). Quem instancia a config
// decide, via callbacks, tudo que é específico do contexto (onde estão os
// dados, como atualizar a UI, para onde voltar ao fechar). O núcleo aqui só
// garante a ORDEM das operações — a mesma ordem que o abrirRezar original
// (usuário) sempre seguiu: define as globais de estado ANTES de procurar a
// oração (mesmo que a oração não exista, o "estado atual" já mudou), e só
// então, se a oração existir, atualiza a UI e troca de tela.
//
// config esperada:
//   carregarOracao(id, tipo) → retorna a oração ou undefined/null
//   definirEstado(id, origem, tipo) → seta as globais do contexto (ex:
//     oracaoAtualId/oracaoAtualTipo/origemRezar no usuário), aplicando os
//     mesmos defaults que o código original aplicava
//   atualizarUI(oracao, { origem, tipo }) → popula título, estrela, botões,
//     texto, dataset, etc. — tudo que é visual e específico do contexto
//   mostrarTela() → troca para a view certa (mostrarView('view-rezar') no
//     usuário; view-rezar-admin na Etapa 5)
function criarTelaRezar(config){
  return {
    abrir(id, origem, tipo){
      // Mesma ordem do abrirRezar original: estado primeiro, mesmo que a
      // oração não exista — nenhuma outra parte do app deve observar uma
      // inconsistência entre "id atual" e "o que está de fato na tela".
      config.definirEstado(id, origem, tipo);

      const o = config.carregarOracao(id, tipo);
      if(!o) return;

      config.atualizarUI(o, { id, origem, tipo });
      config.mostrarTela();
    }
  };
}
