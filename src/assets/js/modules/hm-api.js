/**
 * Utilidades compartidas por los módulos del panel de usuario (se carga antes que los módulos).
 * - hmApi(archivo, params): POST a api/<archivo> (ruta relativa: user.php vive junto a api/).
 * - hmModal({...}): ventana de formulario con los estilos .modal-* de user.css.
 * - hmEl / hmFecha / hmNumero: ayudas para armar la pantalla.
 * Los módulos avisan entre sí con el evento "hm:datos" (p. ej. el dashboard se recalcula al cargar una medición).
 */
async function hmApi(archivo, params = {}) {
  const base = { ok: false, estado: 0, datos: null, mensaje: "No pudimos conectar con el servidor." };
  try {
    const resp = await fetch("api/" + archivo, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: new URLSearchParams(params)
    });
    let datos = null;
    try { datos = await resp.json(); } catch (_) { /* sin JSON */ }
    const ok = resp.ok && !!datos && datos.ok === true;
    let mensaje = datos && datos.mensaje ? datos.mensaje : (ok ? "" : "No pudimos completar la operación.");
    if (resp.status === 401) mensaje = "Tu sesión venció. Volvé a iniciar sesión.";
    return { ok, estado: resp.status, datos, mensaje };
  } catch (_) {
    return base;
  }
}

/** Crea un elemento: hmEl("p", { className: "x", text: "hola", onclick: fn, style: "..." }, hijo1, hijo2) */
function hmEl(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "text") el.textContent = v;
    else if (k === "className") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  hijos.flat().forEach((h) => { if (h !== null && h !== undefined) el.append(h); });
  return el;
}

/** "5,5" / "120" — hasta 2 decimales, coma decimal. */
function hmNumero(v) {
  if (v === null || v === undefined || v === "") return "–";
  return Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

/** "2026-11-05 09:30:00" -> "05/11/2026 09:30" (sin pasar por Date: no hay corrimiento de zona horaria). */
function hmFecha(texto, conHora = true) {
  const m = String(texto || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}` + (conHora && m[4] ? ` ${m[4]}:${m[5]}` : "");
}

function hmAvisarCambio() {
  document.dispatchEvent(new CustomEvent("hm:datos"));
}

/**
 * Ventana con formulario.
 * campos: [{ id, label, tipo: "text"|"number"|"textarea"|"select", valor, opciones: [..], atributos: {..} }]
 * onGuardar(valores) -> Promise<{ ok, mensaje }>; si ok se cierra, si no se muestra el mensaje en la ventana.
 */
function hmModal({ titulo, campos = [], textoGuardar = "Guardar", onGuardar, nota = "" }) {
  const error = hmEl("p", { style: "color:#ef4444;font-size:13px;font-weight:600;margin:8px 0 0;display:none;" });
  const entradas = {};
  const filas = campos.map((c) => {
    let input;
    if (c.tipo === "textarea") {
      input = hmEl("textarea", { rows: "4", style: "width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;box-sizing:border-box;" });
      input.value = c.valor || "";
    } else if (c.tipo === "select") {
      input = hmEl("select", { style: "width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;box-sizing:border-box;" },
        (c.opciones || []).map((o) => hmEl("option", { value: o, text: o })));
      if (c.valor) input.value = c.valor;
    } else {
      input = hmEl("input", { type: c.tipo || "text" });
      input.value = c.valor === undefined || c.valor === null ? "" : c.valor;
    }
    Object.entries(c.atributos || {}).forEach(([k, v]) => input.setAttribute(k, v));
    input.id = "hm-campo-" + c.id;
    entradas[c.id] = input;
    return hmEl("div", { className: "modal-field" }, hmEl("label", { for: input.id, text: c.label }), input);
  });

  const overlay = hmEl("div", { className: "modal-overlay active" });
  const cerrar = () => overlay.remove();
  const btnGuardar = hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: textoGuardar });
  const btnCancelar = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Cancelar", onclick: cerrar });

  btnGuardar.addEventListener("click", async () => {
    const valores = {};
    Object.entries(entradas).forEach(([id, el]) => { valores[id] = el.value; });
    btnGuardar.disabled = true;
    error.style.display = "none";
    const r = await onGuardar(valores);
    btnGuardar.disabled = false;
    if (r && r.ok) { cerrar(); return; }
    error.textContent = (r && r.mensaje) || "No pudimos guardar.";
    error.style.display = "block";
  });

  overlay.append(hmEl("div", { className: "modal-content" },
    hmEl("h3", { text: titulo }),
    nota ? hmEl("p", { text: nota, style: "margin:0 0 10px;font-size:13px;color:#64748b;" }) : null,
    filas, error,
    hmEl("div", { className: "modal-actions" }, btnCancelar, btnGuardar)));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
  document.body.appendChild(overlay);
  const primero = overlay.querySelector("input, textarea, select");
  if (primero) primero.focus();
  return cerrar;
}

/** Línea de aviso (error o confirmación) para insertar en un panel. */
function hmAviso() {
  const el = hmEl("p", { style: "margin:10px 0;font-size:14px;font-weight:600;display:none;" });
  el.mostrar = (texto, esError = true) => {
    el.textContent = texto || "";
    el.style.color = esError ? "#ef4444" : "#16a34a";
    el.style.display = texto ? "block" : "none";
  };
  return el;
}

function hmConfirmar({ titulo = "Confirmar", mensaje = "", textoConfirmar = "Aceptar", textoCancelar = "Cancelar", peligro = false } = {}) {
  return new Promise((resolver) => {
    const previo = document.activeElement;

    const cerrar = (resultado) => {
      document.removeEventListener("keydown", alTeclear, true);
      overlay.remove();
      if (previo && typeof previo.focus === "function") previo.focus();
      resolver(resultado);
    };

    const estiloBtn = "min-height:44px;font-size:16px;padding:10px 24px;";
    const btnCancelar = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", style: estiloBtn, text: textoCancelar, onclick: () => cerrar(false) });
    const btnConfirmar = hmEl("button", {
      type: "button",
      className: "modal-btn modal-btn-save",
      style: estiloBtn + (peligro ? "background:#ef4444;color:#fff;" : ""),
      text: textoConfirmar,
      onclick: () => cerrar(true)
    });

    function alTeclear(e) {
      if (e.key === "Escape") { e.preventDefault(); cerrar(false); return; }
      if (e.key === "Tab") { // el foco queda dentro del modal
        const botones = [btnCancelar, btnConfirmar];
        const i = botones.indexOf(document.activeElement);
        e.preventDefault();
        botones[(i + (e.shiftKey ? -1 : 1) + 2) % 2].focus();
      }
    }

    const overlay = hmEl("div", { className: "modal-overlay active" },
      hmEl("div", { className: "modal-content", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "hm-confirmar-titulo", "aria-describedby": "hm-confirmar-msg" },
        hmEl("h3", { id: "hm-confirmar-titulo", text: titulo }),
        hmEl("p", { id: "hm-confirmar-msg", text: mensaje, style: "margin:0;font-size:16px;line-height:1.5;color:#475569;" }),
        hmEl("div", { className: "modal-actions" }, btnCancelar, btnConfirmar)));

    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(false); });
    document.addEventListener("keydown", alTeclear, true);
    document.body.appendChild(overlay);
    (peligro ? btnCancelar : btnConfirmar).focus(); // en acciones destructivas el foco empieza en "Cancelar"
  });
}