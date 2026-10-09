# HEALTH ME - Lógica aislada en C# (prototipo de reglas)

Funciones puras, sin base de datos ni interfaz, para validar las reglas del negocio antes de portarlas a PHP.

## Cómo correrlo
    dotnet run

Necesita el SDK de .NET 8 o superior. Si solo tenés uno más nuevo, cambiá `net8.0` por tu versión en el `.csproj`
(igual está puesto `RollForward=Major`). No usa paquetes externos: corre sin internet.

## Archivos
| Archivo | Qué contiene |
|---|---|
| Modelos.cs | Espejo mínimo de las tablas del SQL |
| Validaciones.cs | Registro, DNI, mediciones, caritas y PIN de grupo |
| Permisos.cs | Redirección tras el login y quién puede ver o cargar qué |
| Inventario.cs | Descuento de stock, alerta de stock bajo, días restantes |
| Recordatorios.cs | Próxima ocurrencia y mensajes de aviso de eventos |
| Periodos.cs | Períodos mensuales del dashboard |
| Dashboard.cs | Cálculo del dashboard (estadísticas, comparación, ánimo) |
| DatosExcel.cs | Datos del Excel del dashboard (archivo generado) |
| Program.cs | Las pruebas |
