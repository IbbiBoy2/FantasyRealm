<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/require-active-user.php';

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

// The reviewer ID comes from the PHP session, never the request body.

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'You must be logged in to submit a review.'
    ]);

    exit;
}

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
$rating = $data['rating'] ?? null;

$comment = is_string($data['comment'] ?? null)
    ? trim($data['comment'])
    : '';

if (!is_int($characterId) || $characterId <= 0) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid character ID.'
    ]);

    exit;
}

if (!is_int($rating) || $rating < 1 || $rating > 5) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Choose a rating from 1 to 5.'
    ]);

    exit;
}

if ($comment === '' || mb_strlen($comment) > 2000) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Enter a comment of 1 to 2000 characters.'
    ]);

    exit;
}

// =========================
// SAVE PENDING REVIEW
// =========================

try {
    // Inserts only if the character is approved, shared and not deleted.
    // The availability check and insertion happen in one SQL statement.

    $stmt = $pdo->prepare(
        'INSERT INTO reviews (
            user_id,
            character_id,
            rating,
            comment,
            status
         )
         SELECT
            :user_id,
            characters.id,
            :rating,
            :comment,
            :review_status
         FROM characters
         WHERE characters.id = :character_id
           AND characters.status = :character_status
           AND characters.shared = 1
           AND characters.deleted_at IS NULL'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id'],
        'rating' => $rating,
        'comment' => $comment,
        'review_status' => 'PENDING',
        'character_id' => $characterId,
        'character_status' => 'APPROVED'
    ]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Character not found.'
        ]);

        exit;
    }

    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Your review has been submitted and is waiting for employee approval.'
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to submit your review.'
    ]);
}