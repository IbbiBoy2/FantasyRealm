<?php

declare(strict_types=1);

session_start();

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
// INPUT
// =========================

$data = json_decode(
    file_get_contents('php://input'),
    true
);

$characterId =
    (int) ($data['character_id'] ?? 0);

if ($characterId <= 0) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid character.'
    ]);

    exit;
}


// =========================
// PERMANENT DELETE
// =========================

try {

    $pdo->beginTransaction();


    // First confirm that this deleted character
    // belongs to the logged-in user.

    $stmt = $pdo->prepare(
        'SELECT id
         FROM characters
         WHERE id = :character_id
           AND user_id = :user_id
           AND deleted_at IS NOT NULL
         LIMIT 1'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);


    if (!$stmt->fetch()) {

        $pdo->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Deleted character not found.'
        ]);

        exit;
    }


    // Related records must be deleted first
    // because the database uses foreign keys.

    $stmt = $pdo->prepare(
        'DELETE FROM reviews
         WHERE character_id = :character_id'
    );

    $stmt->execute([
        'character_id' => $characterId
    ]);


    $stmt = $pdo->prepare(
        'DELETE FROM character_accessories
         WHERE character_id = :character_id'
    );

    $stmt->execute([
        'character_id' => $characterId
    ]);


    $stmt = $pdo->prepare(
        'DELETE FROM appearances
         WHERE character_id = :character_id'
    );

    $stmt->execute([
        'character_id' => $characterId
    ]);


    $stmt = $pdo->prepare(
        'DELETE FROM characters
         WHERE id = :character_id
           AND user_id = :user_id'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);


    $pdo->commit();


    echo json_encode([
        'success' => true,
        'message' => 'Character permanently deleted.'
    ]);


} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to permanently delete character.'
    ]);
}