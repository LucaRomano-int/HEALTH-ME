using System.Diagnostics;
using System.Text;
using static HealthMe.Logica.Runner;

namespace HealthMe.Logica;

/// <summary>
/// Pruebas de FNV-1a de 32 bits, de la tabla hash y de los índices (usuarios por correo, grupos por PIN,
/// mediciones por usuario y tipo, y pares que comparten grupo). Los valores de referencia de FNV-1a se calcularon con
/// una implementación independiente en Python y se confirmaron con la librería "fnvhash" de PyPI.
/// </summary>
public static class PruebasHash
{
    static void Info(string texto) => Console.WriteLine($"  info   {texto}");

    public static void Correr()
    {
        Proteger("9. FNV-1a", Fnv);
        Proteger("10. Tabla hash", Tabla);
        Proteger("11. Índice de usuarios", IndiceDeUsuarios);
        Proteger("12. Índice de grupos", IndiceDeGrupos);
        Proteger("13. Índice de mediciones", IndiceDeMediciones);
        Proteger("14. Índice de grupos compartidos", IndiceDeGrupoCompartido);
    }

    // =====================================================================
    static void Fnv()
    {
        Seccion("9. FNV-1a de 32 bits");
        // =====================================================================
        Igual("vector: texto vacío = offset basis", 0x811C9DC5u, Fnv1a.Hash32(""));
        Igual("constante OffsetBasis", 2166136261u, Fnv1a.OffsetBasis);
        Igual("constante Primo", 16777619u, Fnv1a.Primo);
        Igual("vector: \"a\"", 0xE40C292Cu, Fnv1a.Hash32("a"));
        Igual("vector: \"foobar\"", 0xBF9CF968u, Fnv1a.Hash32("foobar"));
        Igual("vector: correo normalizado", 0xAB8177F8u, Fnv1a.Hash32("carlos.gomez@example.com"));
        Igual("vector: PIN", 0x01EE5087u, Fnv1a.Hash32("GM4X7K"));
        Igual("vector: texto con tilde", 0x8CEA616Du, Fnv1a.Hash32("Familia Gómez"));
        Igual("\"ñ\" se hashea como sus 2 bytes UTF-8 (C3 B1)", 0x069DC2F9u, Fnv1a.Hash32("ñ"));
        Igual("\"ñ\" == bytes C3 B1", Fnv1a.Hash32(new byte[] { 0xC3, 0xB1 }), Fnv1a.Hash32("ñ"));

        Igual("entero 1 (4 bytes little-endian)", 4218009092u, Fnv1a.Hash32(1));
        Igual("entero 1 == bytes 01 00 00 00", Fnv1a.Hash32(new byte[] { 1, 0, 0, 0 }), Fnv1a.Hash32(1));
        Igual("entero -1 == bytes FF FF FF FF", Fnv1a.Hash32(new byte[] { 0xFF, 0xFF, 0xFF, 0xFF }), Fnv1a.Hash32(-1));
        Igual("entero 305419896", 2741278597u, Fnv1a.Hash32(305419896));
        Igual("par (1, 2)", 3738734694u, Fnv1a.Hash32(1, 2));
        Igual("par (2, 1)", 108523670u, Fnv1a.Hash32(2, 1));
        Cierto("el orden del par importa: (1,2) != (2,1)", Fnv1a.Hash32(1, 2) != Fnv1a.Hash32(2, 1));
        Cierto("sin ambigüedad: (1,23) != (12,3)", Fnv1a.Hash32(1, 23) != Fnv1a.Hash32(12, 3));
        Lanza<ArgumentNullException>("texto nulo lanza error", () => Fnv1a.Hash32((string)null!));

        // FNV-1a de 32 bits SÍ tiene colisiones: este par es real (encontrado recorriendo "usuarioN@example.com")
        const string a = "usuario20789@example.com", b = "usuario308490@example.com";
        Cierto("COLISIÓN REAL: dos correos distintos...", a != b);
        Igual("...con el mismo hash de 32 bits", Fnv1a.Hash32(a), Fnv1a.Hash32(b));
        Igual("...y ese hash es 0x96EC7534", 0x96EC7534u, Fnv1a.Hash32(a));
    }

    // =====================================================================
    static void Tabla()
    {
        Seccion("10. Tabla hash con encadenamiento");
        // =====================================================================
        var t = new TablaHash<string, int>(Hashes.Texto);
        Igual("tabla nueva vacía", 0, t.Count);
        t.Agregar("uno", 1);
        t.Agregar("dos", 2);
        Igual("2 elementos", 2, t.Count);
        Igual("valor de 'dos'", 2, t["dos"]);
        Cierto("contiene 'uno'", t.Contiene("uno"));
        Cierto("no contiene 'tres'", !t.Contiene("tres"));
        Cierto("TryGetValue de clave inexistente = false", !t.TryGetValue("tres", out _));
        Lanza<ArgumentException>("agregar una clave repetida lanza error", () => t.Agregar("uno", 99));
        Cierto("TryAgregar repetida devuelve false", !t.TryAgregar("uno", 99));
        Igual("TryAgregar repetida no pisa el valor", 1, t["uno"]);
        t.Establecer("uno", 100);
        Igual("Establecer reemplaza el valor", 100, t["uno"]);
        Igual("Establecer sobre existente no suma elementos", 2, t.Count);
        t.Establecer("tres", 3);
        Igual("Establecer sobre inexistente agrega", 3, t.Count);
        Lanza<KeyNotFoundException>("el indexador con clave inexistente lanza error", () => _ = t["nada"]);
        Lanza<ArgumentNullException>("clave nula al agregar lanza error", () => t.Agregar(null!, 1));
        Lanza<ArgumentNullException>("clave nula al consultar lanza error", () => t.Contiene(null!));
        Cierto("las claves distinguen mayúsculas (se normaliza ANTES de usar la tabla)", !t.Contiene("UNO"));

        Igual("recorrido: todas las claves una sola vez", "dos,tres,uno", string.Join(",", t.Claves.OrderBy(x => x, StringComparer.Ordinal)));
        Igual("recorrido: suma de valores", 105, t.Valores.Sum());
        Lanza<InvalidOperationException>("modificar la tabla mientras se recorre lanza error", () =>
        {
            foreach (var _ in t) t.Agregar("nueva" + t.Count, 0);
        });
        t.Limpiar();
        Igual("Limpiar deja la tabla vacía", 0, t.Count);

        // Baja en distintas posiciones de la cadena: hash constante = todas las claves en el mismo casillero
        var cadena = new TablaHash<string, int>(_ => 7u);
        foreach (var (k, i) in new[] { ("a", 1), ("b", 2), ("c", 3), ("d", 4) }) cadena.Agregar(k, i);
        Igual("hash constante: una sola cadena de 4", 4, cadena.LongitudMaximaDeCadena);
        Cierto("quitar la cabeza de la cadena", cadena.Quitar("d"));
        Cierto("quitar un nodo del medio", cadena.Quitar("b"));
        Cierto("quitar el último nodo", cadena.Quitar("a"));
        Cierto("quitar una clave inexistente = false", !cadena.Quitar("zzz"));
        Igual("queda 1 elemento", 1, cadena.Count);
        Igual("el que queda es 'c'", "c", string.Join(",", cadena.Claves));
        Cierto("las quitadas ya no están", !cadena.Contiene("a") && !cadena.Contiene("b") && !cadena.Contiene("d"));

        // Redimensionado
        var grande = new TablaHash<int, int>(Hashes.Entero, capacidadInicial: 4);
        for (int i = 0; i < 1000; i++) grande.Agregar(i, i * 10);
        Igual("1000 elementos", 1000, grande.Count);
        bool todos = Enumerable.Range(0, 1000).All(i => grande.TryGetValue(i, out var v) && v == i * 10);
        Cierto("tras redimensionar siguen todos los elementos", todos);
        Cierto("la capacidad es potencia de 2", (grande.Capacidad & (grande.Capacidad - 1)) == 0);
        Igual("capacidad final: 2048 (1000 <= 0,75 x 2048)", 2048, grande.Capacidad);
        Cierto("el factor de carga no supera 0,75", grande.FactorDeCarga <= 0.75);

        // Colisiones forzadas: la cadena crece pero todo sigue funcionando
        var colisionada = new TablaHash<string, int>(_ => 1u);
        for (int i = 0; i < 50; i++) colisionada.Agregar($"clave{i}", i);
        Igual("50 claves con el mismo hash: cadena de 50", 50, colisionada.LongitudMaximaDeCadena);
        Igual("ocupan un solo casillero", 1, colisionada.CasillerosOcupados);
        Cierto("todas se recuperan", Enumerable.Range(0, 50).All(i => colisionada[$"clave{i}"] == i));
        for (int i = 0; i < 50; i += 2) colisionada.Quitar($"clave{i}");
        Cierto("tras quitar las pares, las impares siguen", Enumerable.Range(0, 50).All(i => colisionada.Contiene($"clave{i}") == (i % 2 == 1)));

        // Colisión REAL de FNV-1a: se comparan las claves completas, no solo el hash
        var real = new TablaHash<string, string>(Hashes.Texto);
        real.Agregar("usuario20789@example.com", "primero");
        real.Agregar("usuario308490@example.com", "segundo");
        Igual("dos claves con el mismo hash conviven (2 elementos)", 2, real.Count);
        Igual("la primera devuelve su valor", "primero", real["usuario20789@example.com"]);
        Igual("la segunda devuelve su valor", "segundo", real["usuario308490@example.com"]);
        Igual("están en la misma cadena (largo 2)", 2, real.LongitudMaximaDeCadena);
        Cierto("quitar una no afecta a la otra", real.Quitar("usuario20789@example.com") && real["usuario308490@example.com"] == "segundo");

        // Qué tan bien reparte FNV-1a con claves reales
        var correos = new TablaHash<string, int>(Hashes.Texto);
        for (int i = 1; i <= 10_000; i++) correos.Agregar($"usuario{i}@example.com", i);
        double ocupados = (double)correos.CasillerosOcupados / correos.Capacidad;
        Info($"10.000 correos: capacidad {correos.Capacidad}, carga {correos.FactorDeCarga:F2}, casilleros ocupados {ocupados:P0}, cadena más larga {correos.LongitudMaximaDeCadena}");
        Igual("10.000 correos: todos presentes", 10_000, correos.Count);
        Cierto("10.000 correos: la cadena más larga es corta (<= 14)", correos.LongitudMaximaDeCadena <= 14);
        Cierto("10.000 correos: usa una buena parte de los casilleros (>= 40%)", ocupados >= 0.40);
    }

    // =====================================================================
    static void IndiceDeUsuarios()
    {
        Seccion("11. Índice de usuarios por correo (login y registro)");
        // =====================================================================
        var admin = new Usuario(1, "Admin", Nivel.Administrador, null, true, "admin@healthme.test");
        var carlos = new Usuario(2, "Carlos", Nivel.General, Rol.Afectado, true, "carlos.gomez@example.com");
        var marta = new Usuario(3, "Marta", Nivel.General, Rol.Acompanante, true, "marta.gomez@example.com");
        var baja = new Usuario(7, "Baja", Nivel.General, Rol.Afectado, false, "baja@example.com");
        var indice = IndiceUsuarios.Desde(new[] { admin, carlos, marta, baja });

        Igual("4 usuarios indexados", 4, indice.Cantidad);
        Igual("login: encuentra por correo exacto", carlos, indice.Buscar("carlos.gomez@example.com"));
        Igual("login: ignora mayúsculas y espacios", marta, indice.Buscar("  MARTA.Gomez@Example.COM "));
        Igual<Usuario?>("login: correo inexistente", null, indice.Buscar("nadie@example.com"));
        Igual<Usuario?>("login: correo nulo", null, indice.Buscar(null));
        Igual<Usuario?>("login: correo vacío", null, indice.Buscar("   "));
        Igual("tras el login: admin -> panel admin", Destino.PanelAdmin, Permisos.DestinoTrasLogin(indice.Buscar("admin@healthme.test")!));
        Igual("tras el login: usuario de baja -> no entra", Destino.Inactivo, Permisos.DestinoTrasLogin(indice.Buscar("baja@example.com")!));

        Cierto("registro: el correo ya existe", indice.ExisteEmail("CARLOS.GOMEZ@example.com"));
        Cierto("registro: correo libre", !indice.ExisteEmail("nuevo@example.com"));
        var duplicado = new Usuario(9, "Otro", Nivel.General, null, true, "Carlos.Gomez@EXAMPLE.com");
        Cierto("alta con correo repetido (distinto caso) rechazada", !indice.TryAgregar(duplicado, out var error));
        Igual<string?>("mensaje de error", "Ya existe un usuario con ese correo.", error);
        Cierto("alta sin correo rechazada", !indice.TryAgregar(new Usuario(10, "Sin correo", Nivel.General, null), out _));
        var nuevo = new Usuario(11, "Nuevo", Nivel.General, null, true, "nuevo@example.com");
        Cierto("alta de un correo libre aceptada", indice.TryAgregar(nuevo, out _));
        Igual("y queda buscable", nuevo, indice.Buscar("NUEVO@example.com"));
        Cierto("quitar un usuario", indice.Quitar("nuevo@example.com"));
        Igual<Usuario?>("ya no se encuentra", null, indice.Buscar("nuevo@example.com"));

        Lanza<InvalidDataException>("armar el índice con un correo repetido lanza error (el correo es único)", () =>
            IndiceUsuarios.Desde(new[] { carlos, carlos with { Id = 99 } }));
        Lanza<InvalidDataException>("armar el índice con un usuario sin correo lanza error", () =>
            IndiceUsuarios.Desde(new[] { new Usuario(5, "X", Nivel.General, null) }));

        var muchos = IndiceUsuarios.Desde(Enumerable.Range(1, 5000)
            .Select(i => new Usuario(i, $"U{i}", Nivel.General, Rol.Afectado, true, $"usuario{i}@example.com")));
        Cierto("5000 usuarios: todos se encuentran por su correo", Enumerable.Range(1, 5000).All(i => muchos.Buscar($"USUARIO{i}@example.com")?.Id == i));
    }

    // =====================================================================
    static void IndiceDeGrupos()
    {
        Seccion("12. Índice de grupos por PIN (unirse a un grupo)");
        // =====================================================================
        var gomez = new Grupo(1, "Familia Gómez", "GM4X7K", 3);
        var perez = new Grupo(2, "Familia Pérez", "PR9H2T", 5);
        var sinPin = new Grupo(3, "Sin PIN", null);
        var indice = IndiceGrupos.Desde(new[] { gomez, perez, sinPin });

        Igual("los grupos sin PIN se omiten", 2, indice.Cantidad);
        Igual<Grupo?>("PIN exacto", gomez, indice.BuscarPorPin("GM4X7K"));
        Igual<Grupo?>("PIN en minúsculas", gomez, indice.BuscarPorPin("gm4x7k"));
        Igual<Grupo?>("PIN con espacios y guion", perez, indice.BuscarPorPin(" pr9-h2t "));
        Igual<Grupo?>("PIN inexistente", null, indice.BuscarPorPin("ZZZZZZ"));
        Igual<Grupo?>("PIN demasiado corto", null, indice.BuscarPorPin("GM4X7"));
        Igual<Grupo?>("PIN con un carácter inválido (la O)", null, indice.BuscarPorPin("GM4X7O"));
        Igual<Grupo?>("PIN nulo", null, indice.BuscarPorPin(null));

        Cierto("alta de PIN repetido rechazada", !indice.TryAgregar(new Grupo(4, "Copia", "gm4-x7k"), out var e1));
        Igual<string?>("mensaje: PIN repetido", "Ya existe un grupo con ese PIN.", e1);
        Cierto("alta de PIN con formato inválido rechazada", !indice.TryAgregar(new Grupo(5, "Viejo", "GOM4821"), out _));
        Lanza<InvalidDataException>("armar el índice con un PIN inválido lanza error", () => IndiceGrupos.Desde(new[] { new Grupo(5, "Viejo", "GOM4821") }));
        Lanza<InvalidDataException>("armar el índice con PIN repetido lanza error", () => IndiceGrupos.Desde(new[] { gomez, gomez with { Id = 9 } }));

        // Generación de PIN sin repetir
        var ocupado = IndiceGrupos.Desde(new[] { new Grupo(1, "Ocupa AAAAAA", "AAAAAA") });
        int llamadas = 0;
        Func<int, int> guion = _ => llamadas++ < Pin.Largo ? 0 : 1;   // primer intento = AAAAAA (ocupado), segundo = BBBBBB
        Igual("PIN ocupado: reintenta y devuelve uno libre", "BBBBBB", ocupado.GenerarPinUnico(guion));
        Igual("hizo exactamente 2 intentos", 2 * Pin.Largo, llamadas);
        Lanza<InvalidOperationException>("si nunca consigue uno libre, lanza error", () => ocupado.GenerarPinUnico(_ => 0, maxIntentos: 20));

        var lleno = new IndiceGrupos();
        for (int i = 0; i < 200; i++)
            lleno.TryAgregar(new Grupo(i, $"G{i}", lleno.GenerarPinUnico()), out _);
        Igual("200 PIN generados con el generador criptográfico: todos distintos", 200, lleno.Cantidad);
    }

    // =====================================================================
    static string Resumen(DashboardCalculado d) =>
        string.Join(" | ", d.Detalles.Select(x =>
            $"{x.Tipo.Id}:{x.Actual?.Cantidad}/{x.Actual?.Promedio}/{x.Actual?.PorcentajeEnRango}~{x.Anterior?.Cantidad}/{x.Anterior?.PorcentajeEnRango}={x.Resultado}"))
        + $" || ánimo {d.Animo.Cantidad}/{d.Animo.Promedio}/{d.Animo.Variacion}/{d.Animo.Resultado}";

    static void IndiceDeMediciones()
    {
        Seccion("13. Índice de mediciones por (usuario, tipo) y dashboard");
        // =====================================================================
        var excel = DatosExcel.Mediciones;
        var indice = IndiceMediciones.Desde(excel);
        Igual("mismas mediciones que la lista", excel.Count, indice.Cantidad);

        bool mismosGrupos = true;
        foreach (var t in DatosExcel.Tipos)
            mismosGrupos &= indice.De(1, t.Id).SequenceEqual(excel.Where(m => m.IdUsuario == 1 && m.IdTipo == t.Id));
        Cierto("cada grupo (usuario 1, tipo) tiene las mismas mediciones y en el mismo orden que filtrando la lista", mismosGrupos);
        Igual("usuario inexistente: grupo vacío", 0, indice.De(99, 1).Count);
        Igual("tipo inexistente: grupo vacío", 0, indice.De(1, 99).Count);

        var semActual = new Periodo(new(2026, 9, 21), new(2026, 9, 27));
        var semAnterior = new Periodo(new(2026, 9, 14), new(2026, 9, 20));
        var porLista = Dashboard.Generar(semActual, semAnterior, 1, DatosExcel.Tipos, excel, DatosExcel.Estados);
        var porIndice = Dashboard.Generar(semActual, semAnterior, 1, DatosExcel.Tipos, indice, DatosExcel.Estados);
        Igual("dashboard del Excel: idéntico con índice y con lista", Resumen(porLista), Resumen(porIndice));
        Igual("dashboard del Excel con índice: glucosa mejoró", Resultado.Mejoro, porIndice.Detalles.Single(d => d.Tipo.Id == 1).Resultado);
        Igual("dashboard del Excel con índice: temperatura sin datos previos", Resultado.SinDatosPrevios, porIndice.Detalles.Single(d => d.Tipo.Id == 5).Resultado);

        // Escala: 200 usuarios x 5 tipos x 10 a 30 mediciones (miles de filas), datos deterministas
        var rnd = new Random(20261021);
        var medicionesGrandes = new List<Medicion>();
        var estadosGrandes = new List<EstadoDiario>();
        for (int u = 1; u <= 200; u++)
        {
            foreach (var t in DatosExcel.Tipos)
            {
                decimal centro = (t.RangoMin!.Value + t.RangoMax!.Value) / 2m, ancho = t.RangoMax!.Value - t.RangoMin!.Value;
                int n = rnd.Next(10, 31);
                for (int k = 0; k < n; k++)
                {
                    var fecha = new DateTime(2026, 9, 1).AddDays(rnd.Next(0, 61)).AddMinutes(rnd.Next(0, 1440));
                    var valor = Math.Round(centro + (decimal)(rnd.NextDouble() - 0.5) * ancho * 1.6m, 2);
                    medicionesGrandes.Add(new Medicion(u, t.Id, valor, fecha));
                }
            }
            for (int k = 0; k < 12; k++)
                estadosGrandes.Add(new EstadoDiario(u, new DateOnly(2026, 9, 1).AddDays(rnd.Next(0, 61)), rnd.Next(1, 5)));
        }
        var indiceGrande = IndiceMediciones.Desde(medicionesGrandes);
        var sep = new Periodo(new(2026, 9, 1), new(2026, 9, 30));
        var oct = new Periodo(new(2026, 10, 1), new(2026, 10, 31));
        Igual("escala: el índice tiene todas las mediciones", medicionesGrandes.Count, indiceGrande.Cantidad);

        int diferencias = 0;
        var cronoLista = Stopwatch.StartNew();
        var viaLista = new List<Estadistica?>();
        for (int u = 1; u <= 200; u++)
            foreach (var t in DatosExcel.Tipos)
                foreach (var p in new[] { sep, oct })
                    viaLista.Add(Dashboard.EstadisticaDeTipo(medicionesGrandes, u, t, p));
        cronoLista.Stop();

        var cronoIndice = Stopwatch.StartNew();
        var viaIndice = new List<Estadistica?>();
        for (int u = 1; u <= 200; u++)
            foreach (var t in DatosExcel.Tipos)
                foreach (var p in new[] { sep, oct })
                    viaIndice.Add(Dashboard.EstadisticaDeTipo(indiceGrande, u, t, p));
        cronoIndice.Stop();

        for (int i = 0; i < viaLista.Count; i++)
            if (!Equals(viaLista[i], viaIndice[i])) diferencias++;
        Igual($"escala: {viaLista.Count} estadísticas idénticas con lista e índice (diferencias)", 0, diferencias);
        Info($"{medicionesGrandes.Count} mediciones, {viaLista.Count} estadísticas: lista {cronoLista.ElapsedMilliseconds} ms, índice {cronoIndice.ElapsedMilliseconds} ms (solo informativo)");

        int diferenciasDashboard = 0;
        for (int u = 1; u <= 200; u += 7)
        {
            var a = Dashboard.Generar(oct, sep, u, DatosExcel.Tipos, medicionesGrandes, estadosGrandes);
            var b = Dashboard.Generar(oct, sep, u, DatosExcel.Tipos, indiceGrande, estadosGrandes);
            if (Resumen(a) != Resumen(b)) diferenciasDashboard++;
        }
        Igual("escala: 29 dashboards completos idénticos con lista e índice (diferencias)", 0, diferenciasDashboard);
    }

    // =====================================================================
    static (List<Usuario> Usuarios, List<MiembroGrupo> Miembros) EscenarioAleatorio(int semilla)
    {
        var rnd = new Random(semilla);
        var usuarios = Enumerable.Range(1, 60).Select(id =>
        {
            var nivel = rnd.Next(10) == 0 ? Nivel.Administrador : Nivel.General;
            Rol? rol = nivel == Nivel.Administrador ? null : rnd.Next(3) switch { 0 => null, 1 => Rol.Afectado, _ => Rol.Acompanante };
            return new Usuario(id, $"U{id}", nivel, rol, rnd.Next(10) != 0);
        }).ToList();

        var miembros = new List<MiembroGrupo>();
        for (int g = 1; g <= 40; g++)
            foreach (var id in Enumerable.Range(1, 60).OrderBy(_ => rnd.Next()).Take(rnd.Next(3, 9)))
            {
                bool aprobado = rnd.Next(4) != 0;
                miembros.Add(new MiembroGrupo(g, id, aprobado));
                if (rnd.Next(12) == 0) miembros.Add(new MiembroGrupo(g, id, aprobado));   // fila repetida a propósito
            }
        return (usuarios, miembros);
    }

    static void IndiceDeGrupoCompartido()
    {
        Seccion("14. Índice de pares que comparten grupo (permisos)");
        // =====================================================================
        var carlos = new Usuario(2, "Carlos", Nivel.General, Rol.Afectado);
        var marta = new Usuario(3, "Marta", Nivel.General, Rol.Acompanante);
        var julia = new Usuario(4, "Julia", Nivel.General, Rol.Afectado);
        var lucia = new Usuario(5, "Lucía", Nivel.General, Rol.Acompanante);
        var baja = new Usuario(7, "Baja", Nivel.General, Rol.Afectado, Activo: false);
        var todos = new[] { carlos, marta, julia, lucia, baja };

        var miembros = new List<MiembroGrupo>
        {
            new(1, 3), new(1, 2), new(1, 5, Aprobado: false), new(1, 7),
            new(2, 5), new(2, 4),
            new(2, 4),   // fila repetida
        };
        var indice = IndiceGrupoCompartido.Desde(miembros);

        Igual("pares: (2,3), (2,7), (3,7) del grupo 1 y (4,5) del grupo 2", 4, indice.Pares);
        Cierto("Marta y Carlos comparten grupo", indice.Comparten(3, 2));
        Cierto("el orden no importa: Carlos y Marta", indice.Comparten(2, 3));
        Cierto("Lucía (ingreso pendiente) no comparte grupo 1 con Carlos", !indice.Comparten(5, 2));
        Cierto("Marta y Julia no comparten grupo", !indice.Comparten(3, 4));
        Cierto("nadie comparte grupo consigo mismo", !indice.Comparten(2, 2));
        Cierto("usuario inexistente", !indice.Comparten(2, 999));

        Cierto("Permisos con índice: Marta ve a Carlos", Permisos.PuedeVerDatosDeSalud(marta, carlos, indice));
        Cierto("Permisos con índice: Lucía no ve a Carlos (pendiente)", !Permisos.PuedeVerDatosDeSalud(lucia, carlos, indice));
        Cierto("Permisos con índice: Lucía ve a Julia", Permisos.PuedeVerDatosDeSalud(lucia, julia, indice));
        Cierto("Permisos con índice: Marta no ve al usuario de baja", !Permisos.PuedeVerDatosDeSalud(marta, baja, indice));
        Cierto("Permisos con índice: Carlos ve sus propios datos", Permisos.PuedeVerDatosDeSalud(carlos, carlos, indice));

        int distintos = 0, pares = 0;
        foreach (var s in todos) foreach (var o in todos)
        {
            pares++;
            if (Permisos.PuedeVerDatosDeSalud(s, o, miembros) != Permisos.PuedeVerDatosDeSalud(s, o, indice)) distintos++;
        }
        Igual($"los {pares} pares de este caso dan lo mismo con lista e índice (diferencias)", 0, distintos);

        // Propiedad con escenarios aleatorios: 5 semillas x 60 usuarios x 60 usuarios
        int totalPares = 0, discrepancias = 0, permitidos = 0;
        foreach (int semilla in new[] { 1, 2, 3, 20261021, 777 })
        {
            var (usuarios, miembrosAleatorios) = EscenarioAleatorio(semilla);
            var idx = IndiceGrupoCompartido.Desde(miembrosAleatorios);
            foreach (var s in usuarios) foreach (var o in usuarios)
            {
                totalPares++;
                bool porLista = Permisos.PuedeVerDatosDeSalud(s, o, miembrosAleatorios);
                bool porIndice = Permisos.PuedeVerDatosDeSalud(s, o, idx);
                if (porLista != porIndice) discrepancias++;
                if (porLista && s.Id != o.Id) permitidos++;
            }
        }
        Info($"{totalPares} pares aleatorios evaluados; {permitidos} permitidos entre usuarios distintos");
        Igual($"{totalPares} pares aleatorios: lista e índice coinciden (diferencias)", 0, discrepancias);
        Cierto("el escenario aleatorio es significativo (hay pares permitidos)", permitidos > 100);
    }
}
