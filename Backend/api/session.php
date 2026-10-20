<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';

// Returns whether the current visitor has an authenticated PHP session.

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'authenticated' => false,
        'user' => null
    ]);

    exit;
}

// =========================
// CURRENT USER AND ROLE
// =========================

// Reads the current database role so menu links follow role changes.

try {
    $stmt = $pdo->prepare(
        'SELECT
            users.id,
            users.role_id,
            users.username,
            users.email,
            users.suspended,
            roles.name AS role
         FROM users
         INNER JOIN roles
            ON users.role_id = roles.id
         WHERE users.id = :user_id'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id']
    ]);

    $user = $stmt->fetch();

    if (!$user || (bool) $user['suspended']) {
        echo json_encode([
            'authenticated' => false,
            'user' => null
        ]);

        exit;
    }

    // Preserves existing response fields and adds the role name.

    echo json_encode([
        'authenticated' => true,
        'user' => [
            'id' => (int) $user['id'],
            'role_id' => (int) $user['role_id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'authenticated' => false,
        'user' => null,
        'message' => 'Unable to verify session.'
    ]);
}