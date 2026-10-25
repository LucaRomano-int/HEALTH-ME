/* MÓDULO: INVENTARIO DE MEDICAMENTOS
    Lleva la cuenta de cuántas pastillas le quedan al usuario y avisa
    cuando alcanzan para pocos días. El stock NO se descuenta con un cron:
    se calcula al vuelo a partir de (stock_base, fecha_base, consumo diario). */

/* Ruta al endpoint. Usar la misma base que el resto de los fetch del proyecto
   (si el frontend está en otro host que el PHP, poner la URL completa). */
const INVENTARIO_API = "api/inventario.php";
const INVENTARIO_UMBRAL_DEFECTO = 3; /* días de aviso por defecto */

/* ---------- LÓGICA DE CÁLCULO (sin DOM, fácil de probar) ---------- */

function inventarioParseFecha(texto) {
    const partes = texto.split("-");
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
}

function inventarioDiasEntre(desdeTexto, hasta) {
    const desde = inventarioParseFecha(desdeTexto);
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
    return Math.max(0, Math.round((fin - desde) / 86400000));
}

/* Devuelve cuántas pastillas quedan hoy, para cuántos días alcanzan y el estado */
function inventarioCalcular(med, hoy) {
    const consumoDiario = med.dosis_por_toma * med.tomas_por_dia;
    const diasPasados = inventarioDiasEntre(med.fecha_base, hoy);
    const restantes = Math.max(0, Math.round((med.stock_base - diasPasados * consumoDiario) * 100) / 100);

    let diasRestantes = null;
    let fechaAgotado = null;
    if (consumoDiario > 0) {
        diasRestantes = Math.floor(restantes / consumoDiario);
        fechaAgotado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diasRestantes);
    }

    let estado = "ok";
    if (restantes <= 0) {
        estado = "agotado";
    } else if (diasRestantes !== null && diasRestantes <= med.umbral_dias) {
        estado = "poco";
    }

    return {
        consumoDiario: consumoDiario,
        restantes: restantes,
        diasRestantes: diasRestantes,
        fechaAgotado: fechaAgotado,
        estado: estado,
        porcentaje: med.stock_base > 0 ? Math.min(100, (restantes / med.stock_base) * 100) : 0
    };
}

/* ---------- COMUNICACIÓN CON EL SERVIDOR ---------- */

function inventarioPeticion(accion, datos) {
    const formData = new FormData();
    formData.append("accion", accion);
    Object.keys(datos || {}).forEach(function (clave) {
        formData.append(clave, datos[clave]);
    });

    return fetch(INVENTARIO_API, {
        method: "POST",
        body: formData,
        credentials: "include" /* manda la cookie de sesión también entre hosts distintos */
    }).then(function (respuesta) {
        return respuesta.json();
    });
}

/* PDO devuelve los decimales como texto: se pasan a número */
function inventarioNormalizar(fila) {
    return {
        id: Number(fila.id),
        nombre: fila.nombre,
        dosis_por_toma: Number(fila.dosis_por_toma),
        tomas_por_dia: Number(fila.tomas_por_dia),
        stock_base: Number(fila.stock_base),
        fecha_base: fila.fecha_base,
        umbral_dias: Number(fila.umbral_dias)
    };
}

/* ---------- INTERFAZ ---------- */

function renderInventarioModule(description) {
    let medicamentos = [];
    let editandoId = null;

    const container = document.createElement("div");
    container.className = "inventario-wrapper";

    const titleElem = document.createElement("h2");
    titleElem.className = "panel-title";
    titleElem.textContent = "Inventario de medicamentos";
    container.appendChild(titleElem);

    const descElem = document.createElement("p");
    descElem.className = "panel-description";
    descElem.textContent = description;
    container.appendChild(descElem);

    const alertasBox = document.createElement("div");
    alertasBox.className = "inv-alertas";
    container.appendChild(alertasBox);

    /* FORMULARIO DE ALTA / EDICIÓN */
    const form = document.createElement("form");
    form.className = "inv-form";

    function crearCampo(etiqueta, nombre, tipo, atributos) {
        const grupo = document.createElement("label");
        grupo.className = "inv-field";
        const span = document.createElement("span");
        span.textContent = etiqueta;
        const input = document.createElement("input");
        input.type = tipo;
        input.name = nombre;
        input.required = true;
        Object.keys(atributos || {}).forEach(function (k) {
        input.setAttribute(k, atributos[k]);
        });
        grupo.appendChild(span);
        grupo.appendChild(input);
        form.appendChild(grupo);
        return input;
    }

    const inNombre = crearCampo("Medicamento", "nombre", "text", { maxlength: 100, placeholder: "Ej: Enalapril 10 mg" });
    const inDosis = crearCampo("Pastillas por toma", "dosis_por_toma", "number", { min: 0.25, step: 0.25, value: 1 });
    const inTomas = crearCampo("Tomas por día", "tomas_por_dia", "number", { min: 1, max: 12, step: 1, value: 1 });
    const inStock = crearCampo("Pastillas que tengo hoy", "stock_actual", "number", { min: 0, step: 0.5, value: 0 });
    const inUmbral = crearCampo("Avisarme con (días)", "umbral_dias", "number", { min: 1, max: 30, step: 1, value: INVENTARIO_UMBRAL_DEFECTO });

    const btnGuardar = document.createElement("button");
    btnGuardar.type = "submit";
    btnGuardar.className = "inv-btn inv-btn-primary";
    btnGuardar.textContent = "Agregar medicamento";

    const btnCancelar = document.createElement("button");
    btnCancelar.type = "button";
    btnCancelar.className = "inv-btn inv-btn-ghost";
    btnCancelar.textContent = "Cancelar";
    btnCancelar.hidden = true;

    form.appendChild(btnGuardar);
    form.appendChild(btnCancelar);
    container.appendChild(form);

    const mensaje = document.createElement("p");
    mensaje.className = "inv-mensaje";
    mensaje.setAttribute("role", "status");
    container.appendChild(mensaje);

    const grid = document.createElement("div");
    grid.className = "inv-grid";
    container.appendChild(grid);

    function mostrarMensaje(texto, esError) {
        mensaje.textContent = texto;
        mensaje.className = "inv-mensaje" + (esError ? " inv-mensaje-error" : "");
    }

    function salirDeEdicion() {
        editandoId = null;
        form.reset();
        inDosis.value = 1;
        inTomas.value = 1;
        inUmbral.value = INVENTARIO_UMBRAL_DEFECTO;
        btnGuardar.textContent = "Agregar medicamento";
        btnCancelar.hidden = true;
    }

    function entrarEnEdicion(med, info) {
        editandoId = med.id;
        inNombre.value = med.nombre;
        inDosis.value = med.dosis_por_toma;
        inTomas.value = med.tomas_por_dia;
        inStock.value = info.restantes;
        inUmbral.value = med.umbral_dias;
        btnGuardar.textContent = "Guardar cambios";
        btnCancelar.hidden = false;
        inNombre.focus();
    }

    btnCancelar.addEventListener("click", salirDeEdicion);

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const datos = {
        nombre: inNombre.value.trim(),
        dosis_por_toma: inDosis.value,
        tomas_por_dia: inTomas.value,
        stock_actual: inStock.value,
        umbral_dias: inUmbral.value
        };
        if (editandoId !== null) {
        datos.id = editandoId;
        }

        inventarioPeticion("guardar", datos)
        .then(function (resp) {
            if (resp.ok) {
            mostrarMensaje(editandoId !== null ? "Medicamento actualizado." : "Medicamento agregado.", false);
            salirDeEdicion();
            cargar();
            } else {
            mostrarMensaje(resp.mensaje || "No se pudo guardar.", true);
            }
        })
        .catch(function () {
            mostrarMensaje("No pudimos conectar con el servidor.", true);
        });
    });

    /* TARJETA DE UN MEDICAMENTO */
    function crearTarjeta(med, info) {
        const card = document.createElement("div");
        card.className = "inv-card inv-" + info.estado;

        const head = document.createElement("div");
        head.className = "inv-card-head";

        const nombre = document.createElement("span");
        nombre.className = "inv-card-name";
        nombre.textContent = med.nombre;
        head.appendChild(nombre);

        const acciones = document.createElement("div");
        acciones.className = "inv-card-actions";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "inv-icon-btn";
        btnEditar.title = "Editar";
        btnEditar.textContent = "✏️";
        btnEditar.addEventListener("click", function () {
        entrarEnEdicion(med, info);
        });

        const btnBorrar = document.createElement("button");
        btnBorrar.type = "button";
        btnBorrar.className = "inv-icon-btn";
        btnBorrar.title = "Eliminar";
        btnBorrar.textContent = "🗑️";
        btnBorrar.addEventListener("click", function () {
        if (!confirm("¿Eliminar " + med.nombre + " del inventario?")) {
            return;
        }
        inventarioPeticion("eliminar", { id: med.id }).then(function (resp) {
            if (resp.ok) {
            cargar();
            } else {
            mostrarMensaje(resp.mensaje || "No se pudo eliminar.", true);
            }
        });
        });

        acciones.appendChild(btnEditar);
        acciones.appendChild(btnBorrar);
        head.appendChild(acciones);
        card.appendChild(head);

        const cantidad = document.createElement("div");
        cantidad.className = "inv-card-count";
        cantidad.textContent = info.restantes + " ";
        const unidad = document.createElement("small");
        unidad.textContent = info.restantes === 1 ? "pastilla" : "pastillas";
        cantidad.appendChild(unidad);
        card.appendChild(cantidad);

        const barra = document.createElement("div");
        barra.className = "inv-bar";
        const relleno = document.createElement("div");
        relleno.className = "inv-bar-fill";
        relleno.style.width = info.porcentaje + "%";
        barra.appendChild(relleno);
        card.appendChild(barra);

        const estado = document.createElement("div");
        estado.className = "inv-status";
        if (info.estado === "agotado") {
        estado.textContent = "Agotado: hay que comprar ya";
        } else if (info.estado === "poco") {
        estado.textContent = "Quedan pocos días: comprar pronto";
        } else {
        estado.textContent = "Stock suficiente";
        }
        card.appendChild(estado);

        const detalle = document.createElement("p");
        detalle.className = "inv-detail";
        if (info.estado === "agotado") {
        detalle.textContent = "Consumo: " + info.consumoDiario + " por día.";
        } else {
        detalle.textContent = "Alcanza para " + info.diasRestantes + (info.diasRestantes === 1 ? " día" : " días") +
            " (hasta el " + info.fechaAgotado.toLocaleDateString("es-AR", { day: "numeric", month: "long" }) + "). " +
            "Consumo: " + info.consumoDiario + " por día.";
        }
        card.appendChild(detalle);

        /* REPOSICIÓN RÁPIDA: "compré más" */
        const reponer = document.createElement("div");
        reponer.className = "inv-restock";
        const inCantidad = document.createElement("input");
        inCantidad.type = "number";
        inCantidad.min = 1;
        inCantidad.step = 1;
        inCantidad.placeholder = "Compré…";
        inCantidad.setAttribute("aria-label", "Pastillas compradas de " + med.nombre);
        const btnSumar = document.createElement("button");
        btnSumar.type = "button";
        btnSumar.className = "inv-btn inv-btn-primary";
        btnSumar.textContent = "Sumar";
        btnSumar.addEventListener("click", function () {
        const comprada = Number(inCantidad.value);
        if (!(comprada > 0)) {
            mostrarMensaje("Ingresá cuántas pastillas compraste.", true);
            return;
        }
        inventarioPeticion("stock", { id: med.id, stock_actual: info.restantes + comprada }).then(function (resp) {
            if (resp.ok) {
            mostrarMensaje("Stock de " + med.nombre + " actualizado.", false);
            cargar();
            } else {
            mostrarMensaje(resp.mensaje || "No se pudo actualizar.", true);
            }
        });
        });
        reponer.appendChild(inCantidad);
        reponer.appendChild(btnSumar);
        card.appendChild(reponer);

        return card;
    }

    /* DIBUJA TODO A PARTIR DE LA LISTA ACTUAL */
    function dibujar() {
        const hoy = new Date();
        grid.innerHTML = "";
        alertasBox.innerHTML = "";

        if (medicamentos.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "inv-empty";
        vacio.textContent = "Todavía no cargaste medicamentos. Agregá el primero con el formulario de arriba.";
        grid.appendChild(vacio);
        inventarioActualizarAvisos(container, []);
        return;
        }

        const conAviso = [];
        medicamentos
        .map(function (med) { return { med: med, info: inventarioCalcular(med, hoy) }; })
        .sort(function (a, b) {
            const da = a.info.diasRestantes === null ? 9999 : a.info.diasRestantes;
            const db = b.info.diasRestantes === null ? 9999 : b.info.diasRestantes;
            return da - db;
        })
        .forEach(function (item) {
            grid.appendChild(crearTarjeta(item.med, item.info));
            if (item.info.estado !== "ok") {
            conAviso.push(item);
            }
        });

        conAviso.forEach(function (item) {
        const aviso = document.createElement("div");
        aviso.className = "inv-alerta inv-alerta-" + item.info.estado;
        aviso.textContent = item.info.estado === "agotado"
            ? "Se terminó " + item.med.nombre + ". Compralo cuanto antes."
            : "A " + item.med.nombre + " le quedan pastillas para " + item.info.diasRestantes +
            (item.info.diasRestantes === 1 ? " día" : " días") + ". Es momento de comprar más.";
        alertasBox.appendChild(aviso);
        });

        inventarioActualizarAvisos(container, conAviso);
    }

    function cargar() {
        inventarioPeticion("listar", {})
        .then(function (resp) {
            if (resp.ok) {
            medicamentos = resp.medicamentos.map(inventarioNormalizar);
            dibujar();
            } else {
            mostrarMensaje(resp.mensaje || "No se pudo cargar el inventario.", true);
            }
        })
        .catch(function () {
            mostrarMensaje("No pudimos conectar con el servidor.", true);
        });
    }

    cargar();
    return container;
}

/* ---------- AVISOS GLOBALES (globito en el menú + cartel al entrar) ---------- */

function inventarioActualizarAvisos(container, conAviso) {
    const panel = container.closest(".function-panel");
    if (!panel) {
        return;
    }
    const indice = Number(panel.id.replace("panel-", ""));
    const boton = document.querySelector('.function-tab-btn[data-index="' + indice + '"]');

    if (boton) {
        const viejo = boton.querySelector(".inv-badge");
        if (viejo) {
        viejo.remove();
        }
        if (conAviso.length > 0) {
        const badge = document.createElement("span");
        badge.className = "inv-badge";
        badge.textContent = conAviso.length;
        badge.title = "Medicamentos por reponer";
        boton.appendChild(badge);
        }
    }

    /* El cartel flotante se muestra una sola vez por sesión */
    let yaMostrado = false;
    try {
        yaMostrado = sessionStorage.getItem("inv_aviso_mostrado") === "1";
    } catch (err) {
        yaMostrado = false;
    }
    if (conAviso.length === 0 || yaMostrado) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = "inv-toast";
    const texto = document.createElement("span");
    texto.textContent = conAviso.length === 1
        ? "Te quedan pocas pastillas de " + conAviso[0].med.nombre + "."
        : "Te quedan pocas pastillas de " + conAviso.length + " medicamentos.";
    const ver = document.createElement("button");
    ver.type = "button";
    ver.textContent = "Ver inventario";
    ver.addEventListener("click", function () {
        if (typeof setActiveFunction === "function") {
        setActiveFunction(indice);
        }
        toast.remove();
    });
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "inv-toast-close";
    cerrar.setAttribute("aria-label", "Cerrar aviso");
    cerrar.textContent = "×";
    cerrar.addEventListener("click", function () {
        toast.remove();
    });
    toast.appendChild(texto);
    toast.appendChild(ver);
    toast.appendChild(cerrar);
    document.body.appendChild(toast);

    try {
        sessionStorage.setItem("inv_aviso_mostrado", "1");
    } catch (err) {
        /* sin sessionStorage: el aviso puede repetirse, no es grave */
    }
}