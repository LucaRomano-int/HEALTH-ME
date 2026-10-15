# HEALTH ME - Lógica aislada en C# + base de datos

Funciones puras (sin interfaz) para validar las reglas del negocio, contrastadas contra la base `health_me_db`
del equipo. Después se portan a PHP.

## Cómo correrlo
    dotnet run

Necesita el SDK de .NET 8 o superior (si tenés uno más nuevo, cambiá `net8.0` en el `.csproj`; está puesto
`RollForward=Major`). No usa paquetes externos.
Corre dos tandas: las reglas aisladas (secciones 1 a 8) y, si existe `datos/datos_bd.json`, las pruebas contra la
base (secciones 9 a 12). Se puede pasar otra ruta:  `dotnet run -- ruta/al/archivo.json`

## Cómo dejar la base lista (XAMPP / phpMyAdmin)
1. Importar `health_me_db.sql` (el volcado original del equipo) en una base vacía llamada `health_me_db`.
2. Importar `bd/02_migracion_logica.sql` (UNA sola vez; está explicado cada cambio).
3. Importar `bd/03_datos_prueba.sql` (usuarios, grupos, mediciones... de ejemplo).
4. `bd/04_consultas.sql` son las consultas que usa la lógica; se pueden correr una por una para probarlas.
Todo con juego de caracteres UTF-8. Este flujo reemplaza al `healthme_schema.sql` anterior.

## Regenerar los datos de la prueba de integración
    pip install pymysql
    python tools/exportar_datos.py datos/datos_bd.json
Se conecta como XAMPP (127.0.0.1, root, sin clave); se cambia con HM_HOST, HM_PORT, HM_USER, HM_PASS.

## Archivos
| Archivo | Qué contiene |
|---|---|
| Modelos.cs | Espejo mínimo de las tablas |
| Mapeo.cs | Traduce filas de la base (nombres de columna y valores reales) al modelo |
| Validaciones.cs | Registro, DNI, mediciones, caritas y PIN de grupo |
| Permisos.cs | Redirección tras el login y quién ve o carga qué |
| Inventario.cs | Descuento de stock, alerta de stock bajo, días restantes |
| Recordatorios.cs | Próxima ocurrencia y avisos de eventos |
| Periodos.cs | Períodos mensuales del dashboard |
| Dashboard.cs | Cálculo del dashboard |
| DatosExcel.cs | Datos del Excel del dashboard (generado) |
| Program.cs / PruebasBD.cs | Las pruebas |
| bd/ | Migración, datos de prueba y consultas SQL |
