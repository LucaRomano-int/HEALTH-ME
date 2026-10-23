const tbody = document.querySelector('#tablaUsuarios tbody');
const msg = document.getElementById('msgAdmin');

function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  return td;
}

function cargarUsuarios() {
  fetch('php/admin/usuarios_listar.php')
    .then(r => r.json())
    .then(d => {
      if (!d.ok) { msg.textContent = d.mensaje; return; }
      tbody.innerHTML = '';

      d.usuarios.forEach(u => {
        const tr = document.createElement('tr');
        tr.appendChild(celda(`${u.nombre} ${u.apellido ?? ''}`.trim()));
        tr.appendChild(celda(u.email));
        tr.appendChild(celda(u.dni));
        tr.appendChild(celda(u.rol));
        tr.appendChild(celda(u.nivel));
        tr.appendChild(celda(u.ultima_conexion));
        tr.appendChild(celda(u.activo == 1 ? 'Activo' : 'Desactivado'));

        const tdAccion = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = u.activo == 1 ? 'Desactivar' : 'Activar';
        btn.addEventListener('click', () => cambiarEstado(u.id, u.activo == 1 ? 0 : 1));
        tdAccion.appendChild(btn);
        tr.appendChild(tdAccion);

        tbody.appendChild(tr);
      });
    })
    .catch(() => { msg.textContent = 'No pudimos conectar con el servidor.'; });
}

function cambiarEstado(id, activo) {
  const datos = new FormData();
  datos.append('id_usuario', id);
  datos.append('activo', activo);

  fetch('php/admin/usuario_estado.php', { method: 'POST', body: datos })
    .then(r => r.json())
    .then(d => {
      msg.textContent = d.ok ? 'Usuario actualizado.' : (d.mensaje || 'Error.');
      if (d.ok) cargarUsuarios();
    });
}

cargarUsuarios();