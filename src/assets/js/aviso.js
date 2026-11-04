/**
 * Aviso flotante dentro de la página (reemplaza a alert()).
 * hmToast("Texto", "ok" | "error", milisegundos)
 */
function hmToast(texto, tipo = 'ok', duracion = 6000) {
  const previo = document.getElementById('hm-toast');
  if (previo) previo.remove();

  const esError = tipo === 'error';
  const caja = document.createElement('div');
  caja.id = 'hm-toast';
  caja.setAttribute('role', esError ? 'alert' : 'status');
  caja.style.cssText = [
    'position:fixed', 'top:100px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:10000', 'width:min(92vw,520px)', 'box-sizing:border-box',
    'display:flex', 'align-items:flex-start', 'gap:12px',
    'padding:14px 16px', 'border-radius:12px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
    'font-size:15px', 'font-weight:600', 'line-height:1.4',
    esError
      ? 'background:#fef2f2;border:2px solid #ef4444;color:#991b1b'
      : 'background:#f0fdf4;border:2px solid #16a34a;color:#166534'
  ].join(';');

  const msg = document.createElement('span');
  msg.style.flex = '1';
  msg.textContent = texto;

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.setAttribute('aria-label', 'Cerrar aviso');
  cerrar.textContent = '✕';
  cerrar.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;font-weight:800;color:inherit;padding:0 4px;';

  let timer = null;
  const quitar = () => { clearTimeout(timer); caja.remove(); };
  cerrar.addEventListener('click', quitar);

  caja.append(msg, cerrar);
  document.body.appendChild(caja);
  if (duracion > 0) timer = setTimeout(quitar, duracion);
}