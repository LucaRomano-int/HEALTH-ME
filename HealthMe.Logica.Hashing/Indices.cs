namespace HealthMe.Logica;

// Índices en memoria construidos sobre TablaHash + FNV-1a de 32 bits.
// Cada uno reemplaza un recorrido lineal de una lista por una búsqueda directa por clave.

// =====================================================================
// 1. Usuarios por correo  (login y chequeo de duplicados en el registro)
// =====================================================================

/// <summary>
/// Clave: correo normalizado (sin espacios y en minúsculas). No puede haber dos usuarios con el mismo correo.
/// OJO: este índice solo ubica al usuario; la clave se verifica aparte (en PHP con password_verify).
/// </summary>
public sealed class IndiceUsuarios
{
    readonly TablaHash<string, Usuario> _porEmail = new(Hashes.Texto);

    public int Cantidad => _porEmail.Count;

    public bool TryAgregar(Usuario usuario, out string? error)
    {
        if (string.IsNullOrWhiteSpace(usuario.Email))
        {
            error = "El usuario no tiene correo.";
            return false;
        }
        if (!_porEmail.TryAgregar(Validaciones.NormalizarEmail(usuario.Email), usuario))
        {
            error = "Ya existe un usuario con ese correo.";
            return false;
        }
        error = null;
        return true;
    }

    public Usuario? Buscar(string? email) =>
        string.IsNullOrWhiteSpace(email) ? null
        : _porEmail.TryGetValue(Validaciones.NormalizarEmail(email), out var u) ? u : null;

    /// <summary>Para el registro: ¿ya hay alguien con este correo?</summary>
    public bool ExisteEmail(string? email) => Buscar(email) is not null;

    public bool Quitar(string email) => _porEmail.Quitar(Validaciones.NormalizarEmail(email));

    /// <summary>Arma el índice desde una lista. Un correo repetido o faltante lanza error.</summary>
    public static IndiceUsuarios Desde(IEnumerable<Usuario> usuarios)
    {
        var indice = new IndiceUsuarios();
        foreach (var u in usuarios)
            if (!indice.TryAgregar(u, out var error))
                throw new InvalidDataException($"Usuario {u.Id}: {error}");
        return indice;
    }
}

// =====================================================================
// 2. Grupos por PIN  (unirse a un grupo)
// =====================================================================

public sealed class IndiceGrupos
{
    readonly TablaHash<string, Grupo> _porPin = new(Hashes.Texto);

    public int Cantidad => _porPin.Count;

    public bool TryAgregar(Grupo grupo, out string? error)
    {
        if (!Pin.EsValido(grupo.Pin))
        {
            error = $"El PIN '{grupo.Pin}' no tiene el formato válido ({Pin.Largo} caracteres del alfabeto permitido).";
            return false;
        }
        if (!_porPin.TryAgregar(Pin.Normalizar(grupo.Pin), grupo))
        {
            error = "Ya existe un grupo con ese PIN.";
            return false;
        }
        error = null;
        return true;
    }

    /// <summary>Acepta minúsculas, espacios y guiones ("gm4-x7k"). Un PIN con formato inválido nunca encuentra nada.</summary>
    public Grupo? BuscarPorPin(string? pin) =>
        Pin.EsValido(pin) && _porPin.TryGetValue(Pin.Normalizar(pin), out var g) ? g : null;

    public bool PinEnUso(string pin) => BuscarPorPin(pin) is not null;

    /// <summary>Genera un PIN que no esté en uso. Si no lo logra en maxIntentos (tabla casi llena o RNG roto), lanza error.</summary>
    public string GenerarPinUnico(Func<int, int>? aleatorio = null, int maxIntentos = 100)
    {
        for (int i = 0; i < maxIntentos; i++)
        {
            var pin = Pin.Generar(aleatorio);
            if (!PinEnUso(pin)) return pin;
        }
        throw new InvalidOperationException($"No se pudo generar un PIN libre en {maxIntentos} intentos.");
    }

    /// <summary>Arma el índice. Los grupos sin PIN (NULL) se omiten porque nadie puede unirse a ellos; un PIN inválido o repetido lanza error.</summary>
    public static IndiceGrupos Desde(IEnumerable<Grupo> grupos)
    {
        var indice = new IndiceGrupos();
        foreach (var g in grupos.Where(g => g.Pin is not null))
            if (!indice.TryAgregar(g, out var error))
                throw new InvalidDataException($"Grupo {g.Id}: {error}");
        return indice;
    }
}

// =====================================================================
// 3. Mediciones por (usuario, tipo)  (dashboard)
// =====================================================================

/// <summary>
/// Agrupa las mediciones por (id_usuario, id_tipo). El dashboard pide "las mediciones de ESTE usuario y ESTE tipo":
/// con el índice se recorre solo ese grupo en vez de la lista completa de todos los usuarios.
/// </summary>
public sealed class IndiceMediciones
{
    readonly TablaHash<(int, int), List<Medicion>> _grupos = new(Hashes.ParEnteros);

    public int Cantidad { get; private set; }

    public void Agregar(Medicion medicion)
    {
        var clave = (medicion.IdUsuario, medicion.IdTipo);
        if (!_grupos.TryGetValue(clave, out var lista))
        {
            lista = new List<Medicion>();
            _grupos.Agregar(clave, lista);
        }
        lista.Add(medicion);
        Cantidad++;
    }

    /// <summary>Las mediciones de ese usuario y tipo, en el orden en que se agregaron (vacío si no hay).</summary>
    public IReadOnlyList<Medicion> De(int idUsuario, int idTipo) =>
        _grupos.TryGetValue((idUsuario, idTipo), out var lista) ? lista : Array.Empty<Medicion>();

    public static IndiceMediciones Desde(IEnumerable<Medicion> mediciones)
    {
        var indice = new IndiceMediciones();
        foreach (var m in mediciones) indice.Agregar(m);
        return indice;
    }
}

// =====================================================================
// 4. Pares de usuarios que comparten un grupo aprobado  (permisos de visualización)
// =====================================================================

/// <summary>
/// Conjunto de pares {a, b} de usuarios que son miembros APROBADOS de un mismo grupo. Responde "¿comparten grupo?" en
/// un solo acceso, en vez de recorrer la lista de miembros en cada consulta de permisos. El par se guarda ordenado
/// (menor, mayor), así {3, 2} y {2, 3} son la misma entrada. Las reglas de rol y de actividad siguen en Permisos.
/// </summary>
public sealed class IndiceGrupoCompartido
{
    readonly TablaHash<(int, int), bool> _pares = new(Hashes.ParEnteros);

    public int Pares => _pares.Count;

    static (int, int) Par(int a, int b) => a <= b ? (a, b) : (b, a);

    public bool Comparten(int idA, int idB) => idA != idB && _pares.Contiene(Par(idA, idB));

    /// <summary>Por cada grupo se agregan todos los pares de sus miembros aprobados (los grupos familiares son chicos).</summary>
    public static IndiceGrupoCompartido Desde(IEnumerable<MiembroGrupo> miembros)
    {
        var porGrupo = new TablaHash<int, List<int>>(Hashes.Entero);
        foreach (var m in miembros.Where(m => m.Aprobado))
        {
            if (!porGrupo.TryGetValue(m.IdGrupo, out var ids))
            {
                ids = new List<int>();
                porGrupo.Agregar(m.IdGrupo, ids);
            }
            if (!ids.Contains(m.IdUsuario)) ids.Add(m.IdUsuario);
        }

        var indice = new IndiceGrupoCompartido();
        foreach (var ids in porGrupo.Valores)
            for (int i = 0; i < ids.Count; i++)
                for (int j = i + 1; j < ids.Count; j++)
                    indice._pares.Establecer(Par(ids[i], ids[j]), true);
        return indice;
    }
}
