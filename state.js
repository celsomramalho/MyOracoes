// state.js — Estado global e localStorage

// ===================== DADOS PESSOAIS =====================
const CHAVE_STORAGE = 'minhas_oracoes_v1';
const CHAVE_FAVORITAS_OFICIAIS = 'minhas_oracoes_oficiais_favoritas_v1';
const CHAVE_VOZES = 'minhas_oracoes_vozes_v1';
const CHAVE_REZADAS_DIARIAMENTE = 'minhas_oracoes_rezadas_diarias_v1';
const CHAVE_PROGRESSO_LEITURA = 'minhas_oracoes_progresso_leitura_v1';
const CHAVE_VELOCIDADE = 'minhas_oracoes_velocidade_v1';
const OPCOES_VELOCIDADE = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0];
let velocidadeAtual = parseFloat(localStorage.getItem(CHAVE_VELOCIDADE)) || 1.0;

function obterDataLocalHoje() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

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
let ORACOES_OFICIAIS = [];       // carregado via fetch
let favoritasOficiaisIds = carregarFavoritasOficiais();
let editandoId = null;     // id da oração sendo editada (null = criando nova)
let editorTituloOriginal = '';  // valor do título ao abrir o editor, para detectar alterações não salvas
let editorTextoOriginal = '';   // valor do texto ao abrir o editor, para detectar alterações não salvas
let oracaoAtualId = null;  // id da oração aberta na tela "Rezar"
let oracaoAtualTipo = 'pessoal'; // 'pessoal' ou 'oficial'
let origemRezar = 'home';  // 'home', 'todas' ou 'oficiais'