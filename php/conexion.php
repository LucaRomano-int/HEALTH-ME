<?php
// Conexión con BDD

// Datos de acceso a MySQL (XAMPP/phpMyAdmin usa estos valores por defecto)
$host     = 'localhost';
$dbname   = 'health_me_db';   // Nombre de la base 
$usuario  = 'root';
$password = '';

// DSN: indica el tipo de base, el servidor, el nombre y la codificación de caracteres
$dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";

// Opciones de PDO
$opciones = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // Los errores lanzan excepciones
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         // Los resultados vienen como arrays asociativos
    PDO::ATTR_EMULATE_PREPARES   => false,                    // Consultas preparadas reales (más seguro)
];

try {
    // $pdo es el objeto de conexión que usan los demás archivos
    $pdo = new PDO($dsn, $usuario, $password, $opciones);
} catch (PDOException $e) {
    http_response_code(500);
    die('Error de conexión con la base de datos.');
}