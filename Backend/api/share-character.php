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

// The owner ID comes from the PHP session, not the request body.

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

// Reject requests without a valid session security token.
requireCsrfToken();

// =========================
// INPUT VALIDATION
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

$characterId = $data['character_id'] ?? null;
$shared = $data['shared'] ?? null;

if (
    !is_int($characterId) ||
    $characterId <= 0 ||
    !is_bool($shared)
) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Provide a positive integer character_id and a boolean shared value.'
    ]);

    exit;
}

// =========================
// OWNERSHIP AND APPROVAL
// =========================

try {
    $pdo->beginTransaction();

    // Locks the character while its approval and visibility are checked.

    $stmt = $pdo->prepare(
        'SELECT status
         FROM characters
         WHERE id = :character_id
           AND user_id = :user_id
           AND deleted_at IS NULL
         FOR UPDATE'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);

    $character = $stmt->fetch();

    if (!$character) {
        $pdo->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Character not found.'
        ]);

        exit;
    }

    // Unsharing remains allowed regardless of approval status.

    if ($shared && $character['status'] !== 'APPROVED') {
        $pdo->rollBack();

        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'Only approved characters can be shared.'
        ]);

        exit;
    }

    // =========================
    // UPDATE VISIBILITY
    // =========================

    $stmt = $pdo->prepare(
        'UPDATE characters
         SET shared = :shared
         WHERE id = :character_id
           AND user_id = :user_id
           AND deleted_at IS NULL'
    );

    $stmt->execute([
        'shared' => $shared ? 1 : 0,
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $shared
            ? 'Character shared successfully.'
            : 'Character is now private.',
        'character_id' => $characterId,
        'shared' => $shared
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
        'message' => 'Unable to update character visibility.'
    ]);
}