<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-admin.php';

function sendPromotionResponse(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    header('Allow: GET, POST');

    sendPromotionResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
}

try {
    $admin = requireAdmin($pdo);

    // GET provides the CSRF token for the promotion form.
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (empty($_SESSION['admin_promote_employee_csrf'])) {
            $_SESSION['admin_promote_employee_csrf'] = bin2hex(
                random_bytes(32)
            );
        }

        sendPromotionResponse(200, [
            'success' => true,
            'csrf_token' => $_SESSION['admin_promote_employee_csrf']
        ]);
    }

    // Only JSON requests are accepted.
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (!preg_match('~^application/json(?:\s*;|$)~i', $contentType)) {
        sendPromotionResponse(415, [
            'success' => false,
            'message' => 'Content-Type must be application/json.'
        ]);
    }

    // Protect role changes from cross-site requests.
    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expectedToken = $_SESSION['admin_promote_employee_csrf'] ?? '';

    if (
        !is_string($csrfToken) ||
        !is_string($expectedToken) ||
        $expectedToken === '' ||
        !hash_equals($expectedToken, $csrfToken)
    ) {
        sendPromotionResponse(403, [
            'success' => false,
            'message' => 'Invalid security token.'
        ]);
    }

    try {
        $data = json_decode(
            file_get_contents('php://input'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    } catch (JsonException $e) {
        sendPromotionResponse(400, [
            'success' => false,
            'message' => 'Invalid JSON data.'
        ]);
    }

    $userId = is_array($data)
        ? ($data['user_id'] ?? null)
        : null;

    if (!is_int($userId) || $userId <= 0) {
        sendPromotionResponse(422, [
            'success' => false,
            'message' => 'Provide a valid user ID.'
        ]);
    }

    $pdo->beginTransaction();

    // Lock the account before changing its role.
    $stmt = $pdo->prepare(
        'SELECT users.id, users.username, users.suspended,
                users.role_id, roles.name AS role_name
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id
         FOR UPDATE'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $pdo->rollBack();

        sendPromotionResponse(404, [
            'success' => false,
            'message' => 'Player account not found.'
        ]);
    }

    // Existing employees and administrators cannot be promoted.
    if ($user['role_name'] !== 'USER') {
        $pdo->rollBack();

        sendPromotionResponse(409, [
            'success' => false,
            'message' => 'This account is not a regular player account.'
        ]);
    }

    if ((bool) $user['suspended']) {
        $pdo->rollBack();

        sendPromotionResponse(409, [
            'success' => false,
            'message' => 'Reactivate this player before promoting them.'
        ]);
    }

    // Find the Employee role without assuming its numeric ID.
    $stmt = $pdo->prepare(
        'SELECT id FROM roles WHERE name = :role'
    );

    $stmt->execute([
        'role' => 'EMPLOYEE'
    ]);

    $employeeRoleId = $stmt->fetchColumn();

    if ($employeeRoleId === false) {
        throw new RuntimeException('Employee role is missing.');
    }

    // Promote the existing account.
    $stmt = $pdo->prepare(
        'UPDATE users
         SET role_id = :role_id
         WHERE id = :user_id'
    );

    $stmt->execute([
        'role_id' => (int) $employeeRoleId,
        'user_id' => $userId
    ]);

    $pdo->commit();

    // Record the role change in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        recordStaffActivity(
            (int) $admin['id'],
            'employee.promoted',
            'employee',
            $userId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log('FantasyRealm: Employee promotion logging failed.');
    }

    sendPromotionResponse(200, [
        'success' => true,
        'message' => 'Player promoted to Employee successfully.',
        'user_id' => $userId,
        'username' => $user['username'],
        'role' => 'EMPLOYEE',
        'activity_logged' => $activityLogged
    ]);

} catch (AdminAccessException $e) {
    sendPromotionResponse($e->getHttpStatus(), [
        'success' => false,
        'message' => $e->getMessage()
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('FantasyRealm: Employee promotion failed.');

    sendPromotionResponse(500, [
        'success' => false,
        'message' => 'Unable to promote player.'
    ]);
}
