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
    // INPUT VALIDATION
    // =========================

    $userId = $data['user_id'] ?? null;
    $suspended = $data['suspended'] ?? null;

    if (
        !is_int($userId) ||
        $userId <= 0 ||
        !is_bool($suspended)
    ) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid user ID and a boolean suspended value.'
        ]);

        exit;
    }

    if ($userId === (int) $_SESSION['user_id']) {
        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'You cannot change your own suspension state.'
        ]);

        exit;
    }

    // =========================
    // PROTECT STAFF ACCOUNTS
    // =========================

    $pdo->beginTransaction();

    // Locks the target account and accepts only ordinary USER accounts.

    $stmt = $pdo->prepare(
        'SELECT users.id
         FROM users
         INNER JOIN roles
            ON users.role_id = roles.id
         WHERE users.id = :user_id
           AND roles.name = :role
         FOR UPDATE'
    );

    $stmt->execute([
        'user_id' => $userId,
        'role' => 'USER'
    ]);

    if (!$stmt->fetch()) {
        $pdo->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Player account not found.'
        ]);

        exit;
    }

    // =========================
    // UPDATE SUSPENSION STATE
    // =========================

    $stmt = $pdo->prepare(
        'UPDATE users
         SET suspended = :suspended
         WHERE id = :user_id'
    );

    $stmt->execute([
        'suspended' => $suspended ? 1 : 0,
        'user_id' => $userId
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $suspended
            ? 'User account suspended.'
            : 'User account reactivated.',
        'user_id' => $userId,
        'suspended' => $suspended
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
        'message' => 'Unable to update account suspension.'
    ]);
}