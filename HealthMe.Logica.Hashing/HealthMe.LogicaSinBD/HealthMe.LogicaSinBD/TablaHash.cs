using System.Collections;

namespace HealthMe.Logica;

/// <summary>
/// Tabla hash propia con ENCADENAMIENTO (cada casillero guarda una lista enlazada de nodos).
///  - La función de hash se inyecta (acá se usa FNV-1a de 32 bits).
///  - La cantidad de casilleros es siempre potencia de 2, así el índice es "hash &amp; (capacidad - 1)".
///  - Cuando el factor de carga (elementos / casilleros) supera el máximo, se duplica la capacidad y se redistribuyen
///    los nodos usando el hash que cada uno ya guarda (no se recalcula).
///  - Dos claves distintas pueden tener el mismo hash (colisión): por eso SIEMPRE se compara la clave completa.
/// </summary>
public sealed class TablaHash<TClave, TValor> : IEnumerable<KeyValuePair<TClave, TValor>> where TClave : notnull
{
    const int CapacidadMaxima = 1 << 30;

    sealed class Nodo
    {
        public readonly TClave Clave;
        public readonly uint Hash;
        public TValor Valor;
        public Nodo? Siguiente;

        public Nodo(TClave clave, uint hash, TValor valor, Nodo? siguiente)
        {
            Clave = clave; Hash = hash; Valor = valor; Siguiente = siguiente;
        }
    }

    readonly Func<TClave, uint> _funcionHash;
    readonly IEqualityComparer<TClave> _igualdad;
    readonly double _factorCargaMaximo;
    Nodo?[] _casilleros;
    int _cantidad;
    int _version;   // cambia con cada alta o baja: permite detectar modificaciones durante un recorrido

    public TablaHash(Func<TClave, uint> funcionHash, int capacidadInicial = 16,
                     double factorCargaMaximo = 0.75, IEqualityComparer<TClave>? comparador = null)
    {
        ArgumentNullException.ThrowIfNull(funcionHash);
        if (factorCargaMaximo <= 0) throw new ArgumentOutOfRangeException(nameof(factorCargaMaximo));
        if (capacidadInicial < 0 || capacidadInicial > CapacidadMaxima) throw new ArgumentOutOfRangeException(nameof(capacidadInicial));

        _funcionHash = funcionHash;
        _igualdad = comparador ?? EqualityComparer<TClave>.Default;
        _factorCargaMaximo = factorCargaMaximo;
        _casilleros = new Nodo?[PotenciaDeDosMayorOIgual(Math.Max(capacidadInicial, 2))];
    }

    static int PotenciaDeDosMayorOIgual(int n)
    {
        int p = 2;
        while (p < n) p <<= 1;
        return p;
    }

    // ---- consulta -------------------------------------------------------

    public int Count => _cantidad;
    public int Capacidad => _casilleros.Length;
    public double FactorDeCarga => (double)_cantidad / _casilleros.Length;

    public bool TryGetValue(TClave clave, out TValor valor)
    {
        ArgumentNullException.ThrowIfNull(clave);
        var nodo = Buscar(clave, _funcionHash(clave));
        if (nodo is null) { valor = default!; return false; }
        valor = nodo.Valor;
        return true;
    }

    public bool Contiene(TClave clave)
    {
        ArgumentNullException.ThrowIfNull(clave);
        return Buscar(clave, _funcionHash(clave)) is not null;
    }

    public TValor this[TClave clave]
    {
        get => TryGetValue(clave, out var v) ? v : throw new KeyNotFoundException($"No existe la clave '{clave}'.");
        set => Establecer(clave, value);
    }

    // ---- alta, modificación y baja -------------------------------------

    /// <summary>Agrega la clave; si ya existe lanza ArgumentException.</summary>
    public void Agregar(TClave clave, TValor valor)
    {
        if (!TryAgregar(clave, valor))
            throw new ArgumentException($"Ya existe la clave '{clave}'.", nameof(clave));
    }

    /// <summary>Agrega la clave si no existía. Devuelve false (sin cambiar nada) si ya estaba.</summary>
    public bool TryAgregar(TClave clave, TValor valor)
    {
        ArgumentNullException.ThrowIfNull(clave);
        uint hash = _funcionHash(clave);
        if (Buscar(clave, hash) is not null) return false;
        Insertar(clave, hash, valor);
        return true;
    }

    /// <summary>Agrega la clave o, si ya existía, reemplaza su valor.</summary>
    public void Establecer(TClave clave, TValor valor)
    {
        ArgumentNullException.ThrowIfNull(clave);
        uint hash = _funcionHash(clave);
        var existente = Buscar(clave, hash);
        if (existente is not null) existente.Valor = valor;
        else Insertar(clave, hash, valor);
    }

    public bool Quitar(TClave clave)
    {
        ArgumentNullException.ThrowIfNull(clave);
        uint hash = _funcionHash(clave);
        int indice = Indice(hash, _casilleros.Length);

        Nodo? anterior = null;
        for (var n = _casilleros[indice]; n is not null; anterior = n, n = n.Siguiente)
        {
            if (n.Hash != hash || !_igualdad.Equals(n.Clave, clave)) continue;

            if (anterior is null) _casilleros[indice] = n.Siguiente;   // era la cabeza de la cadena
            else anterior.Siguiente = n.Siguiente;                     // estaba en el medio o al final
            _cantidad--;
            _version++;
            return true;
        }
        return false;
    }

    public void Limpiar()
    {
        Array.Clear(_casilleros);
        _cantidad = 0;
        _version++;
    }

    // ---- recorrido -------------------------------------------------------

    public IEnumerable<TClave> Claves => this.Select(par => par.Key);
    public IEnumerable<TValor> Valores => this.Select(par => par.Value);

    public IEnumerator<KeyValuePair<TClave, TValor>> GetEnumerator()
    {
        int versionAlEmpezar = _version;
        foreach (var cabeza in _casilleros)
            for (var n = cabeza; n is not null; n = n.Siguiente)
            {
                if (versionAlEmpezar != _version)
                    throw new InvalidOperationException("La tabla se modificó mientras se la recorría.");
                yield return new KeyValuePair<TClave, TValor>(n.Clave, n.Valor);
            }
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    // ---- estadísticas (para ver qué tan bien reparte la función de hash) --

    public int CasillerosOcupados => _casilleros.Count(c => c is not null);

    public int LongitudMaximaDeCadena
    {
        get
        {
            int max = 0;
            foreach (var cabeza in _casilleros)
            {
                int largo = 0;
                for (var n = cabeza; n is not null; n = n.Siguiente) largo++;
                if (largo > max) max = largo;
            }
            return max;
        }
    }

    // ---- internos ----------------------------------------------------------

    static int Indice(uint hash, int capacidad) => (int)(hash & (uint)(capacidad - 1));

    Nodo? Buscar(TClave clave, uint hash)
    {
        for (var n = _casilleros[Indice(hash, _casilleros.Length)]; n is not null; n = n.Siguiente)
            if (n.Hash == hash && _igualdad.Equals(n.Clave, clave)) return n;   // se compara el hash (rápido) y después la clave completa
        return null;
    }

    void Insertar(TClave clave, uint hash, TValor valor)
    {
        if (_cantidad + 1 > _casilleros.Length * _factorCargaMaximo && _casilleros.Length < CapacidadMaxima)
            Redimensionar();

        int indice = Indice(hash, _casilleros.Length);
        _casilleros[indice] = new Nodo(clave, hash, valor, _casilleros[indice]);   // se inserta al principio de la cadena
        _cantidad++;
        _version++;
    }

    void Redimensionar()
    {
        var nuevos = new Nodo?[_casilleros.Length * 2];
        foreach (var cabeza in _casilleros)
        {
            var n = cabeza;
            while (n is not null)
            {
                var siguiente = n.Siguiente;                  // se guarda antes de reenganchar el nodo
                int indice = Indice(n.Hash, nuevos.Length);   // se reutiliza el hash guardado
                n.Siguiente = nuevos[indice];
                nuevos[indice] = n;
                n = siguiente;
            }
        }
        _casilleros = nuevos;
    }
}
