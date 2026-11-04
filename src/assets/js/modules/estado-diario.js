/**
 * ESTADO DIARIO (api/estado_diario.php + api/notificaciones.php + api/preferencias.php)
 *
 * Reúne todo lo del "¿Cómo te sentís hoy?":
 *  - hmCrearCaritas / hmAbrirCaritas: las 4 caritas (en el dashboard y en el modal).
 *  - Banner de aviso para el afectado, con revisión periódica de notificaciones y deep link.
 *
 * Usa las constantes HM_CARITAS y HM_ETIQUETA_ANIMO de dashboard.js (se leen al usarlas,
 * así que el orden de los <script> no importa). Todo texto de la API entra con textContent.
 */

/* ---------- Rol del usuario ---------- */

/** "acompañante" / "acompanante" -> "acompanante" (la base guarda la ñ; la API puede devolver cualquiera). */
function hmNormalizarRol(rol) {
  return String(rol || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

let hmRolPromesa = null;

/** Rol normalizado ("afectado" | "acompanante" | null). Se pide una sola vez; si falla, se reintenta la próxima. */
function hmObtenerRol() {
  if (!hmRolPromesa) {
    hmRolPromesa = hmApi("preferencias.php", { accion: "ver" }).then((r) => {
      if (!r.ok) { hmRolPromesa = null; return null; }
      return hmNormalizarRol(r.datos.rol) || null;
    });
  }
  return hmRolPromesa;
}

/* ---------- Caritas ---------- */

/**
 * Construye la fila de 4 caritas.
 *  - grande: true -> botones grandes para el modal (clase .hm-carita); false -> el estilo compacto del dashboard.
 *  - alElegir(valor): se ejecuta al tocar una carita.
 * Devuelve { contenedor, bloquear(bool) }.
 */
function hmCrearCaritas({ grande = false, alElegir }) {
  const contenedor = hmEl("div", {
    className: grande ? "hm-caritas-fila" : "",
    style: grande ? null : "display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;",
    role: "group",
    "aria-label": "Elegí cómo te sentís hoy"
  });
  const botones = [1, 2, 3, 4].map((v) => hmEl("button", {
    type: "button",
    className: grande ? "hm-carita" : null,
    title: HM_ETIQUETA_ANIMO[v],
    "aria-label": HM_ETIQUETA_ANIMO[v],
    style: grande ? null : "font-size:30px;background:none;border:1px solid #cbd5e1;border-radius:12px;padding:6px 12px;cursor:pointer;",
    onclick: () => alElegir(v)
  }, hmEl("span", { "aria-hidden": "true", text: HM_CARITAS[v] }),
     grande ? hmEl("span", { className: "hm-carita-texto", text: HM_ETIQUETA_ANIMO[v] }) : null));
  contenedor.append(...botones);
  return { contenedor, botones, bloquear: (b) => botones.forEach((x) => { x.disabled = b; }) };
}

/** Guarda el estado de hoy. Devuelve la respuesta de hmApi. */
function hmGuardarEstadoAnimo(valor) {
  return hmApi("estado_diario.php", { accion: "guardar", valor });
}

let hmCaritasAbierto = false;

/**
 * Modal "¿Cómo te sentís hoy?". alGuardar(valor) se llama cuando el servidor confirmó el guardado.
 * Foco al abrir, cierre con Esc o tocando afuera, y el foco vuelve a donde estaba.
 */
function hmAbrirCaritas({ alGuardar } = {}) {
  if (hmCaritasAbierto) return;
  hmCaritasAbierto = true;
  const foco = document.activeElement;

  const mensaje = hmEl("p", { className: "hm-caritas-mensaje", role: "status", "aria-live": "polite" });
  const caritas = hmCrearCaritas({
    grande: true,
    alElegir: async (valor) => {
      caritas.bloquear(true);
      mensaje.className = "hm-caritas-mensaje";
      mensaje.textContent = "Guardando…";
      const r = await hmGuardarEstadoAnimo(valor);
      if (!r.ok) {
        mensaje.className = "hm-caritas-mensaje hm-error";
        mensaje.textContent = r.mensaje || "No pudimos guardar tu estado.";
        caritas.bloquear(false);
        return;
      }
      mensaje.className = "hm-caritas-mensaje hm-ok";
      mensaje.textContent = "¡Listo! Guardamos tu estado de hoy: " + HM_ETIQUETA_ANIMO[valor] + ".";
      if (typeof alGuardar === "function") alGuardar(valor);
      hmAvisarCambio();
      setTimeout(cerrar, 1200); // se deja ver la confirmación un instante
    }
  });

  const btnCerrar = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Ahora no", onclick: () => cerrar() });
  const caja = hmEl("div", { className: "modal-content hm-caritas-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "hm-caritas-titulo" },
    hmEl("h3", { id: "hm-caritas-titulo", text: "¿Cómo te sentís hoy?" }),
    hmEl("p", { className: "hm-ayuda", text: "Elegí una carita para contarnos." }),
    caritas.contenedor, mensaje,
    hmEl("div", { className: "modal-actions" }, btnCerrar));
  const overlay = hmEl("div", { className: "modal-overlay active" }, caja);

  function cerrar() {
    if (!overlay.isConnected) return;
    overlay.remove();
    document.removeEventListener("keydown", teclado, true);
    hmCaritasAbierto = false;
    if (foco && foco.isConnected && typeof foco.focus === "function") foco.focus();
  }

  // Esc cierra; Tab queda dentro del modal
  function teclado(e) {
    if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
    if (e.key !== "Tab") return;
    const foc = [...caja.querySelectorAll("button:not([disabled])")];
    if (!foc.length) return;
    const primero = foc[0], ultimo = foc[foc.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
  document.addEventListener("keydown", teclado, true);
  document.body.appendChild(overlay);
  caritas.botones[0].focus();
}

/* ---------- Banner del afectado + revisión periódica ---------- */

const HM_REVISION_MS = 60 * 1000;
const hmRevision = { intervalo: null, escuchando: false, revisando: false };

/** Dibuja u oculta el banner dentro de #hmBannerEstadoDiario. */
function hmMostrarBanner(visible) {
  const caja = document.getElementById("hmBannerEstadoDiario");
  if (!caja) return;
  if (!visible) { caja.replaceChildren(); caja.hidden = true; return; }
  if (!caja.hidden && caja.childElementCount) return; // ya está a la vista
  caja.hidden = false;
  caja.replaceChildren(
    hmEl("div", { className: "hm-banner-estado" },
      hmEl("span", { className: "hm-banner-texto", text: "¿Cómo te sentís hoy?" }),
      hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "Responder",
        onclick: () => hmAbrirCaritas({ alGuardar: () => hmMostrarBanner(false) }) })));
}

/** Pregunta por notificaciones "estado_diario" sin leer y muestra/oculta el banner. */
async function hmRevisarNotificacionesEstado() {
  if (hmRevision.revisando) return;
  hmRevision.revisando = true;
  try {
    if ((await hmObtenerRol()) !== "afectado") return;
    const r = await hmApi("notificaciones.php", { accion: "listar", limite: 30 });
    if (!r.ok) return; // si falla, se deja el banner como estaba y se reintenta en la próxima vuelta
    hmMostrarBanner(r.datos.notificaciones.some((n) => n.tipo === "estado_diario" && !n.leida));
  } finally {
    hmRevision.revisando = false;
  }
}

/** Arranca la revisión (una sola vez, aunque se llame de nuevo): cada 60 s y al volver a la pestaña. */
function hmIniciarAvisoEstadoDiario() {
  if (hmRevision.intervalo) clearInterval(hmRevision.intervalo);
  hmRevision.intervalo = setInterval(() => { if (!document.hidden) hmRevisarNotificacionesEstado(); }, HM_REVISION_MS);
  if (!hmRevision.escuchando) {
    hmRevision.escuchando = true;
    document.addEventListener("visibilitychange", () => { if (!document.hidden) hmRevisarNotificacionesEstado(); });
    document.addEventListener("hm:datos", hmRevisarNotificacionesEstado); // p. ej. respondió desde el dashboard
  }
  hmRevisarNotificacionesEstado();
}

/** user.php?estado_diario=1 (para el futuro push): abre las caritas si es afectado y todavía no respondió. */
async function hmAbrirCaritasPorEnlace() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("estado_diario") !== "1") return;
  try {
    if ((await hmObtenerRol()) !== "afectado") return;
    const r = await hmApi("estado_diario.php", { accion: "hoy" });
    if (r.ok && r.datos.respondio_hoy === false) {
      hmAbrirCaritas({ alGuardar: () => hmMostrarBanner(false) });
    }
  } finally {
    url.searchParams.delete("estado_diario");
    history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  hmIniciarAvisoEstadoDiario();
  hmAbrirCaritasPorEnlace();
});