<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'You must be logged in.'
    ]);
    exit;
}

try {
    // Check the employee's current role and account status.
    $stmt = $pdo->prepare(
        'SELECT
            users.suspended,
            roles.name AS role_name
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id']
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$user ||
        (bool) $user['suspended'] ||
        !in_array($user['role_name'], ['EMPLOYEE', 'ADMIN'], true)
    ) {
        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'Employee access required.'
        ]);
        exit;
    }

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
    $status = $data['status'] ?? null;

    $reason = is_string($data['rejection_reason'] ?? null)
        ? trim($data['rejection_reason'])
        : '';

    if (
        !is_int($characterId) ||
        $characterId <= 0 ||
        !in_array($status, ['APPROVED', 'REJECTED'], true)
    ) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid character ID and moderation status.'
        ]);
        exit;
    }

    if (
        $status === 'REJECTED' &&
        ($reason === '' || mb_strlen($reason) > 1000)
    ) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Rejection requires a reason of 1 to 1000 characters.'
        ]);
        exit;
    }

    // Only pending, undeleted characters can be moderated.
    $stmt = $pdo->prepare(
        'UPDATE characters
         SET status = :status,
             rejection_reason = :rejection_reason,
             shared = 0
         WHERE id = :character_id
           AND status = :pending_status
           AND deleted_at IS NULL'
    );

    $stmt->execute([
        'status' => $status,
        'rejection_reason' => $status === 'REJECTED'
            ? $reason
            : null,
        'character_id' => $characterId,
        'pending_status' => 'PENDING'
    ]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Pending character not found. It may already have been reviewed or deleted.'
        ]);
        exit;
    }

    // Record successful moderation in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        $action = $status === 'APPROVED'
            ? 'character.approved'
            : 'character.rejected';

        recordStaffActivity(
            (int) $_SESSION['user_id'],
            $action,
            'character',
            $characterId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Character moderation activity logging failed.'
        );
    }

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => $status === 'APPROVED'
            ? 'Character name approved.'
            : 'Character name rejected.',
        'character_id' => $characterId,
        'status' => $status,
        'activity_logged' => $activityLogged
    ]);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to save the moderation decision.'
    ]);
}
