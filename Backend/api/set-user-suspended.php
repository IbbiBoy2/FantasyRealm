<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
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
    require_once __DIR__ . '/../config/database.php';

    // Verify staff permissions using the current database role.
    $stmt = $pdo->prepare(
        'SELECT users.suspended, roles.name AS role_name
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id']
    ]);

    $employee = $stmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$employee ||
        (bool) $employee['suspended'] ||
        !in_array($employee['role_name'], ['EMPLOYEE', 'ADMIN'], true)
    ) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Employee access required.'
        ]);
        exit;
    }

    // Validate the incoming JSON.
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

    $userId = $data['user_id'] ?? null;
    $suspended = $data['suspended'] ?? null;

    if (
        !is_int($userId) ||
        $userId <= 0 ||
        !is_bool($suspended)
    ) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid user ID and a boolean suspended value.'
        ]);
        exit;
    }

    // Prevent staff members from modifying themselves.
    if ($userId === (int) $_SESSION['user_id']) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'You cannot change your own suspension state.'
        ]);
        exit;
    }

    $pdo->beginTransaction();

    // Lock the account and allow changes to USER accounts only.
    $stmt = $pdo->prepare(
        'SELECT users.id, users.suspended
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id
           AND roles.name = :role
         FOR UPDATE'
    );

    $stmt->execute([
        'user_id' => $userId,
        'role' => 'USER'
    ]);

    $player = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$player) {
        $pdo->rollBack();

        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Player account not found.'
        ]);
        exit;
    }

    $currentStatus = (bool) $player['suspended'];

    // Do not update or log an unchanged account.
    if ($currentStatus === $suspended) {
        $pdo->commit();

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $suspended
                ? 'Player is already suspended.'
                : 'Player is already active.',
            'user_id' => $userId,
            'suspended' => $suspended,
            'changed' => false,
            'activity_logged' => null
        ]);
        exit;
    }

    // Update the player's suspension status.
    $stmt = $pdo->prepare(
        'UPDATE users
         SET suspended = :suspended
         WHERE id = :user_id'
    );

    $stmt->execute([
        'suspended' => $suspended ? 1 : 0,
        'user_id' => $userId
    ]);

    $pdo->commit();

    // Record the completed change in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        $action = $suspended
            ? 'player.suspended'
            : 'player.reactivated';

        recordStaffActivity(
            (int) $_SESSION['user_id'],
            $action,
            'player',
            $userId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Player suspension activity logging failed.'
        );
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => $suspended
            ? 'User account suspended.'
            : 'User account reactivated.',
        'user_id' => $userId,
        'suspended' => $suspended,
        'changed' => true,
        'activity_logged' => $activityLogged
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO) {
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (Throwable $rollbackError) {
            error_log(
                'FantasyRealm: Player suspension rollback failed.'
            );
        }
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to update account suspension.'
    ]);
}
