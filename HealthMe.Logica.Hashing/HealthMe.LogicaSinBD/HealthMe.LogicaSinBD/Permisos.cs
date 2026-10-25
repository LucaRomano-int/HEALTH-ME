namespace HealthMe.Logica;

public static class Permisos
{
    /// <summary>Punto 6 del parcial: según el tipo de usuario, a dónde va después del login.</summary>
    public static Destino DestinoTrasLogin(Usuario u)
    {
        if (!u.Activo) return Destino.Inactivo;                 // baja lógica: no entra
        if (u.Nivel == Nivel.Administrador) return Destino.PanelAdmin;
        return u.Rol is null ? Destino.ElegirRol : Destino.PanelGeneral;
    }

    /// <summary>ABM de usuarios, catálogos y consultas de contacto: solo el administrador.</summary>
    public static bool PuedeGestionarUsuarios(Usuario u) =>
        u.Activo && u.Nivel == Nivel.Administrador;

    /// <summary>Cargar datos propios (mediciones, estado, inventario, bitácora): solo el afectado, y solo los suyos.</summary>
    public static bool PuedeCargarDatos(Usuario solicitante, int idDuenioDelDato) =>
        solicitante.Activo
        && solicitante.Nivel == Nivel.General
        && solicitante.Rol == Rol.Afectado
        && solicitante.Id == idDuenioDelDato;

    /// <summary>
    /// Ver datos de salud de un afectado:
    ///  - el propio afectado ve los suyos;
    ///  - un acompañante ve los de los afectados con los que comparte un grupo (aprobado);
    ///  - el administrador NO ve datos de salud (gestiona cuentas, no historias clínicas).
    /// Versión que recorre la lista de miembros en cada consulta.
    /// </summary>
    public static bool PuedeVerDatosDeSalud(Usuario solicitante, Usuario objetivo, IEnumerable<MiembroGrupo> miembros)
    {
        var lista = miembros.ToList();
        return PuedeVer(solicitante, objetivo, (idSolicitante, idObjetivo) =>
        {
            var gruposDelSolicitante = lista
                .Where(m => m.IdUsuario == idSolicitante && m.Aprobado)
                .Select(m => m.IdGrupo)
                .ToHashSet();
            return lista.Any(m => m.IdUsuario == idObjetivo && m.Aprobado && gruposDelSolicitante.Contains(m.IdGrupo));
        });
    }

    /// <summary>Misma regla, pero "¿comparten grupo?" se responde con un acceso al índice (tabla hash) en vez de recorrer la lista.</summary>
    public static bool PuedeVerDatosDeSalud(Usuario solicitante, Usuario objetivo, IndiceGrupoCompartido indice) =>
        PuedeVer(solicitante, objetivo, indice.Comparten);

    // Las precondiciones viven UNA sola vez: las dos versiones públicas solo se diferencian en cómo buscan el grupo en común.
    static bool PuedeVer(Usuario solicitante, Usuario objetivo, Func<int, int, bool> comparteGrupoAprobado)
    {
        if (!solicitante.Activo || !objetivo.Activo) return false;
        if (solicitante.Nivel != Nivel.General) return false;
        if (objetivo.Rol != Rol.Afectado) return false;
        if (solicitante.Id == objetivo.Id) return true;
        if (solicitante.Rol != Rol.Acompanante) return false;
        return comparteGrupoAprobado(solicitante.Id, objetivo.Id);
    }
}
