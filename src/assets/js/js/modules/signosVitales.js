/* DATOS Y RANGOS DE CALIFICACIÓN DE PARÁMETROS MÉDICOS */
const medicalParametersData = [
  {
    id: "presion",
    title: "Presion Arterial",
    value: 120,
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
    title: "Frecuencia cardiaca",
    value: 72,
    unit: "LPM",
    infoText: "Cantidad de latidos del corazón por minuto.",
    howToMeasure: "Se toma colocando los dedos en la muñeca o mediante oxímetro/reloj.\n\nNormal - 60 a 80\nAceptable - 81 a 100\n Grave - mayor a 100",
    /* LÓGICA DE CALIFICACIÓN DE FRECUENCIA CARDÍACA: 60-80 Bueno, 81-100 Aceptable, <60 o >100 Malo */
    evaluateStatus: function (val) {
      if (val >= 60 && val <= 80) {
        return { text: "Bueno", cssClass: "status-good" };
      }
      if (val > 81 && val <= 100) {
        return { text: "Aceptable", cssClass: "status-acceptable" };
      }
      return { text: "Malo", cssClass: "status-bad" };
    }
  },
  {
    id: "glucosa",
    title: "Glucosa en sangre",
    value: 95,
    unit: "mg/dL",
    infoText: "Concentración de azúcar presente en el torrente sanguíneo.",
    howToMeasure: "Se mide en ayunas con un glucómetro de punción digital.\n\nGENTE SIN DIABETES:\nNormal (En ayunas) - menos de 100 \nNormal - (Despues del almuerzo) - menos de 140 \n\nGENTE CON DIABETES:\nNormal (En ayunas) - entre 80 y 130 \nNormal - (Despues del almuerzo) - menos de 180 \n\nEN AMBOS CASOS:\n Hipoglusemia - menos de 70",
    /* LÓGICA DE CALIFICACIÓN DE GLUCOSA: 70-99 Bueno, 100-125 Aceptable, <70 o >125 Malo */
    evaluateStatus: function (val) {
      if (val >= 80 && val <= 140) {
        return { text: "Bueno", cssClass: "status-good" };
      }
      return { text: "Hipoglucemia", cssClass: "status-bad" };
    }
  },
  {
    id: "saturacion",
    title: "Saturacion de oxigeno",
    value: 98,
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
    pHow.textContent = item.howToMeasure;
    popover.appendChild(pHow);

    header.appendChild(popover);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "param-card-body";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-param-edit";
    editBtn.title = "Editar valor";
    editBtn.textContent = "✏️";
    body.appendChild(editBtn);

    const valueDiv = document.createElement("div");
    valueDiv.className = "param-value-text";
    valueDiv.textContent = item.value + " ";

    const smallUnit = document.createElement("small");
    smallUnit.style.fontSize = "16px";
    smallUnit.textContent = item.unit;
    valueDiv.appendChild(smallUnit);
    body.appendChild(valueDiv);

    const statusObj = item.evaluateStatus(item.value);
    const badge = document.createElement("div");
    badge.className = "param-status-badge " + statusObj.cssClass;
    badge.textContent = statusObj.text;
    body.appendChild(badge);

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

  return container;
}

/* CIERRE GLOBAL DE LOS POPOVERS AL HACER CLIC FUERA */
document.addEventListener("click", function () {
  document.querySelectorAll(".param-info-popover").forEach(function (pop) {
    pop.classList.remove("active");
  });
});