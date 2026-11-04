/**
 * MI PERFIL (api/perfil.php)
 *
 * renderPerfilModule devuelve el panel con tres secciones:
 *   1. Mis datos          (nombre, apellido, DNI, obra social, correo)
 *   2. Mi rol             (afectado / acompañante, con las reglas que valida el backend)
 *   3. Cambiar contraseña
 * Todo texto dinámico entra con textContent (hmEl). Depende de hm-api.js.
 */
function renderPerfilModule(description) {
  const contenedor = hmEl("div", { className: "perfil-wrapper" },
    hmEl("h2", { className: "panel-title", text: "Mi perfil" }),
    hmEl("p", { className: "panel-description", text: description || "Modificá tus datos, tu rol y tu contraseña." }));
  const estado = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });
  const cuerpo = hmEl("div", { className: "perfil-secciones" });
  contenedor.append(estado, cuerpo);

  cargar();

  async function cargar() {
    estado.className = "hm-estado-msg";
    estado.textContent = "Cargando…";
    const r = await hmApi("perfil.php", { accion: "ver" });
    if (!r.ok) {
      estado.className = "hm-estado-msg hm-error";
      estado.textContent = r.mensaje || "No pudimos cargar tu perfil.";
      return;
    }
    estado.textContent = "";
    cuerpo.replaceChildren(
      perfilSeccion("Mis datos", perfilFormDatos(r.datos.perfil || {})),
      perfilSeccion("Mi rol", perfilFormRol(r.datos.perfil || {}, r.datos.cambio_rol || {})),
      perfilSeccion("Cambiar contraseña", perfilFormPassword())
    );
  }

  return contenedor;
}

/* ---------- Ayudas ---------- */

function perfilSeccion(titulo, contenido) {
  return hmEl("section", { className: "perfil-seccion" },
    hmEl("h3", { className: "hm-subtitulo", text: titulo }), contenido);
}

/** Campo con etiqueta: devuelve { grupo, input }. */
function perfilCampo(id, etiqueta, { tipo = "text", valor = "", atributos = {} } = {}) {
  const input = hmEl("input", { type: tipo, id: "hm-perfil-" + id, className: "hm-campo" });
  input.value = valor === null || valor === undefined ? "" : valor;
  Object.entries(atributos).forEach(([k, v]) => input.setAttribute(k, v));
  const grupo = hmEl("div", { className: "hm-campo-grupo" },
    hmEl("label", { for: input.id, text: etiqueta }), input);
  return { grupo, input };
}

function perfilMensaje() {
  const el = hmEl("p", { className: "hm-estado-msg", role: "status", "aria-live": "polite" });
  el.poner = (texto, tipo) => {
    el.className = "hm-estado-msg" + (tipo ? " hm-" + tipo : "");
    el.textContent = texto || "";
  };
  return el;
}

/* ---------- 1. Datos personales ---------- */

function perfilFormDatos(perfil) {
  let emailOriginal = String(perfil.email || "");

  const nombre   = perfilCampo("nombre", "Nombre", { valor: perfil.nombre, atributos: { maxlength: "100", autocomplete: "given-name", required: "required" } });
  const apellido = perfilCampo("apellido", "Apellido", { valor: perfil.apellido, atributos: { maxlength: "100", autocomplete: "family-name", required: "required" } });
  const dni      = perfilCampo("dni", "DNI (sin puntos)", { valor: perfil.dni, atributos: { maxlength: "8", inputmode: "numeric", required: "required" } });
  const obra     = perfilCampo("obra-social", "Obra social (opcional)", { valor: perfil.obra_social, atributos: { maxlength: "150" } });
  const email    = perfilCampo("email", "Correo electrónico", { tipo: "email", valor: perfil.email, atributos: { maxlength: "150", autocomplete: "email", required: "required" } });
  const pwEmail  = perfilCampo("email-password", "Tu contraseña actual (para confirmar el cambio de correo)", { tipo: "password", atributos: { autocomplete: "current-password" } });
  pwEmail.grupo.hidden = true;

  // El correo es con lo que se inicia sesión: si lo cambia, pedimos la contraseña
  email.input.addEventListener("input", () => {
    const cambio = email.input.value.trim().toLowerCase() !== emailOriginal.toLowerCase();
    pwEmail.grupo.hidden = !cambio;
    if (!cambio) pwEmail.input.value = "";
  });

  const tipoCuenta = perfil.nivel === "administrador" ? "Administrador" : "Usuario";
  const mensaje = perfilMensaje();
  const btn = hmEl("button", { type: "submit", className: "modal-btn modal-btn-save", text: "Guardar cambios" });

  const form = hmEl("form", { className: "perfil-form", novalidate: "novalidate" },
    hmEl("p", { className: "hm-ayuda", text: "Tipo de cuenta: " + tipoCuenta + ". Solo un administrador puede cambiarlo." }),
    nombre.grupo, apellido.grupo, dni.grupo, obra.grupo, email.grupo, pwEmail.grupo,
    hmEl("div", {}, btn), mensaje);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = nombre.input.value.trim(), a = apellido.input.value.trim();
    const d = dni.input.value.trim(), c = email.input.value.trim();
    if (!n || !a || !d || !c) return mensaje.poner("Nombre, apellido, DNI y correo son obligatorios.", "error");
    if (!/^\d{7,8}$/.test(d)) return mensaje.poner("El DNI debe tener 7 u 8 dígitos, sin puntos.", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return mensaje.poner("El correo electrónico no es válido.", "error");
    if (!pwEmail.grupo.hidden && !pwEmail.input.value) return mensaje.poner("Escribí tu contraseña actual para cambiar el correo.", "error");

    btn.disabled = true;
    mensaje.poner("Guardando…");
    const params = { accion: "guardar", nombre: n, apellido: a, dni: d, obra_social: obra.input.value.trim(), email: c };
    if (!pwEmail.grupo.hidden) params.password_actual = pwEmail.input.value;
    const r = await hmApi("perfil.php", params);
    btn.disabled = false;

    if (!r.ok) return mensaje.poner(r.mensaje || "No pudimos guardar los cambios.", "error");

    const p = r.datos.perfil || {};
    emailOriginal = String(p.email || c);
    pwEmail.input.value = "";
    pwEmail.grupo.hidden = true;
    // Actualiza el "Hola, ..." de la barra de arriba
    const saludo = document.getElementById("nombreUsuario");
    if (saludo) saludo.textContent = (p.nombre || n) + " " + (p.apellido || a);
    mensaje.poner("Listo, guardamos tus datos.", "ok");
  });

  return form;
}

/* ---------- 2. Rol ---------- */

function perfilFormRol(perfil, cambioRol) {
  if (perfil.nivel === "administrador") {
    return hmEl("p", { className: "hm-ayuda", text: "Tu cuenta es de administrador: no tiene rol de afectado o acompañante." });
  }

  const rolActual = hmNormalizarRol(perfil.rol);
  const permitido = cambioRol.permitido !== false;
  const opciones = [
    { valor: "afectado", titulo: "Soy la persona afectada",
      detalle: "Cargás tus propios datos de salud (mediciones, medicamentos, recordatorios) y elegís quién puede verlos." },
    { valor: "acompanante", titulo: "Soy acompañante",
      detalle: "Acompañás a una o más personas afectadas y ves sus datos cuando ellas te dan permiso." }
  ];

  const radios = opciones.map((o) => {
    const input = hmEl("input", { type: "radio", name: "hm-perfil-rol", id: "hm-perfil-rol-" + o.valor, value: o.valor });
    input.checked = rolActual === o.valor;
    input.disabled = !permitido;
    const etiqueta = hmEl("label", { for: input.id, className: "perfil-rol-opcion" + (permitido ? "" : " perfil-rol-deshabilitado") },
      input,
      hmEl("span", {}, hmEl("strong", { text: o.titulo }), hmEl("span", { className: "perfil-rol-detalle", text: o.detalle })));
    return { input, etiqueta };
  });

  const mensaje = perfilMensaje();
  const btn = hmEl("button", { type: "submit", className: "modal-btn modal-btn-save", text: "Guardar rol" });
  btn.disabled = !permitido;

  const form = hmEl("form", { className: "perfil-form", novalidate: "novalidate" },
    hmEl("p", { className: "hm-ayuda", text: rolActual ? "Tu rol actual: " + (rolActual === "afectado" ? "persona afectada." : "acompañante.") : "Todavía no elegiste tu rol." }),
    permitido ? null : hmEl("p", { className: "hm-estado-msg hm-error", text: cambioRol.motivo || "Por ahora no podés cambiar de rol." }),
    hmEl("div", { className: "perfil-rol-lista", role: "radiogroup", "aria-label": "Rol en la aplicación" }, radios.map((r) => r.etiqueta)),
    hmEl("div", {}, btn), mensaje);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const elegido = radios.find((r) => r.input.checked);
    if (!elegido) return mensaje.poner("Elegí un rol.", "error");
    if (elegido.input.value === rolActual) return mensaje.poner("Ya tenés ese rol.", "error");
    if (!await hmConfirmar({ titulo: "Cambiar de rol", mensaje: "Al cambiar de rol cambian las pantallas y permisos de tu cuenta. ¿Querés continuar?", textoConfirmar: "Cambiar rol" })) return;

    btn.disabled = true;
    mensaje.poner("Guardando…");
    const r = await hmApi("perfil.php", { accion: "cambiar_rol", rol: elegido.input.value });
    if (!r.ok) {
      btn.disabled = false;
      return mensaje.poner(r.mensaje || "No pudimos cambiar tu rol.", "error");
    }
    mensaje.poner("Listo, cambiamos tu rol. Recargando la pantalla…", "ok");
    // El resto de los módulos arman su contenido según el rol: recargamos para que se actualicen
    setTimeout(() => window.location.reload(), 1200);
  });

  return form;
}

/* ---------- 3. Contraseña ---------- */

function perfilFormPassword() {
  const actual    = perfilCampo("pw-actual", "Contraseña actual", { tipo: "password", atributos: { autocomplete: "current-password", required: "required" } });
  const nueva     = perfilCampo("pw-nueva", "Contraseña nueva", { tipo: "password", atributos: { autocomplete: "new-password", required: "required", "aria-describedby": "hm-perfil-pw-ayuda" } });
  const confirmar = perfilCampo("pw-confirmar", "Repetí la contraseña nueva", { tipo: "password", atributos: { autocomplete: "new-password", required: "required" } });
  const campos = [actual.input, nueva.input, confirmar.input];

  const mostrar = hmEl("input", { type: "checkbox", id: "hm-perfil-pw-mostrar", className: "hm-switch" });
  mostrar.addEventListener("change", () => campos.forEach((c) => { c.type = mostrar.checked ? "text" : "password"; }));

  const mensaje = perfilMensaje();
  const btn = hmEl("button", { type: "submit", className: "modal-btn modal-btn-save", text: "Cambiar contraseña" });

  const form = hmEl("form", { className: "perfil-form", novalidate: "novalidate" },
    actual.grupo, nueva.grupo,
    hmEl("p", { id: "hm-perfil-pw-ayuda", className: "hm-ayuda", text: "Mínimo 8 caracteres, con letras y números." }),
    confirmar.grupo,
    hmEl("div", { className: "hm-fila-switch" }, mostrar, hmEl("label", { for: "hm-perfil-pw-mostrar", text: "Mostrar contraseñas" })),
    hmEl("div", {}, btn), mensaje);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = actual.input.value, n = nueva.input.value, c = confirmar.input.value;
    if (!a || !n || !c) return mensaje.poner("Completá los tres campos.", "error");
    if (n.length < 8) return mensaje.poner("La contraseña nueva debe tener al menos 8 caracteres.", "error");
    if (!/[A-Za-z]/.test(n) || !/\d/.test(n)) return mensaje.poner("La contraseña nueva debe incluir letras y números.", "error");
    if (n !== c) return mensaje.poner("Las contraseñas nuevas no coinciden.", "error");
    if (n === a) return mensaje.poner("La contraseña nueva tiene que ser distinta de la actual.", "error");

    btn.disabled = true;
    mensaje.poner("Guardando…");
    const r = await hmApi("perfil.php", {
      accion: "cambiar_password", password_actual: a, password_nueva: n, password_confirmar: c
    });
    btn.disabled = false;

    if (!r.ok) return mensaje.poner(r.mensaje || "No pudimos cambiar la contraseña.", "error");
    campos.forEach((x) => { x.value = ""; });
    mostrar.checked = false;
    campos.forEach((x) => { x.type = "password"; });
    mensaje.poner("Listo, cambiaste tu contraseña.", "ok");
  });

  return form;
}