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

    // Validate the accessory ID.
    $accessoryId = $data['accessory_id'] ?? null;

    if (!is_int($accessoryId) || $accessoryId <= 0) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid accessory ID.'
        ]);
        exit;
    }

    // The database prevents deleting equipment used by characters.
    $stmt = $pdo->prepare(
        'DELETE FROM accessories
         WHERE id = :accessory_id'
    );

    $stmt->execute([
        'accessory_id' => $accessoryId
    ]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Accessory not found.'
        ]);
        exit;
    }

    // Record successful equipment deletion in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        recordStaffActivity(
            (int) $_SESSION['user_id'],
            'accessory.deleted',
            'accessory',
            $accessoryId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Accessory deletion activity logging failed.'
        );
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Accessory deleted permanently.',
        'accessory_id' => $accessoryId,
        'activity_logged' => $activityLogged
    ]);

} catch (PDOException $e) {
    // Error 1451 means the accessory is referenced by another record.
    $inUse = (int) ($e->errorInfo[1] ?? 0) === 1451;

    http_response_code($inUse ? 409 : 500);
    echo json_encode([
        'success' => false,
        'message' => $inUse
            ? 'This accessory is used by saved characters. Disable it instead.'
            : 'Unable to delete accessory.'
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to delete accessory.'
    ]);
}
