// Ruta desde la raíz del sitio: sirve con cualquier puerto o host.
const API_URL = "/health-me_backend-php";

// Pestañas y paneles
const tabUsuarios  = document.getElementById('tabUsuarios');
const tabBitacora  = document.getElementById('tabBitacora');
const tabConsultas = document.getElementById('tabConsultas');

const segUsuarios  = document.getElementById('segUsuarios');
const segBitacora  = document.getElementById('segBitacora');
const segConsultas = document.getElementById('segConsultas');

const panelUsuarios = document.getElementById('panelUsuarios');
const panelBitacora = document.getElementById('panelBitacora');
const panelConsultas = document.getElementById('panelConsultas');

// Usuarios DOM
const tbody        = document.querySelector('#tablaUsuarios tbody');
const msg          = document.getElementById('msgAdmin');
const resumen      = document.getElementById('resumen');
const btnPrev      = document.getElementById('btnPrev');
const btnNext      = document.getElementById('btnNext');
const fBusq        = document.getElementById('fBusqueda');
const fNivel       = document.getElementById('fNivel');
const fEstado      = document.getElementById('fEstado');

// Bitácora DOM
const tbodyBitacora   = document.querySelector('#tablaBitacora tbody');
const resumenBitacora = document.getElementById('resumenBitacora');
const btnPrevBitacora = document.getElementById('btnPrevBitacora');
const btnNextBitacora = document.getElementById('btnNextBitacora');

// Consultas Web DOM
const tbodyConsultas   = document.querySelector('#tablaConsultas tbody');
const resumenConsultas = document.getElementById('resumenConsultas');
const btnPrevConsultas = document.getElementById('btnPrevConsultas');
const btnNextConsultas = document.getElementById('btnNextConsultas');

// Modales
const modalCrear       = document.getElementById('modalCrear');
const btnAbrirCrear    = document.getElementById('btnAbrirCrear');
const btnCerrarCrear   = document.getElementById('btnCerrarCrear');
const formCrearUsuario  = document.getElementById('formCrearUsuario');
const msgModalCrear    = document.getElementById('msgModalCrear');

const modalEditar      = document.getElementById('modalEditar');
const btnCerrarEditar  = document.getElementById('btnCerrarEditar');
const formEditarUsuario = document.getElementById('formEditarUsuario');
const msgModalEditar   = document.getElementById('msgModalEditar');

const modalResetPass     = document.getElementById('modalResetPass');
const btnCerrarResetPass = document.getElementById('btnCerrarResetPass');
const formResetPass      = document.getElementById('formResetPass');
const msgModalResetPass  = document.getElementById('msgModalResetPass');

const modalVerConsulta       = document.getElementById('modalVerConsulta');
const btnCerrarVerConsulta   = document.getElementById('btnCerrarVerConsulta');
const btnResponderVerConsulta = document.getElementById('btnResponderVerConsulta');

const estado = { pagina: 1, porPagina: 15, total: 0, yo: null };
const estadoBitacora = { pagina: 1, porPagina: 15, total: 0 };
const estadoConsultas = { pagina: 1, porPagina: 15, total: 0 };

function mostrar(texto, esError = false) {
  msg.textContent = texto;
  msg.className = 'inv-mensaje ' + (esError ? 'inv-mensaje-error' : '');
}

async function llamar(url, opciones = {}) {
  const resp = await fetch(url, {
    credentials: 'include',
    ...opciones,
    headers: { 'X-Requested-With': 'XMLHttpRequest', ...(opciones.headers || {}) },
  });
  
  let datos = null;
  try { 
    datos = await resp.json(); 
  } catch {}

  if (resp.status === 401) { 
    window.location.href = '/health-me_frontend/src/views/login.html'; 
    throw new Error('401'); 
  }
  
  if (resp.status === 403 && !datos?.mensaje) { 
    window.location.href = 'user.php'; 
    throw new Error('403'); 
  }
  
  if (!datos) {
    throw new Error('Respuesta inválida del servidor.');
  }
  
  return datos;
}

function celda(texto) {
  const td = document.createElement('td');
  td.style.padding = '10px';
  td.style.borderBottom = '1px solid #e2e8f0';
  td.textContent = texto ?? '—';
  return td;
}

function formatearFecha(valor) {
  if (!valor) return 'Nunca';
  const f = new Date(valor.replace(' ', 'T'));
  return isNaN(f) ? valor : f.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido ?? ''}`.trim();
}

function confirmar({ titulo = 'Confirmar', mensaje = '', textoConfirmar = 'Aceptar', textoCancelar = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolver) => {
    const previo = document.activeElement;

    const cerrar = (resultado) => {
      document.removeEventListener('keydown', alTeclear, true);
      overlay.remove();
      if (previo && typeof previo.focus === 'function') previo.focus();
      resolver(resultado);
    };

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'inv-btn inv-btn-ghost';
    btnCancelar.textContent = textoCancelar;
    btnCancelar.addEventListener('click', () => cerrar(false));

    const btnConfirmar = document.createElement('button');
    btnConfirmar.type = 'button';
    btnConfirmar.className = 'inv-btn inv-btn-primary';
    btnConfirmar.textContent = textoConfirmar;
    if (peligro) {
      btnConfirmar.style.background = '#ef4444';
      btnConfirmar.style.borderColor = '#ef4444';
      btnConfirmar.style.color = '#fff';
    }
    btnConfirmar.addEventListener('click', () => cerrar(true));

    function alTeclear(e) {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(false); return; }
      if (e.key === 'Tab') { // el foco queda dentro del cuadro
        e.preventDefault();
        const botones = [btnCancelar, btnConfirmar];
        const i = botones.indexOf(document.activeElement);
        botones[(i + (e.shiftKey ? -1 : 1) + 2) % 2].focus();
      }
    }

    const h3 = document.createElement('h3');
    h3.style.cssText = 'color:#2c3e50;margin-bottom:10px;';
    h3.textContent = titulo;

    const p = document.createElement('p');
    p.style.cssText = 'font-size:15px;color:#475569;line-height:1.5;white-space:pre-line;margin-bottom:20px;';
    p.textContent = mensaje; // textContent: un nombre o email raro no puede inyectar HTML

    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
    acciones.append(btnCancelar, btnConfirmar);

    const contenido = document.createElement('div');
    contenido.className = 'modal-content';
    contenido.setAttribute('role', 'alertdialog');
    contenido.setAttribute('aria-modal', 'true');
    contenido.append(h3, p, acciones);

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop active';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
    overlay.appendChild(contenido);

    document.addEventListener('keydown', alTeclear, true);
    document.body.appendChild(overlay);
    (peligro ? btnCancelar : btnConfirmar).focus(); // en acciones destructivas el foco empieza en "Cancelar"
  });
}

// GESTIÓN DE PESTAÑAS
tabUsuarios.addEventListener('click', () => {
  tabUsuarios.classList.add('active');
  segUsuarios.classList.add('active');
  panelUsuarios.classList.add('active');

  tabBitacora.classList.remove('active');
  segBitacora.classList.remove('active');
  panelBitacora.classList.remove('active');

  if (tabConsultas) {
    tabConsultas.classList.remove('active');
    segConsultas.classList.remove('active');
    panelConsultas.classList.remove('active');
  }
});

tabBitacora.addEventListener('click', () => {
  tabBitacora.classList.add('active');
  segBitacora.classList.add('active');
  panelBitacora.classList.add('active');

  tabUsuarios.classList.remove('active');
  segUsuarios.classList.remove('active');
  panelUsuarios.classList.remove('active');

  if (tabConsultas) {
    tabConsultas.classList.remove('active');
    segConsultas.classList.remove('active');
    panelConsultas.classList.remove('active');
  }

  cargarBitacora();
});

if (tabConsultas) {
  tabConsultas.addEventListener('click', () => {
    tabConsultas.classList.add('active');
    segConsultas.classList.add('active');
    panelConsultas.classList.add('active');

    tabUsuarios.classList.remove('active');
    segUsuarios.classList.remove('active');
    panelUsuarios.classList.remove('active');

    tabBitacora.classList.remove('active');
    segBitacora.classList.remove('active');
    panelBitacora.classList.remove('active');

    cargarConsultas();
  });
}

// ESTADÍSTICAS DASHBOARD
async function cargarEstadisticas() {
  try {
    const d = await llamar(`${API_URL}/api/admin/dashboard_stats.php`);
    if (d.ok && d.stats) {
      document.getElementById('stat_total').textContent   = d.stats.total_usuarios;
      document.getElementById('stat_activos').textContent = d.stats.usuarios_activos;
      document.getElementById('stat_mes').textContent     = d.stats.registros_mes;
      document.getElementById('stat_meds').textContent    = d.stats.total_medicamentos;
    }
  } catch (e) {
    console.error('No se pudieron cargar las estadísticas');
  }
}

// TABLA DE USUARIOS
function filaUsuario(u) {
  const esMiId = u.id === estado.yo;
  const activo = Number(u.activo) === 1;
  const tr = document.createElement('tr');

  tr.appendChild(celda(nombreCompleto(u) + (esMiId ? ' (vos)' : '')));
  tr.appendChild(celda(u.email));
  tr.appendChild(celda(u.dni));
  tr.appendChild(celda(u.rol));
  tr.appendChild(celda(u.nivel));
  tr.appendChild(celda(u.ultima_conexion ? formatearFecha(u.ultima_conexion) : ''));

  const tdEstado = document.createElement('td');
  tdEstado.style.padding = '10px';
  tdEstado.style.borderBottom = '1px solid #e2e8f0';
  const badge = document.createElement('span');
  badge.style.padding = '4px 10px';
  badge.style.borderRadius = '12px';
  badge.style.fontWeight = '700';
  badge.style.fontSize = '12px';
  badge.style.backgroundColor = activo ? '#e0f5e9' : '#fde8e8';
  badge.style.color = activo ? '#1b6b3a' : '#9b1c1c';
  badge.textContent = activo ? 'Activo' : 'Desactivado';
  tdEstado.appendChild(badge);
  tr.appendChild(tdEstado);

  const tdAcc = document.createElement('td');
  tdAcc.style.padding = '10px';
  tdAcc.style.borderBottom = '1px solid #e2e8f0';
  tdAcc.style.textAlign = 'center';

  const contBotones = document.createElement('div');
  contBotones.style.display = 'inline-flex';
  contBotones.style.gap = '6px';
  contBotones.style.alignItems = 'center';
  contBotones.style.flexWrap = 'nowrap';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'inv-btn inv-btn-ghost';
  btnEditar.style.padding = '4px 8px';
  btnEditar.style.fontSize = '13px';
  btnEditar.textContent = '✏️';
  btnEditar.title = 'Editar datos del usuario';
  btnEditar.addEventListener('click', () => abrirModalEditar(u));
  contBotones.appendChild(btnEditar);

  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.className = 'inv-btn inv-btn-ghost';
  btnReset.style.padding = '4px 8px';
  btnReset.style.fontSize = '13px';
  btnReset.textContent = '🔑';
  btnReset.title = 'Cambiar contraseña';
  btnReset.addEventListener('click', () => abrirModalResetPass(u));
  contBotones.appendChild(btnReset);

  const btnEstado = document.createElement('button');
  btnEstado.type = 'button';
  btnEstado.className = 'inv-btn ' + (activo ? 'inv-btn-ghost' : 'inv-btn-primary');
  btnEstado.style.padding = '4px 10px';
  btnEstado.style.fontSize = '12px';
  btnEstado.textContent = activo ? 'Desactivar' : 'Activar';
  btnEstado.disabled = esMiId && activo;
  btnEstado.title = btnEstado.disabled ? 'No puedes desactivar tu propia cuenta' : '';
  btnEstado.addEventListener('click', () => cambiarEstado(u, activo ? 0 : 1));
  contBotones.appendChild(btnEstado);

  const btnNivel = document.createElement('button');
  btnNivel.type = 'button';
  btnNivel.className = 'inv-btn inv-btn-ghost';
  btnNivel.style.padding = '4px 10px';
  btnNivel.style.fontSize = '12px';
  const esAdmin = u.nivel === 'administrador';
  btnNivel.textContent = esAdmin ? 'Quitar admin' : 'Hacer admin';
  btnNivel.disabled = esMiId;
  btnNivel.title = esMiId ? 'No puedes cambiar tu propio nivel' : '';
  btnNivel.addEventListener('click', () => cambiarNivel(u, esAdmin ? 'general' : 'administrador'));
  contBotones.appendChild(btnNivel);

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'inv-btn inv-btn-ghost';
  btnEliminar.style.padding = '4px 8px';
  btnEliminar.style.fontSize = '13px';
  btnEliminar.style.color = '#ef4444';
  btnEliminar.textContent = '🗑️';
  btnEliminar.disabled = esMiId;
  btnEliminar.title = esMiId ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario definitivamente';
  btnEliminar.addEventListener('click', () => eliminarUsuario(u));
  contBotones.appendChild(btnEliminar);

  tdAcc.appendChild(contBotones);
  tr.appendChild(tdAcc);

  return tr;
}

function renderPaginacion() {
  const paginas = Math.max(1, Math.ceil(estado.total / estado.porPagina));
  resumen.textContent = estado.total === 0
    ? 'Sin resultados'
    : `${estado.total} usuario(s) · página ${estado.pagina} de ${paginas}`;
    
  btnPrev.disabled = estado.pagina <= 1;
  btnNext.disabled = estado.pagina >= paginas;
}

async function cargarUsuarios() {
  const params = new URLSearchParams({
    pagina: estado.pagina,
    por_pagina: estado.porPagina,
    q: fBusq.value.trim(),
    nivel: fNivel.value,
    estado: fEstado.value,
  });

  try {
    const d = await llamar(`${API_URL}/api/admin/usuarios_listar.php?${params}`);
    if (!d.ok) { 
      mostrar(d.mensaje || 'Error al cargar usuarios.', true); 
      return; 
    }

    estado.total = d.total;
    estado.yo = d.yo;

    const ultima = Math.max(1, Math.ceil(d.total / estado.porPagina));
    if (estado.pagina > ultima) { 
      estado.pagina = ultima; 
      return cargarUsuarios(); 
    }

    tbody.replaceChildren(...d.usuarios.map(filaUsuario));
    
    if (d.usuarios.length === 0) {
      const tr = document.createElement('tr');
      const td = celda('No se encontraron usuarios con esos filtros.');
      td.colSpan = 8;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    
    renderPaginacion();
    cargarEstadisticas();
  } catch (e) {
    if (e.message != '401' && e.message != '403') { 
      mostrar('No pudimos conectar con el servidor.', true); 
    }
  }
}

// BITÁCORA GLOBAL
function filaBitacora(b) {
  const tr = document.createElement('tr');
  const usuarioTexto = b.email ? `${b.nombre} ${b.apellido || ''} (${b.email})` : 'Sistema / Anon';

  tr.appendChild(celda(formatearFecha(b.fecha_hora)));
  tr.appendChild(celda(usuarioTexto));
  tr.appendChild(celda(b.tipo || 'General'));
  tr.appendChild(celda(b.texto));

  return tr;
}

function renderPaginacionBitacora() {
  const paginas = Math.max(1, Math.ceil(estadoBitacora.total / estadoBitacora.porPagina));
  resumenBitacora.textContent = estadoBitacora.total === 0
    ? 'Sin registros'
    : `${estadoBitacora.total} registro(s) · página ${estadoBitacora.pagina} de ${paginas}`;
    
  btnPrevBitacora.disabled = estadoBitacora.pagina <= 1;
  btnNextBitacora.disabled = estadoBitacora.pagina >= paginas;
}

async function cargarBitacora() {
  const params = new URLSearchParams({
    pagina: estadoBitacora.pagina,
    por_pagina: estadoBitacora.porPagina
  });

  try {
    const d = await llamar(`${API_URL}/api/admin/bitacora_listar.php?${params}`);
    if (!d.ok) return;

    estadoBitacora.total = d.total;
    tbodyBitacora.replaceChildren(...d.bitacora.map(filaBitacora));

    if (d.bitacora.length === 0) {
      const tr = document.createElement('tr');
      const td = celda('No hay registros guardados en la bitácora aún.');
      td.colSpan = 4;
      tr.appendChild(td);
      tbodyBitacora.appendChild(tr);
    }

    renderPaginacionBitacora();
  } catch (e) {
    console.error('Error al cargar la bitácora');
  }
}

btnPrevBitacora.addEventListener('click', () => { estadoBitacora.pagina--; cargarBitacora(); });
btnNextBitacora.addEventListener('click', () => { estadoBitacora.pagina++; cargarBitacora(); });

// CONSULTAS WEB
function abrirModalVerConsulta(c) {
  document.getElementById('ver_consulta_fecha').textContent   = formatearFecha(c.fecha_creacion);
  document.getElementById('ver_consulta_nombre').textContent  = c.nombre;
  document.getElementById('ver_consulta_email').textContent   = c.email;
  document.getElementById('ver_consulta_asunto').textContent  = c.asunto;
  document.getElementById('ver_consulta_mensaje').textContent = c.mensaje;

  if (btnResponderVerConsulta) {
    btnResponderVerConsulta.href = `mailto:${c.email}?subject=RE: ${encodeURIComponent(c.asunto)}`;
  }

  if (modalVerConsulta) {
    modalVerConsulta.classList.add('active');
  }
}

if (btnCerrarVerConsulta && modalVerConsulta) {
  btnCerrarVerConsulta.addEventListener('click', () => {
    modalVerConsulta.classList.remove('active');
  });
}

function filaConsulta(c) {
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid #e2e8f0';

  tr.appendChild(celda(formatearFecha(c.fecha_creacion)));
  tr.appendChild(celda(c.nombre));
  tr.appendChild(celda(c.email));
  tr.appendChild(celda(c.asunto));

  // Celda con mensaje recortado a 50 caracteres máximo
  const tdMsg = document.createElement('td');
  tdMsg.style.padding = '10px';
  tdMsg.style.maxWidth = '250px';

  const esLargo = c.mensaje.length > 50;
  const textoCorto = esLargo ? c.mensaje.substring(0, 50) + '...' : c.mensaje;

  const pTexto = document.createElement('span');
  pTexto.textContent = textoCorto + ' ';
  tdMsg.appendChild(pTexto);

  if (esLargo) {
    const btnVer = document.createElement('button');
    btnVer.type = 'button';
    btnVer.className = 'inv-btn inv-btn-ghost';
    btnVer.style.padding = '2px 6px';
    btnVer.style.fontSize = '12px';
    btnVer.style.marginTop = '4px';
    btnVer.style.display = 'block';
    btnVer.textContent = 'Ver mensaje completo';
    btnVer.addEventListener('click', () => abrirModalVerConsulta(c));
    tdMsg.appendChild(btnVer);
  }

  tr.appendChild(tdMsg);

  // Botón Acción: Responder por Mail
  const tdAcc = document.createElement('td');
  tdAcc.style.padding = '10px';
  tdAcc.style.textAlign = 'center';

  const btnMail = document.createElement('a');
  btnMail.href = `mailto:${c.email}?subject=RE: ${encodeURIComponent(c.asunto)}`;
  btnMail.className = 'inv-btn inv-btn-ghost';
  btnMail.style.padding = '4px 8px';
  btnMail.style.fontSize = '13px';
  btnMail.textContent = '✉️ Responder';
  btnMail.title = 'Enviar correo a ' + c.email;

  tdAcc.appendChild(btnMail);
  tr.appendChild(tdAcc);

  return tr;
}

function renderPaginacionConsultas() {
  const paginas = Math.max(1, Math.ceil(estadoConsultas.total / estadoConsultas.porPagina));
  if (resumenConsultas) {
    resumenConsultas.textContent = estadoConsultas.total === 0
      ? 'Sin consultas'
      : `${estadoConsultas.total} consulta(s) · página ${estadoConsultas.pagina} de ${paginas}`;
  }
    
  if (btnPrevConsultas) btnPrevConsultas.disabled = estadoConsultas.pagina <= 1;
  if (btnNextConsultas) btnNextConsultas.disabled = estadoConsultas.pagina >= paginas;
}

async function cargarConsultas() {
  const params = new URLSearchParams({
    pagina: estadoConsultas.pagina,
    por_pagina: estadoConsultas.porPagina
  });

  try {
    const d = await llamar(`${API_URL}/api/admin/consultas_listar.php?${params}`);
    if (!d.ok) return;

    estadoConsultas.total = d.total;
    if (tbodyConsultas) {
      tbodyConsultas.replaceChildren(...d.consultas.map(filaConsulta));

      if (d.consultas.length === 0) {
        const tr = document.createElement('tr');
        const td = celda('No hay consultas recibidas desde la web.');
        td.colSpan = 6;
        tr.appendChild(td);
        tbodyConsultas.appendChild(tr);
      }
    }

    renderPaginacionConsultas();
  } catch (e) {
    console.error('Error al cargar consultas');
  }
}

if (btnPrevConsultas) btnPrevConsultas.addEventListener('click', () => { estadoConsultas.pagina--; cargarConsultas(); });
if (btnNextConsultas) btnNextConsultas.addEventListener('click', () => { estadoConsultas.pagina++; cargarConsultas(); });

// ACCIONES USUARIO
async function enviarAccion(endpoint, datos, exito) {
  try {
    const d = await llamar(`${API_URL}/api/admin/${endpoint}`, { 
      method: 'POST', 
      body: new URLSearchParams(datos) 
    });
    
    if (d.ok) { 
      mostrar(exito); 
      cargarUsuarios(); 
    } else {
      mostrar(d.mensaje || 'Error.', true);
    }
  } catch (e) {
    if (e.message != '401' && e.message != '403') { 
      mostrar('No pudimos conectar con el servidor.', true); 
    }
  }
}

async function cambiarEstado(u, activo) {
  const accion = activo ? 'activar' : 'desactivar';
  const ok = await confirmar({
    titulo: activo ? 'Activar usuario' : 'Desactivar usuario',
    mensaje: `¿Seguro que querés ${accion} a ${nombreCompleto(u)}?`,
    textoConfirmar: activo ? 'Activar' : 'Desactivar',
    peligro: !activo
  });
  if (!ok) return;
  enviarAccion('usuario_estado.php', { id_usuario: u.id, activo }, activo ? 'Usuario activado.' : 'Usuario desactivado.');
}

async function cambiarNivel(u, nivel) {
  const darAdmin = nivel === 'administrador';
  const ok = await confirmar({
    titulo: darAdmin ? 'Dar permisos de administrador' : 'Quitar permisos de administrador',
    mensaje: darAdmin
      ? `¿Dar permisos de administrador a ${nombreCompleto(u)}?`
      : `¿Quitar permisos de administrador a ${nombreCompleto(u)}?`,
    textoConfirmar: darAdmin ? 'Dar permisos' : 'Quitar permisos',
    peligro: !darAdmin
  });
  if (!ok) return;
  enviarAccion('usuario_nivel.php', { id_usuario: u.id, nivel }, 'Nivel actualizado.');
}

async function eliminarUsuario(u) {
  const ok = await confirmar({
    titulo: 'Eliminar usuario',
    mensaje: `¿Querés ELIMINAR DEFINITIVAMENTE a ${nombreCompleto(u)} (${u.email})?\nEsta acción borra su cuenta y registros y no se puede deshacer.`,
    textoConfirmar: 'Eliminar definitivamente',
    peligro: true
  });
  if (!ok) return;
  enviarAccion('usuario_eliminar.php', { id_usuario: u.id }, 'Usuario eliminado definitivamente.');
}

// MODALES LÓGICA
if (btnAbrirCrear && modalCrear) {
  btnAbrirCrear.addEventListener('click', () => {
    formCrearUsuario.reset();
    msgModalCrear.textContent = '';
    modalCrear.classList.add('active');
  });
}

if (btnCerrarCrear && modalCrear) {
  btnCerrarCrear.addEventListener('click', () => {
    modalCrear.classList.remove('active');
  });
}

if (formCrearUsuario) {
  formCrearUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgModalCrear.textContent = '';

    try {
      const d = await llamar(`${API_URL}/api/admin/usuario_crear.php`, {
        method: 'POST',
        body: new FormData(formCrearUsuario)
      });

      if (d.ok) {
        modalCrear.classList.remove('active');
        mostrar(d.mensaje || 'Usuario creado correctamente.');
        cargarUsuarios();
      } else {
        msgModalCrear.textContent = d.mensaje || 'Error al crear usuario.';
      }
    } catch (err) {
      if (err.message !== '401' && err.message !== '403') {
        msgModalCrear.textContent = 'Error de conexión con el servidor.';
      }
    }
  });
}

function abrirModalEditar(u) {
  document.getElementById('edit_id_usuario').value = u.id;
  document.getElementById('edit_nombre').value     = u.nombre || '';
  document.getElementById('edit_apellido').value   = u.apellido || '';
  document.getElementById('edit_dni').value        = u.dni || '';
  document.getElementById('edit_email').value      = u.email || '';
  document.getElementById('edit_obra_social').value = u.obra_social || '';
  document.getElementById('edit_rol').value        = u.rol || 'afectado';
  
  msgModalEditar.textContent = '';
  modalEditar.classList.add('active');
}

if (btnCerrarEditar && modalEditar) {
  btnCerrarEditar.addEventListener('click', () => {
    modalEditar.classList.remove('active');
  });
}

if (formEditarUsuario) {
  formEditarUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgModalEditar.textContent = '';

    try {
      const d = await llamar(`${API_URL}/api/admin/usuario_editar.php`, {
        method: 'POST',
        body: new FormData(formEditarUsuario)
      });

      if (d.ok) {
        modalEditar.classList.remove('active');
        mostrar(d.mensaje || 'Usuario actualizado correctamente.');
        cargarUsuarios();
      } else {
        msgModalEditar.textContent = d.mensaje || 'Error al actualizar usuario.';
      }
    } catch (err) {
      if (err.message !== '401' && err.message !== '403') {
        msgModalEditar.textContent = 'Error de conexión con el servidor.';
      }
    }
  });
}

function abrirModalResetPass(u) {
  document.getElementById('reset_id_usuario').value = u.id;
  document.getElementById('reset_usuario_email').textContent = u.email;
  formResetPass.reset();
  msgModalResetPass.textContent = '';
  modalResetPass.classList.add('active');
}

if (btnCerrarResetPass && modalResetPass) {
  btnCerrarResetPass.addEventListener('click', () => {
    modalResetPass.classList.remove('active');
  });
}

if (formResetPass) {
  formResetPass.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgModalResetPass.textContent = '';

    try {
      const d = await llamar(`${API_URL}/api/admin/usuario_reset_password.php`, {
        method: 'POST',
        body: new FormData(formResetPass)
      });

      if (d.ok) {
        modalResetPass.classList.remove('active');
        mostrar(d.mensaje || 'Contraseña actualizada correctamente.');
      } else {
        msgModalResetPass.textContent = d.mensaje || 'Error al restablecer contraseña.';
      }
    } catch (err) {
      if (err.message !== '401' && err.message !== '403') {
        msgModalResetPass.textContent = 'Error de conexión con el servidor.';
      }
    }
  });
}

let temporizador;
if (fBusq) {
  fBusq.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { 
      estado.pagina = 1; 
      cargarUsuarios(); 
    }, 300);
  });
}

[fNivel, fEstado].forEach(el => {
  if (el) {
    el.addEventListener('change', () => { 
      estado.pagina = 1; 
      cargarUsuarios(); 
    });
  }
});

if (btnPrev) btnPrev.addEventListener('click', () => { estado.pagina--; cargarUsuarios(); });
if (btnNext) btnNext.addEventListener('click', () => { estado.pagina++; cargarUsuarios(); });

// Inicializar Footer Desplegable
const footerElement = document.getElementById("collapsibleFooter");
const footerSummaryBar = document.getElementById("footerSummaryBar");
if (footerElement && footerSummaryBar) {
  footerSummaryBar.addEventListener("click", () => {
    footerElement.classList.toggle("expanded");
  });
}

cargarUsuarios();