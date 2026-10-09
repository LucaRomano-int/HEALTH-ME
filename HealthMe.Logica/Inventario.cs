namespace HealthMe.Logica;

public record ResultadoDescuento(int CantidadNueva, int UnidadesDescontadas, bool StockInsuficiente, bool StockBajo);

public static class Inventario
{
    /// <summary>Regla: alerta cuando el stock llega al umbral o por debajo (<=).</summary>
    public static bool EstaBajoUmbral(int cantidad, int umbral) => cantidad <= umbral;

    /// <summary>
    /// Descuenta las unidades de una toma. El stock nunca queda negativo:
    /// si no alcanza, queda en 0 y se avisa (la toma igual se marca como cumplida).
    /// OJO en SQL: cantidad_actual es UNSIGNED, así que "cantidad_actual - 1" con stock 0 da ERROR.
    /// Hay que usar GREATEST(cantidad_actual - ?, 0).
    /// </summary>
    public static ResultadoDescuento Descontar(Medicamento m, int unidades)
    {
        if (unidades <= 0) throw new ArgumentOutOfRangeException(nameof(unidades), "Las unidades deben ser positivas.");
        int descontadas = Math.Min(unidades, m.CantidadActual);
        int nueva = m.CantidadActual - descontadas;
        return new ResultadoDescuento(nueva, descontadas, descontadas < unidades, EstaBajoUmbral(nueva, m.UmbralAlerta));
    }

    /// <summary>
    /// Días que dura el stock según los recordatorios activos de ese medicamento.
    /// Diaria = dosis por día; semanal = dosis/7. Sin recordatorios repetitivos devuelve null.
    /// </summary>
    public static int? DiasRestantes(Medicamento m, IEnumerable<Recordatorio> recordatorios)
    {
        // Se cuenta el consumo por SEMANA con enteros (diaria = dosis x 7, semanal = dosis).
        // Dividir por 1/7 da 69,999... en vez de 70 por el redondeo, y al truncar se pierde un día.
        long consumoSemanal = recordatorios
            .Where(r => r.Activo && r.IdMedicamento == m.Id && r.IdUsuario == m.IdUsuario)
            .Sum(r => r.Repeticion switch
            {
                Repeticion.Diaria => 7L * r.DosisUnidades,
                Repeticion.Semanal => (long)r.DosisUnidades,
                _ => 0L
            });

        if (consumoSemanal == 0) return null;
        return (int)(m.CantidadActual * 7L / consumoSemanal);   // división entera = redondeo hacia abajo
    }
}
