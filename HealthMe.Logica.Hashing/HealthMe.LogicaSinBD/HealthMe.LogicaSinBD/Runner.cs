namespace HealthMe.Logica;

/// <summary>Mini framework de pruebas (sin paquetes externos, así corre sin internet).</summary>
public static class Runner
{
    static int _ok, _falla;

    public static void Seccion(string titulo) => Console.WriteLine($"\n== {titulo} ==");

    public static void Ok(string nombre) { _ok++; Console.WriteLine($"  OK     {nombre}"); }

    public static void Falla(string nombre, string detalle)
    {
        _falla++;
        Console.WriteLine($"  FALLA  {nombre}  ->  {detalle}");
    }

    public static void Igual<T>(string nombre, T esperado, T actual)
    {
        if (EqualityComparer<T>.Default.Equals(esperado, actual)) Ok(nombre);
        else Falla(nombre, $"esperado <{esperado}> pero fue <{actual}>");
    }

    public static void Cierto(string nombre, bool condicion) => Igual(nombre, true, condicion);

    public static void Lanza<TEx>(string nombre, Action accion) where TEx : Exception
    {
        try { accion(); }
        catch (TEx) { Ok(nombre); return; }
        catch (Exception ex) { Falla(nombre, $"lanzó {ex.GetType().Name} en vez de {typeof(TEx).Name}"); return; }
        Falla(nombre, $"no lanzó {typeof(TEx).Name}");
    }

    /// <summary>Si una sección se cae con una excepción inesperada, se registra como falla y las demás secciones siguen corriendo.</summary>
    public static void Proteger(string nombre, Action seccion)
    {
        try { seccion(); }
        catch (Exception ex) { Falla($"{nombre}: la sección se interrumpió", $"{ex.GetType().Name}: {ex.Message}"); }
    }

    public static int Resumen()
    {
        Console.WriteLine($"\n==================================\n  {_ok} OK   |   {_falla} FALLAS\n==================================");
        return _falla == 0 ? 0 : 1;
    }
}
