/* MEDICAMENTOS Y STOCK (api/medicamentos.php) + avisos (api/notificaciones.php). */
function renderMedicamentosModule(description) {
  const container = hmEl("div", { className: "medicamentos-wrapper" });
  container.append(
    hmEl("h2", { className: "panel-title", text: "Medicamentos" }),
    hmEl("p", { className: "panel-description", text: description })
  );
  const aviso = hmAviso();
  const avisos = hmEl("div", { style: "margin:12px 0;" });
  const barra = hmEl("div", { style: "margin:12px 0;" });
  const lista = hmEl("div", { className: "medical-params-grid" });
  container.append(aviso, avisos, barra, lista);

  barra.append(hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "+ Agregar medicamento", onclick: () => abrirFormulario(null) }));

  function abrirFormulario(m) {
    hmModal({
      titulo: m ? "Editar medicamento" : "Nuevo medicamento",
      campos: [
        { id: "nombre", label: "Nombre", valor: m ? m.nombre : "", atributos: { maxlength: "150" } },
        { id: "presentacion", label: "Presentación (opcional, ej. comprimidos de 10 mg)", valor: m && m.presentacion ? m.presentacion : "", atributos: { maxlength: "100" } },
        { id: "cantidad", label: "Unidades que quedan", tipo: "number", valor: m ? m.cantidad_actual : "", atributos: { min: "0", step: "1" } },
        { id: "umbral", label: "Avisarme cuando queden… unidades o menos", tipo: "number", valor: m ? m.umbral_alerta_stock_bajo : 5, atributos: { min: "0", step: "1" } }
      ],
      onGuardar: async (v) => {
        const p = { accion: "guardar", nombre: v.nombre, presentacion: v.presentacion, cantidad_actual: v.cantidad, umbral_alerta_stock_bajo: v.umbral };
        if (m) p.id = m.id;
        const r = await hmApi("medicamentos.php", p);
        if (r.ok) { cargar(); }
        return r;
      }
    });
  }

  function tarjeta(m) {
    const c = hmEl("div", { className: "param-card", style: "padding:16px;" });
    c.append(hmEl("div", { className: "param-card-header" }, hmEl("span", { className: "param-title", text: m.nombre })));
    if (m.presentacion) c.append(hmEl("div", { style: "font-size:13px;color:#64748b;", text: m.presentacion }));
    c.append(hmEl("div", { className: "param-value-text", text: m.cantidad_actual + " ", style: "margin-top:6px;" }, hmEl("small", { text: "unidades", style: "font-size:16px;" })));
    c.append(hmEl("div", { style: "font-size:13px;margin-top:4px;", text: m.dias_restantes !== null && m.dias_restantes !== undefined ? `Te alcanza para unos ${m.dias_restantes} ${m.dias_restantes === 1 ? "día" : "días"}.` : "Sin horarios cargados: no podemos estimar cuántos días te alcanzan." }));
    c.append(hmEl("div", { className: "param-status-badge " + (m.stock_bajo ? "status-bad" : "status-good"), text: m.stock_bajo ? "Stock bajo" : "Stock suficiente", style: "margin-top:10px;" }));
    c.append(hmEl("div", { style: "display:flex;gap:8px;margin-top:12px;" },
      hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Editar", onclick: () => abrirFormulario(m) }),
      hmEl("button", { type: "button", className: "modal-btn", style: "background:#ef4444;color:#fff;", text: "Eliminar", onclick: async () => {
        if (!await hmConfirmar({ titulo: "Eliminar medicamento", mensaje: `¿Eliminar ${m.nombre}? Sus recordatorios de toma se desactivan.`, textoConfirmar: "Eliminar", peligro: true })) return;
        const r = await hmApi("medicamentos.php", { accion: "eliminar", id: m.id });
        if (!r.ok) { aviso.mostrar(r.mensaje); return; }
        cargar(); hmAvisarCambio();
      } })));
    return c;
  }

  async function cargarAvisos() {
    const r = await hmApi("notificaciones.php", { accion: "listar", limite: 30 });
    avisos.replaceChildren();
    if (!r.ok || r.datos.notificaciones.length === 0) return;
    const sinLeer = r.datos.notificaciones.filter((n) => !n.leida);
    avisos.append(hmEl("strong", { text: sinLeer.length ? `Avisos (${sinLeer.length} sin leer)` : "Avisos" }));
    r.datos.notificaciones.forEach((n) => {
      const fila = hmEl("div", {
        style: `font-size:14px;margin-top:6px;padding:8px 12px;border-radius:8px;background:${n.leida ? "#f1f5f9" : "#fef3c7"};`,
        text: `${hmFecha(n.fecha_envio)} — ${n.mensaje}`
      });
      // Aviso diario del estado de ánimo sin responder: se contesta desde acá mismo
      if (n.tipo === "estado_diario" && !n.leida && typeof hmAbrirCaritas === "function") {
        fila.append(hmEl("button", { type: "button", className: "modal-btn modal-btn-save", style: "margin-left:10px;", text: "Responder",
          onclick: () => hmAbrirCaritas({ alGuardar: cargarAvisos }) }));
      }
      avisos.append(fila);
    });
    if (sinLeer.length) {
      avisos.append(hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", style: "margin-top:8px;", text: "Marcar como leídos", onclick: async () => {
        await hmApi("notificaciones.php", { accion: "marcar_leidas" });
        cargarAvisos();
      } }));
    }
  }

  async function cargar() {
    const r = await hmApi("medicamentos.php", { accion: "listar" });
    lista.replaceChildren();
    if (!r.ok) { aviso.mostrar(r.mensaje || "No pudimos cargar tus medicamentos."); return; }
    aviso.mostrar("");
    if (r.datos.medicamentos.length === 0) {
      lista.append(hmEl("p", { text: "Todavía no cargaste medicamentos.", style: "grid-column:1/-1;color:#64748b;" }));
    }
    r.datos.medicamentos.forEach((m) => lista.append(tarjeta(m)));
    cargarAvisos();
  }

  cargar();
  // Si se responde el estado desde el banner o el dashboard, la lista de avisos se actualiza sola
  document.addEventListener("hm:datos", () => { if (container.isConnected) cargarAvisos(); });
  return container;
}
