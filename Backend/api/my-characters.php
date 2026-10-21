<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../backend/api/require-active-user.php';

// Blocks private requests from deleted or suspended accounts.

requireActiveUser($pdo);

// =========================
// REQUEST VALIDATION
// =========================

// This private endpoint only accepts GET requests.

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

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

// The user ID always comes from the authenticated session,
// never from data supplied by the client.

if (!isset($_SESSION['user_id'])) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'You must be logged in.'
    ]);

    exit;
}


// =========================
// LOAD USER CHARACTERS
// =========================

try {

    $stmt = $pdo->prepare(
        'SELECT
            characters.id,
            characters.name,
            characters.gender,
            characters.status,
            characters.rejection_reason,
            characters.shared,
            characters.image_path,
            characters.created_at,

            appearances.hair_style,
            appearances.hair_color,
            appearances.skin_color,
            appearances.eye_color

         FROM characters

         LEFT JOIN appearances
            ON appearances.character_id = characters.id

         WHERE characters.user_id = :user_id
           AND characters.deleted_at IS NULL

         ORDER BY characters.created_at DESC'
    );


    $stmt->execute([
        'user_id' => $_SESSION['user_id']
    ]);


    $characters = $stmt->fetchAll();


    // Cast database values to useful JSON types.

    foreach ($characters as &$character) {

        $character['id'] =
            (int) $character['id'];

        $character['shared'] =
            (bool) $character['shared'];
    }

    unset($character);


    echo json_encode([
        'success' => true,
        'characters' => $characters
    ]);


} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load your characters.'
    ]);
}