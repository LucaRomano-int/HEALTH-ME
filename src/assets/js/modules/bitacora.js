/* BITÁCORA DEL PACIENTE (api/bitacora.php): observaciones, diagnósticos, consultas y síntomas. */
function renderBitacoraModule(description) {
  const container = hmEl("div", { className: "bitacora-wrapper" });
  
  /* Título y descripción del módulo */
  container.append(
    hmEl("h2", { className: "panel-title", text: "Bitácora del paciente" }),
    hmEl("p", { className: "panel-description", text: description })
  );

  const aviso = hmAviso();
  const barra = hmEl("div", { style: "margin:12px 0;" });
  const lista = hmEl("div", { style: "display:flex;flex-direction:column;gap:16px;" });
  
  container.append(aviso, barra, lista);
  let tipos = ["Observación", "Diagnóstico", "Consulta", "Síntoma", "Otro"];

  /* Botón para agregar nueva entrada */
  barra.append(
    hmEl("button", {
      type: "button",
      className: "modal-btn modal-btn-save",
      text: "+ Nueva entrada",
      onclick: () => {
        hmModal({
          titulo: "Nueva entrada en la bitácora",
          campos: [
            { id: "tipo", label: "Tipo", tipo: "select", opciones: tipos, valor: "Observación" },
            { id: "texto", label: "¿Qué querés registrar?", tipo: "textarea", atributos: { maxlength: "1000" } }
          ],
          onGuardar: async (v) => {
            const r = await hmApi("bitacora.php", { accion: "guardar", tipo: v.tipo, texto: v.texto });
            if (r.ok) cargar();
            return r;
          }
        });
      }
    })
  );

  /* Carga dinámica de las entradas */
  async function cargar() {
    const r = await hmApi("bitacora.php", { accion: "listar" });
    lista.replaceChildren();
    
    if (!r.ok) {
      aviso.mostrar(r.mensaje || "No pudimos cargar la bitácora.");
      return;
    }
    
    aviso.mostrar("");
    tipos = r.datos.tipos || tipos;

    // NUEVO: Ocultar el contenedor del botón "+ Nueva entrada" si es acompañante
    if (r.datos.rol_usuario === "acompañante") {
      barra.style.display = "none";
    }

    if (r.datos.entradas.length === 0) {
      const mensajeVacio = r.datos.rol_usuario === "acompañante"
        ? "El paciente todavía no tiene entradas en su bitácora."
        : "Todavía no hay entradas en la bitácora.";
      lista.append(hmEl("p", { text: mensajeVacio, style: "color:#64748b;" }));
      return;
    }

    r.datos.entradas.forEach((e) => {
      /* Tarjeta envolvente principal (Turquesa #5cb8bc) */
      const card = hmEl("div", { className: "param-card" });

      /* Encabezado superior sobre fondo turquesa con botones de acción */
      const header = hmEl("div", {
        style: "display:flex;justify-content:space-between;align-items:center;padding:8px 12px;gap:8px;flex-wrap:wrap;"
      });

      const title = hmEl("span", {
        className: "param-title",
        text: `${e.tipo || "Observación"} · ${hmFecha(e.fecha_hora)}`,
        style: "text-align:left;flex:1;"
      });

      const actions = hmEl("div", { style: "display:flex;gap:6px;" });

      // NUEVO: Solo agregar los botones de edición y eliminación si NO es acompañante
      if (r.datos.rol_usuario !== "acompañante") {
        const btnEdit = hmEl("button", {
          type: "button",
          className: "modal-btn modal-btn-cancel",
          style: "padding:4px 12px;font-size:12px;border-radius:20px;",
          text: "Editar",
          onclick: () => {
            hmModal({
              titulo: "Editar entrada",
              campos: [
                { id: "tipo", label: "Tipo", tipo: "select", opciones: tipos, valor: e.tipo || "Observación" },
                { id: "texto", label: "Texto", tipo: "textarea", valor: e.texto, atributos: { maxlength: "1000" } }
              ],
              onGuardar: async (v) => {
                const r2 = await hmApi("bitacora.php", { accion: "editar", id: e.id, tipo: v.tipo, texto: v.texto });
                if (r2.ok) cargar();
                return r2;
              }
            });
          }
        });

        const btnDelete = hmEl("button", {
          type: "button",
          className: "modal-btn",
          style: "background:#ef4444;color:#fff;padding:4px 12px;font-size:12px;border-radius:20px;",
          text: "Eliminar",
          onclick: async () => {
            if (!await hmConfirmar({ titulo: "Eliminar entrada", mensaje: "¿Eliminar esta entrada?", textoConfirmar: "Eliminar", peligro: true })) return;
            const rr = await hmApi("bitacora.php", { accion: "eliminar", id: e.id });
            if (!rr.ok) {
              aviso.mostrar(rr.mensaje);
              return;
            }
            cargar();
          }
        });

        actions.append(btnEdit, btnDelete);
      }

      header.append(title, actions);

      /* Cuerpo interior de la tarjeta (Fondo blanco estético) */
      const body = hmEl("div", {
        className: "param-card-body",
        style: "align-items:flex-start;padding:16px 20px;"
      });

      const textElem = hmEl("p", {
        text: e.texto,
        style: "margin:0;color:#334155;font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-word;width:100%;"
      });

      body.append(textElem);
      card.append(header, body);
      lista.append(card);
    });
  }

  cargar();
  return container;
}