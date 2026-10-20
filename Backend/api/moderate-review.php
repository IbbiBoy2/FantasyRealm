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
    // DECISION VALIDATION
    // =========================

    $reviewId = $data['review_id'] ?? null;
    $status = $data['status'] ?? null;

    if (
        !is_int($reviewId) ||
        $reviewId <= 0 ||
        !in_array($status, ['APPROVED', 'REJECTED'], true)
    ) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid review ID and moderation status.'
        ]);

        exit;
    }

    // =========================
    // SAVE REVIEW DECISION
    // =========================

    // Only pending reviews on undeleted characters can be moderated.
    // A completed decision cannot be overwritten by another submission.

    $stmt = $pdo->prepare(
        'UPDATE reviews
         INNER JOIN characters
            ON reviews.character_id = characters.id
         SET reviews.status = :status
         WHERE reviews.id = :review_id
           AND reviews.status = :pending_status
           AND characters.deleted_at IS NULL'
    );

    $stmt->execute([
        'status' => $status,
        'review_id' => $reviewId,
        'pending_status' => 'PENDING'
    ]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Pending review not found. It may already have been reviewed or its character deleted.'
        ]);

        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => $status === 'APPROVED'
            ? 'Review approved.'
            : 'Review rejected.',
        'review_id' => $reviewId,
        'status' => $status
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to save the review decision.'
    ]);
}