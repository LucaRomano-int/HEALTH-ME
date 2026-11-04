/* MÓDULO: DASHBOARD DE SALUD (GRÁFICOS SEPARADOS POR TIPO) */
function renderDashboardModule(description) {
  const API_URL = "http://localhost/health-me_backend-php/api/dashboard.php";

  const container = document.createElement("div");
  container.className = "dashboard-wrapper";

  const titleElem = document.createElement("h2");
  titleElem.className = "panel-title";
  titleElem.textContent = "Dashboard de salud";
  container.appendChild(titleElem);

  const descElem = document.createElement("p");
  descElem.className = "panel-description";
  descElem.textContent = description;
  container.appendChild(descElem);

  // Tarjetas de Métricas Resumidas
  const metricsGrid = document.createElement("div");
  metricsGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;";
  metricsGrid.innerHTML = `
    <div class="param-card" style="background-color: #5cb8bc;">
      <div class="param-card-body" style="padding: 15px; text-align: center;">
        <span style="font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cumplimiento</span>
        <div id="dash_cumplimiento" class="param-value-text" style="font-size: 28px; margin-top: 5px; color: #10b981;">-%</div>
        <div id="dash_cumplimiento_detalle" style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 4px;">Últimos 30 días</div>
      </div>
    </div>
    <div class="param-card" style="background-color: #f59e0b;">
      <div class="param-card-body" style="padding: 15px; text-align: center;">
        <span style="font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase;">Medicamentos Activos</span>
        <div id="dash_meds" class="param-value-text" style="font-size: 28px; margin-top: 5px; color: #f59e0b;">-</div>
      </div>
    </div>
    <div class="param-card" style="background-color: #8b5cf6;">
      <div class="param-card-body" style="padding: 15px; text-align: center;">
        <span style="font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase;">Notas en Bitácora</span>
        <div id="dash_notas" class="param-value-text" style="font-size: 28px; margin-top: 5px; color: #8b5cf6;">-</div>
      </div>
    </div>
  `;
  container.appendChild(metricsGrid);

  // Contenedor con Filtro de Parámetro + Canvas del Gráfico
  const chartsContainer = document.createElement("div");
  chartsContainer.style.cssText = "background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-top: 25px;";
  chartsContainer.innerHTML = `
    <div class="inv-form" style="margin-bottom: 1rem; display: flex; gap: 12px; align-items: flex-end;">
      <div class="inv-field">
        <span>Fecha Desde</span>
        <input type="date" id="dashFechaInicio" />
      </div>
      <div class="inv-field">
        <span>Fecha Hasta</span>
        <input type="date" id="dashFechaFin" />
      </div>
      <button type="button" id="btnFiltrarGrafico" class="inv-btn inv-btn-primary">
        Filtrar
      </button>
      <button type="button" id="btnLimpiarFiltroGrafico" class="inv-btn inv-btn-ghost">
        Limpiar
      </button>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
      <h3 style="font-size: 18px; color: #2c3e50; margin: 0;">Evolución por Parámetro</h3>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px; font-weight: 700; color: #64748b;">Seleccionar:</span>
        <select id="selectFiltroParametro" style="padding: 8px 12px; border-radius: 8px; border: 2px solid #cbd5e1; font-size: 14px; outline: none; cursor: pointer;">
          <option value="">Cargando parámetros...</option>
        </select>
      </div>
    </div>
    <div style="position: relative; height: 300px; width: 100%;">
      <canvas id="chartMediciones"></canvas>
    </div>
    <div id="msgSinDatos" style="display: none; text-align: center; color: #64748b; padding: 40px 0;">
      No hay mediciones registradas para este parámetro.
    </div>
  `;
  container.appendChild(chartsContainer);

  let chartInstance = null;
  let medicionesAgrupadas = {};

  function renderizarGrafico(tipo) {
    const canvas = document.getElementById("chartMediciones");
    const msgSinDatos = document.getElementById("msgSinDatos");

    if (!canvas || typeof Chart === "undefined") return;

    const datosTipo = medicionesAgrupadas[tipo] || [];

    if (datosTipo.length === 0) {
      canvas.style.display = "none";
      msgSinDatos.style.display = "block";
      if (chartInstance) chartInstance.destroy();
      return;
    }

    canvas.style.display = "block";
    msgSinDatos.style.display = "none";

    const labels = datosTipo.map((m) => {
      const f = new Date(m.fecha_hora.replace(" ", "T"));
      return f.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    });

    const esPresion = tipo.toLowerCase().includes("presión") || tipo.toLowerCase().includes("presion");
    const unidad = datosTipo[0]?.unidad ? ` (${datosTipo[0].unidad})` : "";

    const datasets = [
      {
        label: esPresion ? `Sistólica${unidad}` : `${tipo}${unidad}`,
        data: datosTipo.map((m) => Number(m.valor)),
        borderColor: "#5cb8bc",
        backgroundColor: "rgba(92, 184, 188, 0.15)",
        fill: !esPresion,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
      },
    ];

    if (esPresion && datosTipo.some((m) => m.valor2 != null)) {
      datasets.push({
        label: `Diastólica${unidad}`,
        data: datosTipo.map((m) => Number(m.valor2)),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.15)",
        fill: false,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
      });
    }

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          y: { beginAtZero: false, grid: { color: "#f1f5f9" } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  // Función principal para pedir datos a la API (con o sin filtros de fecha)
  async function cargarDatosDashboard() {
    const fechaInicio = document.getElementById("dashFechaInicio")?.value || "";
    const fechaFin = document.getElementById("dashFechaFin")?.value || "";

    const params = new URLSearchParams();
    if (fechaInicio) params.append("desde", fechaInicio);
    if (fechaFin) params.append("hasta", fechaFin);

    try {
      const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
      const respuesta = await fetch(url, { credentials: "include" });
      const data = await respuesta.json();

      if (!data.ok) return;

      // Actualizar Tarjetas
      // Cumplimiento = tomas marcadas / tomas que ya tocaban (null = todavía no hay tomas cargadas)
      const elCump = document.getElementById("dash_cumplimiento");
      const elCumpDetalle = document.getElementById("dash_cumplimiento_detalle");
      const cump = data.resumen.cumplimiento;
      if (cump === null || cump === undefined) {
        elCump.textContent = "Sin datos";
        elCump.style.fontSize = "22px";
        elCumpDetalle.textContent = data.rol_usuario === "acompañante"
          ? "El paciente todavía no cargó tomas"
          : "Cargá tus tomas en «Fechas y recordatorios»";
      } else {
        elCump.textContent = `${cump}%`;
        elCump.style.fontSize = "28px";
        elCumpDetalle.textContent = `${data.resumen.tomas_cumplidas} de ${data.resumen.tomas_esperadas} tomas · últimos 30 días`;
      }
      document.getElementById("dash_meds").textContent = data.resumen.total_medicamentos;
      document.getElementById("dash_notas").textContent = data.resumen.total_notas;

      // Agrupar mediciones por tipo
      medicionesAgrupadas = {};
      (data.mediciones || []).forEach((m) => {
        if (!medicionesAgrupadas[m.tipo]) {
          medicionesAgrupadas[m.tipo] = [];
        }
        medicionesAgrupadas[m.tipo].push(m);
      });

      const select = document.getElementById("selectFiltroParametro");
      const tipoSeleccionadoPrevio = select ? select.value : "";
      const tiposDisponibles = Object.keys(medicionesAgrupadas);

      if (tiposDisponibles.length === 0) {
        select.innerHTML = '<option value="">Sin mediciones registradas</option>';
        renderizarGrafico("");
        return;
      }

      select.innerHTML = tiposDisponibles
        .map((tipo) => `<option value="${tipo}">${tipo}</option>`)
        .join("");

      // Mantener el tipo seleccionado anteriormente si sigue disponible, de lo contrario elegir el primero
      const tipoARenderizar = tiposDisponibles.includes(tipoSeleccionadoPrevio)
        ? tipoSeleccionadoPrevio
        : tiposDisponibles[0];

      select.value = tipoARenderizar;
      renderizarGrafico(tipoARenderizar);

      select.onchange = (e) => {
        renderizarGrafico(e.target.value);
      };
    } catch (error) {
      console.error("Error al cargar los datos del dashboard:", error);
    }
  }

  // Vincular eventos y primera carga al insertar en el DOM
  setTimeout(() => {
    cargarDatosDashboard();

    // Cuando otro módulo cambia datos (p. ej. se marca una toma) el dashboard se recalcula
    document.addEventListener("hm:datos", () => { if (container.isConnected) cargarDatosDashboard(); });

    document.getElementById("btnFiltrarGrafico")?.addEventListener("click", () => {
      cargarDatosDashboard();
    });

    document.getElementById("btnLimpiarFiltroGrafico")?.addEventListener("click", () => {
      const inputInicio = document.getElementById("dashFechaInicio");
      const inputFin = document.getElementById("dashFechaFin");
      if (inputInicio) inputInicio.value = "";
      if (inputFin) inputFin.value = "";
      cargarDatosDashboard();
    });
  }, 0);

  return container;
}