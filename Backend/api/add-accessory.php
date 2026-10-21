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

    $name = is_string($data['name'] ?? null)
        ? trim($data['name'])
        : '';

    $type = is_string($data['type'] ?? null)
        ? strtolower(trim($data['type']))
        : '';

    $allowedTypes = [
        'weapon',
        'armor',
        'clothing',
        'accessory'
    ];

    if ($name === '' || mb_strlen($name) > 100) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Enter an accessory name of 1 to 100 characters.'
        ]);

        exit;
    }

    if (!in_array($type, $allowedTypes, true)) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Choose a valid accessory type.'
        ]);

        exit;
    }

    // =========================
    // CREATE ACCESSORY
    // =========================

    // New catalogue items start active. PHP controls this initial state.

    $stmt = $pdo->prepare(
        'INSERT INTO accessories (
            name,
            type,
            active
         ) VALUES (
            :name,
            :type,
            1
         )'
    );

    $stmt->execute([
        'name' => $name,
        'type' => $type
    ]);

    $accessoryId = (int) $pdo->lastInsertId();

    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Accessory added successfully.',
        'accessory' => [
            'id' => $accessoryId,
            'name' => $name,
            'type' => $type,
            'active' => true,
            'usage_count' => 0
        ]
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to add accessory.'
    ]);
}