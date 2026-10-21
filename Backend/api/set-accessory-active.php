<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';

// =========================
// REQUEST VALIDATION
// =========================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

// =========================
// AUTHENTICATION
// =========================

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'You must be logged in.'
    ]);

    exit;
}

try {
    // =========================
    // EMPLOYEE AUTHORIZATION
    // =========================

    $stmt = $pdo->prepare(
        'SELECT users.suspended, roles.name AS role_name
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id']
    ]);

    $user = $stmt->fetch();

    if (
        !$user ||
        (bool) $user['suspended'] ||
        !in_array($user['role_name'], ['EMPLOYEE', 'ADMIN'], true)
    ) {
        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'Employee access required.'
        ]);

        exit;
    }

    // =========================
    // INPUT VALIDATION
    // =========================

    try {
        $data = json_decode(
            file_get_contents('php://input'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    } catch (JsonException $e) {
        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid JSON data.'
        ]);

        exit;
    }

    if (!is_array($data)) {
        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid JSON data.'
        ]);

        exit;
    }

    $accessoryId = $data['accessory_id'] ?? null;
    $active = $data['active'] ?? null;

    if (
        !is_int($accessoryId) ||
        $accessoryId <= 0 ||
        !is_bool($active)
    ) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Provide an integer accessory_id and a boolean active value.'
        ]);

        exit;
    }

    // =========================
    // UPDATE AVAILABILITY
    // =========================

    // Locks the existing accessory while updating its availability.

    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'SELECT id
         FROM accessories
         WHERE id = :accessory_id
         FOR UPDATE'
    );

    $stmt->execute([
        'accessory_id' => $accessoryId
    ]);

    if (!$stmt->fetch()) {
        $pdo->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Accessory not found.'
        ]);

        exit;
    }

    $stmt = $pdo->prepare(
        'UPDATE accessories
         SET active = :active
         WHERE id = :accessory_id'
    );

    $stmt->execute([
        'active' => $active ? 1 : 0,
        'accessory_id' => $accessoryId
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $active
            ? 'Accessory enabled.'
            : 'Accessory disabled.',
        'accessory_id' => $accessoryId,
        'active' => $active
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to update accessory availability.'
    ]);
}