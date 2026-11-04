/**
 * BOTÓN S.O.S. (api/sos.php)
 *
 * Afectado:    botón rojo flotante en todas las pestañas, confirmación con cuenta regresiva de 3 s,
 *              pestaña "S.O.S." con contactos de emergencia e historial.
 * Acompañante: banner de alerta fijo arriba con los S.O.S. activos (se consulta cada 15 s con la pestaña visible).
 * Admin o sin rol: nada (la pestaña solo explica para quién es).
 *
 * Reglas: todo texto de la API entra con textContent (hmEl), enlaces externos con rel="noopener noreferrer",
 * sin localStorage ni cookies propias. Usa hmApi / hmEl / hmFecha / hmAvisarCambio de hm-api.js.
 */
(function () {
  "use strict";

  const SEGUNDOS_CUENTA = 3;
  const ESPERA_UBICACION_MS = 5000;
  const ESPERA_ENVIO_MS = 15 * 1000;
  const CONSULTA_ACTIVOS_MS = 15 * 1000;
  const MSG_SIN_CONEXION = "No pudimos conectar con el servidor. Llamá directamente al 107 o a tu contacto.";

  /* ======================= Utilidades ======================= */

  /** Solo dígitos y un "+" inicial: lo único que se permite dentro de un enlace tel:. */
  function soloTel(t) {
    const s = String(t || "").trim();
    return (s.startsWith("+") ? "+" : "") + s.replace(/\D/g, "");
  }

  /** Teléfono legible para mostrar (el href siempre usa el valor original). */
  function formatearTelefono(t) {
    const s = String(t || "");
    const d = s.replace(/\D/g, "");
    if (!d) return "";
    if (s.startsWith("+")) {
      if (d.startsWith("549") && d.length >= 12) return "+54 9 " + d.slice(3, -8) + " " + d.slice(-8, -4) + "-" + d.slice(-4);
      return "+" + d;
    }
    if (d.length === 10) { // 11 (Buenos Aires) usa 2 dígitos de área; el resto del país, 3
      return d.startsWith("11") ? d.slice(0, 2) + " " + d.slice(2, 6) + "-" + d.slice(6) : d.slice(0, 3) + " " + d.slice(3, 6) + "-" + d.slice(6);
    }
    if (d.length >= 9) return d.slice(0, -8) + " " + d.slice(-8, -4) + "-" + d.slice(-4);
    if (d.length === 8) return d.slice(0, 4) + "-" + d.slice(4);
    if (d.length === 7) return d.slice(0, 3) + "-" + d.slice(3);
    return d;
  }

  function nombreCompleto(e) { return [e.nombre, e.apellido].filter(Boolean).join(" ") || "Una persona"; }

  function haceMinutos(m) {
    const n = Number(m) || 0;
    if (n < 1) return "hace menos de 1 minuto";
    return "hace " + n + (n === 1 ? " minuto" : " minutos");
  }

  /** Mensaje de error de una respuesta: sin conexión (estado 0) usa el texto de emergencia. */
  function textoError(r) {
    if (r.estado === 0) return MSG_SIN_CONEXION;
    return r.mensaje || "No pudimos completar la operación.";
  }

  /** Línea de mensajes accesible (siempre presente en el DOM para que el lector la anuncie). */
  function crearMensaje() {
    const p = hmEl("p", { className: "sos-mensaje", role: "status", "aria-live": "polite" });
    p.mostrar = (texto, esError) => {
      p.textContent = texto || "";
      p.className = "sos-mensaje" + (texto ? (esError ? " sos-mensaje-error" : " sos-mensaje-ok") : "");
    };
    return p;
  }

  /** Elementos que se pueden enfocar dentro de un contenedor (para atrapar el foco). */
  function enfocables(raiz) {
    return [...raiz.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")]
      .filter((e) => !e.hidden && e.getClientRects().length > 0);
  }

  /** Atrapa Tab dentro de `raiz` y llama a alEscape con Escape. Devuelve la función para soltar. */
  function atraparFoco(raiz, alEscape) {
    function teclado(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); alEscape(); return; }
      if (e.key !== "Tab") return;
      const f = enfocables(raiz);
      if (!f.length) { e.preventDefault(); return; }
      const primero = f[0], ultimo = f[f.length - 1];
      if (!raiz.contains(document.activeElement)) { e.preventDefault(); primero.focus(); }
      else if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
    document.addEventListener("keydown", teclado, true);
    return () => document.removeEventListener("keydown", teclado, true);
  }

  /** Lleva a la pestaña "S.O.S." del menú. */
  function irAPestanaSos() {
    if (typeof healthFunctions === "undefined" || typeof setActiveFunction !== "function") return;
    const i = healthFunctions.findIndex((f) => f.renderFunctionName === "renderSosModule");
    if (i >= 0) setActiveFunction(i);
  }

  /* ======================= Rol ======================= */

  let rolCache = null;
  let rolPromesa = null;   // consulta en curso: si dos partes piden el rol a la vez, se hace un solo pedido
  const esperandoRol = []; // pestañas que quedaron esperando porque no había conexión al cargar
  /** { rol, es_admin } o null si no hubo respuesta. Solo se guarda si salió bien. */
  function cargarRol() {
    if (rolCache) return Promise.resolve(rolCache);
    if (!rolPromesa) {
      rolPromesa = hmApi("sos.php", { accion: "mi_rol" }).then((r) => {
        rolPromesa = null;
        if (r.ok) { rolCache = { rol: r.datos.rol || null, es_admin: !!r.datos.es_admin }; return rolCache; }
        if (r.estado === 401 || r.estado === 403) { rolCache = { rol: null, es_admin: false }; return rolCache; } // sin sesión: no se insiste
        return null;
      });
    }
    return rolPromesa;
  }
  /** "afectado" | "acompanante" | null (admin y sin rol son null). */
  function rolEfectivo(info) { return info && !info.es_admin ? info.rol : null; }

  /* ======================= Botón flotante y confirmación (afectado) ======================= */

  let botonFlotante = null;
  let confirmacionAbierta = false;

  function crearBotonFlotante() {
    if (botonFlotante) return;
    botonFlotante = hmEl("button", { type: "button", className: "sos-boton-flotante", "aria-label": "Pedir ayuda: botón S.O.S.", text: "S.O.S.",
      onclick: abrirConfirmacion });
    document.body.appendChild(botonFlotante);
  }

  /** Pide la ubicación (máximo 5 s). Siempre resuelve: con { lat, lng } o con null si se niega, tarda o no existe. */
  function pedirUbicacion() {
    return new Promise((resolver) => {
      if (!navigator.geolocation) { resolver(null); return; }
      let listo = false;
      const fin = (v) => { if (!listo) { listo = true; resolver(v); } };
      const respaldo = setTimeout(() => fin(null), ESPERA_UBICACION_MS + 500);
      try {
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(respaldo); fin({ lat: p.coords.latitude, lng: p.coords.longitude }); },
          () => { clearTimeout(respaldo); fin(null); },
          { timeout: ESPERA_UBICACION_MS, maximumAge: 60000, enableHighAccuracy: false });
      } catch (_) { clearTimeout(respaldo); fin(null); }
    });
  }

  /** Ventana de pantalla completa: cuenta regresiva -> envío -> resultado. */
  function abrirConfirmacion() {
    if (confirmacionAbierta) return;
    confirmacionAbierta = true;
    const foco = document.activeElement;
    let segundos = SEGUNDOS_CUENTA;
    let temporizador = null;
    let anulado = false;          // la persona canceló antes de que se enviara
    let enviando = false;
    let ubicacionPromesa = null;  // se inicia cuando tilda la casilla (o al final, si quedó tildada)
    let eventoId = null;

    const titulo = hmEl("h2", { id: "sos-conf-titulo", className: "sos-conf-titulo", text: "Pedir ayuda" });
    const cuenta = hmEl("p", { id: "sos-conf-cuenta", className: "sos-conf-cuenta", "aria-live": "polite" });
    const casilla = hmEl("input", { type: "checkbox", id: "sos-ubicacion", className: "sos-casilla" });
    const filaUbicacion = hmEl("div", { className: "sos-conf-ubicacion" }, casilla,
      hmEl("label", { for: "sos-ubicacion", text: "Enviar mi ubicación" }));
    const btnCancelar = hmEl("button", { type: "button", className: "sos-btn-cancelar", text: "Cancelar" });
    const cuerpo = hmEl("div", { className: "sos-conf-cuerpo" }, titulo, cuenta, filaUbicacion, btnCancelar);
    const caja = hmEl("div", { className: "sos-conf", role: "alertdialog", "aria-modal": "true",
      "aria-labelledby": "sos-conf-titulo", "aria-describedby": "sos-conf-cuenta" }, cuerpo);
    const overlay = hmEl("div", { className: "sos-overlay" }, caja);
    document.body.appendChild(overlay);

    // Con el envío en curso no se puede cancelar (ni con Escape): queda el resultado en pantalla
    const soltarFoco = atraparFoco(overlay, () => { if (!enviando) cerrar(); });

    function cerrar() {
      anulado = true;
      clearInterval(temporizador);
      soltarFoco();
      overlay.remove();
      confirmacionAbierta = false;
      if (foco && foco.isConnected && typeof foco.focus === "function") foco.focus();
      else if (botonFlotante) botonFlotante.focus();
    }
    btnCancelar.onclick = () => { if (!enviando) cerrar(); };

    // Pedir la ubicación recién cuando tilda la casilla: así se gana tiempo durante la cuenta
    casilla.addEventListener("change", () => { if (casilla.checked && !ubicacionPromesa) ubicacionPromesa = pedirUbicacion(); });

    function pintarCuenta() { cuenta.textContent = "Se enviará en " + segundos + "…"; }
    pintarCuenta();
    btnCancelar.focus();
    temporizador = setInterval(() => {
      segundos -= 1;
      if (segundos > 0) { pintarCuenta(); return; }
      clearInterval(temporizador);
      enviar();
    }, 1000);

    async function enviar() {
      enviando = false;
      let coords = null;
      if (casilla.checked) {
        cuenta.textContent = "Buscando tu ubicación…";
        if (!ubicacionPromesa) ubicacionPromesa = pedirUbicacion();
        coords = await ubicacionPromesa;
        if (anulado) return;           // canceló mientras se buscaba la ubicación
      }
      enviando = true;
      btnCancelar.disabled = true;
      cuenta.textContent = "Enviando…";
      const params = { accion: "disparar" };
      if (coords) { params.latitud = coords.lat.toFixed(6); params.longitud = coords.lng.toFixed(6); }
      // Tope de espera: si el servidor no contesta, se muestra el error con el enlace al 107 en vez de quedar en "Enviando…".
      // Si el pedido había llegado igual, "Reintentar" devuelve el mismo evento (la API lo detecta como repetido).
      const r = await Promise.race([
        hmApi("sos.php", params),
        new Promise((resolver) => setTimeout(() => resolver({ ok: false, estado: 0, datos: null, mensaje: MSG_SIN_CONEXION }), ESPERA_ENVIO_MS))
      ]);
      if (anulado) return;
      enviando = false;
      mostrarResultado(r);
    }

    /** Reemplaza el contenido por el resultado del disparo. */
    function mostrarResultado(r) {
      overlay.classList.add("sos-overlay-resultado");
      const salir = hmEl("button", { type: "button", className: "sos-btn sos-btn-secundario", text: "Cerrar", onclick: cerrar });
      const msg = crearMensaje();

      if (r.ok) {
        const d = r.datos;
        eventoId = d.evento && d.evento.id;
        const c = d.contacto || {};
        const tel = soloTel(c.telefono);
        const nombreContacto = c.nombre + (c.parentesco ? " (" + c.parentesco + ")" : "");
        hmAvisarCambio();

        const hijos = [hmEl("h2", { id: "sos-conf-titulo", className: "sos-conf-titulo", text: "S.O.S. enviado" })];
        let linea;
        if (d.repetido) linea = "Ya habíamos enviado tu S.O.S. hace un momento. Tus acompañantes ya están avisados.";
        else if (d.sin_acompanantes) linea = "";
        else linea = "Avisamos a " + d.avisados + (d.avisados === 1 ? " acompañante." : " acompañantes.");
        hijos.push(hmEl("p", { id: "sos-conf-cuenta", className: "sos-conf-texto", text: linea || "Tu S.O.S. quedó registrado." }));
        if (d.sin_acompanantes && !d.repetido) {
          hijos.push(hmEl("p", { className: "sos-aviso-amarillo", role: "status", text: "No tenés acompañantes vinculados, llamá vos al contacto." }));
        }
        if (tel) {
          hijos.push(
            hmEl("a", { className: "sos-llamar", href: "tel:" + tel, text: "Llamar a " + nombreContacto }),
            hmEl("p", { className: "sos-conf-numero", text: "Número: " + formatearTelefono(c.telefono) }));
        }
        const btnError = hmEl("button", { type: "button", className: "sos-btn sos-btn-secundario", text: "Fue un error, cancelar el S.O.S." });
        btnError.onclick = async () => {
          if (!eventoId) return;
          btnError.disabled = true;
          msg.mostrar("Cancelando…", false);
          const c2 = await hmApi("sos.php", { accion: "cancelar", id: eventoId });
          if (!c2.ok) { btnError.disabled = false; msg.mostrar(textoError(c2), true); return; }
          hmAvisarCambio();
          btnError.hidden = true;
          const l = overlay.querySelector(".sos-llamar"); if (l) l.hidden = true;
          const n = overlay.querySelector(".sos-conf-numero"); if (n) n.hidden = true;
          msg.mostrar("Listo, cancelamos el S.O.S. y avisamos a tus acompañantes que fue una falsa alarma.", false);
          salir.focus();
        };
        hijos.push(msg, hmEl("div", { className: "sos-conf-botones" }, btnError, salir));
        cuerpo.replaceChildren(...hijos);
        caja.setAttribute("aria-live", "polite");
        const enlace = cuerpo.querySelector(".sos-llamar");
        (enlace || salir).focus();
        // Los navegadores pueden bloquear esta redirección: por eso el enlace de arriba queda siempre visible
        if (tel && !d.repetido) { try { window.location.href = "tel:" + tel; } catch (_) { /* queda el enlace */ } }
        return;
      }

      // Errores
      const hijos = [hmEl("h2", { id: "sos-conf-titulo", className: "sos-conf-titulo", text: "No se pudo enviar" })];
      const botones = [];
      if (r.estado === 409 && r.datos && r.datos.codigo === "sin_contacto") {
        hijos[0].textContent = "Falta un contacto";
        hijos.push(hmEl("p", { id: "sos-conf-cuenta", className: "sos-conf-texto", text: "Todavía no cargaste un contacto de emergencia." }));
        botones.push(hmEl("button", { type: "button", className: "sos-btn sos-btn-principal", text: "Cargar un contacto",
          onclick: () => { cerrar(); irAPestanaSos(); } }));
      } else {
        hijos.push(hmEl("p", { id: "sos-conf-cuenta", className: "sos-conf-texto", text: textoError(r) }));
        if (r.estado === 0) {
          hijos.push(hmEl("a", { className: "sos-llamar", href: "tel:107", text: "Llamar al 107" }));
        }
        if (r.estado === 0 || r.estado >= 500) {
          botones.push(hmEl("button", { type: "button", className: "sos-btn sos-btn-principal", text: "Reintentar",
            onclick: () => { cerrar(); abrirConfirmacion(); } }));
        }
      }
      botones.push(salir);
      hijos.push(hmEl("div", { className: "sos-conf-botones" }, ...botones));
      cuerpo.replaceChildren(...hijos);
      (cuerpo.querySelector(".sos-btn-principal") || cuerpo.querySelector(".sos-llamar") || salir).focus();
    }
  }

  /* ======================= Pestaña "S.O.S." ======================= */

  /** Formulario para agregar o editar un contacto (con casilla de prioritario, que hmModal no tiene). */
  function abrirFormularioContacto(contacto, alGuardar) {
    const foco = document.activeElement;
    const editando = !!contacto;
    const nombre = hmEl("input", { type: "text", id: "sos-f-nombre", className: "sos-campo", maxlength: "150", required: "required", autocomplete: "off" });
    const telefono = hmEl("input", { type: "tel", id: "sos-f-tel", className: "sos-campo", maxlength: "30", required: "required", inputmode: "tel", autocomplete: "off" });
    const parentesco = hmEl("input", { type: "text", id: "sos-f-par", className: "sos-campo", maxlength: "100", autocomplete: "off" });
    const prio = hmEl("input", { type: "checkbox", id: "sos-f-prio", className: "sos-casilla" });
    if (editando) {
      nombre.value = contacto.nombre || "";
      telefono.value = contacto.telefono || "";
      parentesco.value = contacto.parentesco || "";
      if (contacto.es_prioritario) { prio.checked = true; prio.disabled = true; } // ya es el primero de la lista
    }
    const msg = crearMensaje();
    const btnGuardar = hmEl("button", { type: "submit", className: "modal-btn modal-btn-save sos-btn-modal", text: "Guardar" });
    const btnCancelar = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel sos-btn-modal", text: "Cancelar" });
    const form = hmEl("form", { className: "sos-form", novalidate: "novalidate" },
      hmEl("div", { className: "sos-campo-grupo" }, hmEl("label", { for: "sos-f-nombre", text: "Nombre (obligatorio)" }), nombre),
      hmEl("div", { className: "sos-campo-grupo" }, hmEl("label", { for: "sos-f-tel", text: "Teléfono (obligatorio)" }), telefono,
        hmEl("p", { className: "sos-ayuda", text: "Con código de área, por ejemplo 11 5555 1234." })),
      hmEl("div", { className: "sos-campo-grupo" }, hmEl("label", { for: "sos-f-par", text: "Parentesco (opcional)" }), parentesco),
      hmEl("div", { className: "sos-fila-casilla" }, prio, hmEl("label", { for: "sos-f-prio", text: "Es mi contacto prioritario" })),
      msg,
      hmEl("div", { className: "modal-actions" }, btnCancelar, btnGuardar));
    const overlay = hmEl("div", { className: "modal-overlay active sos-modal-overlay" },
      hmEl("div", { className: "modal-content sos-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "sos-f-titulo" },
        hmEl("h3", { id: "sos-f-titulo", text: editando ? "Editar contacto" : "Agregar contacto" }), form));
    document.body.appendChild(overlay);
    const soltar = atraparFoco(overlay, cerrar);
    function cerrar() {
      soltar();
      overlay.remove();
      if (foco && foco.isConnected && typeof foco.focus === "function") foco.focus();
    }
    btnCancelar.onclick = cerrar;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
    nombre.focus();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!nombre.value.trim()) { msg.mostrar("Escribí el nombre del contacto.", true); nombre.focus(); return; }
      if (!telefono.value.trim()) { msg.mostrar("Escribí el teléfono del contacto.", true); telefono.focus(); return; }
      btnGuardar.disabled = true;
      msg.mostrar("Guardando…", false);
      const params = { accion: "contacto_guardar", nombre: nombre.value.trim(), telefono: telefono.value.trim(), parentesco: parentesco.value.trim() };
      if (editando) params.id = contacto.id;
      if (prio.checked && !prio.disabled) params.prioritario = "1";
      const r = await hmApi("sos.php", params);
      btnGuardar.disabled = false;
      if (!r.ok) { msg.mostrar(textoError(r), true); return; } // el mensaje del servidor (teléfono inválido, máximo, etc.)
      cerrar();
      alGuardar(r.datos.contactos);
    });
  }

  /** Tarjeta de un S.O.S. del historial. */
  function tarjetaHistorial(e) {
    const estados = { activo: ["Activo", "sos-estado-activo"], atendido: ["Atendido", "sos-estado-atendido"], cancelado: ["Cancelado", "sos-estado-cancelado"] };
    const [texto, clase] = estados[e.estado] || [String(e.estado || ""), "sos-estado-cancelado"];
    return hmEl("div", { className: "sos-item" },
      hmEl("div", { className: "sos-item-cabecera" },
        hmEl("strong", { text: hmFecha(e.fecha_hora, true) }),
        hmEl("span", { className: "sos-estado " + clase, text: texto })),
      hmEl("p", { className: "sos-item-linea", text: e.contacto_llamado ? "Contacto: " + e.contacto_llamado : "Sin contacto registrado" }),
      e.atendido_por ? hmEl("p", { className: "sos-item-linea", text: "Atendido por " + e.atendido_por }) : null);
  }

  /** Pestaña del afectado: contactos + historial. */
  function armarPanelAfectado(raiz) {
    const msg = crearMensaje();
    const contador = hmEl("span", { className: "sos-contador" });
    const lista = hmEl("div", { className: "sos-lista" });
    const historial = hmEl("div", { className: "sos-lista" });
    let contactos = [];
    let maximo = 5;
    let ocupado = false;
    let focoPendiente = null;

    const btnAgregar = hmEl("button", { type: "button", className: "modal-btn modal-btn-save sos-btn-modal", text: "+ Agregar contacto",
      onclick: () => abrirFormularioContacto(null, (c) => { contactos = c; pintarContactos(); msg.mostrar("Contacto guardado.", false); }) });

    raiz.append(
      hmEl("p", { className: "sos-ayuda-grande", text: "El botón S.O.S. llama al contacto prioritario y avisa a tus acompañantes." }),
      hmEl("section", { className: "sos-seccion", "aria-labelledby": "sos-h-contactos" },
        hmEl("div", { className: "sos-seccion-cabecera" }, hmEl("h3", { id: "sos-h-contactos", className: "sos-subtitulo", text: "Contactos de emergencia" }), contador),
        msg, lista, hmEl("div", { style: "margin-top:12px;" }, btnAgregar)),
      hmEl("section", { className: "sos-seccion", "aria-labelledby": "sos-h-historial" },
        hmEl("h3", { id: "sos-h-historial", className: "sos-subtitulo", text: "Historial de S.O.S." }), historial));

    /** Ejecuta una acción sobre los contactos y vuelve a pintar con la lista que devuelve la API. */
    async function accion(params, textoOk) {
      if (ocupado) return;
      ocupado = true;
      lista.setAttribute("aria-busy", "true");
      const r = await hmApi("sos.php", params);
      ocupado = false;
      lista.removeAttribute("aria-busy");
      if (!r.ok) { msg.mostrar(textoError(r), true); return; }
      contactos = r.datos.contactos || contactos;
      pintarContactos();
      msg.mostrar(textoOk || "", false);
    }

    function pintarContactos() {
      contador.textContent = contactos.length + " de " + maximo;
      lista.replaceChildren();
      if (!contactos.length) {
        lista.append(hmEl("p", { className: "sos-vacio", text: "Todavía no cargaste ningún contacto de emergencia. Agregá al menos uno para poder usar el botón S.O.S." }));
      }
      contactos.forEach((c, i) => {
        const ids = contactos.map((x) => x.id);
        const mover = (desde, hasta, texto) => {
          const nuevo = ids.slice(); const [x] = nuevo.splice(desde, 1); nuevo.splice(hasta, 0, x);
          focoPendiente = texto;
          accion({ accion: "contacto_ordenar", ids: nuevo.join(",") }, "Cambiamos el orden.");
        };
        const botonera = hmEl("div", { className: "sos-botonera" },
          hmEl("button", { type: "button", className: "sos-btn-flecha", "data-foco": "subir-" + c.id, text: "↑", disabled: i === 0 ? "disabled" : null,
            "aria-label": "Subir a " + c.nombre, title: "Subir", onclick: () => mover(i, i - 1, "subir-" + c.id) }),
          hmEl("button", { type: "button", className: "sos-btn-flecha", "data-foco": "bajar-" + c.id, text: "↓", disabled: i === contactos.length - 1 ? "disabled" : null,
            "aria-label": "Bajar a " + c.nombre, title: "Bajar", onclick: () => mover(i, i + 1, "bajar-" + c.id) }),
          c.es_prioritario ? null : hmEl("button", { type: "button", className: "sos-btn-accion", text: "Hacer prioritario", "aria-label": "Hacer prioritario a " + c.nombre,
            onclick: () => accion({ accion: "contacto_prioritario", id: c.id }, c.nombre + " ahora es tu contacto prioritario.") }),
          hmEl("button", { type: "button", className: "sos-btn-accion", text: "Editar", "aria-label": "Editar a " + c.nombre,
            onclick: () => abrirFormularioContacto(c, (n) => { contactos = n; pintarContactos(); msg.mostrar("Contacto guardado.", false); }) }),
          hmEl("button", { type: "button", className: "sos-btn-accion sos-btn-peligro", text: "Eliminar", "aria-label": "Eliminar a " + c.nombre,
            onclick: async () => {
              if (await hmConfirmar({ titulo: "Eliminar contacto", mensaje: "¿Eliminar a " + c.nombre + " de tus contactos de emergencia?", textoConfirmar: "Eliminar", peligro: true }))
                accion({ accion: "contacto_eliminar", id: c.id }, "Contacto eliminado.");
            } }));
        lista.append(hmEl("div", { className: "param-card sos-contacto" },
          hmEl("div", { className: "sos-contacto-cuerpo" },
            hmEl("div", { className: "sos-contacto-datos" },
              hmEl("strong", { className: "sos-contacto-nombre", text: c.nombre }),
              c.es_prioritario ? hmEl("span", { className: "sos-etiqueta-prioritario", text: "Prioritario" }) : null),
            hmEl("p", { className: "sos-item-linea", text: formatearTelefono(c.telefono) }),
            c.parentesco ? hmEl("p", { className: "sos-item-linea", text: c.parentesco }) : null,
            botonera)));
      });
      if (focoPendiente) {
        let b = lista.querySelector('[data-foco="' + focoPendiente + '"]');
        if (b && b.disabled) b = lista.querySelector('[data-foco="' + (focoPendiente.startsWith("subir") ? "bajar-" : "subir-") + focoPendiente.split("-")[1] + '"]');
        if (b && !b.disabled) b.focus();
        focoPendiente = null;
      }
    }

    async function cargarContactos() {
      const r = await hmApi("sos.php", { accion: "contactos_listar" });
      if (!r.ok) { msg.mostrar(textoError(r), true); return; }
      contactos = r.datos.contactos || [];
      maximo = r.datos.maximo || 5;
      msg.mostrar("", false);
      pintarContactos();
    }

    async function cargarHistorial() {
      const r = await hmApi("sos.php", { accion: "historial", limite: 20 });
      historial.replaceChildren();
      if (!r.ok) { historial.append(hmEl("p", { className: "sos-mensaje sos-mensaje-error", text: textoError(r) })); return; }
      const eventos = r.datos.eventos || [];
      if (!eventos.length) historial.append(hmEl("p", { className: "sos-vacio", text: "Todavía no usaste el botón S.O.S." }));
      eventos.forEach((e) => historial.append(tarjetaHistorial(e)));
    }

    cargarContactos();
    cargarHistorial();
    // Cuando se dispara o cancela un S.O.S. se actualiza el historial
    document.addEventListener("hm:datos", () => { if (raiz.isConnected) cargarHistorial(); });
  }

  /* ======================= Banner y lista de S.O.S. activos (acompañante) ======================= */

  const activos = {
    eventos: [],                 // lo que devuelve eventos_activos
    atendidos: new Map(),        // id -> evento que YO estoy atendiendo (la API ya no lo trae como activo; se mantiene hasta cerrarlo)
    errores: new Map(),          // id -> texto de error de ese evento
    avisos: [],                  // frases sueltas ("Ya lo está atendiendo ...")
    oyentes: [],
    iniciado: false,
    consultando: false,
    detenido: false
  };
  let bannerEl = null;

  function notificarActivos() { activos.oyentes.forEach((f) => { try { f(); } catch (_) { /* un oyente roto no frena a los demás */ } }); }

  /** Eventos para mostrar: los que atiendo yo (arriba) + los activos que trae la API. */
  function eventosVisibles() {
    const propios = [...activos.atendidos.values()];
    const ids = new Set(propios.map((e) => e.id));
    return propios.concat(activos.eventos.filter((e) => !ids.has(e.id)));
  }

  async function consultarActivos() {
    if (activos.consultando || activos.detenido) return;
    activos.consultando = true;
    try {
      const r = await hmApi("sos.php", { accion: "eventos_activos" });
      if (r.ok) {
        activos.eventos = r.datos.eventos || [];
        notificarActivos();
      } else if (r.estado === 401 || r.estado === 403) {
        activos.detenido = true; // sesión vencida o rol incorrecto: no se insiste
      }
      // Sin conexión u otro error: en silencio, se reintenta en la próxima vuelta
    } finally {
      activos.consultando = false;
    }
  }

  function iniciarConsultaActivos() {
    if (activos.iniciado) return;
    activos.iniciado = true;
    consultarActivos();
    setInterval(() => { if (document.visibilityState === "visible") consultarActivos(); }, CONSULTA_ACTIVOS_MS);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") consultarActivos(); });
  }

  /** Acciones de un evento: llamar, ver ubicación y atender. Se usa en el banner y en la lista de la pestaña. */
  function accionesEvento(e, atendiendoYo) {
    const tel = soloTel(e.telefono_llamado);
    const btns = [];
    if (tel) btns.push(hmEl("a", { className: "sos-btn sos-btn-llamar-acomp", href: "tel:" + tel, text: "Llamar a " + (e.contacto_llamado || "el contacto") }));
    if (e.mapa_url && /^https:\/\//i.test(e.mapa_url)) {
      btns.push(hmEl("a", { className: "sos-btn sos-btn-secundario", href: e.mapa_url, target: "_blank", rel: "noopener noreferrer", text: "Ver ubicación" }));
    }
    if (!atendiendoYo) {
      const b = hmEl("button", { type: "button", className: "sos-btn sos-btn-principal", text: "Lo estoy atendiendo" });
      b.onclick = () => atenderEvento(e, b);
      btns.push(b);
    } else {
      btns.push(hmEl("button", { type: "button", className: "sos-btn sos-btn-secundario", text: "Cerrar aviso",
        onclick: () => { activos.atendidos.delete(e.id); notificarActivos(); } }));
    }
    return btns;
  }

  async function atenderEvento(e, boton) {
    boton.disabled = true;
    activos.errores.delete(e.id);
    const r = await hmApi("sos.php", { accion: "atender", id: e.id });
    const quitar = () => { activos.eventos = activos.eventos.filter((x) => x.id !== e.id); };
    if (!r.ok) {
      if (r.estado === 409 || r.estado === 404) { // cancelado, vencido o ya no existe
        quitar();
        activos.avisos.push(r.mensaje || "Ese S.O.S. ya no está activo.");
      } else {
        boton.disabled = false;
        activos.errores.set(e.id, textoError(r));
      }
      notificarActivos();
      return;
    }
    if (r.datos.ya_atendido) {
      quitar();
      activos.avisos.push("Ya lo está atendiendo " + (r.datos.atendido_por || "otro acompañante") + ".");
    } else {
      quitar();
      activos.atendidos.set(e.id, Object.assign({}, e, { atendido_por: r.datos.atendido_por || "vos" }));
    }
    notificarActivos();
  }

  /** Una tarjeta de evento (banner o pestaña). */
  function tarjetaEvento(e) {
    const atendiendoYo = activos.atendidos.has(e.id);
    const titulo = atendiendoYo
      ? "Estás atendiendo el S.O.S. de " + nombreCompleto(e)
      : nombreCompleto(e) + " pidió ayuda";
    return hmEl("div", { className: "sos-evento" + (atendiendoYo ? " sos-evento-atendido" : "") },
      hmEl("strong", { className: "sos-evento-titulo", text: titulo }),
      hmEl("p", { className: "sos-evento-tiempo", text: "S.O.S. activado " + haceMinutos(e.minutos) }),
      e.contacto_llamado ? hmEl("p", { className: "sos-evento-tiempo", text: "Contacto de emergencia: " + e.contacto_llamado + (e.telefono_llamado ? " · " + formatearTelefono(e.telefono_llamado) : "") }) : null,
      activos.errores.has(e.id) ? hmEl("p", { className: "sos-mensaje sos-mensaje-error", text: activos.errores.get(e.id) }) : null,
      hmEl("div", { className: "sos-evento-botones" }, ...accionesEvento(e, atendiendoYo)));
  }

  /** Deja el banner justo debajo de la barra de navegación. */
  function ubicarBanner() {
    if (!bannerEl) return;
    const nav = document.querySelector(".navbar");
    const r = nav ? nav.getBoundingClientRect() : null;
    bannerEl.style.top = (r && r.bottom > 0 ? Math.round(r.bottom) : 0) + "px";
  }

  function pintarBanner() {
    if (!bannerEl) return;
    const evs = eventosVisibles();
    const nodos = [];
    activos.avisos.forEach((t, i) => nodos.push(hmEl("div", { className: "sos-banner-aviso" },
      hmEl("span", { text: t }),
      hmEl("button", { type: "button", className: "sos-btn-cerrar-aviso", text: "Entendido", "aria-label": "Cerrar este mensaje",
        onclick: () => { activos.avisos.splice(i, 1); notificarActivos(); } }))));
    evs.forEach((e) => nodos.push(tarjetaEvento(e)));
    bannerEl.replaceChildren(...nodos);
    bannerEl.hidden = nodos.length === 0;
    ubicarBanner();
  }

  function iniciarBannerAcompanante() {
    if (bannerEl) return;
    bannerEl = hmEl("div", { className: "sos-banner", role: "alert", "aria-live": "assertive", hidden: "hidden" });
    document.body.appendChild(bannerEl);
    activos.oyentes.push(pintarBanner);
    let pendiente = false;
    const reubicar = () => { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; ubicarBanner(); }); };
    window.addEventListener("scroll", reubicar, { passive: true });
    window.addEventListener("resize", reubicar);
    iniciarConsultaActivos();
  }

  /** Pestaña del acompañante: explicación + lista de S.O.S. activos. */
  function armarPanelAcompanante(raiz) {
    const lista = hmEl("div", { className: "sos-lista", "aria-live": "polite" });
    raiz.append(
      hmEl("p", { className: "sos-ayuda-grande", text: "Si una persona que acompañás activa el S.O.S., te aparece una alerta roja arriba de la pantalla con su nombre y hace cuánto lo activó. Desde ahí podés llamar a su contacto de emergencia, ver su ubicación (si la compartió) y avisar que lo estás atendiendo." }),
      hmEl("section", { className: "sos-seccion", "aria-labelledby": "sos-h-activos" },
        hmEl("h3", { id: "sos-h-activos", className: "sos-subtitulo", text: "S.O.S. activos ahora" }), lista));
    function pintar() {
      if (!raiz.isConnected) return;
      const evs = eventosVisibles();
      lista.replaceChildren();
      if (!evs.length) lista.append(hmEl("p", { className: "sos-vacio", text: "No hay S.O.S. activos en este momento." }));
      evs.forEach((e) => lista.append(tarjetaEvento(e)));
    }
    activos.oyentes.push(pintar);
    pintar();
  }

  /* ======================= Módulo (pestaña) ======================= */

  window.renderSosModule = function (description) {
    const raiz = hmEl("div", { className: "sos-wrapper" },
      hmEl("h2", { className: "panel-title", text: "S.O.S." }),
      hmEl("p", { className: "panel-description", text: description || "Pedí ayuda y configurá a quién avisar." }));
    const contenido = hmEl("div", { className: "sos-contenido" });
    raiz.append(contenido);
    let armado = false;

    async function pintar() {
      if (armado) return;
      contenido.replaceChildren(hmEl("p", { className: "sos-vacio", text: "Cargando…" }));
      const info = await cargarRol();
      if (armado) return;
      if (!info) {
        contenido.replaceChildren(
          hmEl("p", { className: "sos-mensaje sos-mensaje-error", text: "No pudimos conectar con el servidor." }),
          hmEl("button", { type: "button", className: "modal-btn modal-btn-save sos-btn-modal", text: "Reintentar", onclick: pintar }));
        return;
      }
      const rol = rolEfectivo(info);
      contenido.replaceChildren();
      if (rol === "afectado") { armado = true; armarPanelAfectado(contenido); }
      else if (rol === "acompanante") { armado = true; armarPanelAcompanante(contenido); }
      else { armado = true; contenido.append(hmEl("p", { className: "sos-ayuda-grande", text: "El S.O.S. es para personas afectadas y acompañantes." })); }
    }
    pintar();
    // Si la conexión vuelve y el rol se averigua desde otro lado, se completa la pestaña
    esperandoRol.push(() => { if (!armado && raiz.isConnected) pintar(); });
    return raiz;
  };

  /* ======================= Arranque ======================= */

  document.addEventListener("DOMContentLoaded", async () => {
    // Se averigua el rol; si no hay conexión se reintenta en silencio cada 10 s
    let info = await cargarRol();
    while (!info) {
      await new Promise((ok) => setTimeout(ok, 10000));
      info = await cargarRol();
    }
    const rol = rolEfectivo(info);
    if (rol === "afectado") crearBotonFlotante();
    else if (rol === "acompanante") iniciarBannerAcompanante();
    esperandoRol.splice(0).forEach((f) => f());
  });
})();
