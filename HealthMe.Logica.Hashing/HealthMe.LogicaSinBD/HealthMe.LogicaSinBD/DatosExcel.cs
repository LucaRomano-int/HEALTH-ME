// ARCHIVO GENERADO a partir de HEALTH_ME_Dashboard_Semanal.xlsx (hojas Tipo_Medicion, Medicion y Estado_Diario).
// Son los datos de ejemplo del Excel; se usan para comprobar que el cálculo en C# da lo mismo que la hoja Dashboard_Calculo.
namespace HealthMe.Logica;

public static class DatosExcel
{
    public static readonly IReadOnlyList<TipoMedicion> Tipos = new List<TipoMedicion>
    {
        new(1, "Glucosa", "mg/dL", 70m, 140m),
        new(2, "Ritmo cardíaco", "lpm", 60m, 100m),
        new(3, "Presión sistólica", "mmHg", 90m, 120m),
        new(4, "Presión diastólica", "mmHg", 60m, 80m),
        new(5, "Temperatura", "°C", 36m, 37.5m),
    };

    public static readonly IReadOnlyList<Medicion> Mediciones = new List<Medicion>
    {
        new(1, 1, 110m, new DateTime(2026, 9, 14, 8, 10, 0)),
        new(1, 1, 165m, new DateTime(2026, 9, 15, 8, 5, 0)),
        new(1, 1, 150m, new DateTime(2026, 9, 17, 8, 0, 0)),
        new(1, 1, 98m, new DateTime(2026, 9, 18, 20, 30, 0)),
        new(1, 1, 172m, new DateTime(2026, 9, 20, 23, 30, 0)),
        new(1, 1, 105m, new DateTime(2026, 9, 21, 8, 0, 0)),
        new(1, 1, 118m, new DateTime(2026, 9, 22, 8, 15, 0)),
        new(1, 1, 132m, new DateTime(2026, 9, 24, 8, 5, 0)),
        new(1, 1, 150m, new DateTime(2026, 9, 25, 20, 0, 0)),
        new(1, 1, 95m, new DateTime(2026, 9, 27, 9, 0, 0)),
        new(1, 2, 88m, new DateTime(2026, 9, 14, 9, 0, 0)),
        new(1, 2, 96m, new DateTime(2026, 9, 16, 9, 10, 0)),
        new(1, 2, 104m, new DateTime(2026, 9, 18, 9, 5, 0)),
        new(1, 2, 92m, new DateTime(2026, 9, 20, 9, 0, 0)),
        new(1, 2, 90m, new DateTime(2026, 9, 21, 9, 0, 0)),
        new(1, 2, 108m, new DateTime(2026, 9, 23, 9, 20, 0)),
        new(1, 2, 112m, new DateTime(2026, 9, 25, 9, 0, 0)),
        new(1, 2, 95m, new DateTime(2026, 9, 27, 9, 10, 0)),
        new(1, 3, 118m, new DateTime(2026, 9, 14, 8, 30, 0)),
        new(1, 3, 126m, new DateTime(2026, 9, 16, 8, 30, 0)),
        new(1, 3, 122m, new DateTime(2026, 9, 18, 8, 30, 0)),
        new(1, 3, 119m, new DateTime(2026, 9, 20, 8, 30, 0)),
        new(1, 3, 117m, new DateTime(2026, 9, 21, 8, 30, 0)),
        new(1, 3, 121m, new DateTime(2026, 9, 23, 8, 30, 0)),
        new(1, 3, 125m, new DateTime(2026, 9, 25, 8, 30, 0)),
        new(1, 3, 119m, new DateTime(2026, 9, 27, 8, 30, 0)),
        new(1, 4, 78m, new DateTime(2026, 9, 14, 8, 30, 0)),
        new(1, 4, 84m, new DateTime(2026, 9, 16, 8, 30, 0)),
        new(1, 4, 82m, new DateTime(2026, 9, 18, 8, 30, 0)),
        new(1, 4, 79m, new DateTime(2026, 9, 20, 8, 30, 0)),
        new(1, 4, 79m, new DateTime(2026, 9, 21, 8, 30, 0)),
        new(1, 4, 84m, new DateTime(2026, 9, 23, 8, 30, 0)),
        new(1, 4, 82m, new DateTime(2026, 9, 25, 8, 30, 0)),
        new(1, 4, 78m, new DateTime(2026, 9, 27, 8, 30, 0)),
        new(1, 5, 36.6m, new DateTime(2026, 9, 22, 21, 0, 0)),
        new(1, 5, 36.8m, new DateTime(2026, 9, 24, 21, 10, 0)),
        new(1, 5, 37.9m, new DateTime(2026, 9, 26, 21, 5, 0)),
    };

    public static readonly IReadOnlyList<EstadoDiario> Estados = new List<EstadoDiario>
    {
        new(1, new DateOnly(2026, 9, 14), 3),
        new(1, new DateOnly(2026, 9, 15), 2),
        new(1, new DateOnly(2026, 9, 16), 3),
        new(1, new DateOnly(2026, 9, 17), 2),
        new(1, new DateOnly(2026, 9, 18), 3),
        new(1, new DateOnly(2026, 9, 19), 3),
        new(1, new DateOnly(2026, 9, 21), 3),
        new(1, new DateOnly(2026, 9, 22), 3),
        new(1, new DateOnly(2026, 9, 23), 4),
        new(1, new DateOnly(2026, 9, 24), 3),
        new(1, new DateOnly(2026, 9, 25), 2),
        new(1, new DateOnly(2026, 9, 26), 3),
        new(1, new DateOnly(2026, 9, 27), 4),
    };
}
