// ===================== TOAST =====================

function mostrarToast(msg, tipo){
  let toast = document.getElementById('toast-notificacao');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toast-notificacao';
    document.getElementById('app').appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast-notificacao' + (tipo === 'sucesso' ? ' toast-sucesso' : '');
  toast.classList.add('toast-visivel');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('toast-visivel'), 3500);
}
