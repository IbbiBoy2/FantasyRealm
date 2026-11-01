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

    $employee = $stmt->fetch();

    if (
        !$employee ||
        (bool) $employee['suspended'] ||
        !in_array(
            $employee['role_name'],
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
    // LOAD PLAYER ACCOUNTS
    // =========================

    // Staff accounts are excluded. Passwords and reset tokens are never returned.

    $stmt = $pdo->prepare(
        'SELECT
            users.id,
            users.username,
            users.email,
            users.suspended,
            users.created_at
         FROM users
         INNER JOIN roles
            ON users.role_id = roles.id
         WHERE roles.name = :role
         ORDER BY users.created_at DESC, users.id DESC'
    );

    $stmt->execute([
        'role' => 'USER'
    ]);

    $users = $stmt->fetchAll();

    foreach ($users as &$user) {
        $user['id'] = (int) $user['id'];
        $user['suspended'] = (bool) $user['suspended'];
    }

    unset($user);

    echo json_encode([
        'success' => true,
        'users' => $users
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load user accounts.'
    ]);
}