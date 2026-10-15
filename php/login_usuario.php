<?php
// Conexión con BDD
require_once __DIR__ . '/conexion.php';

// La sesión guarda quién inició sesión para las demás páginas PHP
session_start();

// La respuesta se devuelve en formato JSON para que login.js la lea
header('Content-Type: application/json; charset=utf-8');

// Solo se aceptan envíos por POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);
    exit;
}

// Datos recibidos desde login.js (coinciden con los name de loginForm)
$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Completa todos los campos.']);
    exit;
}

try {
    // Conexión con BDD: busca al usuario por su email
    $stmt = $pdo->prepare(
        'SELECT id, nombre, apellido, password_hash, rol
         FROM usuario
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $usuario = $stmt->fetch();

    // Mismo mensaje si falla el email o la contraseña (no revela cuál fue)
    if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'Correo o contraseña incorrectos.']);
        exit;
    }

    // Se renueva el id de sesión y se guardan los datos del usuario
    session_regenerate_id(true);
    $_SESSION['id_usuario'] = $usuario['id'];
    $_SESSION['nombre']     = $usuario['nombre'];
    $_SESSION['apellido']   = $usuario['apellido'];
    $_SESSION['rol']        = $usuario['rol'];

    // Conexión con BDD: registra la fecha/hora de la última conexión
    $upd = $pdo->prepare('UPDATE usuario SET ultima_conexion = NOW() WHERE id = :id');
    $upd->execute([':id' => $usuario['id']]);

    echo json_encode(['ok' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'No pudimos iniciar sesión. Intenta nuevamente.']);
}