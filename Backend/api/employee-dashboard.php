<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

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

    // Checks the current database role and suspension state.
    // This prevents outdated session permissions from granting access.

    $stmt = $pdo->prepare(
        'SELECT
            users.username,
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
    // DASHBOARD STATISTICS
    // =========================

    // Deleted characters and their reviews are excluded from moderation counts.

    $stmt = $pdo->query(
        "SELECT
            (
                SELECT COUNT(*)
                FROM characters
                WHERE status = 'PENDING'
                  AND deleted_at IS NULL
            ) AS pending_characters,

            (
                SELECT COUNT(*)
                FROM reviews
                INNER JOIN characters
                    ON reviews.character_id = characters.id
                WHERE reviews.status = 'PENDING'
                  AND characters.deleted_at IS NULL
            ) AS pending_reviews,

            (
                SELECT COUNT(*)
                FROM accessories
                WHERE active = 1
            ) AS active_accessories,

            (
                SELECT COUNT(*)
                FROM users
                INNER JOIN roles
                    ON users.role_id = roles.id
                WHERE roles.name = 'USER'
            ) AS player_accounts"
    );

    $statistics = $stmt->fetch();

    foreach ($statistics as $key => $value) {
        $statistics[$key] = (int) $value;
    }

    // =========================
    // JSON RESPONSE
    // =========================

    echo json_encode([
        'success' => true,
        'user' => [
            'username' => $user['username'],
            'role' => $user['role_name']
        ],
        'statistics' => $statistics
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load employee dashboard.'
    ]);
}