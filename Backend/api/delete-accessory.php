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
        'SELECT
            users.suspended,
            roles.name AS role_name
         FROM users
         INNER JOIN roles
            ON users.role_id = roles.id
         WHERE users.id = :user_id'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id']
    ]);

    $user = $stmt->fetch();

    if (
        !$user ||
        (bool) $user['suspended'] ||
        !in_array(
            $user['role_name'],
            ['EMPLOYEE', 'ADMIN'],
            true
        )
    ) {
        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'Employee access required.'
        ]);

        exit;
    }

    // =========================
    // JSON INPUT
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

    // =========================
    // ACCESSORY VALIDATION
    // =========================

    $accessoryId = $data['accessory_id'] ?? null;

    if (!is_int($accessoryId) || $accessoryId <= 0) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid accessory ID.'
        ]);

        exit;
    }

    // =========================
    // DELETE UNUSED ACCESSORY
    // =========================

    // The existing foreign key prevents deletion of items linked to characters.
    // Equipment links are never deleted automatically by this endpoint.

    $stmt = $pdo->prepare(
        'DELETE FROM accessories
         WHERE id = :accessory_id'
    );

    $stmt->execute([
        'accessory_id' => $accessoryId
    ]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Accessory not found.'
        ]);

        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Accessory deleted permanently.'
    ]);

// =========================
// DATABASE CONSTRAINT HANDLING
// =========================

} catch (PDOException $e) {
    // MySQL/MariaDB error 1451 means another record still references this item.

    $inUse = (int) ($e->errorInfo[1] ?? 0) === 1451;

    http_response_code($inUse ? 409 : 500);

    echo json_encode([
        'success' => false,
        'message' => $inUse
            ? 'This accessory is used by saved characters. Disable it instead.'
            : 'Unable to delete accessory.'
    ]);

// =========================
// GENERAL ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to delete accessory.'
    ]);
}