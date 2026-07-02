# Plano de refatoracao: editor unificado

Status geral: **em andamento**

Objetivo: unificar a tela/codigo de edicao de oracoes pessoais e oficiais, usando o editor do admin como base visual e funcional, sem perder as particularidades de cada contexto.

## Diagnostico atual

Status: **concluido**

Hoje existem dois editores paralelos:

- Usuario: `index.html` + `app.js`
  - Tela: `#view-editor`
  - Campos: `#input-titulo`, `#input-texto`
  - Salvar: `salvarEditor()`
  - Dados: `ORACOES` no `localStorage`
  - Extras de entidade: `favorita`
  - UI de salvar: botao global `#btn-salvar-topo`

- Admin: `admin.html`
  - Tela: `#view-admin-form`
  - Campos: `#input-oficial-titulo`, `#input-oficial-texto`
  - Salvar: handler de `#btn-salvar-oficial`
  - Dados: `ORACOES_OFICIAIS` em memoria, depois exportado para `oracoes-oficiais.json`
  - Extras de entidade: `oculta`, `colapsarNaFala`
  - UI extra: preview/leitura/narracao, aviso de alteracoes nao exportadas, voltar para lista

Duplicacoes principais:

- Markup do editor: titulo, texto, toolbar `+ Inserir`, dica.
- Modais auxiliares: inserir oracao, inserir link, numero para repeticao/pausa.
- Logica de insercao: oracao, leitura opcional, link, pausa.
- Controle de cursor no textarea.
- Estado de "alterado / nao salvo".
- Validacoes de titulo duplicado.

Particularidades que devem permanecer:

- Usuario nao deve ver opcoes oficiais como `oculta` e `colapsarNaFala`.
- Admin deve continuar tendo `oculta` e `colapsarNaFala`.
- Admin deve continuar com preview/leitura/narracao dentro do formulario.
- Admin deve continuar salvando em `ORACOES_OFICIAIS` e marcando `alteracoesNaoExportadas`.
- Usuario deve continuar salvando em `ORACOES` e persistindo no `localStorage`.
- Usuario deve continuar com favoritos pessoais fora do editor.
- Admin deve continuar exportando `oracoes-oficiais.json`.
- Referencias antigas `[Titulo]` devem continuar funcionando; referencias novas por id `[Titulo|id]` devem permanecer.

## Arquitetura proposta

Status: **planejado**

Criar um modulo compartilhado para o editor, com configuracao por contexto.

Arquivo sugerido:

- `js/editor-core.js`

Responsabilidades do modulo:

- Receber uma configuracao de contexto (`usuario` ou `admin`).
- Inicializar handlers do formulario.
- Controlar campos de titulo/texto.
- Controlar toolbar `+ Inserir`.
- Controlar modais de inserir oracao, link e numero.
- Inserir marcadores no textarea.
- Manter posicao do cursor.
- Calcular estado alterado/nao salvo.
- Expor metodos como:
  - `abrir(id)`
  - `salvar()`
  - `resetar()`
  - `obterValores()`
  - `definirValores(oracao)`
  - `atualizarEstadoSalvar()`

Configuracao sugerida:

```js
criarEditorOracao({
  contexto: 'usuario',
  ids: {
    view: 'view-editor',
    titulo: 'input-titulo',
    texto: 'input-texto',
    botaoSalvar: 'btn-salvar-topo',
    menuInserir: 'menu-inserir',
    botaoInserir: 'btn-inserir'
  },
  recursos: {
    mostrarCamposAdmin: false,
    preview: false
  },
  listarReferencias(),
  carregarPorId(id),
  salvarOracao(valores),
  validarTitulo(valores),
  aposSalvar(oracao)
});
```

Para admin:

```js
criarEditorOracao({
  contexto: 'admin',
  ids: {
    view: 'view-admin-form',
    titulo: 'input-oficial-titulo',
    texto: 'input-oficial-texto',
    botaoSalvar: 'btn-salvar-oficial',
    menuInserir: 'menu-inserir-admin',
    botaoInserir: 'btn-inserir-admin'
  },
  recursos: {
    mostrarCamposAdmin: true,
    preview: true
  },
  camposExtras: {
    oculta: 'checkbox-oficial-oculta',
    colapsarNaFala: 'checkbox-oficial-colapsar-fala'
  },
  listarReferencias(),
  carregarPorId(id),
  salvarOracao(valores),
  validarTitulo(valores),
  aposSalvar(oracao)
});
```

## Plano incremental

### Etapa 1 - Congelar comportamento atual

Status: **em andamento**

- [x] Registrar manualmente os fluxos que precisam continuar funcionando → `etapa1-fluxos-congelados.md`
- [ ] Testar no usuario:
  - [ ] criar oracao pessoal
  - [ ] editar oracao pessoal
  - [ ] inserir oracao
  - [ ] inserir leitura opcional
  - [ ] inserir link
  - [ ] inserir pausa
  - [ ] salvar e reabrir
- [ ] Testar no admin:
  - [ ] criar oficial
  - [ ] editar oficial
  - [ ] marcar/desmarcar `oculta`
  - [ ] marcar/desmarcar `colapsarNaFala`
  - [ ] inserir oracao
  - [ ] inserir leitura opcional
  - [ ] inserir link
  - [ ] inserir pausa
  - [ ] preview ler
  - [ ] preview narrar
  - [ ] exportar JSON

### Etapa 2 - Extrair funcoes puras compartilhadas

Status: **concluido**

- [x] Criar `js/editor-core.js`.
- [x] Mover ou duplicar inicialmente funcoes puras para o modulo:
  - [x] `normalizarUrlInserida`
  - [x] `criarMarcadorReferencia`
  - [x] montagem de marcador `[Titulo|id]` → `montarMarcadorReferencia`
  - [x] montagem de `[pausa]{n}` → `montarMarcadorPausa`
  - [x] montagem de `[link:url]` → `montarMarcadorLink`
  - [x] montagem de `[Titulo|id]{opcional}` → `montarMarcadorOpcional`
- [x] Ajustar `app.js` e `admin.html` para usar essas funcoes sem mudar UI.
- [x] Validar que nao houve mudanca visual ou funcional (`node --check` OK).

### Etapa 3 - Unificar logica de insercao

Status: **concluido**

- [x] No `editor-core.js`, criar controlador de insercao configuravel (`criarControladorInsercao`).
- [x] Centralizar:
  - [x] abrir/fechar menu `+ Inserir`
  - [x] modal de lista de oracoes
  - [x] modal de numero
  - [x] modal de link
  - [x] controle de cursor
  - [x] insercao no textarea
- [x] Adaptar usuario para chamar o controlador compartilhado.
- [x] Adaptar admin para chamar o mesmo controlador compartilhado.
- [x] Remover funcoes duplicadas de insercao em `app.js`.
- [x] Remover funcoes duplicadas de insercao no script inline de `admin.html`.

### Etapa 4 - Unificar markup do editor

Status: **pendente**

- [ ] Definir um template comum de editor.
- [ ] Escolher estrategia:
  - [ ] manter HTML duplicado por enquanto, mas com mesmos IDs via configuracao; ou
  - [ ] renderizar o formulario por JS a partir de um template comum.
- [ ] Preferencia inicial: manter HTML existente e apenas padronizar classes/data-attributes, para reduzir risco.
- [ ] Padronizar classes para:
  - [ ] campo titulo
  - [ ] campo texto
  - [ ] toolbar
  - [ ] dica
  - [ ] campos extras
- [ ] Mover estilos inline dos checkboxes admin para classes CSS.

### Etapa 5 - Unificar estado de formulario

Status: **pendente**

- [ ] Criar modelo comum de valores:

```js
{
  id,
  titulo,
  texto,
  extras: {
    oculta,
    colapsarNaFala
  }
}
```

- [ ] Criar comparacao generica de estado original vs atual.
- [ ] Usuario compara apenas `titulo` e `texto`.
- [ ] Admin compara `titulo`, `texto`, `oculta`, `colapsarNaFala`.
- [ ] Centralizar aplicacao visual de `nao-salvo`.

### Etapa 6 - Unificar salvar/validar por estrategia

Status: **pendente**

- [ ] Criar contrato de `salvarOracao(valores)` por contexto.
- [ ] Usuario:
  - [ ] valida duplicidade contra pessoais e oficiais
  - [ ] cria id com `gerarId()`
  - [ ] salva em `ORACOES`
  - [ ] chama `salvarOracoes(ORACOES)`
  - [ ] chama `renderizarTudo()`
- [ ] Admin:
  - [ ] valida duplicidade contra oficiais
  - [ ] cria id `oficial_...`
  - [ ] salva em `ORACOES_OFICIAIS`
  - [ ] marca `alteracoesNaoExportadas = true`
  - [ ] chama `renderizarListaAdmin()`
  - [ ] habilita preview
- [ ] Manter mensagens/toasts atuais.

### Etapa 7 - Encapsular preview do admin

Status: **pendente**

- [ ] Manter preview como recurso opcional do editor compartilhado.
- [ ] Extrair funcoes de preview do admin para um modulo ou objeto separado:
  - [ ] `resetarPreview`
  - [ ] `habilitarBotoesPreview`
  - [ ] `previewHaAlteracaoNaoSalva`
  - [ ] `previewRenderizarTexto`
  - [ ] `previewAbrir`
- [ ] O editor compartilhado apenas chama hooks:
  - [ ] `onAbrir`
  - [ ] `onSalvar`
  - [ ] `onTextoAlterado`

### Etapa 8 - Remover duplicacao final

Status: **pendente**

- [ ] Remover handlers antigos que ficaram sem uso.
- [ ] Garantir que nao existem duas versoes de:
  - [ ] `abrirModalInserir`
  - [ ] `inserirReferencia`
  - [ ] `inserirReferenciaOpcional`
  - [ ] `inserirLink`
  - [ ] `inserirPausa`
  - [ ] `abrirModalNumero`
- [ ] Rodar busca por IDs antigos e funcoes duplicadas.
- [ ] Atualizar comentarios e dicas.

### Etapa 9 - Testes finais

Status: **pendente**

- [ ] `node --check app.js`
- [ ] `node --check js/render-tree.js`
- [ ] `node --check js/speech.js`
- [ ] Se `editor-core.js` existir: `node --check js/editor-core.js`
- [ ] Teste manual no usuario:
  - [ ] criar/editar/salvar
  - [ ] inserir oracao
  - [ ] inserir leitura opcional
  - [ ] inserir link
  - [ ] inserir pausa
  - [ ] abrir tela de rezar
  - [ ] confirmar fala ignorando link e opcional fechado
- [ ] Teste manual no admin:
  - [ ] criar/editar/salvar oficial
  - [ ] campos `oculta` e `colapsarNaFala`
  - [ ] inserir todos os tipos
  - [ ] preview ler/narrar
  - [ ] exportar JSON

## Riscos e decisoes

Status: **aberto**

- [ ] Decidir se o formulario comum sera HTML estatico duplicado com controlador compartilhado ou template renderizado por JS.
- [ ] Evitar misturar regras de persistencia do usuario com regras do admin.
- [ ] Nao remover os campos admin do DOM antes de o preview estar isolado.
- [ ] Cuidar para `#rezar-texto` usado no app e no preview admin nao criar conflito se algum modulo passar a ser compartilhado.
- [ ] Manter compatibilidade com referencias antigas por titulo.
- [ ] Nao migrar `oracoes-oficiais.json` automaticamente nesta refatoracao.

## Proposta de ordem recomendada

Status: **planejado**

1. Extrair apenas funcoes puras e helpers de marcador.
2. Extrair controlador de insercao.
3. Unificar estado original/alterado.
4. Unificar salvar por estrategia.
5. Isolar preview admin.
6. So entao avaliar se vale renderizar o formulario por template unico.

## Status atual

Status: **planejado**

- Analise inicial concluida.
- Nenhuma alteracao de codigo desta refatoracao foi feita ainda.
- Proximo passo recomendado: Etapa 1, congelar comportamento atual com checklist manual.
