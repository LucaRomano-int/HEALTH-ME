/**
 * AVISOS Y RECORDATORIOS (api/preferencias.php)
 *
 * renderPreferenciasModule devuelve un contenedor al que se le pueden sumar secciones:
 *   const panel = renderPreferenciasModule(descripcion);
 *   panel.agregarSeccion("Título", elemento);   // devuelve la <section> creada
 * Hoy tiene "Aviso diario del estado de ánimo" (solo afectados); otras tareas pueden agregar más.
 * Todo texto dinámico entra con textContent.
 */
function renderPreferenciasModule(description) {
  const contenedor = hmEl("div", { className: "preferencias-wrapper" },
    hmEl("h2", { className: "panel-title", text: "Avisos y recordatorios" }),
    hmEl("p", { className: "panel-description", text: description || "Elegí cuándo querés que te avisemos." }));
  const secciones = hmEl("div", { className: "hm-pref-secciones" });
  const estado = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });
  contenedor.append(estado, secciones);

  /** Suma una sección con título al panel. */
  contenedor.agregarSeccion = (titulo, elemento) => {
    const s = hmEl("section", { className: "hm-pref-seccion" }, hmEl("h3", { className: "hm-subtitulo", text: titulo }), elemento);
    secciones.append(s);
    return s;
  };

  cargar();

  async function cargar() {
    estado.textContent = "Cargando…";
    const r = await hmApi("preferencias.php", { accion: "ver" });
    if (!r.ok) {
      estado.className = "hm-estado-msg hm-error";
      estado.textContent = r.mensaje || "No pudimos cargar tus preferencias.";
      return;
    }
    estado.className = "hm-estado-msg";
    estado.textContent = "";
    secciones.replaceChildren();
    const rol = hmNormalizarRol(r.datos.rol);
    if (rol === "afectado") {
      contenedor.agregarSeccion("Aviso diario del estado de ánimo", formularioAvisoDiario(r.datos.preferencias || {}));
    } else if (rol === "acompanante") {
      contenedor.agregarSeccion("Aviso diario del estado de ánimo", hmEl("p", { className: "hm-ayuda",
        text: "Este aviso lo configura cada persona afectada." }));
    } else {
      contenedor.agregarSeccion("Aviso diario del estado de ánimo", hmEl("p", { className: "hm-ayuda",
        text: "Elegí tu rol (afectado o acompañante) en tu perfil para configurar tus avisos." }));
    }
  }

  return contenedor;
}

/** Formulario del aviso diario. prefs viene de preferencias.php ver. */
function formularioAvisoDiario(prefs) {
  const zonaDispositivo = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) { return ""; } })();
  let zonaGuardada = prefs.zona_horaria || "America/Argentina/Buenos_Aires";
  let zonaNueva = null; // solo se envía si la persona toca "Usar la zona de este dispositivo"

  const interruptor = hmEl("input", { type: "checkbox", id: "hm-pref-activo", role: "switch", className: "hm-switch" });
  interruptor.checked = prefs.estado_diario_activo === true || Number(prefs.estado_diario_activo) === 1;

  const hora = hmEl("input", { type: "time", id: "hm-pref-hora", className: "hm-campo", required: "required" });
  hora.value = String(prefs.hora_estado_diario || "20:00").slice(0, 5);

  const horas = hmEl("select", { id: "hm-pref-horas", className: "hm-campo", "aria-describedby": "hm-pref-horas-ayuda" });
  for (let h = 1; h <= 12; h++) horas.append(hmEl("option", { value: String(h), text: h + (h === 1 ? " hora" : " horas") }));
  horas.value = String(Number(prefs.horas_aviso_acompanante) || 3);

  const zonaTexto = hmEl("span", { text: zonaGuardada, style: "font-weight:700;" });
  const zonaFila = hmEl("p", { className: "hm-ayuda" }, "Zona horaria: ", zonaTexto);
  const btnZona = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Usar la zona de este dispositivo (" + zonaDispositivo + ")",
    onclick: () => {
      zonaNueva = zonaDispositivo;
      zonaTexto.textContent = zonaDispositivo;
      mensaje.className = "hm-estado-msg";
      mensaje.textContent = "Cambiaste la zona horaria a " + zonaDispositivo + ". Tocá “Guardar” para aplicarla.";
      btnZona.hidden = true;
    } });
  btnZona.hidden = !zonaDispositivo || zonaDispositivo === zonaGuardada;

  const btnGuardar = hmEl("button", { type: "submit", className: "modal-btn modal-btn-save", text: "Guardar" });
  const mensaje = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });

  // Con el interruptor apagado no tiene sentido tocar la hora ni las horas de espera
  function sincronizar() {
    hora.disabled = !interruptor.checked;
    horas.disabled = !interruptor.checked;
  }
  interruptor.addEventListener("change", sincronizar);
  sincronizar();

  const form = hmEl("form", { className: "hm-pref-form", novalidate: "novalidate" },
    hmEl("div", { className: "hm-fila-switch" }, interruptor, hmEl("label", { for: "hm-pref-activo", text: "Recibir un aviso todos los días" })),
    hmEl("div", { className: "hm-campo-grupo" }, hmEl("label", { for: "hm-pref-hora", text: "¿A qué hora?" }), hora),
    hmEl("div", { className: "hm-campo-grupo" },
      hmEl("label", { for: "hm-pref-horas", text: "Avisar a mis acompañantes si no respondo en:" }), horas,
      hmEl("p", { id: "hm-pref-horas-ayuda", className: "hm-ayuda", text: "Solo se les avisa a quienes aceptaste y les diste permiso para ver tu estado diario." })),
    zonaFila, btnZona,
    hmEl("div", { style: "margin-top:12px;" }, btnGuardar), mensaje,
    hmEl("p", { className: "hm-ayuda", text: "Por ahora el aviso aparece dentro de la app. Cuando se active la app instalable, también llegará como notificación del teléfono." }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const params = { accion: "guardar", estado_diario_activo: interruptor.checked ? 1 : 0 };
    if (interruptor.checked) {
      if (!/^\d{2}:\d{2}$/.test(hora.value)) {
        mensaje.className = "hm-estado-msg hm-error";
        mensaje.textContent = "Elegí a qué hora querés el aviso.";
        hora.focus();
        return;
      }
      params.hora_estado_diario = hora.value;
      params.horas_aviso_acompanante = Number(horas.value);
    }
    if (zonaNueva) params.zona_horaria = zonaNueva;

    btnGuardar.disabled = true;
    mensaje.className = "hm-estado-msg";
    mensaje.textContent = "Guardando…";
    const r = await hmApi("preferencias.php", params);
    btnGuardar.disabled = false;
    if (!r.ok) {
      mensaje.className = "hm-estado-msg hm-error";
      mensaje.textContent = r.mensaje || "No pudimos guardar tus preferencias.";
      return;
    }
    const g = (r.datos && r.datos.preferencias) || {};
    if (g.zona_horaria) { zonaGuardada = g.zona_horaria; zonaTexto.textContent = zonaGuardada; }
    zonaNueva = null;
    btnZona.hidden = !zonaDispositivo || zonaDispositivo === zonaGuardada;
    mensaje.className = "hm-estado-msg hm-ok";
    mensaje.textContent = interruptor.checked
      ? "Listo, te avisamos todos los días a las " + String(g.hora_estado_diario || hora.value).slice(0, 5) + "."
      : "Listo, desactivamos el aviso diario.";
  });

  return form;
}