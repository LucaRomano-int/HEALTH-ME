/**
 * acceso-compartido.js
 * Construye la sección "Acceso compartido" y habla con la API de invitaciones y con la de grupos.
 * user.js la llama con renderAccesoCompartidoModule() (extraRenderFunctionNames)
 * y agrega el elemento que devuelve debajo del módulo de grupo/paciente.
 *
 * Acá vive todo lo del grupo (ya no hay una tarjeta aparte en "Datos del grupo y del paciente"):
 *  - Grupo: nombre, tu lugar, salir del grupo e integrantes (aprobar / rechazar / quitar).
 *  - Invitar: por correo, o compartiendo el PIN del grupo (copiar / cambiar PIN). Se comparte TODO (sin casillas).
 *  - Pedidos para unirme (cuando entraste con un PIN y todavía no te aprobaron).
 *  - Invitaciones recibidas / enviadas y accesos activos.
 *
 * La sección está OCULTA hasta que la persona tenga un grupo (lo avisa grupoPaciente.js con el evento "hm:grupos")
 * o tenga algo para mostrar (un pedido pendiente, una invitación o un acceso activo).
 * Al aceptar una invitación la persona entra al grupo (lo hace el backend) y se pide recargar los grupos.
 *
 * Usa hmApi / hmConfirmar de hm-api.js para api/grupos.php.
 * Todo el texto dinámico se inserta con textContent (nada de innerHTML),
 * así que los datos que vienen de la API no pueden inyectar HTML.
 */
function renderAccesoCompartidoModule() {
  'use strict';

  const root = document.createElement('section');
  root.id = 'acceso-compartido';
  root.style.display = 'none'; // aparece cuando hay un grupo (ver actualizarVisibilidad)

  const API = 'api/invitaciones';

  // Solo para mostrar qué se comparte en los accesos que ya existían con permisos parciales
  const PERMISOS = [
    ['ver_mediciones', 'Mediciones'],
    ['ver_medicamentos', 'Medicamentos'],
    ['ver_recordatorios', 'Recordatorios'],
    ['ver_estado_diario', 'Estado diario'],
    ['ver_dashboard', 'Resumen semanal'],
    ['ver_padecimientos', 'Padecimientos'],
  ];

  const TEXTOS = {
    afectado: {
      titulo: 'Invitar a un acompañante',
      correo: 'Correo del acompañante',
      intro: 'Al invitar compartís toda tu información de salud: mediciones, medicamentos, recordatorios, estado diario, resumen y padecimientos.',
      boton: 'Enviar invitación',
      pin: 'O compartile este PIN a tu acompañante. Cuando lo ingrese en “Unirme con un PIN”, su pedido te aparece en “Integrantes” y lo podés aprobar.',
    },
    'acompañante': {
      titulo: 'Solicitar acceso a una persona',
      correo: 'Correo de la persona a acompañar',
      intro: 'Al solicitar acceso vas a poder ver toda la información de salud de la persona: mediciones, medicamentos, recordatorios, estado diario, resumen y padecimientos.',
      boton: 'Enviar solicitud',
      pin: 'O compartí este PIN con la persona a acompañar. Cuando lo ingrese en “Unirme con un PIN”, el pedido queda pendiente hasta que se apruebe en “Integrantes”.',
    },
  };

  const refs = {};
  const estado = {
    rol: null,              // rol del usuario (lo devuelve mis_invitaciones)
    datos: null,            // última respuesta de mis_invitaciones
    grupos: [],             // grupos del usuario (los carga grupoPaciente.js)
    idYo: null,             // id del usuario logueado (para no ofrecer "Quitar" sobre uno mismo)
    grupoId: null,          // grupo elegido
    firma: null,            // para detectar cambios en los grupos
    integrantesGrupo: null, // grupo cuyos integrantes están en pantalla
  };

  // ---------- utilidades ----------

  function h(tag, props, ...hijos) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') {
        el.className = v;
      } else if (k.startsWith('on')) {
        el.addEventListener(k.slice(2), v);
      } else if (v !== false && v != null) {
        el.setAttribute(k, v === true ? '' : v);
      }
    });
    hijos.flat().forEach((c) => {
      if (c != null && c !== false) {
        el.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    });
    return el;
  }

  async function api(endpoint, opciones) {
    const { method = 'GET', body, query } = opciones || {};
    let url = `${API}/${endpoint}.php`;
    if (query) {
      url += '?' + new URLSearchParams(query);
    }

    const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new Error('No se pudo conectar con el servidor.');
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // Respuesta sin JSON
    }

    if (res.status === 401) {
      window.location.href = 'login.html';
      throw new Error('Tu sesión expiró.');
    }
    // Sin JSON o respuesta con error
    if (!res.ok || data == null || data.ok === false) {
      throw new Error((data && data.mensaje) || 'Ocurrió un error inesperado.');
    }
    return data;
  }

  /** api/grupos.php (vía hmApi). Si falla, lanza el error para que lo muestre el botón. */
  async function grupoApi(params, textoOk) {
    const r = await hmApi('grupos.php', params);
    if (!r.ok) {
      throw new Error(r.mensaje || 'No pudimos completar la operación.');
    }
    if (textoOk) {
      mensaje(textoOk, false);
    }
    return r;
  }

  function mensaje(texto, esError) {
    refs.mensaje.textContent = texto || '';
    refs.mensaje.className = esError ? 'acceso-msg error' : 'acceso-msg exito';
  }

  function textoPermisos(permisos) {
    const lista = PERMISOS.filter(([k]) => permisos[k]).map(([, t]) => t);
    if (lista.length === PERMISOS.length) return 'toda la información';
    return lista.length ? lista.join(', ') : 'sin permisos';
  }

  /**
   * Botón que se deshabilita mientras corre la acción y muestra el error si falla.
   * Si el error es una cancelación del usuario no hace falta mostrar nada: la acción solo retorna.
   */
  function boton(texto, accion, clase = 'acceso-btn-submit small') {
    const b = h('button', { type: 'button', class: clase }, texto);
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await accion();
      } catch (e) {
        mensaje(e.message, true);
      } finally {
        b.disabled = false;
      }
    });
    return b;
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise((ok, fallo) => {
      const t = document.createElement('textarea');
      t.value = texto;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      let copiado = false;
      try { copiado = document.execCommand('copy'); } catch (e) { /* sin permiso */ }
      t.remove();
      copiado ? ok() : fallo(new Error('No se pudo copiar'));
    });
  }

  const firmaDe = (grupos) => JSON.stringify(grupos.map((g) => [g.id, g.aprobado]));
  const gruposAprobados = () => estado.grupos.filter((g) => g.aprobado);
  const gruposPendientes = () => estado.grupos.filter((g) => !g.aprobado);
  const grupoElegido = () => gruposAprobados().find((g) => String(g.id) === String(estado.grupoId)) || null;
  const recargarGrupos = () => document.dispatchEvent(new CustomEvent('hm:grupos-recargar'));

  // ---------- estructura UI ----------

  function construir() {
    // Cabecera turquesa de la tarjeta
    const headerBanner = h('div', { class: 'acceso-card-header' },
      h('h2', { class: 'acceso-header-title' }, 'ACCESO COMPARTIDO E INVITACIONES')
    );

    // --- Bloque "grupo" (solo se ve si hay un grupo aprobado) ---
    refs.selectGrupo = h('select', {
      id: 'grupoInvitacion',
      class: 'acceso-input-text',
      onchange: () => { estado.grupoId = refs.selectGrupo.value; pintarGrupo(); cargarIntegrantes(); },
    });
    refs.grupoFila = h('div', { class: 'acceso-field-group' },
      h('label', { for: 'grupoInvitacion', class: 'acceso-label' }, 'Grupo'),
      refs.selectGrupo
    );
    refs.grupoTitulo = h('h3', { class: 'acceso-section-title' });
    refs.grupoLugar = h('p', { class: 'acceso-empty-text' });
    refs.btnSalir = boton('Salir del grupo', salirDelGrupo, 'acceso-btn-danger');
    refs.integrantes = h('div', { class: 'acceso-lista' });
    refs.btnActualizar = boton('Actualizar', cargarIntegrantes, 'acceso-btn-submit small');

    refs.bloqueGrupo = h('div', { class: 'acceso-form' },
      refs.grupoFila,
      refs.grupoTitulo,
      refs.grupoLugar,
      h('div', { class: 'acceso-li-actions' }, refs.btnSalir),
      h('h4', { class: 'acceso-list-title' }, 'Integrantes'),
      refs.integrantes,
      h('div', { class: 'acceso-li-actions' }, refs.btnActualizar),
      h('hr', { class: 'acceso-divider' })
    );
    refs.bloqueGrupo.style.display = 'none';

    // --- Bloque "invitar" (solo se ve si hay un grupo aprobado) ---
    refs.titulo = h('h3', { class: 'acceso-section-title' });
    refs.intro = h('p', { class: 'acceso-intro-text' });

    // Invitar por correo
    refs.labelCorreo = h('label', { for: 'emailInvitado', class: 'acceso-label' });
    refs.email = h('input', {
      type: 'email',
      id: 'emailInvitado',
      name: 'email',
      class: 'acceso-input-text',
      placeholder: 'correo@ejemplo.com',
      required: true,
      maxlength: '150',
      autocomplete: 'off',
    });
    refs.enviar = h('button', { type: 'submit', class: 'acceso-btn-submit' });
    refs.form = h(
      'form',
      { id: 'formInvitacion', class: 'acceso-form', onsubmit: enviarInvitacion },
      h('h4', { class: 'acceso-list-title' }, 'Por correo electrónico'),
      h('div', { class: 'acceso-field-group' }, refs.labelCorreo, refs.email),
      refs.enviar
    );

    // Invitar compartiendo el PIN del grupo
    refs.pinValor = h('strong', {
      style: 'font-size:24px;letter-spacing:4px;font-family:monospace;color:#2c3e50;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:8px 14px;',
    });
    refs.btnCopiar = boton('Copiar PIN', copiarPin, 'acceso-btn-submit small');
    refs.btnCambiarPin = boton('Cambiar PIN', cambiarPin, 'acceso-btn-submit small');
    refs.pinAyuda = h('p', { class: 'acceso-empty-text' });
    refs.bloquePin = h('div', { class: 'acceso-field-group' },
      h('h4', { class: 'acceso-list-title' }, 'Compartiendo el PIN del grupo'),
      h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, refs.pinValor, refs.btnCopiar, refs.btnCambiarPin),
      refs.pinAyuda
    );

    refs.bloqueInvitar = h('div', { class: 'acceso-form' },
      refs.titulo,
      refs.intro,
      refs.form,
      h('hr', { class: 'acceso-divider' }),
      refs.bloquePin
    );
    refs.bloqueInvitar.style.display = 'none';

    // --- Pedidos para unirme a un grupo (todavía sin aprobar) ---
    refs.pedidos = h('div', { class: 'acceso-lista' });
    refs.bloquePedidos = h('div', { class: 'acceso-form' },
      h('h3', { class: 'acceso-list-title' }, 'Pedidos para unirme a un grupo'),
      refs.pedidos
    );
    refs.bloquePedidos.style.display = 'none';

    // --- Listas ---
    refs.mensaje = h('p', { id: 'mensajeInvitacion', role: 'status' });
    refs.recibidas = h('div', { id: 'listaInvitaciones', class: 'acceso-lista' });
    refs.enviadas = h('div', { id: 'listaEnviadas', class: 'acceso-lista' });
    refs.compartidosConmigo = h('div', { id: 'listaCompartidosConmigo', class: 'acceso-lista' });
    refs.queComparto = h('div', { id: 'listaQueComparto', class: 'acceso-lista' });

    // Envoltorio blanco interior
    const innerCard = h('div', { class: 'acceso-card-body' },
      refs.bloqueGrupo,
      refs.bloqueInvitar,
      refs.bloquePedidos,
      refs.mensaje,
      h('hr', { class: 'acceso-divider' }),
      h('h3', { class: 'acceso-list-title' }, 'Invitaciones recibidas'),
      refs.recibidas,
      h('h3', { class: 'acceso-list-title' }, 'Invitaciones enviadas'),
      refs.enviadas,
      h('h3', { class: 'acceso-list-title' }, 'Personas que acompaño'),
      refs.compartidosConmigo,
      h('h3', { class: 'acceso-list-title' }, 'Personas con acceso a mis datos'),
      refs.queComparto
    );

    // Envoltorio principal (Card)
    const cardWrapper = h('div', { class: 'acceso-card-wrapper' },
      headerBanner,
      innerCard
    );

    root.replaceChildren(cardWrapper);
  }

  /** Textos que dependen del rol (afectado / acompañante). */
  function aplicarRol(rol) {
    const t = TEXTOS[rol];
    if (!t) return;
    refs.titulo.textContent = t.titulo;
    refs.labelCorreo.textContent = t.correo;
    refs.intro.textContent = t.intro;
    refs.enviar.textContent = t.boton;
    refs.pinAyuda.textContent = t.pin;
  }

  /** Nombre del grupo, tu lugar y PIN del grupo elegido. */
  function pintarGrupo() {
    const g = grupoElegido();
    if (!g) return;
    refs.grupoTitulo.textContent = `Grupo «${g.nombre}»`;
    refs.grupoLugar.textContent = `Tu lugar: ${g.rol_dentro_grupo || 'integrante'}.`;
    refs.pinValor.textContent = g.pin || '------';
    refs.btnCopiar.disabled = !g.pin;
    // Cambiar el PIN lo puede hacer solo quien aprueba ingresos
    refs.btnCambiarPin.style.display = g.puede_aprobar ? '' : 'none';
  }

  function llenarGrupos(aprobados) {
    if (!aprobados.some((g) => String(g.id) === String(estado.grupoId))) {
      estado.grupoId = aprobados[0].id;
    }
    refs.selectGrupo.replaceChildren(...aprobados.map((g) => {
      const o = h('option', { value: g.id }, g.nombre);
      o.selected = String(g.id) === String(estado.grupoId);
      return o;
    }));
    // Con un solo grupo no hace falta elegir
    refs.grupoFila.style.display = aprobados.length > 1 ? '' : 'none';
    pintarGrupo();
    // Los integrantes se cargan al elegir un grupo nuevo (después, al actualizar o al hacer una acción)
    if (String(estado.integrantesGrupo) !== String(estado.grupoId)) {
      cargarIntegrantes();
    }
  }

  /** Pedidos que hice con un PIN y todavía no me aprobaron. */
  function pintarPedidos() {
    const pendientes = gruposPendientes();
    refs.bloquePedidos.style.display = pendientes.length ? '' : 'none';
    lista(refs.pedidos, pendientes, '', (g) =>
      h('li', { class: 'acceso-li' },
        h('div', { class: 'acceso-li-info' },
          h('strong', {}, g.nombre),
          ' — tu pedido para unirte todavía no fue aprobado.'
        ),
        h('div', { class: 'acceso-li-actions' },
          boton('Cancelar pedido', () => cancelarPedido(g), 'acceso-btn-danger small')
        )
      )
    );
  }

  /**
   * La sección se ve si hay un grupo (para poder invitar) o si hay algo para mostrar
   * (un pedido pendiente, una invitación recibida de alguien que todavía no tiene grupo, un acceso activo).
   * El grupo y el formulario de invitar solo se ven si hay un grupo aprobado.
   */
  function actualizarVisibilidad() {
    const aprobados = gruposAprobados();
    const d = estado.datos;
    const hayInvitaciones = !!d && (d.recibidas.length + d.enviadas.length + d.compartidos_conmigo.length + d.que_comparto.length) > 0;
    const hayGrupo = aprobados.length > 0;
    const puedeInvitar = hayGrupo && !!TEXTOS[estado.rol];

    pintarPedidos();
    root.style.display = (hayGrupo || gruposPendientes().length > 0 || hayInvitaciones) ? '' : 'none';
    refs.bloqueGrupo.style.display = hayGrupo ? '' : 'none';
    refs.bloqueInvitar.style.display = puedeInvitar ? '' : 'none';
    if (hayGrupo) {
      llenarGrupos(aprobados);
    } else {
      estado.integrantesGrupo = null;
    }
  }

  // ---------- listas ----------

  function lista(contenedor, items, vacio, armarFila) {
    if (!items.length) {
      contenedor.replaceChildren(vacio ? h('p', { class: 'acceso-empty-text' }, vacio) : '');
      return;
    }
    contenedor.replaceChildren(h('ul', { class: 'acceso-ul' }, items.map(armarFila)));
  }

  function filaBase(item, detalle, botones) {
    return h(
      'li', { class: 'acceso-li' },
      h('div', { class: 'acceso-li-info' },
        h('strong', {}, item.otro_usuario.nombre),
        ` (${item.otro_usuario.email}) — `,
        detalle,
        item.grupo ? ` · Grupo «${item.grupo}»` : ''
      ),
      h('div', { class: 'acceso-li-actions' }, ...botones)
    );
  }

  function pintar(d) {
    lista(refs.recibidas, d.recibidas, 'No tenés invitaciones pendientes.', (i) =>
      filaBase(
        i,
        (i.iniciada_por === 'propietario' ? 'Te ofrece compartir: ' : 'Solicita ver: ') + textoPermisos(i.permisos),
        [
          boton('Aceptar', () => responder(i.id, 'aceptar'), 'acceso-btn-submit small'),
          boton('Rechazar', () => responder(i.id, 'rechazar'), 'acceso-btn-danger small'),
        ]
      )
    );

    lista(refs.enviadas, d.enviadas, 'No tenés invitaciones enviadas pendientes.', (i) =>
      filaBase(i, 'Pendiente: ' + textoPermisos(i.permisos), [
        boton('Cancelar', () => revocar(i, false), 'acceso-btn-danger small'),
      ])
    );

    lista(refs.compartidosConmigo, d.compartidos_conmigo, 'Todavía no acompañás a nadie.', (i) =>
      filaBase(i, 'Podés ver: ' + textoPermisos(i.permisos), [
        boton('Dejar de acceder', () => revocar(i, true), 'acceso-btn-danger small'),
      ])
    );

    lista(refs.queComparto, d.que_comparto, 'No compartís tus datos con nadie.', (i) =>
      filaBase(i, 'Comparte: ' + textoPermisos(i.permisos), [
        boton('Revocar acceso', () => revocar(i, true), 'acceso-btn-danger small'),
      ])
    );
  }

  // ---------- integrantes del grupo ----------

  async function cargarIntegrantes() {
    const g = grupoElegido();
    if (!g) return;
    estado.integrantesGrupo = g.id;
    const r = await hmApi('grupos.php', { accion: 'miembros', id_grupo: g.id });
    if (String(estado.grupoId) !== String(g.id)) return; // mientras cargaba se eligió otro grupo
    if (!r.ok) {
      refs.integrantes.replaceChildren(h('p', { class: 'acceso-msg error' }, r.mensaje || 'No pudimos cargar los integrantes.'));
      return;
    }
    const puede = !!r.datos.puede_aprobar;

    lista(refs.integrantes, r.datos.miembros || [], 'Todavía no hay integrantes.', (m) => {
      const esYo = Number(m.id) === Number(estado.idYo);
      const nombre = `${m.nombre} ${m.apellido || ''}`.trim() + (esYo ? ' (vos)' : '');
      const botones = [];

      if (puede && !m.aprobado) {
        botones.push(
          boton('Aprobar', () => accionIntegrante('aprobar', g, m, 'Integrante aprobado.'), 'acceso-btn-submit small'),
          boton('Rechazar', () => accionIntegrante('rechazar', g, m, 'Pedido rechazado.'), 'acceso-btn-danger small')
        );
      } else if (puede && m.aprobado && !esYo) {
        botones.push(boton('Quitar', () => quitarIntegrante(g, m), 'acceso-btn-danger small'));
      }

      return h('li', { class: 'acceso-li' },
        h('div', { class: 'acceso-li-info' },
          h('strong', {}, nombre),
          ` · ${m.rol || 'sin rol'}${m.aprobado ? '' : ' · pendiente de aprobación'}`
        ),
        h('div', { class: 'acceso-li-actions' }, ...botones)
      );
    });
  }

  /** Después de aprobar / rechazar / quitar / cambiar PIN: se refrescan integrantes, accesos y grupos. */
  async function refrescarTodo() {
    await Promise.all([cargar(), cargarIntegrantes()]);
    recargarGrupos();
  }

  async function accionIntegrante(accion, g, m, textoOk) {
    await grupoApi({ accion, id_grupo: g.id, id_usuario: m.id }, textoOk);
    await refrescarTodo();
  }

  async function quitarIntegrante(g, m) {
    const ok = await hmConfirmar({
      titulo: 'Quitar integrante',
      mensaje: '¿Quitar a esta persona del grupo? También se revocan los accesos compartidos con ella.',
      textoConfirmar: 'Quitar',
      peligro: true,
    });
    if (!ok) return;
    await accionIntegrante('quitar', g, m, 'Integrante quitado.');
  }

  async function salirDelGrupo() {
    const g = grupoElegido();
    if (!g) return;
    const ok = await hmConfirmar({
      titulo: 'Salir del grupo',
      mensaje: 'Si salís, dejás de compartir y de ver información con este grupo. ¿Seguro?',
      textoConfirmar: 'Sí, salir',
      peligro: true,
    });
    if (!ok) return;
    await grupoApi({ accion: 'salir', id_grupo: g.id }, 'Saliste del grupo.');
    estado.integrantesGrupo = null;
    estado.grupos = estado.grupos.filter((x) => String(x.id) !== String(g.id)); // ya no figura: evita pedir sus integrantes
    await cargar();
    recargarGrupos();
  }

  async function cancelarPedido(g) {
    const ok = await hmConfirmar({
      titulo: 'Cancelar pedido',
      mensaje: `¿Cancelar tu pedido para unirte al grupo «${g.nombre}»?`,
      textoConfirmar: 'Sí, cancelar',
      peligro: true,
    });
    if (!ok) return;
    await grupoApi({ accion: 'salir', id_grupo: g.id }, 'Pedido cancelado.');
    estado.grupos = estado.grupos.filter((x) => String(x.id) !== String(g.id));
    actualizarVisibilidad();
    recargarGrupos();
  }

  async function cambiarPin() {
    const g = grupoElegido();
    if (!g) return;
    const ok = await hmConfirmar({
      titulo: 'Cambiar PIN',
      mensaje: '¿Generar un PIN nuevo? El anterior deja de servir.',
      textoConfirmar: 'Generar PIN',
    });
    if (!ok) return;
    const r = await grupoApi({ accion: 'regenerar_pin', id_grupo: g.id });
    g.pin = r.datos.pin;
    pintarGrupo();
    mensaje(`Nuevo PIN: ${r.datos.pin}`, false);
    recargarGrupos();
  }

  // ---------- acciones ----------

  async function cargar() {
    try {
      const d = await api('mis_invitaciones');
      estado.rol = d.mi_rol;
      estado.datos = d;
      aplicarRol(d.mi_rol);
      pintar(d);
      actualizarVisibilidad();
    } catch (e) {
      mensaje(e.message, true);
    }
  }

  async function enviarInvitacion(ev) {
    ev.preventDefault();
    const g = grupoElegido();
    if (!g) {
      mensaje('Primero creá un grupo para poder invitar a alguien.', true);
      return;
    }
    // Se comparte todo: el servidor no recibe permisos, solo el correo y el grupo.
    const body = { email: refs.email.value.trim(), id_grupo: Number(g.id) };

    refs.enviar.disabled = true;
    try {
      const d = await api('enviar_invitacion', { method: 'POST', body });
      mensaje(d.mensaje, false);
      refs.form.reset();
      await cargar();
    } catch (e) {
      mensaje(e.message, true);
    } finally {
      refs.enviar.disabled = false;
    }
  }

  async function copiarPin() {
    const g = grupoElegido();
    if (!g || !g.pin) return;
    try {
      await copiarTexto(g.pin);
      mensaje(`PIN ${g.pin} copiado. Compartilo con la persona que querés sumar al grupo.`, false);
    } catch (e) {
      mensaje(`No pudimos copiarlo solo. El PIN es: ${g.pin}`, true);
    }
  }

  async function responder(id, accion) {
    const d = await api('responder_invitacion', { method: 'POST', body: { id, accion } });
    mensaje(d.mensaje, false);
    await cargar();
    // Al aceptar, el backend te sumó al grupo: se refresca la lista de grupos
    if (accion === 'aceptar') recargarGrupos();
  }

  async function revocar(item, pedirConfirmacion) {
    if (pedirConfirmacion) {
      const aviso = item.id_grupo
        ? `¿Seguro que querés finalizar este acceso? El acompañante también deja de integrar el grupo «${item.grupo}».`
        : '¿Seguro que querés finalizar este acceso?';
      if (!await hmConfirmar({ titulo: 'Finalizar acceso', mensaje: aviso, textoConfirmar: 'Finalizar', peligro: true })) {
        return; // canceló: no hay nada que mostrar
      }
    }
    const d = await api('revocar_acceso', { method: 'POST', body: { id: item.id } });
    mensaje(d.mensaje, false);
    await cargar();
    cargarIntegrantes(); // si el acceso venía de un grupo, cambió quién lo integra
    recargarGrupos();
  }

  // ---------- conexión con el módulo de grupos ----------

  // grupoPaciente.js avisa cada vez que carga la lista de grupos
  document.addEventListener('hm:grupos', (e) => {
    const detalle = e.detail || {};
    const grupos = Array.isArray(detalle.grupos) ? detalle.grupos : [];
    const firma = firmaDe(grupos);
    // La primera vez ya hay una carga en curso; después, solo si cambió la pertenencia a los grupos
    const cambio = estado.firma !== null && firma !== estado.firma;
    estado.grupos = grupos;
    estado.firma = firma;
    if (detalle.idYo != null) estado.idYo = detalle.idYo;
    actualizarVisibilidad();
    if (cambio) cargar();
  });

  construir();
  if (Array.isArray(window.hmGrupos)) {
    estado.grupos = window.hmGrupos;
    estado.firma = firmaDe(estado.grupos);
    estado.idYo = window.hmIdYo != null ? window.hmIdYo : null;
  }
  cargar();
  return root;
}