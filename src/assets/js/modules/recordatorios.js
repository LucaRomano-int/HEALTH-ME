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

  // Div contenedor del calendario
  const calendarEl = document.createElement("div");
  calendarEl.id = "calendar-container";
  calendarEl.style.marginTop = "20px";
  container.appendChild(calendarEl);

  // Usamos setTimeout(0) para asegurarnos de que el div ya esté renderizado en el DOM antes de montar FullCalendar
  setTimeout(() => {
    const calendarNode = document.getElementById("calendar-container");
    if (!calendarNode) return;

    const calendar = new FullCalendar.Calendar(calendarNode, {
      initialView: "dayGridMonth",
      locale: "es", // Idioma español
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek"
      },
      // Eventos de prueba (mientras tus compañeros avanzan con la BDD)
      events: [
        {
          title: "Consulta Médica",
          start: "2026-11-05T10:00:00",
          color: "#ef4444"
        },
        {
          title: "Toma de Medicamento",
          start: "2026-11-02T08:00:00",
          color: "#5cb8bc"
        }
      ],
      dateClick: function(info) {
        alert("Hiciste clic en el día: " + info.dateStr);
      }
    });

    calendar.render();
  }, 0);

  return container;
}