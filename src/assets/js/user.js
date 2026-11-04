/* LISTADO PROCEDURAL DE FUNCIONES DEL SISTEMA */
const healthFunctions = [
  {
    id: "opcion1",
    title: "Datos del grupo y del paciente",
    description: "Información detallada sobre el grupo y el paciente.",
    isCustomModule: true,
    renderFunctionName: "renderGrupoPacienteModule",
    // Módulos extra que se muestran dentro del mismo panel, debajo del principal
    extraRenderFunctionNames: ["renderAccesoCompartidoModule"]
  },
  {
    id: "opcion2",
    title: "Parametros de salud y signos vitales",
    description: "Informate o subi tu estado de salud con datos como la presion, glucosa, frecuencia cardíaca y saturacion de oxigeno.",
    isCustomModule: true,
    renderFunctionName: "renderSignosVitalesModule"
  },
  {
    id: "opcion3",
    title: "Fechas y recordatorios",
    description: "Una interfaz visual que reúne, procesa y muestra información relevante sobre la salud del paciente, permitiendo un monitoreo rápido y eficiente de su estado en un lapso de tiempo establecio.",
    isCustomModule: true,
    renderFunctionName: "renderRecordatoriosModule"
  },
  {
    id: "opcion4",
    title: "Bitacora del paciente",
    description: "Consulta tus registros clínicos pasados, diagnósticos y observaciones profesionales.",
    isCustomModule: true,
    renderFunctionName: "renderBitacoraModule"
  },
  {
    id: "opcion5",
    title: "Dashboard",
    description: "Una interfaz visual que reúne, procesa y muestra información relevante sobre la salud del paciente, permitiendo un monitoreo rápido y eficiente de su estado en un lapso de tiempo establecio.",
    isCustomModule: true,
    renderFunctionName: "renderDashboardModule"
  },
  {
    id: "opcion6",
    title: "Inventario de medicamentos",
    description: "Controlá cuántas pastillas te quedan y recibí un aviso cuando sea momento de comprar más.",
    isCustomModule: true,
    renderFunctionName: "renderInventarioModule"
  },
  {
    id: "opcion7",
    title: "Avisos y recordatorios",
    description: "Elegí cuándo querés que te avisemos para contarnos cómo te sentís.",
    isCustomModule: true,
    renderFunctionName: "renderPreferenciasModule"
  },
  {
    id: "opcion8",
    title: "S.O.S.",
    description: "Cargá a quién llamar en una emergencia y mirá tus avisos de ayuda.",
    isCustomModule: true,
    renderFunctionName: "renderSosModule"
  },
  {
    id: "opcion9",
    title: "Mi perfil",
    description: "Modificá tus datos personales, tu rol y tu contraseña.",
    hiddenInMenu: true, // solo se abre desde el link "MI PERFIL" de la barra superior
    isCustomModule: true,
    renderFunctionName: "renderPerfilModule"
  }
];

/* INICIALIZACIÓN AL CARGAR EL DOM */
document.addEventListener("DOMContentLoaded", function () {
  renderProceduralUI();
  initFooterToggle();
  initLinkPerfil();
});

/* LINK "MI PERFIL" DE LA BARRA SUPERIOR: abre la pantalla de perfil del menú lateral */
function initLinkPerfil() {
  const link = document.getElementById("linkMiPerfil");
  if (!link) return;
  link.addEventListener("click", function (e) {
    e.preventDefault();
    const idx = healthFunctions.findIndex(function (f) { return f.id === "opcion9"; });
    if (idx >= 0) setActiveFunction(idx);
  });
}

/* RENDERIZADO PROCEDURAL DE FILAS (BOTÓN + SEGMENTO) Y PANELES */
function renderProceduralUI() {
  const menuContainer = document.getElementById("functionsMenuList");
  const displayContainer = document.getElementById("functionDisplayArea");

  menuContainer.innerHTML = "";
  displayContainer.querySelectorAll(".function-panel").forEach(function (p) { p.remove(); });

  healthFunctions.forEach(function (funcItem, index) {

    const row = document.createElement("div");
    row.className = "menu-row";
    // Las funciones con hiddenInMenu conservan su panel pero no aparecen en el listado lateral
    if (funcItem.hiddenInMenu) row.style.display = "none";

    const button = document.createElement("button");
    button.className = "function-tab-btn";
    button.type = "button";
    button.textContent = funcItem.title;
    button.setAttribute("data-index", index);

    button.addEventListener("click", function () {
      setActiveFunction(index);
    });

    const segment = document.createElement("div");
    segment.className = "row-indicator-segment";
    segment.setAttribute("id", "segment-" + index);

    row.appendChild(button);
    row.appendChild(segment);
    menuContainer.appendChild(row);

    const panel = document.createElement("div");
    panel.className = "function-panel";
    panel.setAttribute("id", "panel-" + index);

    if (funcItem.isCustomModule) {
      const customRenderFn = window[funcItem.renderFunctionName];

      if (typeof customRenderFn === "function") {
        const customDOM = customRenderFn(funcItem.description);
        panel.appendChild(customDOM);
      }

      (funcItem.extraRenderFunctionNames || []).forEach(function (fnName) {
        const extraFn = window[fnName];
        if (typeof extraFn === "function") {
          panel.appendChild(extraFn());
        }
      });
    } else {
      const titleElem = document.createElement("h2");
      titleElem.className = "panel-title";
      titleElem.textContent = funcItem.title;
      panel.appendChild(titleElem);

      const descElem = document.createElement("p");
      descElem.className = "panel-description";
      descElem.textContent = funcItem.description;
      panel.appendChild(descElem);

      const cardElem = document.createElement("div");
      cardElem.className = "panel-content-card";

      const imgElem = document.createElement("img");
      imgElem.src = funcItem.placeholderImage;
      imgElem.alt = funcItem.title;
      imgElem.className = "panel-placeholder-img";
      cardElem.appendChild(imgElem);

      const textElem = document.createElement("p");
      textElem.innerHTML = "Contenido interactivo correspondiente a la <strong>" + funcItem.title + "</strong>.";
      cardElem.appendChild(textElem);

      panel.appendChild(cardElem);
    }

    displayContainer.appendChild(panel);
  });

  if (healthFunctions.length != 0) {
    setActiveFunction(0);
  }
}

/* SELECCIÓN Y ACTIVACIÓN DE UNA FUNCIÓN ESPECÍFICA */
function setActiveFunction(targetIndex) {
  const buttons = document.querySelectorAll(".function-tab-btn");
  const segments = document.querySelectorAll(".row-indicator-segment");
  const panels = document.querySelectorAll(".function-panel");

  buttons.forEach(function (btn, idx) {
    if (idx != targetIndex) {
      btn.classList.remove("active");
    } else {
      btn.classList.add("active");
    }
  });

  segments.forEach(function (seg, idx) {
    if (idx != targetIndex) {
      seg.classList.remove("active");
    } else {
      seg.classList.add("active");
    }
  });

  panels.forEach(function (pnl, idx) {
    if (idx != targetIndex) {
      pnl.classList.remove("active");
    } else {
      pnl.classList.add("active");
    }
  });

  // Forzamos un evento de redimensionamiento para que FullCalendar calcule el tamaño correcto al mostrarse
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 50);
}

/* CONTROLADOR PARA EL FOOTER DESPLEGABLE */
function initFooterToggle() {
  const footerElement = document.getElementById("collapsibleFooter");
  const footerSummaryBar = document.getElementById("footerSummaryBar");

  if (footerElement && footerSummaryBar) {
    footerSummaryBar.addEventListener("click", function () {
      footerElement.classList.toggle("expanded");
    });
  }
}