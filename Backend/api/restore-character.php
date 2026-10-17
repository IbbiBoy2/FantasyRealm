<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';


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
// RESTORE CHARACTER
// =========================

try {

    $stmt = $pdo->prepare(
        'UPDATE characters

         SET deleted_at = NULL

         WHERE id = :character_id
           AND user_id = :user_id
           AND deleted_at IS NOT NULL'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);


    if ($stmt->rowCount() === 0) {

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Deleted character not found.'
        ]);

        exit;
    }


    echo json_encode([
        'success' => true,
        'message' => 'Character restored successfully.'
    ]);


} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to restore character.'
    ]);
}