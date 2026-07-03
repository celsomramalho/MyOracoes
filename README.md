# MyOrações

MyOrações é um **PWA (Progressive Web App) em JavaScript vanilla**, sem frameworks e sem build step, para guardar, organizar e rezar orações — tanto orações pessoais criadas pelo próprio usuário quanto um acervo de "Orações Oficiais" (Pai Nosso, Ave Maria, ladainhas, novenas etc.) mantido pelo administrador do app. 

O app roda inteiramente no navegador: não há backend próprio nem banco de dados — todos os dados pessoais do usuário ficam no `localStorage` do dispositivo, e o app funciona offline graças a um Service Worker.

---

## Orações PWA — Camadas

```
┌───────────────────────────────────────────────────────────┐
│  DADOS                                                    │
│  ├── js/oracoes-data.js       (CRUD, export/import,       │
│  │                              compartilhamento)         │
│  ├── js/oracoes-oficiais-data.js (dados oficiais          │
│  │                              embutidos em JS)          │
│  ├── oracoes-oficiais.json    (fonte bruta das oficiais,  │
│  │                              editada via painel admin) │
│  └── minhas-oracoes-backup-*.json (exports do usuário)    │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  ESTADO                                                    │
│  └── state.js                 (estado global + persistência│
│                                 em localStorage)           │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  LÓGICA                                                    │
│  ├── js/editor-core.js        (funções puras do editor:    │
│  │                              marcadores, normalização   │
│  │                              de URL)                    │
│  └── js/rezar-core.js         (núcleo compartilhado da     │
│                                 tela Rezar, usado também   │
│                                 pelo preview do admin)     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  RENDERIZAÇÃO                                              │
│  ├── js/render-tree.js        (motor de árvore/UI: parsing │
│  │                              dos marcadores e montagem  │
│  │                              do DOM da oração)          │
│  └── js/components/           (card.js, toast.js,          │
│                                 progresso.js — componentes │
│                                 de UI reutilizáveis)       │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  VOZ                                                       │
│  └── js/speech.js              (Web Speech API — leitura   │
│                                  em voz alta, alternando   │
│                                  vozes entre V. e R.)      │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  PWA / INFRA                                               │
│  ├── manifest.json             (manifesto PWA)             │
│  ├── sw.js                     (Service Worker — cache     │
│  │                               offline)                  │
│  └── vercel.json                (configuração de deploy    │
│                                   na Vercel)               │
└────────────────────────────────────────────────────────────┘
```

**Arquivos de apoio (transversais, sem posição fixa numa única camada):**

| Arquivo | Papel |
|---|---|
| `js/utils.js` | Funções utilitárias puras, sem dependência de outros módulos: escapar HTML, extrair a inicial de um título para o card, limpar marcações internas para exibição em listagens, obter a "primeira linha útil" de um texto e normalizar texto para busca (removendo acentos e caixa). |
| `style.css` | Folha de estilos única do projeto (não há pré-processador nem CSS-in-JS). |
| `app.js` | Ponto de entrada / controlador principal: navegação entre telas, listeners de eventos globais, orquestra chamadas às demais camadas. Carregado por último no `index.html`. |
| `index.html` | Estrutura de telas do app do usuário (Home, Todas as Orações, Orações Oficiais, Editor, Rezar) e todos os modais. |
| `admin.html` + `js/admin.js` | Painel administrativo separado, para cadastrar/editar as Orações Oficiais que alimentam `oracoes-oficiais.json` / `js/oracoes-oficiais-data.js`. |
| `icons/` | Ícones do PWA (192×192 e 512×512), referenciados em `manifest.json`. |

> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA]** — O README original citava um arquivo `PLANO-REFATORACAO-EDITOR.md` como arquivo de apoio, mas ele não está presente no projeto. Em `index.html` e em comentários de `js/rezar-core.js` há, em vez disso, referências a um `PLANO-UNIFICACAO-TELA-REZAR.md` (também ausente do pacote analisado). Não é possível saber se são o mesmo documento renomeado, dois documentos distintos, ou se um deles ficou desatualizado — confirmar qual é o nome/arquivo correto e garantir que ele exista no repositório.

---

## Objetivo do projeto

Permitir que o usuário:

1. **Crie e organize** orações pessoais (título + texto), com suporte a diálogo em duas vozes (narrador principal e resposta), citação de outras orações já salvas, pausas cronometradas, leituras opcionais e links externos.
2. **Consulte um acervo de Orações Oficiais** somente leitura, mantido centralmente e distribuído com o app.
3. **Reze de forma guiada**, com o texto renderizado passo a passo, marcação de progresso diário e leitura em voz alta (texto-para-fala) com vozes diferentes para cada narrador.
4. **Funcione offline** como um app instalável (PWA), com todos os dados pessoais guardados localmente no dispositivo.
5. **Faça backup, exporte, importe e compartilhe** orações pessoais com outras pessoas, inclusive por link.

<!-- [SUPOSIÇÃO] Lista de objetivos derivada diretamente das telas, funções e textos de interface encontrados no código (index.html, oracoes-data.js, render-tree.js, speech.js). -->

---

## Camada de Dados

### `js/oracoes-data.js`
Responsável por:
- **Carregar as orações oficiais** a partir de `window.ORACOES_OFICIAIS_DATA` (definido em `js/oracoes-oficiais-data.js`), e não via `fetch()` do JSON bruto — isso é proposital: os dados oficiais são embutidos diretamente em um arquivo `.js` para que o app funcione tanto servido por HTTP quanto aberto localmente como arquivo (`file://`), caso em que o navegador bloqueia `fetch()`.
- **CRUD de favoritos**, tanto para orações pessoais (`alternarFavorito`) quanto oficiais (`alternarFavoritoOficial`, guardadas separadamente por id, já que as oficiais não são editáveis).
- **Exportar/Importar backup** das orações pessoais em um arquivo JSON local (`exportarOracoes` / `importarOracoesDeArquivo`), no formato:
  ```json
  {
    "versao": 1,
    "exportadoEm": "<ISO 8601>",
    "oracoes": [
      { "id": "...", "titulo": "...", "texto": "...", "favorita": true }
    ]
  }
  ```
- **Compartilhamento**: do app em si (`compartilharApp`, via Web Share API com fallback para WhatsApp Web) e de uma oração específica (`compartilharOracao`), que gera um **"link mágico"**: título e texto da oração são serializados em JSON, codificados em Base64 (com tratamento de UTF-8 para acentuação) e anexados como parâmetro `?importar=` a uma URL do app.
- **Recebimento do link mágico**: ao abrir o app com `?importar=<base64>` na URL, `verificarLinkImportacao` decodifica o payload, limpa o parâmetro da URL (sem recarregar a página) e exibe o modal `#modal-importar-link` perguntando se o usuário deseja adicionar a oração recebida às suas orações pessoais (`importarUmaOracao`), com checagem de título duplicado contra orações pessoais e oficiais.

### `js/oracoes-oficiais-data.js`
Arquivo **gerado automaticamente** — o comentário no topo do arquivo é explícito: *"NÃO edite este arquivo diretamente; edite `oracoes-oficiais.json`"*. Contém `window.ORACOES_OFICIAIS_DATA`, um array de objetos no formato:
```json
{
  "id": "oficial_pai_nosso",
  "titulo": "Pai Nosso",
  "texto": "V. ...\nR. ...",
  "colapsarNaFala": true
}
```
> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA]** — Não há, no pacote do projeto, nenhum script de build/geração visível que produza `js/oracoes-oficiais-data.js` a partir de `oracoes-oficiais.json`. É preciso confirmar onde/como essa geração acontece (script manual do desenvolvedor? rotina do painel admin? processo externo?), pois sem isso as duas fontes podem divergir silenciosamente.

### `oracoes-oficiais.json`
Dataset bruto das orações oficiais. Serve como fonte de edição (via painel admin) e também é listado no cache do Service Worker (`sw.js`), mas o app do usuário **não o lê diretamente em tempo de execução** — quem é consumido é `js/oracoes-oficiais-data.js`, conforme explicado acima.

### `minhas-oracoes-backup-*.json`
Arquivos de exemplo de backups exportados pelo usuário via `exportarOracoes()`. Seguem o formato descrito acima e servem apenas como referência/teste — não são carregados automaticamente pelo app; a importação é sempre manual, por meio do botão "📥 Importar backup" na tela "Todas as Orações".

---

## Camada de Estado

### `state.js`
Concentra o **estado global da UI** e toda a leitura/escrita em `localStorage`, através de chaves versionadas:

| Chave | Conteúdo |
|---|---|
| `minhas_oracoes_v1` | Lista de orações pessoais (`ORACOES`) |
| `minhas_oracoes_oficiais_favoritas_v1` | IDs das orações oficiais marcadas como favoritas |
| `minhas_oracoes_vozes_v1` | Vozes escolhidas para o narrador V. e para o narrador R. na leitura em voz alta |
| `minhas_oracoes_rezadas_diarias_v1` | Registro de quais orações já foram "marcadas como rezadas" **no dia local atual** (reinicia à meia-noite, conforme `obterDataLocalHoje()`) |
| `minhas_oracoes_progresso_leitura_v1` | Progresso de leitura dentro de uma oração (quais linhas/blocos já foram marcados) |
| `minhas_oracoes_velocidade_v1` | Velocidade de reprodução da leitura em voz alta, entre as opções `[0.8, 1.0, 1.25, 1.5, 1.75, 2.0]` |

O sufixo `_v1` em todas as chaves sugere uma convenção deliberada de **versionamento de schema no localStorage** — presumivelmente para permitir migrações futuras (`_v2` etc.) sem quebrar dados já salvos no dispositivo do usuário. <!-- [SUPOSIÇÃO] Inferido do padrão de nomenclatura repetido em todas as seis chaves; não há, no código analisado, nenhuma rotina de migração implementada ainda. -->

`gerarId()` é a função responsável por criar identificadores únicos para novas orações pessoais e para marcadores de referência ([veja mini-linguagem do editor](#mini-linguagem-de-marcação-do-editor)).

---

## Camada de Lógica

### `js/editor-core.js`
Funções **puras** (sem efeitos colaterais em DOM ou storage) e **sem dependências de outros módulos**, o que permite carregá-lo em qualquer ordem tanto em `index.html` quanto em `admin.html`. Concentra:
- Normalização de URLs digitadas no modal "Inserir link" (garante prefixo `https://`/`http://`).
- Construção dos marcadores de referência a outras orações, no formato `[Título|id]` (sem repetição) ou `[Título|id]{N}` (com repetição N vezes) — o `id` é incluído para que a referência continue resolvendo corretamente mesmo se o título da oração citada for renomeado depois.

### `js/rezar-core.js`
Núcleo **compartilhado** entre a tela "Rezar" do app do usuário e o preview do painel administrativo, para evitar a duplicação que existia antes (o próprio comentário do arquivo menciona que `renderizarTextoRezar` em `app.js` e `previewRenderizarTexto` em `admin.html` eram "duas cópias quase idênticas"). Principais responsabilidades:
- Renderizar o texto de uma oração dentro de um container, usando sempre o mesmo motor (`construirArvore` + `renderizarNos`, de `render-tree.js`), resolvido em tempo de chamada — por isso este arquivo não precisa ser carregado depois de `render-tree.js`.
- Suportar dois modos de contexto:
  - um objeto `{ n, oracaoId, elementos }` → habilita os checks (✓) de progresso de leitura, associados ao `oracaoId`;
  - `null` → renderização somente leitura, sem progresso — usado sempre pelo preview do admin.
- Define `ID_PREVIEW_REZAR` (`'__preview_admin__'`), um id reservado exclusivamente para isolar o progresso de leitura do preview do admin do progresso real de qualquer oração do usuário — nenhuma oração real deve usar esse id.

---

## Camada de Renderização

### `js/render-tree.js`
"Motor de árvore/UI": interpreta o texto de uma oração linha a linha e o converte numa árvore de nós (`tipo: 'linha' | 'link' | 'pausa' | 'erro' | 'opcional' | 'repetido' | 'bloco' | 'grupo-linhas'`), que depois é transformada em elementos DOM reais.

#### Mini-linguagem de marcação do editor

O texto de uma oração é escrito em texto puro, com as seguintes convenções:

| Marcação | Efeito |
|---|---|
| `V. texto` | Linha do primeiro narrador (classe `linha-v`) |
| `R. texto` | Linha do segundo narrador / resposta (classe `linha-r`) |
| `{R. texto}` numa linha sozinha | Liga o modo de **resposta automática** para ladainhas: toda linha `V.` seguinte passa a ganhar essa resposta automaticamente, sem precisar repeti-la |
| `{}` sozinho | Desliga o modo de resposta automática |
| `[Título\|id]` | Referência/citação de outra oração salva (pessoal ou oficial), resolvida pelo `id` — se a oração referenciada não existir, é exibido um nó de erro `(oração "X" não encontrada)`; se houver referência circular, é exibido `(referência circular: X)` |
| `[Título\|id]{N}` | Mesma referência, repetida N vezes (ex.: `{10}` para uma dezena do terço) |
| `[pausa]{N}` | Palavra reservada (não é referência a oração): insere uma pausa de N segundos |
| `[Título\|id]{opcional}` | Leitura opcional: a oração referenciada aparece oculta por padrão, fora da narração em voz alta, até o usuário optar por exibi-la (switch na UI) |
| Link (`https://...`) inserido via `+ Inserir → Link` | Aparece na renderização como algo para abrir, mas **não entra na narração em voz alta** |
| `colapsarNaFala: true` (na definição da oração) | Ao ser referenciada dentro de outra, o bloco desta oração é colapsado por padrão na visualização da fala, expansível pelo usuário |

<!-- Conteúdo consolidado a partir da dica de interface em index.html (`.editor-dica`) e dos comentários/regex de js/render-tree.js; nenhuma suposição arriscada foi necessária aqui, pois o comportamento está implementado e documentado em comentários no próprio código. -->

O texto após o parsing é agrupado em blocos (`grupos`) e renderizado no DOM por `renderizarNos`, que também controla:
- Colapso/expansão de blocos referenciados marcados com `colapsarNaFala`.
- Exibição condicional de blocos "opcionais" (ocultos por padrão, sem checks de progresso).
- Marcadores visuais de pausa.

### `js/components/`
Componentes de UI reutilizáveis, cada um em seu próprio arquivo, carregados via `<script>` separados (sem bundler):

| Arquivo | Responsabilidade |
|---|---|
| `card.js` | Monta o card de uma oração (pessoal ou oficial) usado nas listagens (Home, Todas, Oficiais, modal de inserir). Depende de `utils.js` (formatação/escaping), `oracoes-data.js` (alternar favorito) e de funções definidas em `app.js` (`abrirEditor`, `abrirRezar`) — chamadas em tempo de execução, não no carregamento. Também exibe badges: "Oficial" (📜) e "Rezada hoje às HH:mm" quando aplicável, e o botão de compartilhar (apenas na Home, apenas para orações pessoais). |
| `toast.js` | Notificações temporárias (toasts) no rodapé/topo da tela, com variante de sucesso; cria o elemento sob demanda se ele ainda não existir no DOM. |
| `progresso.js` | Calcula e renderiza a barra/indicador de progresso diário na Home, considerando: se existem orações favoritas (pessoais + oficiais), o progresso é calculado sobre elas; caso não haja nenhuma favorita, cai para uma contagem geral sobre o total de orações cadastradas. |

---

## Camada de Voz

### `js/speech.js`
Usa a **Web Speech API** nativa do navegador (`speechSynthesis`) para ler a oração em voz alta durante o modo Rezar, com os seguintes recursos:
- **Duas vozes independentes**, uma para as linhas `V.` e outra para as linhas `R.`, configuráveis pelo usuário no modal "Vozes da leitura" e persistidas em `state.js` (`CHAVE_VOZES`). A lista de vozes disponíveis depende do dispositivo/navegador do usuário.
- `aguardarVozesDisponiveis()`: contorna o carregamento assíncrono de vozes do navegador (evento `voiceschanged`), com um timeout de segurança de 1500ms caso o evento nunca dispare.
- **Controle de velocidade** de reprodução, entre as opções definidas em `state.js` (`OPCOES_VELOCIDADE`), refletido no botão "⚡ 1.0x" da topbar durante a tela Rezar.
- **Scroll inteligente** (`estaVisivel`): evita rolar a tela quando o elemento a ser lido já está totalmente visível dentro de uma margem de conforto (80px por padrão), evitando "pulos" desnecessários entre linhas próximas (ex.: `V.` e `R.` de uma Ave Maria que já aparecem juntas na tela).

> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA]** — Suporte a vozes em português é totalmente dependente do navegador/SO do usuário; não há fallback documentado no código para o caso de nenhuma voz em pt-BR estar disponível no dispositivo (ex.: alguns navegadores desktop). Vale confirmar se esse cenário já foi testado/tratado ou se é uma limitação conhecida e aceita.

---

## Camada de PWA / Infraestrutura

### `manifest.json`
Manifesto padrão de PWA: nome "MyOrações", tela inicial `index.html`, modo `standalone`, orientação retrato, cores de tema/fundo `#1B2238` (azul escuro), idioma `pt-BR`, ícones 192×192 e 512×512 com `purpose: "any maskable"`.

### `sw.js`
Service Worker responsável pelo **cache offline** (cache atualmente na versão `minhas-oracoes-v5`, indicando que já houve pelo menos 4 revisões anteriores de cache). Faz `cache.addAll()` de todos os arquivos estáticos essenciais no evento `install` e chama `self.skipWaiting()` para ativar a nova versão imediatamente.

> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA]** — Não foi possível confirmar, a partir do trecho revisado, a estratégia usada no evento `fetch` (cache-first, network-first, stale-while-revalidate) nem se há rotina de limpeza de caches antigos no evento `activate`. Isso é relevante para o comportamento de atualização do app instalado e deveria ser documentado explicitamente.

> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA]** — `admin.html` e `js/admin.js` **não constam** na lista `ARQUIVOS_PARA_CACHE` de `sw.js`. Isso pode ser proposital (o painel admin não precisa funcionar offline) ou um esquecimento — confirmar com o desenvolvedor.

### `vercel.json`
Configuração mínima de deploy na Vercel: `cleanUrls: true` (remove a extensão `.html` das URLs) e `trailingSlash: false`. <!-- [SUPOSIÇÃO] Interpretação padrão dessas duas opções, documentadas publicamente pela Vercel; não há lógica de servidor além disso no projeto. -->

---

## Painel Administrativo (`admin.html` + `js/admin.js`)

Interface **separada** do app principal, destinada a cadastrar/editar as Orações Oficiais.

- Protegida por uma senha estática verificada no cliente (`SENHA_CORRETA`, em `js/admin.js`) e uma flag de sessão em `sessionStorage` (`myoracoes_admin_autenticado`).
- Reaproveita o mesmo motor de renderização da tela Rezar do usuário (`js/rezar-core.js` + `js/render-tree.js`) para o preview das orações oficiais, em modo somente leitura (`ctx: null`, com `ID_PREVIEW_REZAR` isolando o progresso do preview).
- Mostra um aviso de "alterações não exportadas" (`alteracoesNaoExportadas`) quando há mudanças pendentes ainda não gravadas em `oracoes-oficiais.json`.

> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA] — Risco de segurança relevante:** a autenticação do painel admin é feita inteiramente no lado do cliente, com uma senha fixa embutida em texto simples no JavaScript servido publicamente. Qualquer pessoa com acesso ao código-fonte do app (todo usuário do navegador) pode ler a senha. Isso é aceitável apenas se o painel admin **não expõe nenhuma operação sensível de servidor** (o que parece ser o caso, já que não há backend) e o pior cenário é alguém gerar localmente um `oracoes-oficiais.json` alterado — mas mesmo assim, a "proteção" não impede a leitura dos dados oficiais (que já são públicos) nem oferece segurança real de escrita, já que qualquer publicação de alterações depende de um passo manual de deploy fora do escopo do app. Recomenda-se confirmar se esse é o entendimento correto do modelo de ameaça, e se a senha deve permanecer versionada no repositório.

---

## Fluxo de funcionamento

1. **Carregamento inicial**: `index.html` carrega os scripts em ordem (dados oficiais → estado → utilitários → dados pessoais/CRUD → componentes → núcleo Rezar → motor de renderização → voz → progresso → editor → `app.js`). `app.js`, carregado por último, inicializa a navegação e dispara a primeira renderização das telas.
2. **Home**: exibe as orações favoritas (pessoais e oficiais), a barra de progresso diário e um campo de busca. Também é o ponto de entrada para "Criar" (Todas as Orações) e "Orações Oficiais".
3. **Criar/editar oração** (`view-editor`): o usuário digita título e texto livremente, podendo inserir referências a outras orações, pausas, leituras opcionais e links por meio do menu "+ Inserir", que abre os modais correspondentes (`modal-inserir`, `modal-link`, `modal-numero`).
4. **Rezar** (`view-rezar`): o texto é processado por `render-tree.js` e exibido linha a linha, com opção de leitura em voz alta (`speech.js`), marcação manual de progresso, botão "Marcar como rezada" (grava horário no dia local corrente) e "Reiniciar progresso".
5. **Backup/compartilhamento**: a qualquer momento o usuário pode exportar todas as orações pessoais como arquivo JSON, importar um backup, ou compartilhar uma oração individual por link mágico (Base64 na URL) via Web Share API ou WhatsApp.
6. **Offline**: o Service Worker garante que, após a primeira visita, o app continue funcionando sem conexão, servindo os arquivos estáticos a partir do cache.

<!-- [SUPOSIÇÃO] Fluxo reconstruído a partir da ordem de carregamento de scripts em index.html, dos ids de tela (view-home, view-todas, view-oficiais, view-editor, view-rezar) e das funções expostas em app.js/oracoes-data.js. -->

---

## Convenções do projeto

- **Nomenclatura em português**, tanto para nomes de função/variável (`renderizarFavoritas`, `alternarFavorito`, `oracaoAtualId`) quanto para chaves de `localStorage` e ids de elementos HTML (`btn-`, `modal-`, `view-`, `input-`). <!-- [SUPOSIÇÃO] Convenção inferida por consistência observada em todos os arquivos revisados. -->
- **Sem framework, sem bundler, sem transpilação**: todo o código roda como scripts `<script>` simples, carregados em ordem manualmente definida no HTML. Novos arquivos JS precisam ser adicionados manualmente tanto ao(s) HTML(s) relevante(s) quanto, se forem essenciais ao funcionamento offline, à lista `ARQUIVOS_PARA_CACHE` de `sw.js`.
- **Comentários de cabeçalho** em praticamente todo arquivo `.js`, explicando responsabilidade e dependências (ex.: `js/utils.js — Funções utilitárias puras (sem dependências de outros módulos)`) — um padrão que deve ser mantido em arquivos novos.
- **IDs prefixados por tipo de entidade**: orações pessoais usam ids gerados em runtime (padrão observado: `o_<timestamp em base36>_<sufixo aleatório>`, ex.: `o_mqu0jbay_b17p7s`); orações oficiais usam ids fixos com prefixo `oficial_` (ex.: `oficial_pai_nosso`, ou `oficial_` seguido de sufixo alfanumérico gerado, ex.: `oficial_mqtuc5nv`). <!-- [SUPOSIÇÃO] Padrão inferido por amostragem dos arquivos de dados (oracoes-oficiais-data.js e backups de exemplo); a função geradora exata (gerarId, em state.js) não foi incluída no trecho revisado deste README, então o formato pode ter variações não cobertas aqui. -->
- **Versionamento de schema via sufixo `_v1`** nas chaves de `localStorage` (ver seção Estado), a ser incrementado (`_v2`, etc.) caso o formato dos dados armazenados mude de forma incompatível no futuro. <!-- [SUPOSIÇÃO] -->

---

## Riscos e limitações conhecidas

- **Todos os dados pessoais vivem só no navegador do usuário** (`localStorage`): não há sincronização entre dispositivos nem backup automático na nuvem. Perda de dados do navegador (cache limpo, troca de aparelho, modo anônimo) implica perda das orações pessoais, a menos que o usuário tenha exportado um backup manualmente.
- **Autenticação do painel admin é apenas client-side** (ver seção Painel Administrativo acima) — não deve ser tratada como controle de acesso real.
- **Dependência da Web Speech API**: qualidade e disponibilidade de vozes em português variam por navegador/SO e não há fallback textual claro identificado no código revisado além do timeout de 1500ms.
- **Falta de rastreamento de origem entre `oracoes-oficiais.json` e `js/oracoes-oficiais-data.js`**: como não há script de geração visível no projeto, existe risco de as duas fontes ficarem dessincronizadas sem aviso automático.

---

## Estrutura de arquivos (referência rápida)

```
.
├── index.html
├── admin.html
├── app.js
├── state.js
├── manifest.json
├── sw.js
├── vercel.json
├── style.css
├── oracoes-oficiais.json
├── minhas-oracoes-backup-*.json
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── js/
    ├── admin.js
    ├── editor-core.js
    ├── oracoes-data.js
    ├── oracoes-oficiais-data.js
    ├── render-tree.js
    ├── rezar-core.js
    ├── speech.js
    ├── utils.js
    └── components/
        ├── card.js
        ├── progresso.js
        └── toast.js
```

> ⚠️ **[REQUER CONFIRMAÇÃO HUMANA]** — O diagrama de camadas original deste README posicionava `state.js` na raiz do projeto e os demais módulos de dados/lógica dentro de `js/`, o que **bate** com a estrutura real encontrada no código (`state.js` fica na raiz; `oracoes-data.js`, `render-tree.js` etc. ficam em `js/`). Isso foi mantido. Já a referência a `PLANO-REFATORACAO-EDITOR.md` como arquivo de apoio não pôde ser confirmada — ver observação na seção de Camadas.
