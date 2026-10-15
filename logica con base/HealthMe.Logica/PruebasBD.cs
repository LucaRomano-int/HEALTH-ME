using System.Text.Json;
using static HealthMe.Logica.Runner;

namespace HealthMe.Logica;

/// <summary>
/// Pruebas de integración con la base. Leen datos/datos_bd.json (generado por tools/exportar_datos.py
/// desde health_me_db con las filas TAL COMO las devuelve MySQL) y comprueban que:
///  1) la capa de mapeo entiende las columnas y valores reales de la base;
///  2) los permisos en C# coinciden con la vista SQL v_acompanante_afectado;
///  3) las estadísticas del dashboard en C# coinciden con las consultas Q3 y Q4 de bd/04_consultas.sql.
/// </summary>
public static class PruebasBD
{
    // ---- carga del JSON ------------------------------------------------

    static object? Valor(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.Null => null,
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Number => EsEntero(v.GetRawText()) ? v.GetInt64() : v.GetDecimal(),
        JsonValueKind.String => v.GetString(),
        _ => v.GetRawText()
    };

    static bool EsEntero(string texto) => !texto.Contains('.') && !texto.Contains('e') && !texto.Contains('E');

    static List<Dictionary<string, object?>> Filas(JsonElement arreglo) =>
        arreglo.EnumerateArray()
               .Select(e => e.EnumerateObject().ToDictionary(p => p.Name, p => Valor(p.Value)))
               .ToList();

    static decimal? Dec(Dictionary<string, object?> f, string col) =>
        f.TryGetValue(col, out var v) && v is not null ? Mapeo.Numero(v) : null;

    // ---- pruebas -------------------------------------------------------

    public static void Correr(string ruta)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(ruta));
        var raiz = doc.RootElement;
        var esperado = raiz.GetProperty("esperado_sql");

        var filasUsuario = Filas(raiz.GetProperty("usuario"));
        var usuarios = filasUsuario.Select(Mapeo.DesdeUsuario).ToList();
        var tipos = Filas(raiz.GetProperty("tipo_medicion")).Select(Mapeo.DesdeTipoMedicion).ToList();
        var mediciones = Filas(raiz.GetProperty("medicion")).Select(Mapeo.DesdeMedicion).ToList();
        var estados = Filas(raiz.GetProperty("estado_diario")).Select(Mapeo.DesdeEstadoDiario).ToList();
        var medicamentos = Filas(raiz.GetProperty("medicamento")).Select(Mapeo.DesdeMedicamento).ToList();
        var recordatorios = Filas(raiz.GetProperty("recordatorio")).Select(Mapeo.DesdeRecordatorio).ToList();
        var miembros = Filas(raiz.GetProperty("miembro_grupo")).Select(Mapeo.DesdeMiembroGrupo).ToList();
        var configAlarma = Filas(raiz.GetProperty("config_alarma"));

        Usuario U(string nombre) => usuarios.Single(u => u.Nombre == nombre);

        // =================================================================
        Seccion("9. Mapeo de las filas reales de health_me_db");
        // =================================================================
        Igual("usuarios mapeados", 7, usuarios.Count);
        Igual("admin: nivel administrador", Nivel.Administrador, U("Admin").Nivel);
        Igual<Rol?>("admin: sin rol (NULL en la base)", null, U("Admin").Rol);
        Igual<Rol?>("'acompañante' (con ñ) se lee como Acompanante", Rol.Acompanante, U("Marta").Rol);
        Igual<Rol?>("'afectado' se lee como Afectado", Rol.Afectado, U("Carlos").Rol);
        Igual<Rol?>("usuario recién registrado: rol NULL", null, U("Nuevo").Rol);
        Cierto("tinyint(1) activo = 0 se lee como false", !U("Baja").Activo);
        Cierto("tinyint(1) activo = 1 se lee como true", U("Carlos").Activo);
        Igual("tipos de medición mapeados", 5, tipos.Count);
        Igual<decimal?>("glucosa: rango mínimo", 70m, tipos.Single(t => t.Id == 1).RangoMin);
        Igual<decimal?>("glucosa: rango máximo", 140m, tipos.Single(t => t.Id == 1).RangoMax);
        Igual("mediciones mapeadas", 22, mediciones.Count);
        Igual("recordatorio 2 (evento): sin repetición", Repeticion.Ninguna, recordatorios.Single(r => r.Id == 2).Repeticion);
        Igual("recordatorio 2 es un evento", TipoRecordatorio.Evento, recordatorios.Single(r => r.Id == 2).Tipo);
        Igual<int?>("recordatorio 2: sin medicamento (NULL)", null, recordatorios.Single(r => r.Id == 2).IdMedicamento);
        Igual("recordatorio 1: diaria", Repeticion.Diaria, recordatorios.Single(r => r.Id == 1).Repeticion);
        Cierto("ingreso de Lucía al grupo 1: pendiente (aprobado = 0)", !miembros.Single(m => m.IdGrupo == 1 && m.IdUsuario == 5).Aprobado);
        Cierto("ingreso de Marta al grupo 1: aprobado", miembros.Single(m => m.IdGrupo == 1 && m.IdUsuario == 3).Aprobado);

        // Casos que la base de hoy no trae pero que el mapeo tiene que resistir
        var sinRep = new Dictionary<string, object?>
        {
            ["id"] = 9L, ["id_usuario"] = 2L, ["id_medicamento"] = null, ["tipo"] = "evento", ["titulo"] = "X",
            ["fecha_hora"] = new DateTime(2026, 10, 15, 10, 30, 0), ["repeticion"] = null, ["activo"] = (sbyte)1
        };
        Igual("repeticion NULL (como venía antes de la migración) = Ninguna", Repeticion.Ninguna, Mapeo.DesdeRecordatorio(sinRep).Repeticion);
        Igual("columna dosis_unidades ausente = 1 por defecto", 1, Mapeo.DesdeRecordatorio(sinRep).DosisUnidades);
        Cierto("acepta sbyte y DateTime como los entrega el driver", Mapeo.DesdeRecordatorio(sinRep).Activo);
        Igual<Rol?>("'acompanante' sin ñ también se entiende", Rol.Acompanante, Mapeo.ARol("acompanante"));
        Lanza<InvalidDataException>("rol desconocido lanza error (no se asume nada)", () => Mapeo.ARol("tutor"));
        Lanza<InvalidDataException>("nivel desconocido lanza error", () => Mapeo.ANivel("superadmin"));
        Lanza<InvalidDataException>("repeticion con texto libre lanza error", () => Mapeo.ARepeticion("todos los dias"));
        Lanza<InvalidDataException>("columna obligatoria ausente lanza error", () =>
            Mapeo.DesdeMedicion(new Dictionary<string, object?> { ["id_usuario"] = 1L }));
        Lanza<OverflowException>("un id bigint que no entra en int lanza error en vez de truncarse", () => Mapeo.Entero(5_000_000_000L));
        var sinUnidad = new Dictionary<string, object?> { ["id"] = 9, ["nombre"] = "Peso", ["unidad"] = null };
        Igual("tipo sin unidad (la columna admite NULL) = texto vacío", "", Mapeo.DesdeTipoMedicion(sinUnidad).Unidad);
        Cierto("tipo sin rangos (NULL): TieneRango = false", !Mapeo.DesdeTipoMedicion(sinUnidad).TieneRango);

        // =================================================================
        Seccion("10. Permisos y redirección: C# contra la vista SQL v_acompanante_afectado");
        // =================================================================
        var visiblesSql = Filas(esperado.GetProperty("visibles"))
            .Select(f => (Acomp: Mapeo.Entero(f["id_acompanante"]!), Afect: Mapeo.Entero(f["id_afectado"]!)))
            .ToHashSet();

        var acompanantes = usuarios.Where(u => u.Rol == Rol.Acompanante).ToList();
        var afectados = usuarios.Where(u => u.Rol == Rol.Afectado).ToList();
        var discrepancias = new List<string>();
        int pares = 0;
        foreach (var a in acompanantes)
            foreach (var f in afectados)
            {
                pares++;
                bool csharp = Permisos.PuedeVerDatosDeSalud(a, f, miembros);
                bool sql = visiblesSql.Contains((a.Id, f.Id));
                if (csharp != sql) discrepancias.Add($"{a.Nombre}->{f.Nombre} (C#={csharp}, SQL={sql})");
            }
        Igual($"los {pares} pares acompañante-afectado coinciden con la vista (sin discrepancias)", "", string.Join("; ", discrepancias));

        Cierto("Marta ve a Carlos (mismo grupo, ambos aprobados)", Permisos.PuedeVerDatosDeSalud(U("Marta"), U("Carlos"), miembros));
        Cierto("Lucía NO ve a Carlos (ingreso pendiente)", !Permisos.PuedeVerDatosDeSalud(U("Lucía"), U("Carlos"), miembros));
        Cierto("Lucía ve a Julia", Permisos.PuedeVerDatosDeSalud(U("Lucía"), U("Julia"), miembros));
        Cierto("Marta NO ve al usuario dado de baja, aunque esté en su grupo", !Permisos.PuedeVerDatosDeSalud(U("Marta"), U("Baja"), miembros));

        Igual("login admin -> panel admin", Destino.PanelAdmin, Permisos.DestinoTrasLogin(U("Admin")));
        Igual("login Carlos -> panel general", Destino.PanelGeneral, Permisos.DestinoTrasLogin(U("Carlos")));
        Igual("login Marta -> panel general", Destino.PanelGeneral, Permisos.DestinoTrasLogin(U("Marta")));
        Igual("login usuario nuevo -> elegir rol", Destino.ElegirRol, Permisos.DestinoTrasLogin(U("Nuevo")));
        Igual("login usuario de baja -> no entra", Destino.Inactivo, Permisos.DestinoTrasLogin(U("Baja")));

        // =================================================================
        Seccion("11. Dashboard: C# contra las consultas SQL Q3 y Q4");
        // =================================================================
        var filasEst = Filas(esperado.GetProperty("estadisticas"));
        var grupos = filasEst.GroupBy(f => (
            Usuario: Mapeo.Entero(f["id_usuario"]!),
            Ini: Mapeo.Fecha(f["periodo_inicio"]!),
            Fin: Mapeo.Fecha(f["periodo_fin"]!)));

        foreach (var g in grupos)
        {
            var periodo = new Periodo(g.Key.Ini, g.Key.Fin);
            var nombre = $"{usuarios.Single(u => u.Id == g.Key.Usuario).Nombre} {g.Key.Ini:yyyy-MM-dd}";

            var tiposConDatosCSharp = tipos
                .Where(t => Dashboard.EstadisticaDeTipo(mediciones, g.Key.Usuario, t, periodo) is not null)
                .Select(t => t.Id).OrderBy(x => x).ToList();
            var tiposSql = g.Select(f => Mapeo.Entero(f["id_tipo"]!)).OrderBy(x => x).ToList();
            Igual($"{nombre}: mismos tipos con datos", string.Join(",", tiposSql), string.Join(",", tiposConDatosCSharp));

            foreach (var fila in g)
            {
                int idTipo = Mapeo.Entero(fila["id_tipo"]!);
                var c = Dashboard.EstadisticaDeTipo(mediciones, g.Key.Usuario, tipos.Single(t => t.Id == idTipo), periodo);
                if (c is null) { Falla($"{nombre} tipo {idTipo}", "el SQL tiene datos y C# no"); continue; }
                Igual($"{nombre} tipo {idTipo}: cantidad", Mapeo.Entero(fila["cantidad"]!), c.Cantidad);
                Igual<decimal?>($"{nombre} tipo {idTipo}: promedio", Dec(fila, "promedio"), c.Promedio);
                Igual<decimal?>($"{nombre} tipo {idTipo}: mínimo", Dec(fila, "minimo"), c.Minimo);
                Igual<decimal?>($"{nombre} tipo {idTipo}: máximo", Dec(fila, "maximo"), c.Maximo);
                Igual<decimal?>($"{nombre} tipo {idTipo}: % en rango", Dec(fila, "porcentaje_en_rango"), c.PorcentajeEnRango);
            }
        }

        foreach (var fila in Filas(esperado.GetProperty("animo")))
        {
            int u = Mapeo.Entero(fila["id_usuario"]!);
            var periodo = new Periodo(Mapeo.Fecha(fila["periodo_inicio"]!), Mapeo.Fecha(fila["periodo_fin"]!));
            var r = Dashboard.ResumenDeAnimo(estados, u, periodo, null);
            var nombre = $"ánimo {usuarios.Single(x => x.Id == u).Nombre} {periodo.Inicio:yyyy-MM-dd}";
            Igual($"{nombre}: días con respuesta", Mapeo.Entero(fila["cantidad"]!), r.Cantidad);
            Igual<decimal?>($"{nombre}: promedio", Dec(fila, "promedio"), r.Promedio);
        }

        // Camino completo: fecha de inicio guardada en la base -> período -> dashboard con comparación
        var carlos = filasUsuario.Single(f => (string)f["nombre"]! == "Carlos");
        var ancla = Mapeo.Fecha(carlos["fecha_inicio_seguimiento"]!);
        var dOct = Dashboard.GenerarMensual(ancla, new DateOnly(2026, 10, 6), U("Carlos").Id, tipos, mediciones, estados)!;
        Igual("camino completo: octubre compara contra septiembre",
            new Periodo(new(2026, 9, 1), new(2026, 9, 30)), dOct.PeriodoAnterior);
        Igual("camino completo: glucosa mejoró", Resultado.Mejoro, dOct.Detalles.Single(d => d.Tipo.Id == 1).Resultado);
        Igual("camino completo: temperatura 'Sin datos en el período'", Resultado.SinDatosEnElPeriodo, dOct.Detalles.Single(d => d.Tipo.Id == 5).Resultado);
        Igual("camino completo: ánimo empeoró", Resultado.Empeoro, dOct.Animo.Resultado);

        // =================================================================
        Seccion("12. Inventario y recordatorios con filas reales");
        // =================================================================
        var enalapril = medicamentos.Single(m => m.Nombre == "Enalapril");
        var metformina = medicamentos.Single(m => m.Nombre == "Metformina");
        Cierto("Enalapril (8 de umbral 10) tiene stock bajo", Inventario.EstaBajoUmbral(enalapril.CantidadActual, enalapril.UmbralAlerta));
        Cierto("Metformina (40 de umbral 10) tiene stock normal", !Inventario.EstaBajoUmbral(metformina.CantidadActual, metformina.UmbralAlerta));
        Igual<int?>("Metformina dura 40 días (40 unidades, 1 por día)", 40, Inventario.DiasRestantes(metformina, recordatorios));
        Igual("descontar 1 de Enalapril deja 7 (igual que Q6 en SQL)", 7, Inventario.Descontar(enalapril, 1).CantidadNueva);

        var diaria = recordatorios.Single(r => r.Id == 1);
        Igual<DateTime?>("próxima toma de Metformina", new DateTime(2026, 10, 15, 8, 0, 0),
            Recordatorios.ProximaOcurrencia(diaria, new DateTime(2026, 10, 14, 20, 0, 0)));

        var turno = recordatorios.Single(r => r.Id == 2);
        var dias = Mapeo.Entero(configAlarma.Single(c => Mapeo.Entero(c["id_recordatorio"]!) == turno.Id)["dias_anticipacion"]!);
        Igual("el turno avisa con 2 días de anticipación (config_alarma)", 2, dias);
        Igual<string?>("aviso 2 días antes", "En 2 días tienes Turno con el cardiólogo. ¡No lo olvides!",
            Recordatorios.MensajeAviso(turno.Titulo, turno.FechaHora, new DateTime(2026, 10, 13, 9, 0, 0), dias));
        Igual<string?>("aviso el día anterior", "Mañana tienes Turno con el cardiólogo. ¡No lo olvides!",
            Recordatorios.MensajeAviso(turno.Titulo, turno.FechaHora, new DateTime(2026, 10, 14, 9, 0, 0), dias));

    }
}
