using System.Globalization;

namespace HealthMe.Logica;

public static class Recordatorios
{
    /// <summary>Próxima vez que suena/avisa el recordatorio, a partir de "ahora" (null si ya no hay más).</summary>
    public static DateTime? ProximaOcurrencia(Recordatorio r, DateTime ahora)
    {
        if (!r.Activo) return null;
        if (ahora <= r.FechaHora) return r.FechaHora;
        if (r.Repeticion == Repeticion.Ninguna) return null;

        var paso = TimeSpan.FromDays(r.Repeticion == Repeticion.Diaria ? 1 : 7);
        long n = ((ahora - r.FechaHora).Ticks + paso.Ticks - 1) / paso.Ticks;   // división hacia arriba
        return r.FechaHora.AddTicks(n * paso.Ticks);
    }

    /// <summary>
    /// Avisos de eventos (turno médico). diasAnticipacion = 2 -> avisa 2 días antes, 1 día antes y el mismo día.
    /// Devuelve null si hoy no toca avisar (o si el evento de hoy ya pasó).
    /// </summary>
    public static string? MensajeAviso(string titulo, DateTime fechaEvento, DateTime ahora, int diasAnticipacion)
    {
        int dias = (fechaEvento.Date - ahora.Date).Days;
        if (dias < 0 || dias > diasAnticipacion) return null;
        if (dias == 0 && fechaEvento < ahora) return null;

        return dias switch
        {
            0 => $"Hoy tienes {titulo} a las {fechaEvento.ToString("HH:mm", CultureInfo.InvariantCulture)}. ¡No lo olvides!",
            1 => $"Mañana tienes {titulo}. ¡No lo olvides!",
            _ => $"En {dias} días tienes {titulo}. ¡No lo olvides!"
        };
    }
}
