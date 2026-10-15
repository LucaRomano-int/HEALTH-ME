using System.Globalization;

namespace HealthMe.Logica;

/// <summary>
/// Traduce filas de health_me_db a los modelos de la lógica. Es la única parte que conoce los
/// nombres de columna reales ("id", "umbral_alerta_stock_bajo", "rol_dentro_grupo"...).
/// Los lectores son tolerantes con el tipo (long, sbyte, decimal, DateTime, string) porque cada
/// driver devuelve cosas distintas, pero ESTRICTOS con los valores: un texto desconocido en
/// una columna de estado lanza un error claro en vez de convertirse en un valor por defecto.
/// </summary>
public static class Mapeo
{
    // ---- lectores de valores -------------------------------------------

    static object Requerido(IReadOnlyDictionary<string, object?> f, string col) =>
        f.TryGetValue(col, out var v) && v is not null
            ? v
            : throw new InvalidDataException($"La columna '{col}' no existe en la fila o es NULL.");

    static object? Opcional(IReadOnlyDictionary<string, object?> f, string col) =>
        f.TryGetValue(col, out var v) ? v : null;

    public static int Entero(object o) => checked(Convert.ToInt32(o, CultureInfo.InvariantCulture));

    public static decimal Numero(object o) =>
        o is decimal d ? d : Convert.ToDecimal(o, CultureInfo.InvariantCulture);

    public static bool Booleano(object o) => o switch
    {
        bool b => b,
        string s => s != "0" && !s.Equals("false", StringComparison.OrdinalIgnoreCase),
        _ => Convert.ToInt64(o, CultureInfo.InvariantCulture) != 0   // tinyint(1)
    };

    public static DateTime FechaHora(object o) => o switch
    {
        DateTime dt => dt,
        DateOnly d => d.ToDateTime(TimeOnly.MinValue),
        string s => DateTime.Parse(s, CultureInfo.InvariantCulture),
        _ => throw new InvalidDataException($"No se puede leer una fecha y hora de {o.GetType().Name}.")
    };

    public static DateOnly Fecha(object o) => o switch
    {
        DateOnly d => d,
        DateTime dt => DateOnly.FromDateTime(dt),
        string s => DateOnly.Parse(s.Length > 10 ? s[..10] : s, CultureInfo.InvariantCulture),
        _ => throw new InvalidDataException($"No se puede leer una fecha de {o.GetType().Name}.")
    };

    // ---- enums ----------------------------------------------------------

    // 'acompañante' (con ñ, como está en la base) y 'acompanante' se tratan igual.
    static string Normalizar(object? o) =>
        (Convert.ToString(o, CultureInfo.InvariantCulture) ?? "").Trim().ToLowerInvariant().Replace('ñ', 'n');

    public static Nivel ANivel(object? o) => Normalizar(o) switch
    {
        "administrador" => Nivel.Administrador,
        "general" => Nivel.General,
        _ => throw new InvalidDataException($"Valor de 'nivel' desconocido: '{o}'.")
    };

    /// <summary>NULL o vacío = todavía no eligió rol (y el administrador nunca tiene rol).</summary>
    public static Rol? ARol(object? o) => Normalizar(o) switch
    {
        "" => null,
        "afectado" => Rol.Afectado,
        "acompanante" => Rol.Acompanante,
        _ => throw new InvalidDataException($"Valor de 'rol' desconocido: '{o}'.")
    };

    public static TipoRecordatorio ATipoRecordatorio(object? o) => Normalizar(o) switch
    {
        "evento" => TipoRecordatorio.Evento,
        "horario" => TipoRecordatorio.Horario,
        _ => throw new InvalidDataException($"Valor de 'tipo' de recordatorio desconocido: '{o}'.")
    };

    /// <summary>NULL o vacío = no se repite (así venía la columna antes de la migración).</summary>
    public static Repeticion ARepeticion(object? o) => Normalizar(o) switch
    {
        "" or "ninguna" => Repeticion.Ninguna,
        "diaria" => Repeticion.Diaria,
        "semanal" => Repeticion.Semanal,
        _ => throw new InvalidDataException($"Valor de 'repeticion' desconocido: '{o}'.")
    };

    // ---- filas -> modelos -----------------------------------------------

    public static Usuario DesdeUsuario(IReadOnlyDictionary<string, object?> f) => new(
        Entero(Requerido(f, "id")),
        Convert.ToString(Requerido(f, "nombre"), CultureInfo.InvariantCulture)!,
        ANivel(Requerido(f, "nivel")),
        ARol(Opcional(f, "rol")),
        Booleano(Requerido(f, "activo")));

    public static TipoMedicion DesdeTipoMedicion(IReadOnlyDictionary<string, object?> f)
    {
        var min = Opcional(f, "rango_normal_min");
        var max = Opcional(f, "rango_normal_max");
        return new(
            Entero(Requerido(f, "id")),
            Convert.ToString(Requerido(f, "nombre"), CultureInfo.InvariantCulture)!,
            Convert.ToString(Opcional(f, "unidad"), CultureInfo.InvariantCulture) ?? "",   // la columna admite NULL
            min is null ? null : Numero(min),
            max is null ? null : Numero(max));
    }

    /// <summary>Ignora valor2: la presión se carga como dos tipos (sistólica y diastólica).</summary>
    public static Medicion DesdeMedicion(IReadOnlyDictionary<string, object?> f) => new(
        Entero(Requerido(f, "id_usuario")),
        Entero(Requerido(f, "id_tipo")),
        Numero(Requerido(f, "valor")),
        FechaHora(Requerido(f, "fecha_hora")));

    public static EstadoDiario DesdeEstadoDiario(IReadOnlyDictionary<string, object?> f) => new(
        Entero(Requerido(f, "id_usuario")),
        Fecha(Requerido(f, "fecha")),
        Entero(Requerido(f, "valor")));

    public static Medicamento DesdeMedicamento(IReadOnlyDictionary<string, object?> f) => new(
        Entero(Requerido(f, "id")),
        Entero(Requerido(f, "id_usuario")),
        Convert.ToString(Requerido(f, "nombre"), CultureInfo.InvariantCulture)!,
        Entero(Requerido(f, "cantidad_actual")),
        Entero(Requerido(f, "umbral_alerta_stock_bajo")));

    public static Recordatorio DesdeRecordatorio(IReadOnlyDictionary<string, object?> f)
    {
        var idMed = Opcional(f, "id_medicamento");
        var dosis = Opcional(f, "dosis_unidades");
        return new(
            Entero(Requerido(f, "id")),
            Entero(Requerido(f, "id_usuario")),
            idMed is null ? null : Entero(idMed),
            ATipoRecordatorio(Requerido(f, "tipo")),
            Convert.ToString(Requerido(f, "titulo"), CultureInfo.InvariantCulture)!,
            FechaHora(Requerido(f, "fecha_hora")),
            ARepeticion(Opcional(f, "repeticion")),
            dosis is null ? 1 : Entero(dosis),
            Booleano(Requerido(f, "activo")));
    }

    /// <summary>Si la columna "aprobado" todavía no existe, se asume aprobado (comportamiento previo).</summary>
    public static MiembroGrupo DesdeMiembroGrupo(IReadOnlyDictionary<string, object?> f)
    {
        var aprobado = Opcional(f, "aprobado");
        return new(
            Entero(Requerido(f, "id_grupo")),
            Entero(Requerido(f, "id_usuario")),
            aprobado is null || Booleano(aprobado));
    }
}
