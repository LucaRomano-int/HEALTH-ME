using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace HealthMe.Logica;

public record Validacion(bool Ok, IReadOnlyList<string> Errores)
{
    public static Validacion Desde(List<string> errores) =>
        errores.Count == 0 ? new(true, Array.Empty<string>()) : new(false, errores);
}

public static class Validaciones
{
    static readonly Regex EmailRx = new(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", RegexOptions.Compiled);
    static readonly Regex SoloDigitosPuntos = new(@"^[\d.\s]+$", RegexOptions.Compiled);

    // ---- Registro ------------------------------------------------------

    /// <summary>Registro público: nombre, correo y clave (el resto se completa luego).</summary>
    public static Validacion ValidarRegistro(string? nombre, string? email, string? clave, string? confirmacion)
    {
        var e = new List<string>();

        var n = (nombre ?? "").Trim();
        if (n.Length < 2 || n.Length > 60)
            e.Add("El nombre debe tener entre 2 y 60 caracteres.");

        var m = (email ?? "").Trim();
        if (m.Length > 120 || !EmailRx.IsMatch(m))
            e.Add("El correo electrónico no es válido.");

        var c = clave ?? "";
        if (c.Length < 8)
            e.Add("La clave debe tener al menos 8 caracteres.");
        if (!c.Any(char.IsLetter) || !c.Any(char.IsDigit))
            e.Add("La clave debe combinar letras y números.");

        // bcrypt solo mira los primeros 72 BYTES: más largo se trunca en silencio.
        // En PHP hay que medirlo con strlen() (bytes), no con mb_strlen().
        if (Encoding.UTF8.GetByteCount(c) > 72)
            e.Add("La clave no puede superar los 72 bytes.");

        if (c != confirmacion)
            e.Add("Las claves no coinciden.");

        return Validacion.Desde(e);
    }

    /// <summary>El correo se guarda sin espacios y en minúsculas, así no hay duplicados disfrazados.</summary>
    public static string NormalizarEmail(string email) => email.Trim().ToLowerInvariant();

    // ---- DNI -----------------------------------------------------------

    /// <summary>
    /// Devuelve el DNI solo con dígitos ("47.165.087" -> "47165087"), o null si no es válido.
    /// La columna usuario.dni es UNIQUE: si se guarda con puntos, "47.165.087" y "47165087"
    /// serían dos DNI distintos para MySQL.
    /// </summary>
    public static string? NormalizarDni(string? dni)
    {
        if (string.IsNullOrWhiteSpace(dni) || !SoloDigitosPuntos.IsMatch(dni)) return null;
        var d = new string(dni.Where(char.IsDigit).ToArray());
        return d.Length is >= 7 and <= 8 ? d : null;
    }

    // ---- Datos de salud ------------------------------------------------

    public static Validacion ValidarMedicion(decimal valor, DateTime fechaHora, DateTime ahora)
    {
        var e = new List<string>();
        if (valor <= 0) e.Add("El valor debe ser mayor que cero.");
        if (valor > 99999.99m) e.Add("El valor es demasiado grande.");
        if (decimal.Round(valor, 2) != valor) e.Add("El valor admite hasta 2 decimales.");
        if (fechaHora > ahora.AddMinutes(5)) e.Add("La fecha y hora no pueden estar en el futuro.");
        return Validacion.Desde(e);
    }

    // ---- Formulario de caritas ----------------------------------------

    public static bool EstadoValido(int valor) => valor is >= 1 and <= 4;

    public static string EtiquetaEstado(int valor) => valor switch
    {
        1 => "Muy mal",
        2 => "Mal",
        3 => "Bien",
        4 => "Muy bien",
        _ => throw new ArgumentOutOfRangeException(nameof(valor), "El estado va de 1 a 4.")
    };

    public static string EmojiEstado(int valor) => valor switch
    {
        1 => "😖",
        2 => "🙁",
        3 => "🙂",
        4 => "😀",
        _ => throw new ArgumentOutOfRangeException(nameof(valor), "El estado va de 1 a 4.")
    };
}

/// <summary>PIN de grupo familiar. Da acceso a datos de salud: se genera con un RNG criptográfico.</summary>
public static class Pin
{
    // Sin O, I, L, 0 ni 1 para que no se confundan al dictarlo o copiarlo.
    public const string Alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    public const int Largo = 6;

    public static string Generar(Func<int, int>? aleatorio = null)
    {
        aleatorio ??= RandomNumberGenerator.GetInt32;   // exclusivo: [0, n)
        var sb = new StringBuilder(Largo);
        for (int i = 0; i < Largo; i++) sb.Append(Alfabeto[aleatorio(Alfabeto.Length)]);
        return sb.ToString();
    }

    public static string Normalizar(string? texto) =>
        (texto ?? "").Trim().ToUpperInvariant().Replace(" ", "").Replace("-", "");

    public static bool EsValido(string? texto)
    {
        var p = Normalizar(texto);
        return p.Length == Largo && p.All(c => Alfabeto.Contains(c));
    }
}
