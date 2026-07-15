# Refatoração de Código (App vs Admin)

O objetivo desta refatoração é eliminar a dívida técnica criada pela duplicação de funções entre o `app.js` (interface do usuário) e o `js/admin.js` (interface de administração), movendo as lógicas compartilhadas para o arquivo `js/utils.js` ou `js/speech.js`.

## User Review Required

> [!WARNING]
> Como essa alteração afeta tanto a tela principal quanto a área do administrador, precisaremos testar a navegação e o radinho de voz em ambos os lados após a execução. Por favor, valide se a abordagem abaixo está alinhada com suas expectativas.

## Proposed Changes

Abaixo está o plano de ataque dividido por componentes de duplicação:

### 1. Refatoração da Topbar (Redimensionamento)
A lógica que calcula a altura da topbar e ajusta as variáveis do CSS (shadows/paddings) está integralmente duplicada (`atualizarAlturaTopbar` e `atualizarAlturaTopbarAdmin`).

#### [x] [utils.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/js/utils.js)
- Criar a função genérica `inicializarAlturaTopbar()` que adicionará os event listeners no `window` (load e resize) e atuará em qualquer elemento `.topbar` encontrado.
- Executar essa função automaticamente no carregamento do script.

#### [x] [app.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/app.js)
- Deletar a função `atualizarAlturaTopbar()` e os event listeners correspondentes.

#### [x] [admin.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/js/admin.js)
- Deletar a função `atualizarAlturaTopbarAdmin()` e os event listeners correspondentes.

---

### 2. Refatoração do Controle de Velocidade
Ambos possuem o controle para alterar a velocidade da voz (`alternarVelocidade` e `atualizarBotaoVelocidade`), mudando apenas o ID do botão (`btn-velocidade` vs `btn-velocidade-admin`).

#### [x] [speech.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/js/speech.js)
- Mover a matemática de velocidade (`alternarVelocidade`) para este arquivo central.
- A função vai atualizar automaticamente *ambos* os IDs (`btn-velocidade` e `btn-velocidade-admin`) se eles estiverem na tela.
- Exportar globalmente a função central `alternarVelocidadeVoz()`.

#### [x] [app.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/app.js)
- Deletar as funções de velocidade locais. O HTML (através do `onclick` se houver, ou no wire de eventos) chamará a nova função do `speech.js`.

#### [x] [admin.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/js/admin.js)
- Deletar as funções de velocidade locais.

---

### 3. Refatoração da Navegação de Telas (`mostrarView`)
O esqueleto da troca de telas é idêntico: esconde todas as views, mostra a view alvo, para a fala, e sobe o scroll.

#### [x] [utils.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/js/utils.js)
- Adicionar função `trocarViewAtiva(id)` que fará o core: remover `.view-active` de todas, aplicar na nova, chamar `pararFala()` e dar `window.scrollTo(0,0)`.

#### [x] [app.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/app.js)
- Alterar `mostrarView(id)` para chamar primeiro `trocarViewAtiva(id)` e depois processar apenas a lógica de manipular o estado do App (como setar `appEl.dataset.tela`).

#### [x] [admin.js](file:///C:/Users/Celso%20Ramalho/Documents/GitHub/MyOracoes/js/admin.js)
- Alterar `mostrarView(id)` para chamar primeiro `trocarViewAtiva(id)` e depois manter apenas a lógica de controlar quais botões da topbar do admin aparecem/somem.

## Verification Plan

Assim que for aprovado, criarei um arquivo de `task.md` (TODO list) que nós dois usaremos para rastrear o progresso. Eu marcarei `[x]` a cada bloco refatorado e testarei se:
1. O site continua rodando sem erros de lint (`npm run lint`).
2. A voz ainda troca de velocidade adequadamente de 1.0x até 2.0x tanto no app quanto no admin.
3. As abas transitam perfeitamente em ambas as áreas.
