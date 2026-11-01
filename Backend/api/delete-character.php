<?php

declare(strict_types=1);

// SECURE SESSION
require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-active-user.php';

// Blocks private requests from deleted or suspended accounts.

requireActiveUser($pdo);

// =========================
// REQUEST VALIDATION
// =========================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

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

// =========================
// CSRF PROTECTION
// =========================

// Reject deletion requests without a valid CSRF token.
requireCsrfToken();


// =========================
// INPUT
// =========================

$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($data)) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON data.'
    ]);

    exit;
}

$characterId = (int) ($data['character_id'] ?? 0);

if ($characterId <= 0) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid character.'
    ]);

    exit;
}


// =========================
// SOFT DELETE
// =========================

try {

    $stmt = $pdo->prepare(
        'UPDATE characters

         SET deleted_at = NOW(),
             shared = 0

         WHERE id = :character_id
           AND user_id = :user_id
           AND deleted_at IS NULL'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);


    if ($stmt->rowCount() === 0) {

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Character not found.'
        ]);

        exit;
    }


    echo json_encode([
        'success' => true,
        'message' => 'Character moved to deleted characters.'
    ]);


} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to delete character.'
    ]);
}