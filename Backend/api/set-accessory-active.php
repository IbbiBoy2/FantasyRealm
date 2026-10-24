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

    // Decode the JSON request.
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

    $accessoryId = $data['accessory_id'] ?? null;
    $active = $data['active'] ?? null;

    if (
        !is_int($accessoryId) ||
        $accessoryId <= 0 ||
        !is_bool($active)
    ) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Provide an integer accessory_id and a boolean active value.'
        ]);
        exit;
    }

    // Lock the equipment while updating its availability.
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'SELECT id, active
         FROM accessories
         WHERE id = :accessory_id
         FOR UPDATE'
    );

    $stmt->execute([
        'accessory_id' => $accessoryId
    ]);

    $accessory = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$accessory) {
        $pdo->rollBack();

        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Accessory not found.'
        ]);
        exit;
    }

    $currentStatus = (bool) $accessory['active'];

    // Avoid updating equipment that already has the requested status.
    if ($currentStatus === $active) {
        $pdo->commit();

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $active
                ? 'Accessory is already enabled.'
                : 'Accessory is already disabled.',
            'accessory_id' => $accessoryId,
            'active' => $active,
            'changed' => false,
            'activity_logged' => null
        ]);
        exit;
    }

    // Update equipment availability in MariaDB.
    $stmt = $pdo->prepare(
        'UPDATE accessories
         SET active = :active
         WHERE id = :accessory_id'
    );

    $stmt->execute([
        'active' => $active ? 1 : 0,
        'accessory_id' => $accessoryId
    ]);

    $pdo->commit();

    // Record the successful status change in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        recordStaffActivity(
            (int) $_SESSION['user_id'],
            'accessory.updated',
            'accessory',
            $accessoryId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Accessory status activity logging failed.'
        );
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => $active
            ? 'Accessory enabled.'
            : 'Accessory disabled.',
        'accessory_id' => $accessoryId,
        'active' => $active,
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
                'FantasyRealm: Accessory update rollback failed.'
            );
        }
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to update accessory availability.'
    ]);
}
