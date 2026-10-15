namespace HealthMe.Logica;

// Modelos mínimos: espejo de las tablas del script SQL, sin base de datos.
// La idea es probar las REGLAS de forma aislada; después se portan a PHP.

public enum Nivel { Administrador, General }
public enum Rol { Afectado, Acompanante }
public enum TipoRecordatorio { Evento, Horario }
public enum Repeticion { Ninguna, Diaria, Semanal }

/// <summary>A dónde se redirige al usuario después del login (puntos 6, 7 y 8 del parcial).</summary>
public enum Destino { Inactivo, PanelAdmin, PanelGeneral, ElegirRol }

/// <summary>Resultado de comparar un período contra el anterior en el dashboard.</summary>
public enum Resultado
{
    Mejoro,
    Empeoro,
    SinCambios,
    SinDatosPrevios,
    SinDatosEnElPeriodo,
    SinRangoDefinido   // PROPUESTA NUEVA: tipo de medición sin rango normal cargado
}

public record Usuario(int Id, string Nombre, Nivel Nivel, Rol? Rol, bool Activo = true);

public record TipoMedicion(int Id, string Nombre, string Unidad, decimal? RangoMin, decimal? RangoMax)
{
    public bool TieneRango => RangoMin.HasValue && RangoMax.HasValue && RangoMin <= RangoMax;
}

public record Medicion(int IdUsuario, int IdTipo, decimal Valor, DateTime FechaHora);

public record EstadoDiario(int IdUsuario, DateOnly Fecha, int Valor);

public record Medicamento(int Id, int IdUsuario, string Nombre, int CantidadActual, int UmbralAlerta);

public record Recordatorio(
    int Id, int IdUsuario, int? IdMedicamento, TipoRecordatorio Tipo, string Titulo,
    DateTime FechaHora, Repeticion Repeticion, int DosisUnidades = 1, bool Activo = true);

/// <summary>
/// Pertenencia a un grupo. "Aprobado" es una PROPUESTA nueva (no existe hoy en miembro_grupo):
/// quien se une con el PIN queda pendiente hasta que alguien del grupo lo apruebe.
/// </summary>
public record MiembroGrupo(int IdGrupo, int IdUsuario, bool Aprobado = true);

public record Periodo(DateOnly Inicio, DateOnly Fin)
{
    public bool Contiene(DateOnly f) => f >= Inicio && f <= Fin;
    public bool Contiene(DateTime f) => Contiene(DateOnly.FromDateTime(f));
}
