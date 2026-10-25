using System.Text;

namespace HealthMe.Logica;

/// <summary>
/// FNV-1a de 32 bits. Es un hash NO criptográfico: sirve para repartir claves en una tabla hash
/// o sacar huellas rápidas, no para proteger secretos (fabricar dos textos con el mismo hash es trivial).
///
/// Algoritmo (variante "1a": primero XOR, después multiplicación):
///     hash = 2166136261                      (offset basis)
///     por cada byte:  hash = hash XOR byte;  hash = hash * 16777619   (módulo 2^32)
/// </summary>
public static class Fnv1a
{
    public const uint OffsetBasis = 2166136261;
    public const uint Primo = 16777619;

    public static uint Hash32(ReadOnlySpan<byte> bytes)
    {
        unchecked   // la multiplicación tiene que desbordar: eso ES el módulo 2^32
        {
            uint hash = OffsetBasis;
            foreach (byte b in bytes)
            {
                hash ^= b;
                hash *= Primo;
            }
            return hash;
        }
    }

    /// <summary>Hash de los bytes UTF-8 del texto. Normalizar ANTES (correo en minúsculas, PIN en mayúsculas).</summary>
    public static uint Hash32(string texto)
    {
        ArgumentNullException.ThrowIfNull(texto);
        return Hash32(Encoding.UTF8.GetBytes(texto));
    }

    /// <summary>Hash de un entero de 4 bytes, siempre en orden little-endian (da lo mismo en cualquier máquina).</summary>
    public static uint Hash32(int n)
    {
        Span<byte> bytes = stackalloc byte[4];
        Escribir(bytes, n);
        return Hash32(bytes);
    }

    /// <summary>
    /// Hash de un par de enteros (8 bytes). Como cada entero ocupa siempre 4 bytes, no hay ambigüedad:
    /// (1, 23) y (12, 3) dan resultados distintos, y (1, 2) es distinto de (2, 1).
    /// </summary>
    public static uint Hash32(int a, int b)
    {
        Span<byte> bytes = stackalloc byte[8];
        Escribir(bytes[..4], a);
        Escribir(bytes[4..], b);
        return Hash32(bytes);
    }

    static void Escribir(Span<byte> destino, int n)
    {
        destino[0] = (byte)n;
        destino[1] = (byte)(n >> 8);
        destino[2] = (byte)(n >> 16);
        destino[3] = (byte)(n >> 24);
    }
}

/// <summary>Funciones de hash listas para pasarle a <see cref="TablaHash{TClave, TValor}"/>.</summary>
public static class Hashes
{
    public static uint Texto(string clave) => Fnv1a.Hash32(clave);
    public static uint Entero(int clave) => Fnv1a.Hash32(clave);
    public static uint ParEnteros((int, int) clave) => Fnv1a.Hash32(clave.Item1, clave.Item2);
}
