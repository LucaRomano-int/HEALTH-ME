/* DATOS DEL GRUPO Y DEL PACIENTE (api/grupos.php): crear un grupo o unirse con un PIN.
 *
 * Acá solo quedan los dos botones de entrada. Todo lo demás del grupo (nombre, PIN, integrantes, aprobaciones,
 * salir del grupo e invitaciones) se maneja en la sección "Acceso compartido" (acceso-compartido.js),
 * que user.js agrega justo debajo de este módulo.
 *
 * Este módulo sigue siendo el "dueño" de la lista de grupos: cada vez que la carga avisa con el evento "hm:grupos"
 * (detail: { grupos, idYo }) y deja la lista en window.hmGrupos y el id del usuario en window.hmIdYo.
 * "Acceso compartido" aparece recién cuando existe un grupo, y pide recargar con "hm:grupos-recargar"
 * cuando algo cambia (aprobar, quitar, salir, aceptar una invitación...). */
function renderGrupoPacienteModule(description) {
  const container = document.createElement("div");
  container.className = "grupo-paciente-wrapper";

  const titleElem = document.createElement("h2");
  titleElem.className = "panel-title";
  titleElem.textContent = "Datos del grupo y del paciente";
  container.appendChild(titleElem);

  const descElem = document.createElement("p");
  descElem.className = "panel-description";
  descElem.textContent = description;
  container.appendChild(descElem);

  const aviso = hmAviso();
  const barra = hmEl("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;" });
  const vacio = hmEl("p", { style: "color:#64748b;margin:0 0 12px 0;" });
  container.append(aviso, barra, vacio);

  barra.append(
    hmEl("button", { type: "button", className: "modal-btn modal-btn-save", text: "+ Crear grupo", onclick: () => hmModal({
      titulo: "Crear grupo",
      campos: [{ id: "nombre", label: "Nombre del grupo", atributos: { maxlength: "150" } }],
      onGuardar: async (v) => {
        const r = await hmApi("grupos.php", { accion: "crear", nombre: v.nombre });
        if (r.ok) {
          aviso.mostrar(`Grupo creado. PIN para sumar integrantes: ${r.datos.pin}. Ya podés invitar a alguien desde «Acceso compartido», más abajo.`, false);
          cargar();
        }
        return r;
      }
    }) }),
    hmEl("button", { type: "button", className: "modal-btn modal-btn-cancel", text: "Unirme con un PIN", onclick: () => hmModal({
      titulo: "Unirme a un grupo",
      campos: [{ id: "pin", label: "PIN del grupo", atributos: { maxlength: "12", autocomplete: "off" } }],
      onGuardar: async (v) => {
        const r = await hmApi("grupos.php", { accion: "unirse", pin: v.pin });
        if (r.ok) { aviso.mostrar(r.datos.mensaje || "Pedido enviado.", false); cargar(); }
        return r;
      }
    }) })
  );

  async function cargar() {
    const r = await hmApi("grupos.php", { accion: "mis_grupos" });
    if (!r.ok) { aviso.mostrar(r.mensaje || "No pudimos cargar tus grupos."); return; }
    const grupos = r.datos.grupos || [];
    const idYo = r.datos.id_yo !== undefined ? r.datos.id_yo : null;

    vacio.textContent = grupos.length === 0
      ? "Todavía no estás en ningún grupo. Creá uno para empezar a compartir tu información, o unite con un PIN."
      : "";

    // Avisa a "Acceso compartido" (aparece solo si hay al menos un grupo aprobado)
    window.hmGrupos = grupos;
    window.hmIdYo = idYo;
    document.dispatchEvent(new CustomEvent("hm:grupos", { detail: { grupos, idYo } }));
  }

  // "Acceso compartido" pide recargar cuando cambia la pertenencia a un grupo
  document.addEventListener("hm:grupos-recargar", () => { if (container.isConnected) cargar(); });

  cargar();

  return container;
}