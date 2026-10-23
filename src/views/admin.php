<?php
require_once __DIR__ . '/php/verificar_sesion.php';
if (($_SESSION['nivel'] ?? '') !== 'administrador') {
    header('Location: user.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HealthMe - Administración</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <main style="padding:2rem; max-width:1100px; margin:auto;">
    <h1>Gestión de usuarios</h1>
    <p><a href="php/logout.php">Cerrar sesión</a></p>
    <p id="msgAdmin" role="status"></p>
    <div style="overflow-x:auto;">
      <table id="tablaUsuarios" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th>Nombre</th><th>Email</th><th>DNI</th><th>Rol</th>
            <th>Nivel</th><th>Última conexión</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </main>
  <script src="js/admin.js"></script>
</body>
</html>