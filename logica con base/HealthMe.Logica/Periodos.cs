namespace HealthMe.Logica;

/// <summary>
/// Períodos MENSUALES del dashboard, contados desde usuario.fecha_inicio_seguimiento ("ancla").
/// Regla: el período n arranca en ancla + n meses (siempre desde el ANCLA, no encadenado) y termina
/// el día anterior al inicio del siguiente. Así no hay huecos ni solapamientos aunque el ancla sea día 29, 30 o 31.
/// </summary>
public static class Periodos
{
    public static Periodo Numero(DateOnly ancla, int n)
    {
        if (n < 0) throw new ArgumentOutOfRangeException(nameof(n));
        return new Periodo(ancla.AddMonths(n), ancla.AddMonths(n + 1).AddDays(-1));
    }

    /// <summary>Período que contiene a la fecha (null si es anterior al inicio del seguimiento).</summary>
    public static Periodo? QueContiene(DateOnly ancla, DateOnly fecha)
    {
        if (fecha < ancla) return null;
        int n = (fecha.Year - ancla.Year) * 12 + (fecha.Month - ancla.Month);
        if (ancla.AddMonths(n) > fecha) n--;
        return Numero(ancla, n);
    }

    public static Periodo? Anterior(DateOnly ancla, Periodo actual) =>
        QueContiene(ancla, actual.Inicio.AddDays(-1));

    /// <summary>Un período se puede cerrar (generar su dashboard) cuando ya pasó su último día.</summary>
    public static bool EstaCerrado(Periodo p, DateOnly hoy) => hoy > p.Fin;
}
