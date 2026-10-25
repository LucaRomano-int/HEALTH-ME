namespace HealthMe.Logica;

public record Estadistica(int Cantidad, decimal Promedio, decimal Minimo, decimal Maximo, decimal? PorcentajeEnRango);

public record DetalleTipo(
    TipoMedicion Tipo, Estadistica? Actual, Estadistica? Anterior,
    decimal? VariacionPromedio, decimal? VariacionEnRango, Resultado Resultado);

public record ResumenAnimo(int Cantidad, decimal? Promedio, decimal? Variacion, Resultado Resultado);

public record DashboardCalculado(
    Periodo Periodo, Periodo? PeriodoAnterior, IReadOnlyList<DetalleTipo> Detalles, ResumenAnimo Animo)
{
    public int Cantidad(Resultado r) => Detalles.Count(d => d.Resultado == r);
}

public static class Dashboard
{
    // Redondeo a 2 decimales con las mitades hacia arriba (alejándose de cero).
    static decimal Redondear(decimal v) => decimal.Round(v, 2, MidpointRounding.AwayFromZero);

    // ---- Mediciones ----------------------------------------------------

    /// <summary>Cantidad, promedio, mínimo, máximo y % dentro del rango normal (inclusive) de un tipo en un período.</summary>
    public static Estadistica? EstadisticaDeTipo(IEnumerable<Medicion> mediciones, int idUsuario, TipoMedicion tipo, Periodo p) =>
        Calcular(mediciones.Where(m => m.IdUsuario == idUsuario && m.IdTipo == tipo.Id), tipo, p);

    /// <summary>Lo mismo, pero con el índice: solo se recorren las mediciones de ese usuario y ese tipo.</summary>
    public static Estadistica? EstadisticaDeTipo(IndiceMediciones indice, int idUsuario, TipoMedicion tipo, Periodo p) =>
        Calcular(indice.De(idUsuario, tipo.Id), tipo, p);

    // Núcleo común: recibe mediciones que YA son del usuario y del tipo; solo filtra por período.
    static Estadistica? Calcular(IEnumerable<Medicion> deEsteUsuarioYTipo, TipoMedicion tipo, Periodo p)
    {
        var valores = deEsteUsuarioYTipo
            .Where(m => p.Contiene(m.FechaHora))
            .Select(m => m.Valor)
            .ToList();

        if (valores.Count == 0) return null;

        decimal? pct = null;
        if (tipo.TieneRango)
        {
            int enRango = valores.Count(v => v >= tipo.RangoMin!.Value && v <= tipo.RangoMax!.Value);
            pct = Redondear(100m * enRango / valores.Count);
        }

        return new Estadistica(valores.Count, Redondear(valores.Average()), valores.Min(), valores.Max(), pct);
    }

    /// <summary>
    /// Criterio del Excel: más % en rango = Mejoró; menos = Empeoró; si empatan, gana el promedio
    /// más cercano al centro del rango. Las variaciones se calculan con los valores YA redondeados
    /// (los mismos que quedan guardados en el dashboard anterior).
    /// </summary>
    public static (decimal? VarPromedio, decimal? VarEnRango, Resultado Resultado) CompararTipo(
        TipoMedicion tipo, Estadistica? actual, Estadistica? anterior)
    {
        if (actual is null) return (null, null, Resultado.SinDatosEnElPeriodo);
        if (anterior is null) return (null, null, Resultado.SinDatosPrevios);

        decimal varPromedio = actual.Promedio - anterior.Promedio;

        if (!tipo.TieneRango || actual.PorcentajeEnRango is null || anterior.PorcentajeEnRango is null)
            return (varPromedio, null, Resultado.SinRangoDefinido);

        decimal varRango = actual.PorcentajeEnRango.Value - anterior.PorcentajeEnRango.Value;
        if (varRango > 0) return (varPromedio, varRango, Resultado.Mejoro);
        if (varRango < 0) return (varPromedio, varRango, Resultado.Empeoro);

        decimal centro = (tipo.RangoMin!.Value + tipo.RangoMax!.Value) / 2m;
        decimal distActual = Math.Abs(actual.Promedio - centro);
        decimal distAnterior = Math.Abs(anterior.Promedio - centro);

        var res = distActual < distAnterior ? Resultado.Mejoro
                : distActual > distAnterior ? Resultado.Empeoro
                : Resultado.SinCambios;
        return (varPromedio, varRango, res);
    }

    // ---- Estado de ánimo ----------------------------------------------

    static (int Cantidad, decimal? Promedio) AnimoDe(IEnumerable<EstadoDiario> estados, int idUsuario, Periodo p)
    {
        var valores = estados
            .Where(e => e.IdUsuario == idUsuario && p.Contiene(e.Fecha))
            .Select(e => (decimal)e.Valor)
            .ToList();
        return valores.Count == 0 ? (0, null) : (valores.Count, Redondear(valores.Average()));
    }

    public static ResumenAnimo ResumenDeAnimo(IEnumerable<EstadoDiario> estados, int idUsuario, Periodo actual, Periodo? anterior)
    {
        var lista = estados.ToList();
        var act = AnimoDe(lista, idUsuario, actual);
        if (act.Promedio is null) return new ResumenAnimo(0, null, null, Resultado.SinDatosEnElPeriodo);

        var ant = anterior is null ? (Cantidad: 0, Promedio: (decimal?)null) : AnimoDe(lista, idUsuario, anterior);
        if (ant.Promedio is null) return new ResumenAnimo(act.Cantidad, act.Promedio, null, Resultado.SinDatosPrevios);

        decimal variacion = act.Promedio.Value - ant.Promedio.Value;
        var res = variacion > 0 ? Resultado.Mejoro : variacion < 0 ? Resultado.Empeoro : Resultado.SinCambios;
        return new ResumenAnimo(act.Cantidad, act.Promedio, variacion, res);
    }

    // ---- Dashboard completo -------------------------------------------

    /// <summary>
    /// Arma el dashboard de un período. Incluye los tipos con datos en el período ACTUAL o en el ANTERIOR:
    /// si solo hubo datos antes, aparece como "Sin datos en el período" (si no, ese estado nunca se vería).
    /// </summary>
    public static DashboardCalculado Generar(
        Periodo periodo, Periodo? anterior, int idUsuario,
        IReadOnlyList<TipoMedicion> tipos, IReadOnlyList<Medicion> mediciones, IReadOnlyList<EstadoDiario> estados) =>
        GenerarCon(periodo, anterior, idUsuario, tipos, (t, p) => EstadisticaDeTipo(mediciones, idUsuario, t, p), estados);

    /// <summary>Igual que Generar, pero buscando las mediciones con el índice por (usuario, tipo).</summary>
    public static DashboardCalculado Generar(
        Periodo periodo, Periodo? anterior, int idUsuario,
        IReadOnlyList<TipoMedicion> tipos, IndiceMediciones indice, IReadOnlyList<EstadoDiario> estados) =>
        GenerarCon(periodo, anterior, idUsuario, tipos, (t, p) => EstadisticaDeTipo(indice, idUsuario, t, p), estados);

    static DashboardCalculado GenerarCon(
        Periodo periodo, Periodo? anterior, int idUsuario, IReadOnlyList<TipoMedicion> tipos,
        Func<TipoMedicion, Periodo, Estadistica?> estadistica, IReadOnlyList<EstadoDiario> estados)
    {
        var detalles = new List<DetalleTipo>();
        foreach (var tipo in tipos)
        {
            var act = estadistica(tipo, periodo);
            var ant = anterior is null ? null : estadistica(tipo, anterior);
            if (act is null && ant is null) continue;

            var (varProm, varRango, res) = CompararTipo(tipo, act, ant);
            detalles.Add(new DetalleTipo(tipo, act, ant, varProm, varRango, res));
        }

        return new DashboardCalculado(periodo, anterior, detalles, ResumenDeAnimo(estados, idUsuario, periodo, anterior));
    }

    /// <summary>Atajo mensual: calcula el período y el anterior a partir de la fecha de inicio del seguimiento.</summary>
    public static DashboardCalculado? GenerarMensual(
        DateOnly ancla, DateOnly fechaEnElPeriodo, int idUsuario,
        IReadOnlyList<TipoMedicion> tipos, IReadOnlyList<Medicion> mediciones, IReadOnlyList<EstadoDiario> estados)
    {
        var periodo = Periodos.QueContiene(ancla, fechaEnElPeriodo);
        if (periodo is null) return null;
        return Generar(periodo, Periodos.Anterior(ancla, periodo), idUsuario, tipos, mediciones, estados);
    }

    public static string Texto(Resultado r) => r switch
    {
        Resultado.Mejoro => "Mejoró",
        Resultado.Empeoro => "Empeoró",
        Resultado.SinCambios => "Sin cambios",
        Resultado.SinDatosPrevios => "Sin datos previos",
        Resultado.SinDatosEnElPeriodo => "Sin datos en el período",
        Resultado.SinRangoDefinido => "Sin rango definido",
        _ => throw new ArgumentOutOfRangeException(nameof(r))
    };
}
