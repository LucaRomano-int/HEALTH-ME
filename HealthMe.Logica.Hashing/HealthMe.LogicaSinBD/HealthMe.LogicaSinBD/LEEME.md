# HEALTH ME - Lógica aislada en C# (sin base de datos)

Reglas del negocio escritas como funciones puras, más FNV-1a de 32 bits con una tabla hash propia y los índices que
la usan. No hay base de datos, ni interfaz, ni paquetes externos: corre sin internet.

## Cómo correrlo
    dotnet run

Necesita el SDK de .NET 8 o superior (si tenés uno más nuevo, cambiá `net8.0` en el `.csproj`; está puesto
`RollForward=Major`). Ejecuta 328 pruebas y termina con el resumen. Si alguna falla, el programa termina con código 1.

## Archivos
| Archivo | Qué contiene |
|---|---|
| Modelos.cs | Los datos que necesitan las reglas (usuario, medición, recordatorio, grupo...) |
| Validaciones.cs | Registro, DNI, mediciones, caritas y PIN de grupo |
| Permisos.cs | Redirección tras el login y quién ve o carga qué |
| Inventario.cs | Descuento de stock, alerta de stock bajo, días restantes |
| Recordatorios.cs | Próxima ocurrencia y avisos de eventos |
| Periodos.cs | Períodos mensuales del dashboard |
| Dashboard.cs | Cálculo del dashboard (estadísticas, comparación contra el período anterior, estado de ánimo) |
| **Fnv1a.cs** | **FNV-1a de 32 bits (texto, entero y par de enteros)** |
| **TablaHash.cs** | **Tabla hash con encadenamiento, función de hash inyectable y redimensionado** |
| **Indices.cs** | **Usuarios por correo, grupos por PIN, mediciones por (usuario, tipo) y pares que comparten grupo** |
| DatosExcel.cs | Datos de ejemplo del Excel del dashboard (archivo generado) |
| Runner.cs | Mini framework de pruebas |
| Program.cs / PruebasHash.cs | Las pruebas |

## Sobre FNV-1a
Es un hash NO criptográfico: acá solo reparte claves en la tabla hash. Las contraseñas no pasan por él (en la web
se guardan con `password_hash` de PHP / bcrypt). Las pruebas incluyen vectores de referencia verificados con una
implementación independiente y una colisión real entre dos correos distintos.
