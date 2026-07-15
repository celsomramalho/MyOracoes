// state.js — Estado global e localStorage

// ===================== DADOS PESSOAIS =====================
const CHAVE_STORAGE = 'minhas_oracoes_v1';
const CHAVE_FAVORITAS_OFICIAIS = 'minhas_oracoes_oficiais_favoritas_v1';
const CHAVE_VOZES = 'minhas_oracoes_vozes_v1';
const CHAVE_REZADAS_DIARIAMENTE = 'minhas_oracoes_rezadas_diarias_v1';
const CHAVE_PROGRESSO_LEITURA = 'minhas_oracoes_progresso_leitura_v1';
const CHAVE_VELOCIDADE = 'minhas_oracoes_velocidade_v1';
const CHAVE_MODO_LEITURA = 'minhas_oracoes_modo_leitura_v1';
const CHAVE_ZOOM_FONTE = 'minhas_oracoes_zoom_fonte_v1';
const CHAVE_ULTIMO_ACESSO = 'minhas_oracoes_ultimo_acesso_v1';
const OPCOES_VELOCIDADE = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0];
let velocidadeAtual = parseFloat(localStorage.getItem(CHAVE_VELOCIDADE)) || 1.0;
let modoLeituraAtivo = localStorage.getItem(CHAVE_MODO_LEITURA) === 'true';
let zoomFonteRezar = parseFloat(localStorage.getItem(CHAVE_ZOOM_FONTE)) || 1.12;


// ===================== PREFERÊNCIA DE LEITURA OPCIONAL =====================
// Lembra se cada leitura opcional (identificada por oração + rótulo) deve
// abrir ligada ou desligada da próxima vez, em vez de sempre voltar a
// ficar oculta. Ver js/render-tree.js (bloco tipo "opcional").
const CHAVE_LEITURAS_OPCIONAIS = 'minhas_oracoes_leituras_opcionais_v1';
const CHAVE_DICA_LEITURA_OPCIONAL_MOSTRADA = 'minhas_oracoes_dica_leitura_opcional_v1';

function carregarLeiturasOpcionaisPreferidas(){
  try{
    return JSON.parse(localStorage.getItem(CHAVE_LEITURAS_OPCIONAIS) || '{}');
  }catch(e){ return {}; }
}

function salvarLeiturasOpcionaisPreferidas(){
  localStorage.setItem(CHAVE_LEITURAS_OPCIONAIS, JSON.stringify(leiturasOpcionaisPreferidas));
}

let leiturasOpcionaisPreferidas = carregarLeiturasOpcionaisPreferidas();

// ===================== MISTÉRIO DO DIA (Santo Rosário) =====================
// Regra específica: na oração "Santo Rosário", os 4 opcionais de mistério
// (Gozosos/Dolorosos/Luminosos/Gloriosos) não seguem a preferência lembrada
// comum acima — eles seguem o mistério tradicional do dia da semana. Uma
// troca manual do usuário vale só para o dia corrente (guardada com a data
// de hoje); no dia seguinte a data não bate mais e o padrão volta a ser
// calculado pelo dia da semana. Ver js/render-tree.js.
const CHAVE_MISTERIO_DIA_OVERRIDE = 'minhas_oracoes_misterio_dia_override_v1';

// index = Date.getDay() (0 = domingo ... 6 = sábado)
const MISTERIO_DO_DIA_POR_DIA_SEMANA = [
  'glorioso', // domingo
  'gozoso',   // segunda
  'doloroso', // terça
  'glorioso', // quarta
  'luminoso', // quinta
  'doloroso', // sexta
  'gozoso'    // sábado
];

function carregarMisterioDiaOverride(){
  try{
    const dados = JSON.parse(localStorage.getItem(CHAVE_MISTERIO_DIA_OVERRIDE) || '{}');
    return (dados && typeof dados === 'object') ? dados : {};
  }catch(e){ return {}; }
}

function salvarMisterioDiaOverride(){
  localStorage.setItem(CHAVE_MISTERIO_DIA_OVERRIDE, JSON.stringify(misterioDiaOverride));
}

let misterioDiaOverride = carregarMisterioDiaOverride();

// Id fixo da oração oficial "Santo Rosário" — usar o id (em vez do título)
// permite renomear a oração livremente sem quebrar a regra do mistério do
// dia. Se um dia essa oração for recriada com outro id, basta atualizar
// aqui.
const ID_ORACAO_SANTO_ROSARIO = 'oficial_mrc4ar32';

// Ids fixos das 4 orações oficiais de mistério, cada uma referenciada como
// leitura opcional dentro do "Santo Rosário". Também usar id (em vez do
// texto do rótulo) permite renomear "Mistérios Gozosos" etc. livremente.
const IDS_MISTERIOS_POR_TIPO = {
  'oficial_mqtzl9dc': 'gozoso',
  'oficial_mrc4c7cg': 'doloroso',
  'oficial_mrc4do0v': 'luminoso',
  'oficial_mrc4e06s': 'glorioso'
};

// Só entra na regra do mistério do dia se a oração aberta for exatamente o
// "Santo Rosário" (por id) E a leitura opcional referenciada for uma das 4
// orações de mistério (por id). Outras leituras opcionais dentro da mesma
// oração (ou em qualquer outra oração) continuam usando a preferência
// lembrada comum, sem entrar nesta regra.
function obterTipoMisterioDoDiaSeAplicavel(oracaoId, refId){
  if(oracaoId !== ID_ORACAO_SANTO_ROSARIO) return null;
  return IDS_MISTERIOS_POR_TIPO[refId] || null;
}

function obterDataLocalHoje() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function executarResetDiarioSeNecessario() {
  const hoje = obterDataLocalHoje();
  const ultimoAcesso = localStorage.getItem(CHAVE_ULTIMO_ACESSO);
  if (ultimoAcesso !== hoje) {
    // Virou o dia (ou é o primeiríssimo acesso): 
    // Zera os progressos de leitura internos (os checks verdes de cada parágrafo/conta)
    localStorage.removeItem(CHAVE_PROGRESSO_LEITURA);
    
    // Zera também as contas e posições de fala individuais salvas soltas
    const keysParaRemover = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('contas_') || k.startsWith('subpos_'))) {
        keysParaRemover.push(k);
      }
    }
    keysParaRemover.forEach(k => localStorage.removeItem(k));
  }
  // Grava o dia atual
  localStorage.setItem(CHAVE_ULTIMO_ACESSO, hoje);
}

// Roda assim que o script inicializa, ANTES de carregar do localStorage
executarResetDiarioSeNecessario();

function carregarRezadasDiarias() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_REZADAS_DIARIAMENTE) || '{}');
    const hoje = obterDataLocalHoje();
    if (dados.data === hoje) {
      return dados.ids || {};
    } else {
      const novo = { data: hoje, ids: {} };
      salvarRezadasDiarias(novo);
      return novo.ids;
    }
  } catch (e) {
    return {};
  }
}

function salvarRezadasDiarias(dados) {
  localStorage.setItem(CHAVE_REZADAS_DIARIAMENTE, JSON.stringify(dados));
}

let rezadasDiarias = carregarRezadasDiarias();

// ===================== PROGRESSO DE LEITURA POR SEÇÃO =====================
function carregarProgressoLeitura(){
  try{
    return JSON.parse(localStorage.getItem(CHAVE_PROGRESSO_LEITURA) || '{}');
  }catch(e){ return {}; }
}

function salvarProgressoLeitura(){
  localStorage.setItem(CHAVE_PROGRESSO_LEITURA, JSON.stringify(progressoLeitura));
}

let progressoLeitura = carregarProgressoLeitura();

// secaoCtxAtual: { n, oracaoId, elementos: [{idx, el, btn}], totalSecoes }
let secaoCtxAtual = null;

function carregarOracoes(){
  try{
    const dados = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || '[]');
    return Array.isArray(dados) ? dados : [];
  }catch(e){
    return [];
  }
}

function salvarOracoes(lista){
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(lista));
}

function carregarFavoritasOficiais(){
  try{
    const dados = JSON.parse(localStorage.getItem(CHAVE_FAVORITAS_OFICIAIS) || '[]');
    return Array.isArray(dados) ? dados : [];
  }catch(e){
    return [];
  }
}

function salvarFavoritasOficiais(ids){
  localStorage.setItem(CHAVE_FAVORITAS_OFICIAIS, JSON.stringify(ids));
}

function gerarId(){
  return 'o_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

let ORACOES = carregarOracoes();
let ORACOES_OFICIAIS = (typeof ORACOES_OFICIAIS_DATA !== 'undefined' && Array.isArray(ORACOES_OFICIAIS_DATA))
  ? ORACOES_OFICIAIS_DATA
  : [];       // dados embutidos em oracoes-oficiais-data.js (carregado antes deste arquivo)
let favoritasOficiaisIds = carregarFavoritasOficiais();
let editandoId = null;     // id da oração sendo editada (null = criando nova)
let editorTituloOriginal = '';  // valor do título ao abrir o editor, para detectar alterações não salvas
let editorTextoOriginal = '';   // valor do texto ao abrir o editor, para detectar alterações não salvas
let oracaoAtualId = null;  // id da oração aberta na tela "Rezar"
let oracaoAtualTipo = 'pessoal'; // 'pessoal' ou 'oficial'
let origemRezar = 'home';  // 'home', 'todas' ou 'oficiais'