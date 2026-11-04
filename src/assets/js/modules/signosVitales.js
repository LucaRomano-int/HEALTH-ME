/* DATOS Y RANGOS DE CALIFICACIÓN DE PARÁMETROS MÉDICOS */
const medicalParametersData = [
  {
    id: "presion",
    tipoNombre: "Presión arterial",
    title: "Presion Arterial",
    unit: "mmHg",
    infoText: "Mide la fuerza de la sangre contra las paredes de las arterias.",
    howToMeasure: "Se mide mediante un tensiómetro digital o manual.\n\nNormal - 120.\nAceptado - 140.\n Hipertension - Mayor a 140.",
    /* LÓGICA DE CALIFICACIÓN DE PRESIÓN ARTERIAL: <120 Bueno, 120-139 Aceptable, >=140 Malo */
    evaluateStatus: function (val) {
      if (val < 120) {
        return { text: "Bueno", cssClass: "status-good" };
      }
      if (val >= 120 && val <= 139) {
        return { text: "Aceptable", cssClass: "status-acceptable" };
      }
      return { text: "Malo", cssClass: "status-bad" };
    }
  },
  {
    id: "frecuencia",
    tipoNombre: "Frecuencia cardíaca",
    title: "Frecuencia cardiaca",
    unit: "LPM",
    infoText: "Cantidad de latidos del corazón por minuto.",
    howToMeasure: "Se toma colocando los dedos en la muñeca o mediante oxímetro/reloj.\n\nNormal - 60 a 80\nAceptable - 81 a 100\n Grave - mayor a 100",
    /* LÓGICA DE CALIFICACIÓN DE FRECUENCIA CARDÍACA: 60-80 Bueno, 81-100 Aceptable, <60 o >100 Malo */
    evaluateStatus: function (val) {
      if (val >= 60 && val <= 80) {
        return { text: "Bueno", cssClass: "status-good" };
      }
      if (val >= 81 && val <= 100) {
        return { text: "Aceptable", cssClass: "status-acceptable" };
      }
      return { text: "Malo", cssClass: "status-bad" };
    }
  },
  {
    id: "glucosa",
    tipoNombre: "Glucosa",
    title: "Glucosa en sangre",
    unit: "mg/dL",
    infoText: "Concentración de azúcar presente en el torrente sanguíneo.",
    howToMeasure: "Se mide en ayunas con un glucómetro de punción digital.\n\nGENTE SIN DIABETES:\nNormal (En ayunas) - menos de 100 \nNormal - (Despues del almuerzo) - menos de 140 \n\nGENTE CON DIABETES:\nNormal (En ayunas) - entre 80 y 130 \nNormal - (Despues del almuerzo) - menos de 180 \n\nEN AMBOS CASOS:\n Hipoglusemia - menos de 70",
    /* LÓGICA DE CALIFICACIÓN DE GLUCOSA: 70-99 Bueno, 100-125 Aceptable, <70 o >125 Malo */
    evaluateStatus: function (val) {
      if (val >= 80 && val <= 140) {
        return { text: "Bueno", cssClass: "status-good" };
      }
      return { text: val < 80 ? "Bajo" : "Alto", cssClass: "status-bad" };
    }
  },
  {
    id: "saturacion",
    tipoNombre: "Saturación de oxígeno",
    title: "Saturacion de oxigeno",
    unit: "%",
    infoText: "Porcentaje de oxígeno que transporta la hemoglobina en sangre.",
    howToMeasure: "Se mide con un oxímetro de pulso colocado en el dedo.\n\nOptimo - 100\nCuidado y Consultar - 90\n Medico Urgente - Menor a 80",
    /* LÓGICA DE CALIFICACIÓN DE SATURACIÓN: >=100 Bueno, 81-99 Aceptable, <90 Malo */
    evaluateStatus: function (val) {
      if (val >= 100) {
        return { text: "Bueno", cssClass: "status-good" };
      }
      if (val >= 81 && val <= 99) {
        return { text: "Aceptable", cssClass: "status-acceptable" };
      }
      return { text: "Malo", cssClass: "status-bad" };
    }
  }
];

/* CONSTRUCCIÓN DINÁMICA DE LA VISTA DE SIGNOS VITALES USANDO LA API DE DOM */
function renderSignosVitalesModule(description) {
  const container = document.createElement("div");
  container.className = "signos-vitales-wrapper";

  const titleElem = document.createElement("h2");
  titleElem.className = "panel-title";
  titleElem.textContent = "Parametros de salud y signos vitales";
  container.appendChild(titleElem);

  const descElem = document.createElement("p");
  descElem.className = "panel-description";
  descElem.textContent = description;
  container.appendChild(descElem);

  const avisoElem = hmAviso();
  container.appendChild(avisoElem);

  const gridElem = document.createElement("div");
  gridElem.className = "medical-params-grid";

  medicalParametersData.forEach(function (item) {
    const card = document.createElement("div");
    card.className = "param-card";

    const header = document.createElement("div");
    header.className = "param-card-header";

    const paramTitle = document.createElement("span");
    paramTitle.className = "param-title";
    paramTitle.textContent = item.title;
    header.appendChild(paramTitle);

    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "btn-param-help";
    helpBtn.textContent = "?";
    header.appendChild(helpBtn);

    const popover = document.createElement("div");
    popover.className = "param-info-popover";
    popover.id = "popover-" + item.id;

    const h4What = document.createElement("h4");
    h4What.textContent = "¿Qué es?";
    popover.appendChild(h4What);

    const pWhat = document.createElement("p");
    pWhat.textContent = item.infoText;
    popover.appendChild(pWhat);

    const h4How = document.createElement("h4");
    h4How.textContent = "¿Cómo se mide?";
    popover.appendChild(h4How);

    const pHow = document.createElement("p");
    pHow.style.whiteSpace = "pre-line";
    pHow.textContent = item.howToMeasure;
    popover.appendChild(pHow);

    header.appendChild(popover);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "param-card-body";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-param-edit";
    editBtn.title = "Cargar una medición";
    editBtn.textContent = "✏️";
    body.appendChild(editBtn);

    const valueDiv = document.createElement("div");
    valueDiv.className = "param-value-text";
    body.appendChild(valueDiv);

    const badge = document.createElement("div");
    body.appendChild(badge);

    const fechaDiv = document.createElement("div");
    fechaDiv.style.cssText = "font-size:12px;color:#64748b;margin-top:6px;";
    body.appendChild(fechaDiv);

    item.ui = { valueDiv, badge, fechaDiv, editBtn };
    editBtn.addEventListener("click", function () { abrirCargaMedicion(item, avisoElem); });

    card.appendChild(body);
    gridElem.appendChild(card);

    helpBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".param-info-popover").forEach(function (pop) {
        if (pop.id != popover.id) {
          pop.classList.remove("active");
        }
      });
      popover.classList.toggle("active");
    });
  });

  container.appendChild(gridElem);

  historialElem = hmEl("div", { style: "margin-top:24px;" });
  container.appendChild(historialElem);

  cargarSignosVitales(avisoElem);
  document.addEventListener("hm:datos", function () { if (container.isConnected) cargarSignosVitales(avisoElem); });

  return container;
}

/* ---- Conexión con api/mediciones.php ---- */
let tiposDeMedicion = null;   // nombre -> fila de tipo_medicion
let historialElem = null;     // contenedor del historial de mediciones
let filtroHistorialActual = ""; // NUEVO: guarda el filtro seleccionado en el desplegable

function pintarTarjeta(item, medicion) {
  const ui = item.ui;
  ui.valueDiv.textContent = "";
  if (!medicion) {
    ui.valueDiv.textContent = "Sin datos";
    ui.badge.className = "param-status-badge";
    ui.badge.textContent = "Todavía no cargaste una medición";
    ui.fechaDiv.textContent = "";
    return;
  }
  const principal = Number(medicion.valor);
  ui.valueDiv.textContent = hmNumero(medicion.valor) + (medicion.valor2 !== null ? "/" + hmNumero(medicion.valor2) : "") + " ";
  const unidad = document.createElement("small");
  unidad.style.fontSize = "16px";
  unidad.textContent = item.unit;
  ui.valueDiv.appendChild(unidad);
  const estado = item.evaluateStatus(principal);
  ui.badge.className = "param-status-badge " + estado.cssClass;
  ui.badge.textContent = estado.text;
  ui.fechaDiv.textContent = "Última medición: " + hmFecha(medicion.fecha_hora);
}

async function cargarSignosVitales(avisoElem) {
  let rolUsuario = null;

  if (!tiposDeMedicion) {
    const r = await hmApi("mediciones.php", { accion: "tipos" });
    if (!r.ok) { avisoElem.mostrar(r.mensaje || "No pudimos cargar tus mediciones."); return; }

    rolUsuario = r.datos.rol_usuario; // Guardamos el rol
    tiposDeMedicion = {};
    r.datos.tipos.forEach(function (t) { tiposDeMedicion[t.nombre] = t; });
  }

  avisoElem.mostrar("");

  for (const item of medicalParametersData) {
    const tipo = tiposDeMedicion[item.tipoNombre];
    if (!tipo) { pintarTarjeta(item, null); continue; }
    item.idTipo = Number(tipo.id);
    const r = await hmApi("mediciones.php", { accion: "listar", id_tipo: tipo.id, limite: 1 });

    // Si no habíamos obtenido el rol, lo intentamos tomar de aquí
    if (!rolUsuario && r.ok && r.datos.rol_usuario) {
        rolUsuario = r.datos.rol_usuario;
    }

    if (!r.ok) { avisoElem.mostrar(r.mensaje); pintarTarjeta(item, null); continue; }
    pintarTarjeta(item, r.datos.mediciones[0] || null);

    // NUEVO: Ocultar el botón de edición (lápiz) si es acompañante
    if (rolUsuario === "acompañante" && item.ui && item.ui.editBtn) {
        item.ui.editBtn.style.display = "none";
    }
  }
  cargarHistorial(avisoElem);
}

async function cargarHistorial(avisoElem) {
  if (!historialElem) return;

  // 1. Preparamos los parámetros para la API (incluyendo el filtro si existe)
  const paramsApi = { accion: "listar", limite: 15 };
  if (filtroHistorialActual !== "") {
    paramsApi.id_tipo = filtroHistorialActual;
  }

  const r = await hmApi("mediciones.php", paramsApi);

  // 2. Construimos el encabezado con el título y el <select>
  const header = hmEl("div", { style: "display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin:0 0 12px;" });
  header.append(hmEl("h3", { text: "Últimas mediciones", style: "margin:0;" }));

  const selectFiltro = hmEl("select", {
    style: "padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-size:14px; cursor:pointer;",
    onchange: (e) => {
      filtroHistorialActual = e.target.value;
      cargarHistorial(avisoElem);
    }
  });
  selectFiltro.append(hmEl("option", { value: "", text: "Todas las mediciones" }));

  if (tiposDeMedicion) {
    Object.values(tiposDeMedicion).forEach(t => {
      const opt = hmEl("option", { value: t.id, text: t.nombre });
      if (String(t.id) === String(filtroHistorialActual)) opt.selected = true;
      selectFiltro.append(opt);
    });
  }
  
  header.append(selectFiltro);
  historialElem.replaceChildren(header);

  if (!r.ok) { avisoElem.mostrar(r.mensaje); return; }

  // 3. Renderizamos la lista o el mensaje vacío
  if (r.datos.mediciones.length === 0) {
    const mensajeVacio = r.datos.rol_usuario === "acompañante"
      ? "El paciente todavía no registró mediciones."
      : "No hay mediciones registradas para este filtro.";
    historialElem.append(hmEl("p", { text: mensajeVacio, style: "color:#64748b;" }));
    return;
  }

  r.datos.mediciones.forEach((m) => {
    const fila = hmEl("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid #e2e8f0;" });
    const textoFila = hmEl("span", { style: "flex:1;min-width:200px;", text: `${m.tipo}: ${hmNumero(m.valor)}${m.valor2 !== null ? "/" + hmNumero(m.valor2) : ""} ${m.unidad} · ${hmFecha(m.fecha_hora)}` });
    fila.append(textoFila);

    if (r.datos.rol_usuario !== "acompañante") {
      const btnEliminar = hmEl("button", { 
        type: "button", 
        className: "modal-btn", 
        style: "background:#ef4444;color:#fff;padding:4px 10px;", 
        text: "Eliminar", 
        onclick: async () => {
          if (!await hmConfirmar({ titulo: "Eliminar medición", mensaje: "¿Eliminar esta medición?", textoConfirmar: "Eliminar", peligro: true })) return;
          const rr = await hmApi("mediciones.php", { accion: "eliminar", id: m.id });
          if (!rr.ok) { avisoElem.mostrar(rr.mensaje); return; }
          hmAvisarCambio(); // Refresca las tarjetas y la lista
        } 
      });
      fila.append(btnEliminar);
    }
    
    historialElem.append(fila);
  });
}

function abrirCargaMedicion(item, avisoElem) {
  const tipo = tiposDeMedicion && tiposDeMedicion[item.tipoNombre];
  if (!tipo) { avisoElem.mostrar("Todavía no cargaron los tipos de medición."); return; }
  const campos = [{ id: "valor", label: (tipo.etiqueta1 || "Valor") + " (" + item.unit + ")", atributos: { inputmode: "decimal", autocomplete: "off" } }];
  if (Number(tipo.usa_valor2) === 1) {
    campos.push({ id: "valor2", label: (tipo.etiqueta2 || "Segundo valor") + " (" + item.unit + ")", atributos: { inputmode: "decimal", autocomplete: "off" } });
  }
  hmModal({
    titulo: "Cargar " + item.title.toLowerCase(),
    campos,
    onGuardar: async function (v) {
      const params = { accion: "guardar", id_tipo: tipo.id, valor: v.valor.replace(",", ".") };
      if (Number(tipo.usa_valor2) === 1) params.valor2 = (v.valor2 || "").replace(",", ".");
      const r = await hmApi("mediciones.php", params);
      if (r.ok) hmAvisarCambio();
      return r;
    }
  });
}

/* CIERRE GLOBAL DE LOS POPOVERS AL HACER CLIC FUERA */
document.addEventListener("click", function () {
  document.querySelectorAll(".param-info-popover").forEach(function (pop) {
    pop.classList.remove("active");
  });
});