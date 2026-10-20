<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

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

    // Checks current permissions and rejects suspended accounts.

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
    // LOAD PENDING REVIEWS
    // =========================

    // Oldest submissions appear first.
    // Reviews belonging to deleted characters are excluded.

    $stmt = $pdo->prepare(
        'SELECT
            reviews.id,
            reviews.character_id,
            reviews.rating,
            reviews.comment,
            reviews.created_at,
            users.username AS reviewer_username,
            characters.name AS character_name
         FROM reviews
         INNER JOIN users
            ON reviews.user_id = users.id
         INNER JOIN characters
            ON reviews.character_id = characters.id
         WHERE reviews.status = :status
           AND characters.deleted_at IS NULL
         ORDER BY reviews.created_at ASC, reviews.id ASC'
    );

    $stmt->execute([
        'status' => 'PENDING'
    ]);

    $reviews = $stmt->fetchAll();

    foreach ($reviews as &$review) {
        $review['id'] = (int) $review['id'];
        $review['character_id'] = (int) $review['character_id'];
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
        'message' => 'Unable to load pending reviews.'
    ]);
}