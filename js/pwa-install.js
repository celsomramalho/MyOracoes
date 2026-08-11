// js/pwa-install.js — Botão "Instalar app"
//
// No Chrome/Edge (desktop e Android), o navegador dispara o evento
// "beforeinstallprompt" quando o site cumpre os critérios de instalação
// (manifest.json válido + service worker + HTTPS). Guardamos esse evento
// para chamar .prompt() quando o usuário clicar no botão.
//
// No iOS (Safari e também Chrome/Firefox no iOS, que por exigência da Apple
// usam o mesmo motor do Safari), esse evento nunca existe — a instalação é
// sempre manual, via ícone de Compartilhar > "Adicionar à Tela de Início".
// Nesse caso mostramos o mesmo botão, mas o clique abre um modal com o
// passo a passo em vez do prompt nativo.

let eventoInstalacaoPWA = null;

function appJaInstalado(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function ehIOS(){
  // iPhone/iPod e iPad "clássico" batem no userAgent; iPad com iPadOS 13+
  // se identifica como Mac, então distinguimos pelo suporte a touch.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function atualizarBotaoInstalar(){
  const btn = document.getElementById('btn-instalar-app');
  if (!btn) return;
  const appEl = document.getElementById('app');
  const emHome = appEl && appEl.dataset.tela === 'home';
  const podeInstalar = (!!eventoInstalacaoPWA || ehIOS()) && !appJaInstalado();
  btn.classList.toggle('hidden', !(emHome && podeInstalar));
}

// O navegador avisa que a instalação (via prompt nativo) está disponível
window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault(); // impede o mini-infobar automático do Chrome
  eventoInstalacaoPWA = evento;
  atualizarBotaoInstalar();
});

// Instalação concluída (pelo nosso botão ou por outro caminho do navegador)
window.addEventListener('appinstalled', () => {
  eventoInstalacaoPWA = null;
  atualizarBotaoInstalar();
  if (typeof mostrarToast === 'function') mostrarToast('MyOrações instalado com sucesso!');
});

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-instalar-app');
  const appEl = document.getElementById('app');
  const modalIOS = document.getElementById('modal-instalar-ios');
  const btnFecharModalIOS = document.getElementById('btn-fechar-modal-instalar-ios');
  if (!btn || !appEl) return;

  btn.addEventListener('click', async () => {
    if (eventoInstalacaoPWA) {
      // Chrome/Edge: prompt nativo do navegador
      eventoInstalacaoPWA.prompt();
      await eventoInstalacaoPWA.userChoice; // aguarda o usuário aceitar ou recusar
      eventoInstalacaoPWA = null;
      atualizarBotaoInstalar();
    } else if (ehIOS() && modalIOS) {
      // iOS: não existe prompt automático, mostramos o passo a passo
      modalIOS.classList.remove('hidden');
    }
  });

  if (btnFecharModalIOS && modalIOS) {
    btnFecharModalIOS.addEventListener('click', () => modalIOS.classList.add('hidden'));
  }

  // O app troca de tela alterando #app[data-tela] (ver app.js/mostrarView).
  // Observamos essa mudança para exibir o botão só na Home, igual ao
  // botão "Compartilhar".
  new MutationObserver(atualizarBotaoInstalar)
    .observe(appEl, { attributes: true, attributeFilter: ['data-tela'] });

  atualizarBotaoInstalar();
});
