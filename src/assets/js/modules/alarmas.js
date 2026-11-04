/**
 * ALARMAS Y AVISOS (etapa 1A) — api/alarmas.php + api/notificaciones.php
 *
 * - Motor: cada 30 s (y al volver a la pestaña o con "hm:datos") pide los avisos pendientes,
 *   los muestra en un banner con cola y dispara sonido, vibración, voz y notificación del navegador
 *   UNA sola vez por aviso en esta sesión de la página (Set de ids procesados).
 * - Sonidos generados con Web Audio (sin archivos): reproducirTono(nombre) / detenerTono().
 * - Panel "Notificaciones" (hmCrearPanelNotificaciones) y campanita de la cabecera.
 *
 * Todo texto que viene del servidor entra con textContent (hmEl), nunca con innerHTML.
 * La instalación como app (manifest + service worker) es la etapa 1B y NO está acá.
 */

/* ======================= Sonido (Web Audio) ======================= */

let hmAudioCtx = null;      // se crea con el primer clic/tecla de la página
let hmGestoHecho = false;   // ¿la persona ya tocó algo? (sin eso el navegador bloquea sonido, vibración y voz)
let hmMaestro = null;       // nodo de volumen del tono que suena ahora (para poder cortarlo)

/** Devuelve el AudioContext (lo crea si hace falta). Solo debe llamarse después de un gesto. */
function hmObtenerAudio() {
  if (!hmAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { hmAudioCtx = new Ctx(); } catch (_) { return null; }
  }
  if (hmAudioCtx.state === "suspended") { hmAudioCtx.resume().catch(() => {}); }
  return hmAudioCtx;
}

/** Una nota: onda `tipo` a `freq` Hz desde el segundo `inicio` durante `dur`, con ataque corto y caída exponencial. */
function hmNota(ctx, destino, freq, inicio, dur, tipo, volumen) {
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(volumen, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(destino);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Cada tono arma sus notas en el nodo `d`. */
const HM_TONOS = {
  // Campana: tono agudo con caída exponencial, 3 veces
  campana: (ctx, d) => { for (let i = 0; i < 3; i++) { hmNota(ctx, d, 1318, i * 1.2, 1.1, "sine", 0.35); hmNota(ctx, d, 2637, i * 1.2, 0.5, "sine", 0.08); } },
  // Suave: dos notas ascendentes
  suave: (ctx, d) => { hmNota(ctx, d, 523, 0, 0.7, "sine", 0.25); hmNota(ctx, d, 659, 0.4, 1.0, "sine", 0.25); },
  // Alerta: pulsos rápidos alternados, unos 4 segundos
  alerta: (ctx, d) => { for (let i = 0; i < 16; i++) hmNota(ctx, d, i % 2 ? 660 : 880, i * 0.25, 0.2, "square", 0.14); },
  // Digital: bips cortos de despertador
  digital: (ctx, d) => { for (let r = 0; r < 4; r++) for (let b = 0; b < 4; b++) hmNota(ctx, d, 1000, r * 1.0 + b * 0.12, 0.07, "square", 0.12); }
};

/** Reproduce un tono por nombre. "silencio" no suena. Devuelve true si empezó a sonar. Sirve también para "Probar". */
function reproducirTono(nombre) {
  detenerTono();
  if (nombre === "silencio") return false;
  const ctx = hmObtenerAudio();
  if (!ctx) return false;
  const maestro = ctx.createGain();
  maestro.connect(ctx.destination);
  hmMaestro = maestro;
  (HM_TONOS[nombre] || HM_TONOS.campana)(ctx, maestro);
  return true;
}

/** Corta el tono que esté sonando. */
function detenerTono() {
  if (hmMaestro) { try { hmMaestro.disconnect(); } catch (_) { /* ya estaba cortado */ } hmMaestro = null; }
}

/** Lee un texto en voz alta (español de Argentina). Devuelve false si el navegador no puede. */
function hmDecir(texto) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(texto || ""));
    u.lang = "es-AR";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    return true;
  } catch (_) { return false; }
}

/** Vibra con el patrón de las alarmas. Devuelve false si el dispositivo no vibra. */
function hmVibrar() {
  if (!navigator.vibrate) return false;
  try { return navigator.vibrate([300, 150, 300, 150, 600]); } catch (_) { return false; }
}

/* ======================= Motor de avisos ======================= */

const HM_PERIODO_MS = 30 * 1000;
const HM_POSPONER_MS = 5 * 60 * 1000;

const hmAlarmas = {
  iniciado: false,
  procesados: new Set(),     // ids que ya sonaron/vibraron/hablaron en esta sesión de la página
  leidos: new Set(),         // ids marcados como leídos acá: se ignoran si una consulta que ya iba en camino todavía los trae
  cola: [],                  // avisos sin leer, en orden de llegada
  pospuestos: new Map(),     // id -> aviso oculto hasta que venza el temporizador
  temporizadores: new Map(), // id -> setTimeout de "Posponer 5 min"
  efectosPendientes: [],     // avisos que llegaron antes del primer toque
  revisando: false,
  repetir: false,
  detenido: false,           // true si el servidor no deja usar alarmas (403) o se venció la sesión (401)
  error: "",
  banner: null,
  firma: ""
};

/** Primer clic/tecla/toque: se habilita el audio y suenan los avisos que estaban esperando. */
function hmDesbloquear() {
  if (hmGestoHecho) return;
  hmGestoHecho = true;
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.removeEventListener(ev, hmDesbloquear, true));
  hmObtenerAudio();
  const espera = hmAlarmas.efectosPendientes.splice(0);
  espera.forEach((a) => { if (hmAlarmas.cola.some((x) => x.id === a.id) && !hmAlarmas.pospuestos.has(a.id)) hmEfectos(a); });
  hmPintarBanner();
}

/** Sonido + vibración + voz + notificación del navegador de un aviso (solo si "suena"). */
function hmEfectos(a) {
  if (!a.suena) return;
  if (!hmGestoHecho) { // el navegador lo bloquearía: queda esperando el primer toque
    if (!hmAlarmas.efectosPendientes.some((x) => x.id === a.id)) hmAlarmas.efectosPendientes.push(a);
    return;
  }
  if (a.tono !== "silencio") reproducirTono(a.tono);
  if (a.vibracion) hmVibrar();
  if (a.voz) hmDecir(a.mensaje);
  hmNotificacionNavegador(a);
}

/** Notificación del navegador (si hay permiso). Al hacer clic, trae la ventana al frente. */
function hmNotificacionNavegador(a) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(a.titulo || "HealthMe", { body: a.mensaje, tag: "aviso-" + a.id });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (_) { /* algunos celulares exigen service worker: queda el banner */ }
}

/** Pide los avisos pendientes (el servidor además crea los que vencen) y actualiza banner y campanita. */
async function hmRevisarAlarmas() {
  if (hmAlarmas.revisando) { hmAlarmas.repetir = true; return; }
  hmAlarmas.revisando = true;
  try {
    if (!hmAlarmas.detenido) {
      const r = await hmApi("alarmas.php", { accion: "pendientes" });
      if (r.ok) {
        hmAlarmas.error = "";
        hmProcesarAvisos(r.datos.avisos || []);
      } else if (r.estado === 401 || r.estado === 403) {
        hmAlarmas.detenido = true; // admin o sesión vencida: no se insiste cada 30 s
      }
    }
    await hmActualizarCampanita();
  } finally {
    hmAlarmas.revisando = false;
    if (hmAlarmas.repetir) { hmAlarmas.repetir = false; hmRevisarAlarmas(); }
  }
}

/** Compara con lo que ya teníamos: avisos nuevos -> efectos una vez; los que ya no vienen (leídos en otro lado) -> se sacan. */
function hmProcesarAvisos(avisos) {
  const vigentes = new Set(avisos.map((a) => a.id));
  hmAlarmas.cola = hmAlarmas.cola.filter((a) => vigentes.has(a.id));
  hmAlarmas.pospuestos.forEach((_, id) => { if (!vigentes.has(id)) hmLiberarPosposicion(id); });

  avisos.forEach((a) => {
    if (hmAlarmas.leidos.has(a.id)) return;
    const i = hmAlarmas.cola.findIndex((x) => x.id === a.id);
    if (i >= 0) { hmAlarmas.cola[i] = a; return; }   // sigue sin leer: se actualiza, NO vuelve a sonar
    hmAlarmas.cola.push(a);
    if (!hmAlarmas.procesados.has(a.id)) {
      hmAlarmas.procesados.add(a.id);
      hmEfectos(a);
    }
  });
  hmPintarBanner();
}

function hmLiberarPosposicion(id) {
  clearTimeout(hmAlarmas.temporizadores.get(id));
  hmAlarmas.temporizadores.delete(id);
  hmAlarmas.pospuestos.delete(id);
}

/** "Posponer 5 min": se oculta, sigue pendiente en el servidor y vuelve a mostrarse (y a sonar) a los 5 minutos. */
function hmPosponer(a) {
  detenerTono();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  hmAlarmas.pospuestos.set(a.id, true);
  hmAlarmas.temporizadores.set(a.id, setTimeout(() => {
    hmLiberarPosposicion(a.id);
    const vigente = hmAlarmas.cola.find((x) => x.id === a.id);
    if (vigente) { hmEfectos(vigente); hmPintarBanner(); }
  }, HM_POSPONER_MS));
  hmPintarBanner();
}

/** "Listo, entendido": lo marca leído en el servidor. */
async function hmMarcarLeido(a, boton) {
  boton.disabled = true;
  const r = await hmApi("notificaciones.php", { accion: "marcar_leidas", id: a.id });
  if (!r.ok) {
    boton.disabled = false;
    hmAlarmas.error = r.mensaje || "No pudimos marcar el aviso como leído.";
    hmPintarBanner();
    return;
  }
  hmAlarmas.error = "";
  hmAlarmas.leidos.add(a.id);
  detenerTono();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  hmLiberarPosposicion(a.id);
  hmAlarmas.cola = hmAlarmas.cola.filter((x) => x.id !== a.id);
  hmPintarBanner();
  hmActualizarCampanita();
}

/** Dibuja el banner del primer aviso visible, con "(N más)". Solo toca el DOM si algo cambió. */
function hmPintarBanner() {
  const visibles = hmAlarmas.cola.filter((a) => !hmAlarmas.pospuestos.has(a.id));
  const a = visibles[0];
  const pedirToque = !!a && !hmGestoHecho && !!a.suena;
  const firma = a ? [a.id, a.titulo, a.mensaje, visibles.length, pedirToque, hmAlarmas.error].join("|") : "";
  if (firma === hmAlarmas.firma) return;
  hmAlarmas.firma = firma;

  if (!hmAlarmas.banner) {
    hmAlarmas.banner = hmEl("div", { id: "hmAlarmaBanner", className: "hm-alarma", role: "alert", "aria-live": "assertive" });
    document.body.appendChild(hmAlarmas.banner);
  }
  const caja = hmAlarmas.banner;
  if (!a) { caja.replaceChildren(); caja.hidden = true; return; }
  caja.hidden = false;

  const mas = visibles.length - 1;
  const btnListo = hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "Listo, entendido" });
  btnListo.addEventListener("click", () => hmMarcarLeido(a, btnListo));
  const btnPosponer = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Posponer 5 min", onclick: () => hmPosponer(a) });

  caja.replaceChildren(
    hmEl("div", { className: "hm-alarma-cabecera" },
      hmEl("strong", { className: "hm-alarma-titulo", text: a.titulo || "Aviso" }),
      mas > 0 ? hmEl("span", { className: "hm-alarma-mas", text: "(" + mas + " más)" }) : null),
    hmEl("p", { className: "hm-alarma-mensaje", text: a.mensaje }),
    a.fecha_programada ? hmEl("p", { className: "hm-alarma-hora", text: "Para: " + hmFecha(a.fecha_programada) }) : null,
    pedirToque ? hmEl("p", { className: "hm-alarma-toque", text: "Tocá la pantalla para activar el sonido." }) : null,
    hmAlarmas.error ? hmEl("p", { className: "hm-error-texto", text: hmAlarmas.error }) : null,
    hmEl("div", { className: "hm-alarma-botones" }, btnListo, btnPosponer));
}

/** Arranca todo (una sola vez aunque se llame de nuevo). */
function hmIniciarAlarmas() {
  if (hmAlarmas.iniciado) return;
  hmAlarmas.iniciado = true;
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, hmDesbloquear, true));
  setInterval(hmRevisarAlarmas, HM_PERIODO_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) hmRevisarAlarmas(); });
  document.addEventListener("hm:datos", hmRevisarAlarmas);
  hmCrearCampanita();
  hmRevisarAlarmas();
}
document.addEventListener("DOMContentLoaded", hmIniciarAlarmas);

/* ======================= Campanita de la cabecera ======================= */

const hmCampana = { raiz: null, boton: null, badge: null, panel: null, lista: null, btnTodos: null, abierto: false };

function hmCrearCampanita() {
  const raiz = document.getElementById("hmCampanita");
  if (!raiz || hmCampana.raiz) return;
  hmCampana.raiz = raiz;

  hmCampana.badge = hmEl("span", { className: "hm-campana-badge", "aria-hidden": "true", hidden: "hidden" });
  
  /* AQUÍ CAMBIAMOS EL EMOJI 🔔 POR EL ICONO DE FONT AWESOME */
  hmCampana.boton = hmEl("button", { type: "button", className: "hm-campana-btn", "aria-label": "Avisos", "aria-expanded": "false", "aria-controls": "hmCampanaPanel",
    onclick: () => hmAlternarCampana(!hmCampana.abierto) },
    hmEl("i", { className: "fa fa-bell", "aria-hidden": "true" }), hmCampana.badge);

  hmCampana.lista = hmEl("div", { className: "hm-campana-lista" });
  hmCampana.btnTodos = hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Marcar todos como leídos",
    onclick: async () => {
      hmCampana.btnTodos.disabled = true;
      await hmApi("notificaciones.php", { accion: "marcar_leidas" });
      hmRevisarAlarmas();
    } });
  hmCampana.panel = hmEl("div", { id: "hmCampanaPanel", className: "hm-campana-panel", hidden: "hidden" },
    hmEl("strong", { className: "hm-campana-titulo", text: "Tus avisos" }), hmCampana.lista, hmCampana.btnTodos);
  raiz.append(hmCampana.boton, hmCampana.panel);

  // Se cierra al tocar afuera o con Esc
  document.addEventListener("click", (e) => { if (hmCampana.abierto && !raiz.contains(e.target)) hmAlternarCampana(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && hmCampana.abierto) { hmAlternarCampana(false); hmCampana.boton.focus(); } });
}

function hmAlternarCampana(abrir) {
  hmCampana.abierto = abrir;
  hmCampana.panel.hidden = !abrir;
  hmCampana.boton.setAttribute("aria-expanded", abrir ? "true" : "false");
  if (abrir) hmActualizarCampanita();
}

/** Trae los últimos avisos y actualiza contador y lista. */
async function hmActualizarCampanita() {
  if (!hmCampana.raiz) return;
  const r = await hmApi("notificaciones.php", { accion: "listar", limite: 30 });
  if (!r.ok) return;
  const n = r.datos.no_leidas || 0;
  hmCampana.badge.hidden = n === 0;
  hmCampana.badge.textContent = n > 99 ? "99+" : String(n);
  hmCampana.boton.setAttribute("aria-label", n === 0 ? "Avisos: no tenés avisos sin leer" : "Avisos: " + n + (n === 1 ? " sin leer" : " sin leer"));
  hmCampana.btnTodos.disabled = n === 0;

  hmCampana.lista.replaceChildren();
  const ultimos = (r.datos.notificaciones || []).slice(0, 10);
  if (ultimos.length === 0) { hmCampana.lista.append(hmEl("p", { className: "hm-ayuda", text: "No tenés avisos." })); return; }
  ultimos.forEach((x) => {
    const fila = hmEl("div", { className: "hm-campana-item" + (x.leida ? "" : " sin-leer") },
      hmEl("span", { className: "hm-campana-fecha", text: hmFecha(x.fecha_envio) }),
      hmEl("span", { text: x.mensaje }));
    // Aviso diario del estado de ánimo sin responder (tarea 3): se contesta desde acá
    if (x.tipo === "estado_diario" && !x.leida && typeof hmAbrirCaritas === "function") {
      fila.append(hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "Responder",
        onclick: () => { hmAlternarCampana(false); hmAbrirCaritas({ alGuardar: hmActualizarCampanita }); } }));
    }
    hmCampana.lista.append(fila);
  });
}

/* ======================= Panel "Activar notificaciones" ======================= */

/** Panel con el estado del permiso, el botón para activarlo y la ayuda para instalar la app. Lo usa recordatorios.js. */
function hmCrearPanelNotificaciones() {
  const estado = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });
  const ayuda = hmEl("p", { className: "hm-ayuda" });
  const boton = hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "Activar notificaciones" });
  const panel = hmEl("div", { className: "hm-notif-panel" });

  function pintar() {
    ayuda.textContent = "";
    if (!("Notification" in window)) {
      boton.hidden = true;
      estado.textContent = "Este navegador no permite notificaciones del sistema.";
      ayuda.textContent = "No pasa nada: los avisos igual aparecen en pantalla, con sonido y vibración.";
      return;
    }
    const p = Notification.permission;
    boton.hidden = p !== "default";
    if (p === "granted") estado.textContent = "Notificaciones activadas.";
    else if (p === "denied") {
      estado.textContent = "Las notificaciones están bloqueadas.";
      ayuda.textContent = "Para volver a activarlas: tocá el candado (o el ícono de ajustes) que está junto a la dirección del sitio, entrá en “Notificaciones”, elegí “Permitir” y recargá la página. Mientras tanto, los avisos igual aparecen en pantalla.";
    } else {
      estado.textContent = "Activá las notificaciones para que te lleguen los avisos aunque estés en otra pestaña.";
    }
  }

  boton.addEventListener("click", async () => {
    boton.disabled = true;
    try { await Promise.resolve(Notification.requestPermission()); } catch (_) { /* queda como estaba */ }
    boton.disabled = false;
    pintar();
  });
  // Si cambian el permiso desde el candado del navegador, se refleja sin recargar
  try {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "notifications" }).then((s) => { s.onchange = pintar; }).catch(() => {});
    }
  } catch (_) { /* no todos los navegadores lo soportan */ }

  const guia = hmEl("details", { className: "hm-instalar" },
    hmEl("summary", { text: "Cómo instalar la app" }),
    hmEl("p", { className: "hm-ayuda", text: "Android (Chrome): tocá el menú ⋮ y elegí “Agregar a pantalla de inicio”." }),
    hmEl("p", { className: "hm-ayuda", text: "iPhone (Safari): tocá “Compartir” y elegí “Agregar a inicio”. Para que funcione hace falta que el sitio use HTTPS, algo que se verá cuando se publique." }));

  panel.append(estado, ayuda, boton, guia);
  pintar();
  return panel;
}
