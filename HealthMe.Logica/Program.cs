using System.Text;
using HealthMe.Logica;
using static HealthMe.Logica.Runner;

Console.OutputEncoding = Encoding.UTF8;
Console.WriteLine("HEALTH ME - pruebas de la lógica aislada");

// =====================================================================
// Datos de ejemplo (los mismos usuarios y grupos del script SQL)
// =====================================================================
var admin  = new Usuario(1, "Admin",  Nivel.Administrador, null);
var carlos = new Usuario(2, "Carlos", Nivel.General, Rol.Afectado);
var marta  = new Usuario(3, "Marta",  Nivel.General, Rol.Acompanante);
var julia  = new Usuario(4, "Julia",  Nivel.General, Rol.Afectado);
var lucia  = new Usuario(5, "Lucía",  Nivel.General, Rol.Acompanante);
var nuevo  = new Usuario(6, "Nuevo",  Nivel.General, null);                 // recién registrado, sin rol
var baja   = new Usuario(7, "Baja",   Nivel.General, Rol.Afectado, Activo: false);

var miembros = new List<MiembroGrupo>
{
    new(1, 3), new(1, 2),   // Familia Gómez: Marta (acompañante) y Carlos (afectado)
    new(2, 5), new(2, 4),   // Familia Pérez: Lucía (acompañante) y Julia (afectada)
};

// =====================================================================
Seccion("1. Registro y validaciones");
// =====================================================================
Cierto("registro válido", Validaciones.ValidarRegistro("Carlos", "carlos@example.com", "Clave1234", "Clave1234").Ok);
Cierto("rechaza clave corta", !Validaciones.ValidarRegistro("Carlos", "carlos@example.com", "abc1", "abc1").Ok);
Cierto("rechaza clave sin números", !Validaciones.ValidarRegistro("Carlos", "carlos@example.com", "soloLetras", "soloLetras").Ok);
Cierto("rechaza clave sin letras", !Validaciones.ValidarRegistro("Carlos", "carlos@example.com", "12345678", "12345678").Ok);
Cierto("rechaza claves que no coinciden", !Validaciones.ValidarRegistro("Carlos", "carlos@example.com", "Clave1234", "Clave1235").Ok);
Cierto("rechaza correo inválido", !Validaciones.ValidarRegistro("Carlos", "carlos@", "Clave1234", "Clave1234").Ok);
Cierto("rechaza nombre vacío", !Validaciones.ValidarRegistro("  ", "carlos@example.com", "Clave1234", "Clave1234").Ok);

var claveLarga = new string('ñ', 40) + "1";   // 41 caracteres pero 81 bytes
Cierto("clave de 41 caracteres pero 81 bytes: rechazada (límite de bcrypt = 72 bytes)",
    !Validaciones.ValidarRegistro("Carlos", "carlos@example.com", claveLarga, claveLarga).Ok);

Igual("correo normalizado", "carlos@example.com", Validaciones.NormalizarEmail("  Carlos@Example.COM "));
Igual("DNI con puntos", "47165087", Validaciones.NormalizarDni("47.165.087"));
Igual("DNI sin puntos", "47165087", Validaciones.NormalizarDni("47165087"));
Igual("DNI de 7 dígitos", "1234567", Validaciones.NormalizarDni("1.234.567"));
Igual<string?>("DNI muy corto", null, Validaciones.NormalizarDni("123"));
Igual<string?>("DNI con letras", null, Validaciones.NormalizarDni("12a45678"));
Igual<string?>("DNI vacío", null, Validaciones.NormalizarDni(null));

var ahora = new DateTime(2026, 10, 9, 12, 0, 0);
Cierto("medición válida (36,6)", Validaciones.ValidarMedicion(36.6m, ahora.AddHours(-1), ahora).Ok);
Cierto("medición con valor 0 rechazada", !Validaciones.ValidarMedicion(0m, ahora.AddHours(-1), ahora).Ok);
Cierto("medición con 3 decimales rechazada", !Validaciones.ValidarMedicion(36.666m, ahora.AddHours(-1), ahora).Ok);
Cierto("medición con fecha futura rechazada", !Validaciones.ValidarMedicion(36.6m, ahora.AddDays(1), ahora).Ok);
Cierto("medición 2 minutos en el futuro tolerada (desfase de reloj)", Validaciones.ValidarMedicion(36.6m, ahora.AddMinutes(2), ahora).Ok);

Cierto("estado 0 inválido", !Validaciones.EstadoValido(0));
Cierto("estado 5 inválido", !Validaciones.EstadoValido(5));
Igual("etiqueta 1", "Muy mal", Validaciones.EtiquetaEstado(1));
Igual("etiqueta 4", "Muy bien", Validaciones.EtiquetaEstado(4));
Lanza<ArgumentOutOfRangeException>("etiqueta de estado 7 lanza error", () => Validaciones.EtiquetaEstado(7));

// ---- PIN de grupo
Igual("PIN determinístico (para probar)", "AAAAAA", Pin.Generar(_ => 0));
var pinOk = true;
for (int i = 0; i < 300; i++)
{
    var p = Pin.Generar();
    pinOk &= p.Length == Pin.Largo && Pin.EsValido(p);
}
Cierto("300 PIN generados: largo 6 y solo caracteres del alfabeto", pinOk);
Cierto("PIN normaliza minúsculas, espacios y guiones", Pin.EsValido("ab-cd 23"));
Cierto("PIN con '0' inválido (ambiguo con O)", !Pin.EsValido("ABCDE0"));
Cierto("PIN corto inválido", !Pin.EsValido("ABC"));
Cierto("HALLAZGO: los PIN del SQL de ejemplo (GOM4821) no cumplen el formato propuesto", !Pin.EsValido("GOM4821"));

// =====================================================================
Seccion("2. Permisos y redirección tras el login");
// =====================================================================
Igual("admin -> panel admin", Destino.PanelAdmin, Permisos.DestinoTrasLogin(admin));
Igual("afectado -> panel general", Destino.PanelGeneral, Permisos.DestinoTrasLogin(carlos));
Igual("acompañante -> panel general", Destino.PanelGeneral, Permisos.DestinoTrasLogin(marta));
Igual("general sin rol -> elegir rol", Destino.ElegirRol, Permisos.DestinoTrasLogin(nuevo));
Igual("usuario dado de baja -> no entra", Destino.Inactivo, Permisos.DestinoTrasLogin(baja));
Igual("admin dado de baja -> no entra", Destino.Inactivo, Permisos.DestinoTrasLogin(admin with { Activo = false }));

Cierto("admin gestiona usuarios", Permisos.PuedeGestionarUsuarios(admin));
Cierto("acompañante NO gestiona usuarios", !Permisos.PuedeGestionarUsuarios(marta));
Cierto("afectado NO gestiona usuarios", !Permisos.PuedeGestionarUsuarios(carlos));

Cierto("afectado carga sus propios datos", Permisos.PuedeCargarDatos(carlos, 2));
Cierto("afectado NO carga datos de otro afectado", !Permisos.PuedeCargarDatos(carlos, 4));
Cierto("acompañante NO carga datos (ni los del afectado de su grupo)", !Permisos.PuedeCargarDatos(marta, 2));
Cierto("admin NO carga datos de salud", !Permisos.PuedeCargarDatos(admin, 2));
Cierto("afectado dado de baja NO carga datos", !Permisos.PuedeCargarDatos(baja, 7));

Cierto("afectado ve sus datos", Permisos.PuedeVerDatosDeSalud(carlos, carlos, miembros));
Cierto("acompañante ve al afectado de su grupo", Permisos.PuedeVerDatosDeSalud(marta, carlos, miembros));
Cierto("acompañante NO ve a un afectado de otro grupo", !Permisos.PuedeVerDatosDeSalud(marta, julia, miembros));
Cierto("otra acompañante ve a su afectada", Permisos.PuedeVerDatosDeSalud(lucia, julia, miembros));
Cierto("admin NO ve datos de salud", !Permisos.PuedeVerDatosDeSalud(admin, carlos, miembros));
Cierto("afectado NO ve datos de otro afectado", !Permisos.PuedeVerDatosDeSalud(carlos, julia, miembros));
Cierto("nadie 've' datos de salud de un acompañante (no tiene)", !Permisos.PuedeVerDatosDeSalud(carlos, marta, miembros));
Cierto("no se ven datos de un afectado dado de baja", !Permisos.PuedeVerDatosDeSalud(marta, baja, miembros.Append(new MiembroGrupo(1, 7)).ToList()));

var conPendiente = miembros.Append(new MiembroGrupo(1, 5, Aprobado: false)).ToList();
Cierto("PROPUESTA aprobación: acompañante con ingreso PENDIENTE no ve datos", !Permisos.PuedeVerDatosDeSalud(lucia, carlos, conPendiente));
var conAprobado = miembros.Append(new MiembroGrupo(1, 5, Aprobado: true)).ToList();
Cierto("PROPUESTA aprobación: al aprobarlo, sí ve los datos", Permisos.PuedeVerDatosDeSalud(lucia, carlos, conAprobado));

// =====================================================================
Seccion("3. Inventario de medicamentos");
// =====================================================================
Cierto("stock bajo cuando llega justo al umbral", Inventario.EstaBajoUmbral(10, 10));
Cierto("stock bajo por debajo del umbral", Inventario.EstaBajoUmbral(8, 10));
Cierto("stock OK por encima del umbral", !Inventario.EstaBajoUmbral(11, 10));

var metformina = new Medicamento(1, 2, "Metformina", 40, 10);
var enalapril  = new Medicamento(2, 2, "Enalapril", 8, 10);

var r1 = Inventario.Descontar(metformina, 1);
Igual("descuento normal: queda 39", 39, r1.CantidadNueva);
Cierto("descuento normal: sin alerta", !r1.StockBajo && !r1.StockInsuficiente);

var r2 = Inventario.Descontar(enalapril, 1);
Igual("Enalapril 8 - 1 = 7", 7, r2.CantidadNueva);
Cierto("Enalapril queda con stock bajo", r2.StockBajo);

var r3 = Inventario.Descontar(new Medicamento(3, 2, "X", 1, 1), 2);
Igual("stock 1, dosis 2: queda en 0 (nunca negativo)", 0, r3.CantidadNueva);
Igual("stock 1, dosis 2: se descuenta solo 1", 1, r3.UnidadesDescontadas);
Cierto("stock 1, dosis 2: marca stock insuficiente", r3.StockInsuficiente);

var r4 = Inventario.Descontar(new Medicamento(4, 2, "Y", 0, 5), 1);
Igual("stock 0: sigue en 0", 0, r4.CantidadNueva);
Cierto("stock 0: marca stock insuficiente", r4.StockInsuficiente);
Lanza<ArgumentOutOfRangeException>("descontar 0 unidades lanza error", () => Inventario.Descontar(metformina, 0));

var diaria  = new Recordatorio(1, 2, 1, TipoRecordatorio.Horario, "Metformina", new(2026, 9, 1, 8, 0, 0), Repeticion.Diaria);
var diaria2 = diaria with { Id = 5, FechaHora = new(2026, 9, 1, 20, 0, 0) };
Igual<int?>("40 unidades, 1 por día = 40 días", 40, Inventario.DiasRestantes(metformina, new[] { diaria }));
Igual<int?>("40 unidades, 2 tomas por día = 20 días", 20, Inventario.DiasRestantes(metformina, new[] { diaria, diaria2 }));
Igual<int?>("5 unidades, 2 por toma = 2 días (redondea hacia abajo)", 2,
    Inventario.DiasRestantes(metformina with { CantidadActual = 5 }, new[] { diaria with { DosisUnidades = 2 } }));
Igual<int?>("10 unidades, 1 por semana = 70 días", 70,
    Inventario.DiasRestantes(metformina with { CantidadActual = 10 }, new[] { diaria with { Repeticion = Repeticion.Semanal } }));
Igual<int?>("sin recordatorios: no se puede estimar", null, Inventario.DiasRestantes(metformina, Array.Empty<Recordatorio>()));
Igual<int?>("recordatorio inactivo se ignora", null, Inventario.DiasRestantes(metformina, new[] { diaria with { Activo = false } }));
Igual<int?>("recordatorio de otro medicamento se ignora", null, Inventario.DiasRestantes(metformina, new[] { diaria with { IdMedicamento = 99 } }));
Igual<int?>("recordatorio de otro usuario se ignora", null, Inventario.DiasRestantes(metformina, new[] { diaria with { IdUsuario = 4 } }));

// =====================================================================
Seccion("4. Recordatorios y avisos");
// =====================================================================
Igual<DateTime?>("diaria: próxima es mañana a las 8", new DateTime(2026, 10, 7, 8, 0, 0),
    Recordatorios.ProximaOcurrencia(diaria, new DateTime(2026, 10, 6, 9, 0, 0)));
Igual<DateTime?>("diaria: si todavía no son las 8, es hoy", new DateTime(2026, 10, 6, 8, 0, 0),
    Recordatorios.ProximaOcurrencia(diaria, new DateTime(2026, 10, 6, 7, 0, 0)));
Igual<DateTime?>("diaria: justo a la hora, devuelve ahora", new DateTime(2026, 10, 6, 8, 0, 0),
    Recordatorios.ProximaOcurrencia(diaria, new DateTime(2026, 10, 6, 8, 0, 0)));
Igual<DateTime?>("diaria: antes del primer día, devuelve el primero", new DateTime(2026, 9, 1, 8, 0, 0),
    Recordatorios.ProximaOcurrencia(diaria, new DateTime(2026, 8, 20, 0, 0, 0)));

var semanal = diaria with { FechaHora = new(2026, 9, 1, 10, 0, 0), Repeticion = Repeticion.Semanal };   // martes
Igual<DateTime?>("semanal: próximo martes", new DateTime(2026, 10, 13, 10, 0, 0),
    Recordatorios.ProximaOcurrencia(semanal, new DateTime(2026, 10, 6, 10, 1, 0)));

var unico = diaria with { FechaHora = new(2026, 10, 15, 10, 30, 0), Repeticion = Repeticion.Ninguna };
Igual<DateTime?>("sin repetición, futuro: esa fecha", new DateTime(2026, 10, 15, 10, 30, 0),
    Recordatorios.ProximaOcurrencia(unico, new DateTime(2026, 10, 9, 0, 0, 0)));
Igual<DateTime?>("sin repetición, pasado: ya no hay más", null,
    Recordatorios.ProximaOcurrencia(unico, new DateTime(2026, 10, 16, 0, 0, 0)));
Igual<DateTime?>("recordatorio inactivo: nunca", null,
    Recordatorios.ProximaOcurrencia(diaria with { Activo = false }, new DateTime(2026, 10, 6, 9, 0, 0)));

var turno = new DateTime(2026, 10, 15, 10, 30, 0);
Igual<string?>("aviso a 2 días", "En 2 días tienes Turno con el cardiólogo. ¡No lo olvides!",
    Recordatorios.MensajeAviso("Turno con el cardiólogo", turno, new DateTime(2026, 10, 13, 9, 0, 0), 2));
Igual<string?>("aviso el día anterior", "Mañana tienes Turno con el cardiólogo. ¡No lo olvides!",
    Recordatorios.MensajeAviso("Turno con el cardiólogo", turno, new DateTime(2026, 10, 14, 9, 0, 0), 2));
Igual<string?>("aviso el mismo día", "Hoy tienes Turno con el cardiólogo a las 10:30. ¡No lo olvides!",
    Recordatorios.MensajeAviso("Turno con el cardiólogo", turno, new DateTime(2026, 10, 15, 8, 0, 0), 2));
Igual<string?>("3 días antes: todavía no avisa", null,
    Recordatorios.MensajeAviso("Turno con el cardiólogo", turno, new DateTime(2026, 10, 12, 9, 0, 0), 2));
Igual<string?>("el mismo día pero ya pasó la hora: no avisa", null,
    Recordatorios.MensajeAviso("Turno con el cardiólogo", turno, new DateTime(2026, 10, 15, 11, 0, 0), 2));
Igual<string?>("evento pasado: no avisa", null,
    Recordatorios.MensajeAviso("Turno con el cardiólogo", turno, new DateTime(2026, 10, 16, 9, 0, 0), 2));

// =====================================================================
Seccion("5. Períodos mensuales del dashboard");
// =====================================================================
var ancla = new DateOnly(2026, 9, 1);
var sep = new Periodo(new(2026, 9, 1), new(2026, 9, 30));
var oct = new Periodo(new(2026, 10, 1), new(2026, 10, 31));
Igual("15/09 cae en el período de septiembre", sep, Periodos.QueContiene(ancla, new(2026, 9, 15)));
Igual("01/10 arranca el segundo período", oct, Periodos.QueContiene(ancla, new(2026, 10, 1)));
Igual("30/09 sigue en el primero", sep, Periodos.QueContiene(ancla, new(2026, 9, 30)));
Igual<Periodo?>("antes del inicio del seguimiento: ninguno", null, Periodos.QueContiene(ancla, new(2026, 8, 31)));
Igual<Periodo?>("anterior de octubre = septiembre", sep, Periodos.Anterior(ancla, oct));
Igual<Periodo?>("el primer período no tiene anterior", null, Periodos.Anterior(ancla, sep));
Cierto("septiembre se cierra recién el 01/10", Periodos.EstaCerrado(sep, new(2026, 10, 1)));
Cierto("septiembre sigue abierto el 30/09", !Periodos.EstaCerrado(sep, new(2026, 9, 30)));

var ancla31 = new DateOnly(2026, 1, 31);
Igual("ancla 31/01: período 0", new Periodo(new(2026, 1, 31), new(2026, 2, 27)), Periodos.Numero(ancla31, 0));
Igual("ancla 31/01: período 1", new Periodo(new(2026, 2, 28), new(2026, 3, 30)), Periodos.Numero(ancla31, 1));
Igual("ancla 31/01: período 2", new Periodo(new(2026, 3, 31), new(2026, 4, 29)), Periodos.Numero(ancla31, 2));
Igual("ancla 31/01: el 28/02 cae en el período 1", Periodos.Numero(ancla31, 1), Periodos.QueContiene(ancla31, new(2026, 2, 28)));
Igual("ancla 31/01: el 27/02 cae en el período 0", Periodos.Numero(ancla31, 0), Periodos.QueContiene(ancla31, new(2026, 2, 27)));

// Propiedad: sin huecos ni solapes, para anclas de cualquier día (incluye 29/02 de año bisiesto)
var anclas = new[] { new DateOnly(2026, 9, 1), new(2026, 9, 15), new(2026, 9, 28), new(2026, 1, 29),
                     new(2026, 1, 30), new(2026, 1, 31), new(2024, 2, 29), new(2026, 3, 31) };
bool contiguos = true, ubicables = true;
foreach (var a in anclas)
    for (int n = 0; n < 60; n++)
    {
        var p = Periodos.Numero(a, n);
        var sig = Periodos.Numero(a, n + 1);
        contiguos &= sig.Inicio == p.Fin.AddDays(1) && p.Fin >= p.Inicio;
        ubicables &= Periodos.QueContiene(a, p.Inicio) == p && Periodos.QueContiene(a, p.Fin) == p;
    }
Cierto("8 anclas x 60 períodos: sin huecos ni solapes", contiguos);
Cierto("8 anclas x 60 períodos: primer y último día caen en su período", ubicables);

// =====================================================================
Seccion("6. Dashboard: contraste con la hoja Dashboard_Calculo del Excel");
// =====================================================================
var semActual   = new Periodo(new(2026, 9, 21), new(2026, 9, 27));
var semAnterior = new Periodo(new(2026, 9, 14), new(2026, 9, 20));
var dEx = Dashboard.Generar(semActual, semAnterior, 1, DatosExcel.Tipos, DatosExcel.Mediciones, DatosExcel.Estados);

void Detalle(string nombre, int idTipo, int cant, decimal prom, decimal min, decimal max, decimal? pct,
             decimal? varProm, decimal? varRango, Resultado res)
{
    var d = dEx.Detalles.Single(x => x.Tipo.Id == idTipo);
    Igual($"{nombre}: cantidad", cant, d.Actual!.Cantidad);
    Igual($"{nombre}: promedio", prom, d.Actual!.Promedio);
    Igual($"{nombre}: mínimo", min, d.Actual!.Minimo);
    Igual($"{nombre}: máximo", max, d.Actual!.Maximo);
    Igual<decimal?>($"{nombre}: % en rango", pct, d.Actual!.PorcentajeEnRango);
    Igual<decimal?>($"{nombre}: variación del promedio", varProm, d.VariacionPromedio);
    Igual<decimal?>($"{nombre}: variación en rango (puntos)", varRango, d.VariacionEnRango);
    Igual($"{nombre}: resultado", res, d.Resultado);
}

Igual("5 tipos en el dashboard", 5, dEx.Detalles.Count);
Detalle("Glucosa",            1, 5, 120m,    95m,  150m, 80m,    -19m,   40m,  Resultado.Mejoro);
Detalle("Ritmo cardíaco",     2, 4, 101.25m, 90m,  112m, 50m,    6.25m, -25m,  Resultado.Empeoro);
Detalle("Presión sistólica",  3, 4, 120.5m,  117m, 125m, 50m,    -0.75m, 0m,   Resultado.Mejoro);       // desempate por distancia al centro
Detalle("Presión diastólica", 4, 4, 80.75m,  78m,  84m,  50m,    0m,     0m,   Resultado.SinCambios);
Igual<Estadistica?>("Temperatura: sin semana anterior", null, dEx.Detalles.Single(x => x.Tipo.Id == 5).Anterior);
Igual("Temperatura: resultado", Resultado.SinDatosPrevios, dEx.Detalles.Single(x => x.Tipo.Id == 5).Resultado);
Igual<decimal?>("Temperatura: % en rango (37,9 queda afuera)", 66.67m, dEx.Detalles.Single(x => x.Tipo.Id == 5).Actual!.PorcentajeEnRango);

Igual("Resumen: mejoraron", 2, dEx.Cantidad(Resultado.Mejoro));
Igual("Resumen: empeoraron", 1, dEx.Cantidad(Resultado.Empeoro));
Igual("Resumen: sin cambios", 1, dEx.Cantidad(Resultado.SinCambios));
Igual("Resumen: sin datos previos", 1, dEx.Cantidad(Resultado.SinDatosPrevios));

Igual("Ánimo: respuestas", 7, dEx.Animo.Cantidad);
Igual<decimal?>("Ánimo: promedio (Excel 3,1429)", 3.14m, dEx.Animo.Promedio);
Igual("Ánimo: resultado", Resultado.Mejoro, dEx.Animo.Resultado);
// El Excel muestra 0,4762 (sin redondear). Acá se calcula con los promedios YA guardados (3,14 - 2,67).
Igual<decimal?>("HALLAZGO ánimo: variación con valores guardados = 0,47 (el Excel sin redondear daría 0,48)", 0.47m, dEx.Animo.Variacion);

// =====================================================================
Seccion("7. Dashboard: contraste con los datos de prueba del SQL (Carlos)");
// =====================================================================
var tipos = DatosExcel.Tipos;
DateTime D(int m, int d, int h, int mi) => new(2026, m, d, h, mi, 0);
var medCarlos = new List<Medicion>
{
    new(2, 1, 110m, D(9, 5, 8, 0)),  new(2, 1, 165m, D(9, 12, 8, 0)), new(2, 1, 130m, D(9, 19, 8, 10)), new(2, 1, 95m, D(9, 26, 8, 0)),
    new(2, 2, 88m,  D(9, 5, 8, 5)),  new(2, 2, 104m, D(9, 12, 8, 5)), new(2, 2, 92m,  D(9, 19, 8, 15)),
    new(2, 3, 118m, D(9, 5, 8, 10)), new(2, 4, 78m,  D(9, 5, 8, 10)),
    new(2, 3, 126m, D(9, 12, 8, 10)),new(2, 4, 84m,  D(9, 12, 8, 10)),
    new(2, 3, 121m, D(9, 19, 8, 20)),new(2, 4, 82m,  D(9, 19, 8, 20)),
    new(2, 5, 36.6m, D(9, 20, 20, 0)),
    new(2, 1, 102m, D(10, 3, 8, 0)),
    new(2, 2, 90m,  D(10, 4, 8, 5)),
    new(2, 3, 119m, D(10, 4, 8, 10)), new(2, 4, 79m, D(10, 4, 8, 10)),
};
var estCarlos = new List<EstadoDiario>
{
    new(2, new(2026, 9, 5), 3), new(2, new(2026, 9, 12), 2), new(2, new(2026, 9, 19), 3), new(2, new(2026, 9, 26), 4),
    new(2, new(2026, 10, 2), 3), new(2, new(2026, 10, 3), 2), new(2, new(2026, 10, 4), 3),
};

var dSep = Dashboard.GenerarMensual(ancla, new DateOnly(2026, 9, 15), 2, tipos, medCarlos, estCarlos)!;
Igual("septiembre: período", sep, dSep.Periodo);
Igual("septiembre: sin período anterior", true, dSep.PeriodoAnterior is null);

void DetSep(int idTipo, int cant, decimal prom, decimal min, decimal max, decimal pct)
{
    var e = dSep.Detalles.Single(x => x.Tipo.Id == idTipo);
    Igual($"sep tipo {idTipo}: cantidad", cant, e.Actual!.Cantidad);
    Igual($"sep tipo {idTipo}: promedio", prom, e.Actual!.Promedio);
    Igual($"sep tipo {idTipo}: mínimo", min, e.Actual!.Minimo);
    Igual($"sep tipo {idTipo}: máximo", max, e.Actual!.Maximo);
    Igual<decimal?>($"sep tipo {idTipo}: % en rango", pct, e.Actual!.PorcentajeEnRango);
    Igual($"sep tipo {idTipo}: resultado", Resultado.SinDatosPrevios, e.Resultado);
}
DetSep(1, 4, 125m,    95m,   165m,  75m);
DetSep(2, 3, 94.67m,  88m,   104m,  66.67m);
DetSep(3, 3, 121.67m, 118m,  126m,  33.33m);
DetSep(4, 3, 81.33m,  78m,   84m,   33.33m);
DetSep(5, 1, 36.6m,   36.6m, 36.6m, 100m);
Igual("septiembre: días con estado de ánimo", 4, dSep.Animo.Cantidad);
Igual<decimal?>("septiembre: promedio de ánimo", 3.00m, dSep.Animo.Promedio);

var dOct = Dashboard.GenerarMensual(ancla, new DateOnly(2026, 10, 6), 2, tipos, medCarlos, estCarlos)!;
Igual("octubre: período anterior = septiembre", sep, dOct.PeriodoAnterior);
Igual("octubre: 5 tipos (4 con datos + temperatura que solo tuvo datos en septiembre)", 5, dOct.Detalles.Count);
Igual("octubre: glucosa mejoró (100% vs 75%)", Resultado.Mejoro, dOct.Detalles.Single(x => x.Tipo.Id == 1).Resultado);
Igual("octubre: ritmo mejoró (100% vs 66,67%)", Resultado.Mejoro, dOct.Detalles.Single(x => x.Tipo.Id == 2).Resultado);
Igual("octubre: temperatura 'Sin datos en el período'", Resultado.SinDatosEnElPeriodo, dOct.Detalles.Single(x => x.Tipo.Id == 5).Resultado);
Igual("octubre: ánimo empeoró (2,67 vs 3,00)", Resultado.Empeoro, dOct.Animo.Resultado);
Igual<decimal?>("octubre: variación de ánimo", -0.33m, dOct.Animo.Variacion);

var anteSeguimiento = Dashboard.GenerarMensual(ancla, new DateOnly(2026, 8, 20), 2, tipos, medCarlos, estCarlos);
Igual("fecha anterior al inicio del seguimiento: no hay dashboard", true, anteSeguimiento is null);

// =====================================================================
Seccion("8. Casos borde del dashboard");
// =====================================================================
var glucosa = tipos.Single(t => t.Id == 1);
var peso = new TipoMedicion(9, "Peso", "kg", null, null);
var rangoInvertido = new TipoMedicion(10, "Raro", "u", 100m, 50m);
Cierto("tipo sin rango: TieneRango = false", !peso.TieneRango);
Cierto("tipo con rango invertido: TieneRango = false", !rangoInvertido.TieneRango);

var pesos = new List<Medicion> { new(2, 9, 70m, D(9, 5, 8, 0)), new(2, 9, 72m, D(9, 6, 8, 0)), new(2, 9, 71m, D(10, 5, 8, 0)) };
var estSinRango = Dashboard.EstadisticaDeTipo(pesos, 2, peso, sep)!;
Igual<decimal?>("tipo sin rango: no hay % en rango", null, estSinRango.PorcentajeEnRango);
var estSinRangoOct = Dashboard.EstadisticaDeTipo(pesos, 2, peso, oct)!;
Igual("tipo sin rango: se marca 'Sin rango definido' (PROPUESTA)", Resultado.SinRangoDefinido,
    Dashboard.CompararTipo(peso, estSinRangoOct, estSinRango).Resultado);

var bordes = new List<Medicion>
{
    new(2, 1, 140m, D(9, 30, 23, 59)),   // último minuto del período: entra; 140 = tope del rango: cuenta como "en rango"
    new(2, 1, 70m,  D(9, 1, 0, 0)),      // primer minuto: entra; 70 = piso del rango: cuenta
    new(2, 1, 141m, D(10, 1, 0, 0)),     // ya es octubre: no entra
    new(1, 1, 999m, D(9, 15, 8, 0)),     // de otro usuario: no entra
    new(2, 2, 999m, D(9, 15, 8, 0)),     // de otro tipo: no entra
};
var eb = Dashboard.EstadisticaDeTipo(bordes, 2, glucosa, sep)!;
Igual("bordes: solo 2 mediciones entran", 2, eb.Cantidad);
Igual<decimal?>("bordes: los extremos del rango cuentan como 'en rango' (100%)", 100m, eb.PorcentajeEnRango);
Igual<Estadistica?>("sin mediciones en el período: null", null, Dashboard.EstadisticaDeTipo(bordes, 2, glucosa, new Periodo(new(2026, 11, 1), new(2026, 11, 30))));
Igual("sin estados de ánimo en el período", Resultado.SinDatosEnElPeriodo,
    Dashboard.ResumenDeAnimo(estCarlos, 2, new Periodo(new(2026, 11, 1), new(2026, 11, 30)), oct).Resultado);

return Resumen();
