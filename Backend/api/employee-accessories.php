<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';

// =========================
// REQUEST VALIDATION
// =========================

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
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
    // LOAD ACCESSORY CATALOGUE
    // =========================

    // Includes disabled items and counts all saved character links,
    // including links belonging to soft-deleted characters.

    $stmt = $pdo->query(
        'SELECT
            accessories.id,
            accessories.name,
            accessories.type,
            accessories.active,
            (
                SELECT COUNT(*)
                FROM character_accessories
                WHERE character_accessories.accessory_id = accessories.id
            ) AS usage_count
         FROM accessories
         ORDER BY accessories.type ASC,
                  accessories.name ASC,
                  accessories.id ASC'
    );

    $accessories = $stmt->fetchAll();

    foreach ($accessories as &$accessory) {
        $accessory['id'] = (int) $accessory['id'];
        $accessory['active'] = (bool) $accessory['active'];
        $accessory['usage_count'] = (int) $accessory['usage_count'];
    }

    unset($accessory);

    echo json_encode([
        'success' => true,
        'accessories' => $accessories
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load accessories.'
    ]);
}