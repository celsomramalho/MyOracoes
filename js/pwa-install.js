// js/pwa-install.js — Botão "Instalar app" (evento beforeinstallprompt)
//
// O Chrome (desktop e Android) e o Edge disparam o evento "beforeinstallprompt"
// quando decidem que o site cumpre os critérios de instalação (manifest.json
// válido + service worker registrado + servido em HTTPS). Guardamos esse
// evento para poder chamar .prompt() quando o usuário clicar no botão.
//
// Em navegadores que não disparam esse evento (Safari/iOS, Firefox), o botão
// simplesmente nunca aparece — o usuário continua usando o botão
// "Compartilhar" normalmente para levar o link do app.

let eventoInstalacaoPWA = null;

function appJaInstalado(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function atualizarBotaoInstalar(){
  const btn = document.getElementById('btn-instalar-app');
  if (!btn) return;
  const appEl = document.getElementById('app');
  const emHome = appEl && appEl.dataset.tela === 'home';
  const podeInstalar = !!eventoInstalacaoPWA && !appJaInstalado();
  btn.classList.toggle('hidden', !(emHome && podeInstalar));
}

// O navegador avisa que a instalação está disponível
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
  if (!btn || !appEl) return;

  btn.addEventListener('click', async () => {
    if (!eventoInstalacaoPWA) return;
    eventoInstalacaoPWA.prompt();
    await eventoInstalacaoPWA.userChoice; // aguarda o usuário aceitar ou recusar
    eventoInstalacaoPWA = null;
    atualizarBotaoInstalar();
  });

  // O app troca de tela alterando #app[data-tela] (ver app.js/mostrarView).
  // Observamos essa mudança para exibir o botão só na Home, igual ao
  // botão "Compartilhar".
  new MutationObserver(atualizarBotaoInstalar)
    .observe(appEl, { attributes: true, attributeFilter: ['data-tela'] });

  atualizarBotaoInstalar();
});
