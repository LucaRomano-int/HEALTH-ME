<?php
// Conexión con BDD
require_once __DIR__ . '/conexion.php';

//ésta pag puede ser reutilizable para algun otro formulario o qsy, x eso está apartada xd
// La respuesta se devuelve en formato JSON para que contact.js la lea
header('Content-Type: application/json; charset=utf-8');

// Solo se aceptan envíos por POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

// Datos recibidos desde contact.js (coinciden con los name de contact.html)
$name     = trim($_POST['name'] ?? '');
$lastname = trim($_POST['lastname'] ?? '');
$email    = trim($_POST['email'] ?? '');
$motivo   = trim($_POST['motivo'] ?? '');
$mensaje  = trim($_POST['mensaje'] ?? '');

// Validación mínima: todos los campos obligatorios y un email válido
if ($name === '' || $lastname === '' || $email === '' || $motivo === '' || $mensaje === ''
    || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

// Se ajustan al largo máximo de las columnas de consulta_contacto
$nombre = mb_substr($name . ' ' . $lastname, 0, 100);
$email  = mb_substr($email, 0, 120);
$asunto = mb_substr($motivo, 0, 150);

try {
    // Conexión con BDD: inserta la consulta en la tabla consulta_contacto
    $stmt = $pdo->prepare(
        'INSERT INTO consulta_contacto (nombre, email, asunto, mensaje)
         VALUES (:nombre, :email, :asunto, :mensaje)'
    );
    $stmt->execute([
        ':nombre'  => $nombre,
        ':email'   => $email,
        ':asunto'  => $asunto,
        ':mensaje' => $mensaje,
    ]);
    echo json_encode(['ok' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false]);
}