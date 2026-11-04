/**
 * Llamada a api/recordatorios.php. Ruta relativa: user.php vive en la misma carpeta que api/
 * (igual que acceso-compartido.js). Devuelve { ok, estado, datos }.
 */
async function llamarRecordatorios(parametros) {
  try {
    const resp = await fetch("api/recordatorios.php", {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: new URLSearchParams(parametros)
    });
    let datos = null;
    try { datos = await resp.json(); } catch (_) { /* respuesta sin JSON */ }
    return { ok: resp.ok && !!datos && datos.ok === true, estado: resp.status, datos };
  } catch (_) {
    return { ok: false, estado: 0, datos: null };
  }
}

function mensajeDeError(r, porDefecto) {
  if (r.datos && r.datos.mensaje) return r.datos.mensaje;
  if (r.estado === 0) return "No pudimos conectar con el servidor.";
  return porDefecto;
}

/** Fecha local "YYYY-MM-DD" (toISOString daría la de UTC: de noche en Argentina ya es "mañana"). */
function fechaLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Convierte un recordatorio de la API en un evento de FullCalendar (los que se repiten usan recurrencia nativa). */
function recordatorioAEvento(r) {
  const [fecha, hora = "00:00:00"] = String(r.fecha_hora).split(" ");
  const base = {
    id: String(r.id),
    title: r.titulo,
    color: r.tipo === "horario" ? "#f59e0b" : "#5cb8bc",
    extendedProps: { idRecordatorio: r.id, tipo: r.tipo, repeticion: r.repeticion }
  };
  if (r.repeticion === "diaria" || r.repeticion === "semanal") {
    const [a, m, d] = fecha.split("-").map(Number);
    const evento = {
      ...base,
      daysOfWeek: r.repeticion === "diaria" ? [0, 1, 2, 3, 4, 5, 6] : [new Date(a, m - 1, d).getDay()],
      startTime: hora,
      startRecur: fecha
    };
    // Con fecha de fin deja de repetirse (endRecur es exclusivo: se suma un día para incluir el último)
    if (r.fecha_fin) {
      const [fa, fm, fd] = String(r.fecha_fin).slice(0, 10).split("-").map(Number);
      evento.endRecur = fechaLocalISO(new Date(fa, fm - 1, fd + 1));
    }
    return evento;
  }
  return { ...base, start: `${fecha}T${hora}` };
}

/**
 * Modal "Configurar alarma" de un recordatorio (api/alarmas.php: config_obtener / config_guardar).
 * id = id del RECORDATORIO (no de la ocurrencia). alGuardar() se llama cuando el servidor confirmó.
 * Los textos que vienen del servidor entran con textContent. Usa reproducirTono/hmDecir/hmVibrar de alarmas.js.
 */
const HM_ETIQUETA_DIAS = { 2: "2 días antes", 1: "1 día antes", 0: "El mismo día" };

async function abrirConfigAlarma(id, alGuardar) {
  const foco = document.activeElement;
  const cuerpo = hmEl("div", { className: "hm-config-cuerpo" }, hmEl("p", { className: "hm-ayuda", text: "Cargando…" }));
  const mensaje = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });
  const btnCerrar = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Cancelar" });
  const btnGuardar = hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "Guardar", hidden: "hidden" });
  const overlay = hmEl("div", { className: "modal-overlay active" },
    hmEl("div", { className: "modal-content hm-config-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "hm-config-titulo" },
      hmEl("h3", { id: "hm-config-titulo", text: "Configurar alarma" }),
      cuerpo, mensaje,
      hmEl("div", { className: "modal-actions" }, btnCerrar, btnGuardar)));

  function cerrar() {
    if (!overlay.isConnected) return;
    detenerTono();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    overlay.remove();
    document.removeEventListener("keydown", teclado, true);
    if (foco && foco.isConnected && typeof foco.focus === "function") foco.focus();
  }
  function teclado(e) { if (e.key === "Escape") { e.preventDefault(); cerrar(); } }
  btnCerrar.onclick = cerrar;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
  document.addEventListener("keydown", teclado, true);
  document.body.appendChild(overlay);
  btnCerrar.focus();

  const r = await hmApi("alarmas.php", { accion: "config_obtener", id });
  if (!r.ok) { // por ejemplo 403 para administradores
    cuerpo.replaceChildren();
    mensaje.className = "hm-estado-msg hm-error";
    mensaje.textContent = r.mensaje || "No pudimos cargar la configuración de la alarma.";
    btnCerrar.textContent = "Cerrar";
    return;
  }
  const d = r.datos, cfg = d.config || {};
  const titulo = (d.recordatorio && d.recordatorio.titulo) || "";

  // Tono + Probar
  const selTono = hmEl("select", { id: "hm-cfg-tono", className: "hm-campo" },
    (d.tonos || []).map((t) => hmEl("option", { value: t.id, text: t.nombre })));
  selTono.value = cfg.tono;
  const probarTono = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Probar",
    "aria-label": "Probar el tono elegido",
    onclick: () => { mensaje.className = "hm-estado-msg"; mensaje.textContent = selTono.value === "silencio" ? "El tono “silencio” no suena." : (reproducirTono(selTono.value) ? "" : "Este navegador no puede reproducir sonido."); } });

  // Vibración y voz
  const chkVib = hmEl("input", { type: "checkbox", id: "hm-cfg-vib", className: "hm-switch", role: "switch" });
  chkVib.checked = !!cfg.vibracion;
  const probarVib = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Probar", "aria-label": "Probar la vibración",
    onclick: () => { mensaje.className = "hm-estado-msg"; mensaje.textContent = hmVibrar() ? "" : "Este dispositivo no vibra."; } });
  const chkVoz = hmEl("input", { type: "checkbox", id: "hm-cfg-voz", className: "hm-switch", role: "switch" });
  chkVoz.checked = !!cfg.voz;
  const probarVoz = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Probar", "aria-label": "Probar la voz",
    onclick: () => { mensaje.className = "hm-estado-msg"; mensaje.textContent = hmDecir("Es la hora de " + titulo) ? "" : "Este navegador no puede leer en voz alta."; } });

  cuerpo.replaceChildren(
    hmEl("p", { className: "hm-ayuda", text: titulo }),
    hmEl("div", { className: "hm-campo-grupo" }, hmEl("label", { for: "hm-cfg-tono", text: "Tono" }),
      hmEl("div", { className: "hm-fila-probar" }, selTono, probarTono)),
    hmEl("div", { className: "hm-fila-switch" }, chkVib, hmEl("label", { for: "hm-cfg-vib", text: "Vibración" }), probarVib),
    hmEl("div", { className: "hm-fila-switch" }, chkVoz, hmEl("label", { for: "hm-cfg-voz", text: "Decir en voz alta «Es la hora de…»" }), probarVoz));

  // Días de aviso (solo turnos/eventos)
  const casillas = [];
  if (d.usa_dias) {
    const grupo = hmEl("fieldset", { className: "hm-config-dias" }, hmEl("legend", { text: "¿Cuándo querés que te avisemos?" }));
    (d.dias_posibles || [2, 1, 0]).forEach((dia) => {
      const c = hmEl("input", { type: "checkbox", id: "hm-cfg-dia-" + dia, value: String(dia), className: "hm-switch" });
      c.checked = (cfg.dias || []).map(Number).includes(Number(dia));
      casillas.push(c);
      grupo.append(hmEl("div", { className: "hm-fila-switch" }, c, hmEl("label", { for: c.id, text: HM_ETIQUETA_DIAS[dia] || (dia + " días antes") })));
    });
    cuerpo.append(grupo);
  }

  btnGuardar.hidden = false;
  btnGuardar.onclick = async () => {
    const params = { accion: "config_guardar", id, tono: selTono.value, vibracion: chkVib.checked ? 1 : 0, voz: chkVoz.checked ? 1 : 0 };
    if (d.usa_dias) {
      const dias = casillas.filter((c) => c.checked).map((c) => Number(c.value)).sort((a, b) => b - a);
      if (dias.length === 0) {
        mensaje.className = "hm-estado-msg hm-error";
        mensaje.textContent = "Elegí al menos un momento para recibir el aviso.";
        return;
      }
      params.dias = dias.join(",");
    }
    btnGuardar.disabled = true;
    mensaje.className = "hm-estado-msg";
    mensaje.textContent = "Guardando…";
    const g = await hmApi("alarmas.php", params);
    btnGuardar.disabled = false;
    if (!g.ok) {
      mensaje.className = "hm-estado-msg hm-error";
      mensaje.textContent = g.mensaje || "No pudimos guardar la alarma.";
      return;
    }
    cerrar();
    if (typeof alGuardar === "function") alGuardar();
    hmAvisarCambio(); // el motor de alarmas vuelve a revisar con la configuración nueva
  };
}

function renderRecordatoriosModule(description) {
  const container = document.createElement("div");
  container.className = "recordatorios-wrapper";

  const titleElem = document.createElement("h2");
  titleElem.className = "panel-title";
  titleElem.textContent = "Fechas y recordatorios";
  container.appendChild(titleElem);

  const descElem = document.createElement("p");
  descElem.className = "panel-description";
  descElem.textContent = description;
  container.appendChild(descElem);

  // Estado de las notificaciones del navegador + ayuda para instalar la app (alarmas.js)
  if (typeof hmCrearPanelNotificaciones === "function") container.appendChild(hmCrearPanelNotificaciones());

  // Botón superior para crear recordatorio
  const actionToolbar = document.createElement("div");
  actionToolbar.style.marginTop = "15px";
  actionToolbar.innerHTML = `
    <button type="button" id="btnCrearRecordatorio" style="padding: 10px 20px; background-color: #5cb8bc; color: white; border: none; border-radius: 50px; font-weight: 700; cursor: pointer; transition: background-color 0.2s;">Crear recordatorio
    </button>
  `;
  container.appendChild(actionToolbar);

  // Línea de aviso (errores de carga / guardado)
  const avisoElem = document.createElement("p");
  avisoElem.style.cssText = "margin: 10px 0 0; font-size: 14px; font-weight: 600; display: none;";
  container.appendChild(avisoElem);
  function mostrarAviso(texto, esError = false) {
    avisoElem.textContent = texto;
    avisoElem.style.color = esError ? "#ef4444" : "#334155";
    avisoElem.style.display = texto ? "block" : "none";
  }

  // Sección "Tomas de hoy": las tomas de medicamentos que tocan hoy y si ya se marcaron.
  // Marcar una toma alimenta el porcentaje de cumplimiento del Dashboard.
  const avisoTomas = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });
  const listaTomas = hmEl("div", { style: "display:flex;flex-direction:column;gap:8px;margin-top:10px;" });
  const seccionTomas = hmEl("section", { id: "tomas-hoy", style: "margin-top:20px;background:#ffffff;border:2px solid #e2e8f0;border-radius:12px;padding:16px;" },
    hmEl("h3", { text: "Tomas de hoy", style: "margin:0;font-size:18px;color:#2c3e50;" }),
    hmEl("p", { className: "hm-ayuda", text: "Marcá cada toma cuando tomes el medicamento: así se calcula el cumplimiento en el Dashboard." }),
    avisoTomas, listaTomas);
  container.appendChild(seccionTomas);

  const ESTADOS_TOMA = {
    tomada: { clase: "status-good", texto: "Tomada" },
    proxima: { clase: "status-acceptable", texto: "Pendiente" },
    atrasada: { clase: "status-bad", texto: "Sin registrar" }
  };

  async function cargarTomas() {
    const r = await llamarRecordatorios({ accion: "tomas" });
    listaTomas.replaceChildren();
    if (!r.ok) {
      avisoTomas.className = "hm-estado-msg hm-error";
      avisoTomas.textContent = mensajeDeError(r, "No pudimos cargar las tomas de hoy.");
      return;
    }
    avisoTomas.className = "hm-estado-msg";
    avisoTomas.textContent = "";
    const soloLectura = r.datos.rol_usuario === "acompañante";   // el acompañante mira, no marca
    const tomas = r.datos.tomas || [];

    if (tomas.length === 0) {
      listaTomas.append(hmEl("p", { className: "hm-ayuda", text: soloLectura
        ? "El paciente no tiene tomas programadas para hoy."
        : "No tenés tomas programadas para hoy. Creá un recordatorio de tipo «Toma de medicamento» para empezar a registrar tu cumplimiento." }));
      return;
    }

    tomas.forEach((t) => {
      const e = ESTADOS_TOMA[t.estado] || ESTADOS_TOMA.proxima;
      const fila = hmEl("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid #e2e8f0;" },
        hmEl("strong", { text: t.hora, style: "min-width:52px;" }),
        hmEl("span", { style: "flex:1;min-width:140px;" },
          t.titulo,
          t.inventario ? hmEl("small", { text: "Se descuenta del inventario: " + t.inventario, style: "display:block;color:#64748b;font-size:12px;" }) : null),
        hmEl("span", { className: "param-status-badge " + e.clase, text: e.texto, style: "font-size:13px;" }));
      if (!t.cumplida && !soloLectura) {
        const btn = hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "Tomé" });
        btn.onclick = async () => {
          btn.disabled = true;
          const rr = await llamarRecordatorios({ accion: "tomar", id: t.id_recordatorio, programada: t.programada });
          if (!rr.ok) {
            btn.disabled = false;
            avisoTomas.className = "hm-estado-msg hm-error";
            avisoTomas.textContent = mensajeDeError(rr, "No pudimos registrar la toma.");
            return;
          }
          await cargarTomas();
          const inv = rr.datos && rr.datos.inventario;
          avisoTomas.className = "hm-estado-msg";
          avisoTomas.textContent = "¡Toma registrada y anotada en la bitácora!";
          if (inv) {
            avisoTomas.textContent += inv.sin_stock
              ? ` En el inventario no quedaban pastillas de ${inv.medicamento}: acordate de reponer el stock.`
              : ` Quedan ${inv.restantes} ${inv.restantes === 1 ? "pastilla" : "pastillas"} de ${inv.medicamento}.`;
          }
          hmAvisarCambio();   // el Dashboard recalcula el cumplimiento y las alarmas se actualizan
        };
        fila.append(btn);
      }
      listaTomas.append(fila);
    });
  }

  cargarTomas();
  // Los estados cambian con la hora (pendiente -> sin registrar): se refresca cada minuto mientras el módulo esté en pantalla
  const intervaloTomas = setInterval(() => {
    if (!container.isConnected) { clearInterval(intervaloTomas); return; }
    if (!document.hidden) cargarTomas();
  }, 60 * 1000);

  // Div contenedor del calendario
  const calendarEl = document.createElement("div");
  calendarEl.id = "calendar-container";
  calendarEl.style.marginTop = "20px";
  calendarEl.style.height = "500px";
  container.appendChild(calendarEl);

  // 1. Modal para CREAR recordatorio (con mensaje de error en rojo integrado)
  let modalCrear = document.getElementById("modalRecordatorio");
  if (!modalCrear) {
    modalCrear = document.createElement("div");
    modalCrear.className = "modal-overlay";
    modalCrear.id = "modalRecordatorio";
    modalCrear.innerHTML = `
      <div class="modal-content">
        <h3>Nuevo Recordatorio</h3>
        <div class="modal-field">
          <label for="modalTipo">¿Qué querés registrar?</label>
          <select id="modalTipo" style="padding: 10px 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 15px; outline: none; background: #fff;">
            <option value="evento">Evento o turno médico</option>
            <option value="horario">Toma de medicamento</option>
          </select>
        </div>
        <div class="modal-field">
          <label for="modalTitulo">Título</label>
          <input type="text" id="modalTitulo" placeholder="Ej. Consulta Médica">
          <span id="errorTitulo" style="color: #ef4444; font-size: 13px; font-weight: 600; display: none; margin-top: 2px;">Por favor, ingresá un título para el recordatorio.</span>
        </div>
        <div class="modal-field">
          <label for="modalFecha" id="labelFecha">Fecha</label>
          <input type="date" id="modalFecha">
        </div>
        <div class="modal-field">
          <label for="modalHora">Hora</label>
          <input type="time" id="modalHora" value="10:00">
        </div>
        <div class="modal-field" id="campoRepeticion" style="display: none;">
          <label for="modalRepeticion">¿Cada cuánto se toma?</label>
          <select id="modalRepeticion" style="padding: 10px 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 15px; outline: none; background: #fff;">
            <option value="diaria">Todos los días</option>
            <option value="semanal">Una vez por semana</option>
            <option value="ninguna">Una sola vez</option>
          </select>
        </div>
        <div class="modal-field" id="campoInventario" style="display: none;">
          <label for="modalInventario">Descontar del inventario</label>
          <select id="modalInventario" style="padding: 10px 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 15px; outline: none; background: #fff;">
            <option value="">No descontar de ningún medicamento</option>
          </select>
          <small id="ayudaInventario" style="color:#64748b;font-size:12px;"></small>
        </div>
        <div class="modal-field" id="campoFin" style="display: none;">
          <label for="modalFin">Hasta el día (opcional)</label>
          <input type="date" id="modalFin">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px;">
            <button type="button" class="modal-btn modal-btn-cancel" id="btnFin7" style="padding:4px 10px;font-size:12px;">7 días</button>
            <button type="button" class="modal-btn modal-btn-cancel" id="btnFin30" style="padding:4px 10px;font-size:12px;">30 días</button>
            <button type="button" class="modal-btn modal-btn-cancel" id="btnFinSin" style="padding:4px 10px;font-size:12px;">Sin fin</button>
          </div>
          <small style="color:#64748b;font-size:12px;">Si lo dejás vacío, la toma se repite sin final. El último día también cuenta.</small>
        </div>
        <p id="errorServidor" style="color: #ef4444; font-size: 13px; font-weight: 600; display: none; margin: 8px 0 0;"></p>
        <div class="modal-actions">
          <button type="button" class="modal-btn modal-btn-cancel" id="btnCerrarModal">Cancelar</button>
          <button type="button" class="modal-btn modal-btn-save" id="btnGuardarRecordatorio">Guardar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalCrear);
  }

  // 2. Modal para VER DETALLES de un evento guardado
  let modalDetalle = document.getElementById("modalDetalleRecordatorio");
  if (!modalDetalle) {
    modalDetalle = document.createElement("div");
    modalDetalle.className = "modal-overlay";
    modalDetalle.id = "modalDetalleRecordatorio";
    modalDetalle.innerHTML = `
      <div class="modal-content">
        <h3>Detalle del Evento</h3>
        <div class="modal-field">
          <label>Título:</label>
          <p id="detalleTitulo" style="margin: 0; font-size: 16px; color: #334155; font-weight: 600;"></p>
        </div>
        <div class="modal-field" style="margin-top: 10px;">
          <label>Fecha y Hora:</label>
          <p id="detalleFechaHora" style="margin: 0; font-size: 16px; color: #334155; font-weight: 600;"></p>
        </div>
        <div class="modal-actions" style="margin-top: 20px;">
          <button type="button" class="modal-btn modal-btn-cancel" id="btnCerrarDetalle">Cerrar</button>
          <button type="button" class="modal-btn modal-btn-save" id="btnConfigurarAlarma">Configurar alarma</button>
          <button type="button" class="modal-btn" id="btnEliminarRecordatorio" style="background-color: #ef4444; color: white;">Eliminar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalDetalle);
  }

  // Inicializar FullCalendar y la lógica de ambos modales
  setTimeout(() => {
    const calendarNode = document.getElementById("calendar-container");
    if (!calendarNode) return;

    const calendar = new FullCalendar.Calendar(calendarNode, {
      initialView: "dayGridMonth",
      locale: "es",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek"
      },
      events: async function(info, exito, fallo) {
        const r = await llamarRecordatorios({ accion: "listar" });
        if (!r.ok) {
          mostrarAviso(mensajeDeError(r, "No pudimos cargar tus recordatorios."), true);
          fallo(new Error("listar"));
          return;
        }
        mostrarAviso("");
        
        // NUEVO: Ocultar controles si es acompañante
        if (r.datos.rol_usuario === "acompañante") {
          // Ocultar botón principal "Crear recordatorio"
          const btnCrearMain = document.getElementById("btnCrearRecordatorio");
          if (btnCrearMain) btnCrearMain.style.display = "none";
          
          // Ocultar botones de acción en los modales
          const btnEliminar = document.getElementById("btnEliminarRecordatorio");
          const btnCfgAlarma = document.getElementById("btnConfigurarAlarma");
          if (btnEliminar) btnEliminar.style.display = "none";
          if (btnCfgAlarma) btnCfgAlarma.style.display = "none";
          
          // Desactivar el click en los días vacíos del calendario para que no abra el modal de creación
          calendar.setOption('dateClick', null);
        }

        exito(r.datos.recordatorios.filter((x) => x.activo).map(recordatorioAEvento));
      },
      dateClick: function(info) {
        abrirModalCreacion(info.dateStr);
      },
      eventClick: function(info) {
        abrirModalDetalle(info.event);
      }
    });

    calendar.render();

    // Referencias a elementos del DOM de los modales
    const btnCrear = document.getElementById("btnCrearRecordatorio");
    const btnCerrarModal = document.getElementById("btnCerrarModal");
    const btnGuardar = document.getElementById("btnGuardarRecordatorio");
    const inputTipo = document.getElementById("modalTipo");
    const campoRepeticion = document.getElementById("campoRepeticion");
    const inputRepeticion = document.getElementById("modalRepeticion");
    const campoFin = document.getElementById("campoFin");
    const inputFin = document.getElementById("modalFin");
    const campoInventario = document.getElementById("campoInventario");
    const selInventario = document.getElementById("modalInventario");
    const ayudaInventario = document.getElementById("ayudaInventario");
    const labelFecha = document.getElementById("labelFecha");
    const inputTitulo = document.getElementById("modalTitulo");
    const inputFecha = document.getElementById("modalFecha");
    const inputHora = document.getElementById("modalHora");
    const errorTitulo = document.getElementById("errorTitulo");
    const errorServidor = document.getElementById("errorServidor");
    const btnEliminar = document.getElementById("btnEliminarRecordatorio");
    let idParaEliminar = null;

    const btnCerrarDetalle = document.getElementById("btnCerrarDetalle");
    const txtDetalleTitulo = document.getElementById("detalleTitulo");
    const txtDetalleFechaHora = document.getElementById("detalleFechaHora");

    // Medicamentos del módulo Inventario: se ofrecen para descontar el stock cada vez que se marca «Tomé»
    async function cargarMedicamentosInventario() {
      const r = await hmApi("inventario.php", { accion: "listar" });
      const meds = r.ok && r.datos && Array.isArray(r.datos.medicamentos) ? r.datos.medicamentos : [];
      selInventario.replaceChildren(hmEl("option", { value: "", text: "No descontar de ningún medicamento" }));
      meds.forEach((m) => selInventario.append(hmEl("option", { value: String(m.id), text: m.nombre })));
      ayudaInventario.textContent = meds.length === 0
        ? "Todavía no cargaste medicamentos en el módulo «Inventario de medicamentos»."
        : "Cada vez que marques «Tomé», se descuenta una dosis de este medicamento.";
    }
    // Al elegir un medicamento, si todavía no se escribió título se usa su nombre
    if (selInventario) selInventario.onchange = () => {
      const op = selInventario.options[selInventario.selectedIndex];
      if (selInventario.value && inputTitulo.value.trim() === "") inputTitulo.value = op.textContent;
    };

    // «Hasta el día» solo tiene sentido en una toma que se repite
    function aplicarFin() {
      const seRepite = inputTipo.value === "horario" && inputRepeticion.value !== "ninguna";
      campoFin.style.display = seRepite ? "" : "none";
    }
    // Atajos: el día de inicio cuenta como el primer día (7 días = inicio + 6)
    function fijarFin(dias) {
      const [a, m, d] = (inputFecha.value || fechaLocalISO()).split("-").map(Number);
      inputFin.value = fechaLocalISO(new Date(a, m - 1, d + dias - 1));
    }
    document.getElementById("btnFin7").onclick = () => fijarFin(7);
    document.getElementById("btnFin30").onclick = () => fijarFin(30);
    document.getElementById("btnFinSin").onclick = () => { inputFin.value = ""; };
    inputRepeticion.onchange = aplicarFin;

    // Toma de medicamento: pide cada cuánto se repite y cambia los textos de ayuda
    function aplicarTipo() {
      const esToma = inputTipo.value === "horario";
      campoRepeticion.style.display = esToma ? "" : "none";
      campoInventario.style.display = esToma ? "" : "none";
      aplicarFin();
      labelFecha.textContent = esToma ? "Empieza el" : "Fecha";
      inputTitulo.placeholder = esToma ? "Ej. Enalapril 10 mg" : "Ej. Consulta Médica";
    }
    if (inputTipo) inputTipo.onchange = () => { aplicarTipo(); if (inputTipo.value === "horario") cargarMedicamentosInventario(); };

    function abrirModalCreacion(fechaSugerida = "") {
      inputTipo.value = "evento";
      inputRepeticion.value = "diaria";
      selInventario.value = "";
      inputFin.value = "";
      aplicarTipo();
      inputTitulo.value = "";
      inputFecha.value = fechaSugerida || fechaLocalISO();
      inputHora.value = "10:00";
      
      // Limpiamos errores previos al abrir
      errorTitulo.style.display = "none";
      errorServidor.style.display = "none";
      inputTitulo.style.borderColor = "#cbd5e1";

      modalCrear.classList.add("active");
      inputTitulo.focus();
    }

    function cerrarModalCreacion() {
      modalCrear.classList.remove("active");
    }

    function abrirModalDetalle(evento) {
      txtDetalleTitulo.textContent = evento.title;
      const fechaInicio = evento.start ? evento.start.toLocaleString("es-AR", { 
        dateStyle: "full", 
        timeStyle: "short" 
      }) : "Sin fecha especificada";

      txtDetalleFechaHora.textContent = fechaInicio;
      idParaEliminar = evento.extendedProps ? evento.extendedProps.idRecordatorio : null;
      btnEliminar.style.display = idParaEliminar ? "" : "none";
      const btnCfg = document.getElementById("btnConfigurarAlarma");
      if (btnCfg) btnCfg.style.display = idParaEliminar ? "" : "none";
      btnEliminar.disabled = false;
      modalDetalle.classList.add("active");
    }

    function cerrarModalDetalle() {
      modalDetalle.classList.remove("active");
    }

    // "Configurar alarma": usa el id del recordatorio (no el de la ocurrencia) y avisa en pantalla al guardar
    const btnConfigAlarma = document.getElementById("btnConfigurarAlarma");
    if (btnConfigAlarma) {
      btnConfigAlarma.onclick = () => {
        if (!idParaEliminar) return;
        const id = idParaEliminar;
        cerrarModalDetalle();
        abrirConfigAlarma(id, () => mostrarAviso("Alarma guardada."));
      };
    }

    if (btnCrear) btnCrear.onclick = () => abrirModalCreacion();
    if (btnCerrarModal) btnCerrarModal.onclick = cerrarModalCreacion;
    if (btnCerrarDetalle) btnCerrarDetalle.onclick = cerrarModalDetalle;

    // Guardar el recordatorio con validación visual en línea
    if (btnGuardar) {
      btnGuardar.onclick = async () => {
        const titulo = inputTitulo.value.trim();
        const fecha = inputFecha.value;
        const hora = inputHora.value;

        if (!titulo) {
          errorTitulo.style.display = "block";
          inputTitulo.style.borderColor = "#ef4444";
          inputTitulo.focus();
          return;
        } else {
          errorTitulo.style.display = "none";
          inputTitulo.style.borderColor = "#cbd5e1";
        }

        if (!fecha) {
          errorServidor.textContent = "Por favor, seleccioná una fecha.";
          errorServidor.style.display = "block";
          return;
        }

        const fechaHora = `${fecha} ${hora || "00:00"}:00`;
        if (inputTipo.value === "horario" && inputRepeticion.value !== "ninguna" && inputFin.value && inputFin.value < fecha) {
          errorServidor.textContent = "El día final no puede ser anterior al día de inicio.";
          errorServidor.style.display = "block";
          return;
        }

        btnGuardar.disabled = true;
        errorServidor.style.display = "none";
        const tipo = inputTipo.value === "horario" ? "horario" : "evento";
        const params = { accion: "guardar", tipo, titulo, fecha_hora: fechaHora };
        if (tipo === "horario") {
          params.repeticion = inputRepeticion.value;
          if (inputRepeticion.value !== "ninguna" && inputFin.value) params.fecha_fin = inputFin.value;
          if (selInventario.value) params.id_inventario = selInventario.value;
        }
        const r = await llamarRecordatorios(params);
        btnGuardar.disabled = false;

        if (!r.ok) {
          errorServidor.textContent = mensajeDeError(r, "No pudimos guardar el recordatorio.");
          errorServidor.style.display = "block";
          return;
        }
        cerrarModalCreacion();
        calendar.refetchEvents();
        await cargarTomas();
        if (tipo === "horario") {
          // El servidor puede mover el inicio a la próxima toma si la hora elegida ya pasó
          const inicio = r.datos && r.datos.inicio ? new Date(String(r.datos.inicio).replace(" ", "T")) : null;
          avisoTomas.className = "hm-estado-msg";
          avisoTomas.textContent = inicio && !isNaN(inicio)
            ? "Toma guardada. Primera toma: " + inicio.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
            : "Toma guardada.";
          hmAvisarCambio();
        }
      };
    }

    // Eliminar el recordatorio abierto en el detalle
    if (btnEliminar) {
      btnEliminar.onclick = async () => {
        if (!idParaEliminar) return;
        if (!await hmConfirmar({ titulo: "Eliminar recordatorio", mensaje: "¿Eliminar este recordatorio? Si se repite, se eliminan todas sus repeticiones.", textoConfirmar: "Eliminar", peligro: true })) return;
        btnEliminar.disabled = true;
        const r = await llamarRecordatorios({ accion: "eliminar", id: idParaEliminar });
        if (!r.ok) {
          btnEliminar.disabled = false;
          mostrarAviso(mensajeDeError(r, "No pudimos eliminar el recordatorio."), true);
          cerrarModalDetalle();
          return;
        }
        cerrarModalDetalle();
        calendar.refetchEvents();
        cargarTomas();
        hmAvisarCambio();
      };
    }

    // Ocultar el error en rojo automáticamente mientras el usuario escribe
    inputTitulo.oninput = () => {
      if (inputTitulo.value.trim() !== "") {
        errorTitulo.style.display = "none";
        inputTitulo.style.borderColor = "#cbd5e1";
      }
    };

  }, 0);

  return container;
}