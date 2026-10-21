

//para proteger datos. Este archivo no confía en que el navegador le diga qué usuario está conectado. 
//Usa la sesión y comprueba que haya una invitación aceptada y que el permiso de mediciones esté activado.

//La comprobación de permisos debe repetirse en cada endpoint que entregue datos. 
Tener permiso para consultar mediciones no significa que automáticamente se pueda consultar medicamentos o padecimientos.


<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_usuario'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'mensaje' => 'Inicia sesión.']);
    exit;
}

$idAcompanante = (int) $_SESSION['id_usuario'];
$idPropietario = filter_input(INPUT_GET, 'id_usuario', FILTER_VALIDATE_INT);

if (!$idPropietario || $idPropietario === $idAcompanante) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Usuario inválido.']);
    exit;
}

try {
    // Primero se comprueba que el acceso esté autorizado.
    $stmt = $pdo->prepare(
        "SELECT id
         FROM invitacion_acceso
         WHERE id_usuario_propietario = :propietario
           AND id_usuario_acompanante = :acompanante
           AND estado = 'aceptada'
           AND ver_mediciones = 1
         LIMIT 1"
    );

    $stmt->execute([
        ':propietario' => $idPropietario,
        ':acompanante' => $idAcompanante
    ]);

    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode([
            'ok' => false,
            'mensaje' => 'No tienes permiso para consultar estas mediciones.'
        ]);
        exit;
    }

    // Solo después de autorizar, se consultan los datos del propietario.
    $stmt = $pdo->prepare(
        'SELECT m.id, t.nombre AS tipo, t.unidad,
                m.valor, m.valor2, m.fecha_hora
         FROM medicion m
         INNER JOIN tipo_medicion t ON t.id = m.id_tipo
         WHERE m.id_usuario = :propietario
         ORDER BY m.fecha_hora DESC'
    );

    $stmt->execute([':propietario' => $idPropietario]);

    echo json_encode([
        'ok' => true,
        'mediciones' => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ]);

} catch (PDOException $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'mensaje' => 'No se pudieron consultar las mediciones.'
    ]);
}
