<?php
// Conexión con BDD
require_once __DIR__ . '/conexion.php';

// La respuesta se devuelve en formato JSON para que login.js la lea
header('Content-Type: application/json; charset=utf-8');

// Solo se aceptan envíos por POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);
    exit;
}

// Datos recibidos desde login.js (coinciden con los name de registerForm)
$nombre          = trim($_POST['nombre'] ?? '');
$apellido        = trim($_POST['apellido'] ?? '');
$dni             = trim($_POST['dni'] ?? '');
$email           = trim($_POST['email'] ?? '');
$password        = $_POST['password'] ?? '';
$confirmPassword = $_POST['confirmPassword'] ?? '';

// Validación mínima de campos obligatorios y formato de email
if ($nombre === '' || $apellido === '' || $dni === '' || $email === ''
    || $password === '' || $confirmPassword === ''
    || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Completa todos los campos con datos válidos.']);
    exit;
}

// Las dos contraseñas deben coincidir
if ($password !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Las contraseñas no coinciden.']);
    exit;
}

// Límites de largo definidos en la tabla usuario
if (mb_strlen($nombre) > 100 || mb_strlen($apellido) > 100
    || mb_strlen($dni) > 20 || mb_strlen($email) > 150) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Alguno de los campos supera el largo permitido.']);
    exit;
}

// La contraseña nunca se guarda en texto plano
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    // Conexión con BDD: inserta el nuevo usuario en la tabla usuario
    $stmt = $pdo->prepare(
        'INSERT INTO usuario (nombre, apellido, dni, email, password_hash)
         VALUES (:nombre, :apellido, :dni, :email, :password_hash)'
    );
    $stmt->execute([
        ':nombre'        => $nombre,
        ':apellido'      => $apellido,
        ':dni'           => $dni,
        ':email'         => $email,
        ':password_hash' => $passwordHash,
    ]);
    echo json_encode(['ok' => true]);
} catch (PDOException $e) {
    // 23000 = violación de una clave única (email o DNI ya registrados)
    if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ese correo o DNI ya está registrado.']);
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No pudimos crear la cuenta. Intenta nuevamente.']);
    }
}