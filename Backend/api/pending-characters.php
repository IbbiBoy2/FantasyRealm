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

    // Checks current permissions rather than relying on a saved session role.

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
    // LOAD PENDING CHARACTER NAMES
    // =========================

    // Oldest submissions appear first. Deleted characters are excluded.

    $stmt = $pdo->prepare(
        'SELECT
            characters.id,
            characters.name,
            characters.created_at,
            users.username AS creator_username
         FROM characters
         INNER JOIN users
            ON characters.user_id = users.id
         WHERE characters.status = :status
           AND characters.deleted_at IS NULL
         ORDER BY characters.created_at ASC, characters.id ASC'
    );

    $stmt->execute([
        'status' => 'PENDING'
    ]);

    $characters = $stmt->fetchAll();

    foreach ($characters as &$character) {
        $character['id'] = (int) $character['id'];
    }

    unset($character);

    echo json_encode([
        'success' => true,
        'characters' => $characters
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load pending characters.'
    ]);
}