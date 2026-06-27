# Plano de Refatoração — App de Orações

## Estrutura de Arquivos Alvo

```
js/
├── state.js              # Constantes, variáveis globais, localStorage
├── utils.js              # Funções utilitárias puras (escaparHTML, obterInicial, primeiraLinhaUtil)
├── oracoes-data.js       # CRUD, fetch de oficiais, export/import, compartilhamento
├── render-tree.js        # Árvore de nós, progresso visual de leitura por seção
├── speech.js             # Web Speech API, vozes, fila de fala
├── components/
│   ├── card.js           # criarCardOracao (usa utils.js)
│   ├── toast.js          # mostrarToast
│   └── progresso.js      # atualizarProgressoDiario
└── app.js                # Navegação, editor, renderização de listas, ligação de botões, init
```

---

## Ordem de Carregamento no HTML

```html
<script src="js/state.js"></script>              <!-- Passo 1 -->
<script src="js/utils.js"></script>              <!-- Passo 2 -->
<script src="js/oracoes-data.js"></script>       <!-- Passo 3 -->
<script src="js/render-tree.js"></script>        <!-- Passo 6 -->
<script src="js/speech.js"></script>             <!-- Passo 7 -->
<script src="js/components/card.js"></script>    <!-- Passo 4 -->
<script src="js/components/toast.js"></script>   <!-- Passo 5 -->
<script src="js/components/progresso.js"></script><!-- Passo 8 -->
<script src="app.js"></script>                   <!-- Passo 9 -->
```

> ⚠️ **Dependências críticas de ordem:**
> - `state.js` deve ser sempre o primeiro (todas as variáveis globais vivem aqui)
> - `utils.js` deve vir antes de qualquer módulo que use `escaparHTML`, `obterInicial` ou `primeiraLinhaUtil`
> - `render-tree.js` deve vir antes de `speech.js` (speech.js chama `expandirParaElemento`)

---

## Plano de Ação — Ordenado por Prioridade e Custo-Benefício

Cada passo é independente e testável. ✅ = concluído, [ ] = pendente.

---

### 📋 Fase 1 — Extração de Baixo Risco (~30 min cada)

---

#### Passo 1 — `js/state.js` ✅ (já concluído)

- [x] Mover todas as constantes `CHAVE_*` e `OPCOES_VELOCIDADE`
- [x] Mover `obterDataLocalHoje()`
- [x] Mover `carregarRezadasDiarias()` e `salvarRezadasDiarias()`
- [x] Mover `carregarProgressoLeitura()` e `salvarProgressoLeitura()`
- [x] Mover `carregarOracoes()` e `salvarOracoes()`
- [x] Mover `carregarFavoritasOficiais()` e `salvarFavoritasOficiais()`
- [x] Mover `gerarId()` *(já está aqui — não mover novamente no Passo 3)*
- [x] Mover declarações `let` globais: `ORACOES`, `ORACOES_OFICIAIS`, `favoritasOficiaisIds`, `editandoId`, `oracaoAtualId`, `oracaoAtualTipo`, `origemRezar`, `velocidadeAtual`, `rezadasDiarias`, `progressoLeitura`, `secaoCtxAtual`
- [x] **Teste:** abrir app, ver se orações carregam e favoritos funcionam

---

#### Passo 2 — `js/utils.js` *(NOVO — antes não existia no plano)*

- [x] Criar arquivo `js/utils.js`
- [x] Mover `escaparHTML(texto)` *(usada por card.js, render-tree.js e outros)*
- [x] Mover `obterInicial(titulo)` *(usada por card.js)*
- [x] Mover `primeiraLinhaUtil(texto)` *(usada por card.js)*
- [x] Ajustar referências em app.js (remover as definições locais)
- [x] **Teste:** home, todas e oficiais renderizarem cards corretamente, sem erros de "função não definida"

---

#### Passo 3 — `js/oracoes-data.js`

- [x] Criar arquivo `js/oracoes-data.js`
- [x] Mover `alternarFavorito()` e `alternarFavoritoOficial()`
- [x] Mover `exportarOracoes()` e `importarOracoesDeArquivo()`
- [x] Mover `compartilharOracao()` e `copiarParaClipboard()`
- [x] Mover `verificarLinkImportacao()`, `exibirModalImportacaoLink()`, `importarUmaOracao()`
- [v] Mover `carregarOficiais()` *(faz fetch do JSON; chama renderizarOficiais + renderizarFavoritas — manter chamadas no app.js por ora e chamar após o fetch)*
- [x] ⚠️ **Atenção:** `gerarId()` já foi para `state.js` — NÃO duplicar aqui
- [x] Ajustar e salvar app.js
- [v] **Teste:** exportar, importar, favoritar, compartilhar; recarregar app e ver se oficiais carregam

---

#### Passo 4 — `js/components/card.js`

- [ ] Criar arquivo `js/components/card.js`
- [ ] Mover `criarCardOracao()` *(depende de `escaparHTML`, `obterInicial`, `primeiraLinhaUtil` — agora em `utils.js`)*
- [ ] Ajustar e salvar app.js
- [ ] **Teste:** home, todas e oficiais renderizarem cards corretamente; estrela de favoritar funcionando

---

#### Passo 5 — `js/components/toast.js`

- [ ] Criar arquivo `js/components/toast.js`
- [ ] Mover `mostrarToast()`
- [ ] Ajustar e salvar app.js
- [ ] **Teste:** salvar oração e ver toast aparecer

---

### 📋 Fase 2 — Extração de Médio Risco (~45 min cada)

---

#### Passo 6 — `js/render-tree.js`

- [ ] Criar arquivo `js/render-tree.js`
- [ ] Mover `construirArvore()`, `adicionarLinhas()`, `agruparNos()`, `renderizarNos()`
- [ ] Mover `expandirParaElemento()` *(chamada por speech.js — por isso render-tree.js vem antes no HTML)*
- [ ] Mover `criarBtnCheck()`, `marcarSecao()`, `desmarcarSecao()`, `limparProgressoLeitura()`, `atualizarVisuaisProgresso()`
- [ ] Ajustar e salvar app.js
- [ ] **Teste:** abrir oração com referência `[Título]` aninhada, expandir/recolher blocos, marcar seções

---

#### Passo 7 — `js/speech.js`

- [ ] Criar arquivo `js/speech.js`
- [ ] Mover bloco **VOZES**: `configVozes`, `aguardarVozesDisponiveis()`, `ordenarVozesPtPrimeiro()`, `escolherVozesAutomaticas()`, `abrirConfigVozes()`, `fecharModalVozes()`, `salvarConfigVozesModal()`
- [ ] Mover bloco **FALAR EM VOZ ALTA**: `filaFala`, `indiceFalaAtual`, `falando`, `pausado`, `utteranciaAtual`, `obterLinhasParaFalar()`, `alternarFala()`, `iniciarFala()`, `pausarFala()`, `continuarFala()`, `atualizarBotaoFala()`, `falarProximaLinha()`, `pararFala()`
- [ ] Ajustar e salvar app.js
- [ ] **Teste:** reproduzir oração com referência aninhada, pausar, continuar, verificar progresso automático de seções

---

#### Passo 8 — `js/components/progresso.js`

- [ ] Criar arquivo `js/components/progresso.js`
- [ ] Mover `atualizarProgressoDiario()`
- [ ] Ajustar e salvar app.js
- [ ] **Teste:** favoritar/desfavoritar e ver barra de progresso diário atualizar corretamente

---

### 📋 Fase 3 — Limpeza Final (~20 min)

---

#### Passo 9 — Limpar `app.js`

- [ ] Remover listener duplicado de exclusão (manter apenas o inline **ou** `excluirOracaoAtual`, não ambos)
- [ ] Manter apenas: navegação (`mostrarView`), editor (`abrirEditor`, `salvarEditor`), renderização das listas (`renderizarFavoritas`, `renderizarTodas`, `renderizarOficiais`, `renderizarTudo`), ligação dos botões e inicialização
- [ ] *(Opcional — se as listas crescerem):* Considerar extrair `renderizarFavoritas`, `renderizarTodas`, `renderizarOficiais`, `renderizarTudo` para um `js/render-lists.js` no futuro
- [ ] Ajustar e salvar app.js
- [ ] **Teste completo final:** criar oração nova → editar → excluir → favoritar → rezar (com fala) → pausar/continuar → exportar/importar → navegar entre todas as views

---

## ⚠️ Pontos de Atenção

| Risco | Detalhe |
|---|---|
| **Dependência cruzada** | `speech.js` chama `expandirParaElemento()` (em `render-tree.js`) — por isso `render-tree.js` vem antes no HTML |
| **Variáveis compartilhadas** | `ORACOES`, `ORACOES_OFICIAIS`, `favoritasOficiaisIds` são usadas por quase todos os módulos — por isso `state.js` é sempre o primeiro |
| **`gerarId()` já migrada** | Já está em `state.js`. NÃO mover novamente para `oracoes-data.js` (geraria duplicata) |
| **`escaparHTML()` sem dono original** | Estava solta no `app.js`. Agora tem destino: `utils.js` |
| **`carregarOficiais()`** | Faz fetch e chama funções de render — mover para `oracoes-data.js`, mas deixar a chamada inicial em `app.js` |
| **`renderizarListaModalInserir()`** | Chamada dentro de `carregarOficiais()`. Verificar se fica em `app.js` ou segue para `oracoes-data.js` |
| **Erro de ordem de carregamento** | Se algo quebrar com "X is not defined", a causa quase sempre é ordem errada no HTML ou função não extraída ainda |
| **Teste a cada passo** | Após cada extração: (a) lista carrega, (b) favoritar funciona, (c) abrir rezar funciona, (d) fala funciona |