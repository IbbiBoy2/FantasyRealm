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
    // TARGET VALIDATION
    // =========================

    $userId = $data['user_id'] ?? null;

    if (!is_int($userId) || $userId <= 0) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid user ID.'
        ]);

        exit;
    }

    if ($userId === (int) $_SESSION['user_id']) {
        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'You cannot delete your own account here.'
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
    // DELETE RELATED REVIEWS
    // =========================

    // Removes reviews written by this user and reviews on their characters.

    $stmt = $pdo->prepare(
        'DELETE reviews
         FROM reviews
         LEFT JOIN characters
            ON reviews.character_id = characters.id
         WHERE reviews.user_id = :reviewer_id
            OR characters.user_id = :owner_id'
    );

    $stmt->execute([
        'reviewer_id' => $userId,
        'owner_id' => $userId
    ]);

    // =========================
    // DELETE EQUIPMENT LINKS
    // =========================

    // Deletes character links while preserving the accessory catalogue.

    $stmt = $pdo->prepare(
        'DELETE character_accessories
         FROM character_accessories
         INNER JOIN characters
            ON character_accessories.character_id = characters.id
         WHERE characters.user_id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    // =========================
    // DELETE CHARACTER APPEARANCES
    // =========================

    $stmt = $pdo->prepare(
        'DELETE appearances
         FROM appearances
         INNER JOIN characters
            ON appearances.character_id = characters.id
         WHERE characters.user_id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    // =========================
    // DELETE ALL OWNED CHARACTERS
    // =========================

    // Includes characters already in the owner's deleted collection.

    $stmt = $pdo->prepare(
        'DELETE FROM characters
         WHERE user_id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    // =========================
    // DELETE PLAYER ACCOUNT
    // =========================

    $stmt = $pdo->prepare(
        'DELETE FROM users
         WHERE id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Player account and related data deleted permanently.'
    ]);

// =========================
// TRANSACTION ERROR HANDLING
// =========================

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to delete user account.'
    ]);
}