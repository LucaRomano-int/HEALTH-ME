/* LISTADO PROCEDURAL DE FUNCIONES DEL SISTEMA */
const healthFunctions = [
  {
    id: "opcion1",
    title: "Datos del grupo y del paciente",
    description: "Información detallada sobre el grupo y el paciente.",
    placeholderImage: "img/logos/logoHealthMeCeleste.png"
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
    description: "Una interfaz visual que reúne, procesa y muestra información relevante sobre la salud del paciente, permitiendo un monitoreo rápido y eficiente de su estado en un lapso de tiempo esablecido.",
    placeholderImage: "img/logos/logoHealthMeCeleste.png"
  },
  {
    id: "opcion4",
    title: "Vitacora del paciente",
    description: "Consulta tus registros clínicos pasados, diagnósticos y observaciones profesionales.",
    placeholderImage: "img/logos/logoHealthMeCeleste.png"
  },
  {
    id: "opcion5",
    title: "Dashboard",
    description: "Una interfaz visual que reúne, procesa y muestra información relevante sobre la salud del paciente, permitiendo un monitoreo rápido y eficiente de su estado en un lapso de tiempo esablecido.",
    placeholderImage: "img/logos/logoHealthMeCeleste.png"
  },
  {
    id: "opcion6",
    title: "Gestión de medicamentos",
    description: "Administración y seguimiento de los medicamentos recetados, incluyendo dosis, horarios y recordatorios para garantizar la adherencia al tratamiento.",
    placeholderImage: "img/logos/logoHealthMeCeleste.png"
  }
];

/* INICIALIZACIÓN AL CARGAR EL DOM */
document.addEventListener("DOMContentLoaded", function () {
  renderProceduralUI();
  initFooterToggle();
});

/* RENDERIZADO PROCEDURAL DE FILAS (BOTÓN + SEGMENTO) Y PANELES */
function renderProceduralUI() {
  const menuContainer = document.getElementById("functionsMenuList");
  const displayContainer = document.getElementById("functionDisplayArea");

  menuContainer.innerHTML = "";
  displayContainer.innerHTML = "";

  healthFunctions.forEach(function (funcItem, index) {

    const row = document.createElement("div");
    row.className = "menu-row";

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
    setActiveFunction(1);
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