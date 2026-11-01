<?php

declare(strict_types=1);

// =========================
// SECURE SESSION
// =========================

require_once __DIR__ . '/../config/security.php';
startSecureSession();
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

// =========================
// CSRF PROTECTION
// =========================

requireCsrfToken();

try {
    // Verify employee or administrator permissions.
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

    // Decode the submitted JSON.
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

    if (!is_int($userId) || $userId <= 0) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid user ID.'
        ]);
        exit;
    }

    // Prevent employees from deleting their own accounts.
    if ($userId === (int) $_SESSION['user_id']) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'You cannot delete your own account here.'
        ]);
        exit;
    }

    // All related SQL deletions belong to one transaction.
    $pdo->beginTransaction();

    // Lock the target and protect staff accounts.
    $stmt = $pdo->prepare(
        'SELECT users.id
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

    if (!$stmt->fetch()) {
        $pdo->rollBack();

        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Player account not found.'
        ]);
        exit;
    }

    // Delete reviews written by the player or linked to their characters.
    $stmt = $pdo->prepare(
        'DELETE reviews
         FROM reviews
         LEFT JOIN characters
            ON reviews.character_id = characters.id
         WHERE reviews.user_id = :reviewer_id
            OR characters.user_id = :owner_id'
    );

    $stmt->execute([
        'reviewer_id' => $userId,
        'owner_id' => $userId
    ]);

    // Delete equipment links without deleting catalogue items.
    $stmt = $pdo->prepare(
        'DELETE character_accessories
         FROM character_accessories
         INNER JOIN characters
            ON character_accessories.character_id = characters.id
         WHERE characters.user_id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    // Delete character appearances.
    $stmt = $pdo->prepare(
        'DELETE appearances
         FROM appearances
         INNER JOIN characters
            ON appearances.character_id = characters.id
         WHERE characters.user_id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    // Delete all characters owned by the player.
    $stmt = $pdo->prepare(
        'DELETE FROM characters
         WHERE user_id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    // Delete the player account.
    $stmt = $pdo->prepare(
        'DELETE FROM users
         WHERE id = :user_id'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException(
            'Player deletion did not complete.'
        );
    }

    // Commit only after every SQL deletion succeeds.
    $pdo->commit();

    // Record the completed deletion in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        recordStaffActivity(
            (int) $_SESSION['user_id'],
            'player.deleted',
            'player',
            $userId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Player deletion activity logging failed.'
        );
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Player account and related data deleted permanently.',
        'user_id' => $userId,
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
                'FantasyRealm: Player deletion rollback failed.'
            );
        }
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to delete user account.'
    ]);
}
