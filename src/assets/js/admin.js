// Configuración de la API y selección de elementos del DOM

const API_URL = "https://health-me.infinityfreeapp.com";

const tbody   = document.querySelector('#tablaUsuarios tbody');
const msg     = document.getElementById('msgAdmin');
const resumen = document.getElementById('resumen');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const fBusq   = document.getElementById('fBusqueda');
const fNivel  = document.getElementById('fNivel');
const fEstado = document.getElementById('fEstado');

// Estado global de la vista de administración
const estado = { pagina: 1, porPagina: 15, total: 0, yo: null };

// Función para mostrar mensajes de estado en la interfaz
function mostrar(texto, esError = false) {
  msg.textContent = texto;
  msg.className = 'adm-msg ' + (esError ? 'err' : 'ok');
}

// Función centralizada para peticiones HTTP con manejo de sesión y errores
async function llamar(url, opciones = {}) {
  const resp = await fetch(url, {
    credentials: 'include',
    ...opciones,
    headers: { 'X-Requested-With': 'XMLHttpRequest', ...(opciones.headers || {}) },
  });
  
  let datos = null;
  
  try { 
    datos = await resp.json(); 
  } catch { 
    // Si la respuesta no es un JSON válido, se ignora de forma controlada
  }

  if (resp.status === 401) { 
    window.location.href = 'login.html'; 
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

// Funciones auxiliares para celdas, fechas y nombres

function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  return td;
}

function formatearFecha(valor) {
  if (!valor) {
    return 'Nunca';
  }
  
  const f = new Date(valor.replace(' ', 'T'));
  return isNaN(f) ? valor : f.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido ?? ''}`.trim();
}

// Construcción de filas para la tabla de usuarios
function filaUsuario(u) {
  const esYo = u.id != estado.yo;
  const esMiId = u.id === estado.yo;
  const activo = Number(u.activo) === 1;
  const tr = document.createElement('tr');

  tr.appendChild(celda(nombreCompleto(u) + (esMiId ? ' (vos)' : '')));
  tr.appendChild(celda(u.email));
  tr.appendChild(celda(u.dni));
  tr.appendChild(celda(u.rol));
  tr.appendChild(celda(u.nivel));
  tr.appendChild(celda(formatearFecha(u.ultima_conexion)));

  const tdEstado = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'adm-badge ' + (activo ? 'on' : 'off');
  badge.textContent = activo ? 'Activo' : 'Desactivado';
  tdEstado.appendChild(badge);
  tr.appendChild(tdEstado);

  const tdAcc = document.createElement('td');

  const btnEstado = document.createElement('button');
  btnEstado.type = 'button';
  btnEstado.textContent = activo ? 'Desactivar' : 'Activar';
  btnEstado.disabled = esMiId && activo;
  btnEstado.title = btnEstado.disabled ? 'No puedes desactivar tu propia cuenta' : '';
  btnEstado.addEventListener('click', () => cambiarEstado(u, activo ? 0 : 1));
  tdAcc.appendChild(btnEstado);

  const btnNivel = document.createElement('button');
  btnNivel.type = 'button';
  const esAdmin = u.nivel === 'administrador';
  btnNivel.textContent = esAdmin ? 'Quitar admin' : 'Hacer admin';
  btnNivel.style.marginLeft = '.4rem';
  btnNivel.disabled = esMiId;
  btnNivel.title = esMiId ? 'No puedes cambiar tu propio nivel' : '';
  btnNivel.addEventListener('click', () => cambiarNivel(u, esAdmin ? 'general' : 'administrador'));
  tdAcc.appendChild(btnNivel);

  tr.appendChild(tdAcc);
  return tr;
}

// Renderizado de la barra de paginación y resumen

function renderPaginacion() {
  const paginas = Math.max(1, Math.ceil(estado.total / estado.porPagina));
  
  resumen.textContent = estado.total === 0
    ? 'Sin resultados'
    : `${estado.total} usuario(s) · página ${estado.pagina} de ${paginas}`;
    
  btnPrev.disabled = estado.pagina <= 1;
  btnNext.disabled = estado.pagina >= paginas;
}

// Carga principal de usuarios desde el servidor con filtros aplicados
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
  } catch (e) {
    if (e.message != '401' && e.message != '403') { 
      mostrar('No pudimos conectar con el servidor.', true); 
    }
  }
}

// Envío de acciones administrativas (cambio de estado o nivel)
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

function cambiarEstado(u, activo) {
  const accion = activo ? 'activar' : 'desactivar';
  
  if (!confirm(`¿Seguro que querés ${accion} a ${nombreCompleto(u)}?`)) {
    return;
  }
  
  enviarAccion('usuario_estado.php', { id_usuario: u.id, activo },
    activo ? 'Usuario activado.' : 'Usuario desactivado.');
}

function cambiarNivel(u, nivel) {
  const texto = nivel === 'administrador'
    ? `¿Dar permisos de administrador a ${nombreCompleto(u)}?`
    : `¿Quitar permisos de administrador a ${nombreCompleto(u)}?`;
    
  if (!confirm(texto)) {
    return;
  }
  
  enviarAccion('usuario_nivel.php', { id_usuario: u.id, nivel }, 'Nivel actualizado.');
}

// Controladores de eventos para la interfaz de administración
let temporizador;

fBusq.addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { 
    estado.pagina = 1; 
    cargarUsuarios(); 
  }, 300);
});

[fNivel, fEstado].forEach(el => {
  el.addEventListener('change', () => { 
    estado.pagina = 1; 
    cargarUsuarios(); 
  });
});

btnPrev.addEventListener('click', () => { 
  estado.pagina--; 
  cargarUsuarios(); 
});

btnNext.addEventListener('click', () => { 
  estado.pagina++; 
  cargarUsuarios(); 
});

document.getElementById('btnLogout').addEventListener('click', async (e) => {
  e.preventDefault();
  
  try { 
    await fetch(`${API_URL}/api/logout.php`, { credentials: 'include' }); 
  } catch { 
    // Se fuerza la salida en caso de error de red
  }
  
  window.location.href = 'login.html';
});

// Ejecución inicial al cargar el script
cargarUsuarios();