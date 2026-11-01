<?php

declare(strict_types=1);

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

$characterId = filter_input(
    INPUT_GET,
    'character_id',
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if (!$characterId) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid character ID.'
    ]);

    exit;
}

// =========================
// CHECK PUBLIC CHARACTER
// =========================

try {
    $stmt = $pdo->prepare(
        'SELECT id
         FROM characters
         WHERE id = :character_id
           AND status = :status
           AND shared = 1
           AND deleted_at IS NULL'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'status' => 'APPROVED'
    ]);

    if (!$stmt->fetch()) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Character not found.'
        ]);

        exit;
    }

    // =========================
    // LOAD APPROVED REVIEWS
    // =========================

    // Approval is enforced in SQL so pending comments never reach the browser.

    $stmt = $pdo->prepare(
        'SELECT
            reviews.id,
            reviews.rating,
            reviews.comment,
            reviews.created_at,
            users.username AS reviewer_username

         FROM reviews

         INNER JOIN users
            ON reviews.user_id = users.id

         INNER JOIN characters
            ON reviews.character_id = characters.id

         WHERE reviews.character_id = :character_id
           AND reviews.status = :review_status
           AND characters.status = :character_status
           AND characters.shared = 1
           AND characters.deleted_at IS NULL

         ORDER BY reviews.created_at DESC, reviews.id DESC'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'review_status' => 'APPROVED',
        'character_status' => 'APPROVED'
    ]);

    $reviews = $stmt->fetchAll();

    // Returns numeric database fields as JSON numbers.

    foreach ($reviews as &$review) {
        $review['id'] = (int) $review['id'];
        $review['rating'] = (int) $review['rating'];
    }

    unset($review);

    echo json_encode([
        'success' => true,
        'reviews' => $reviews
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load reviews.'
    ]);
}