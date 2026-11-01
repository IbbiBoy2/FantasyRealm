<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/require-admin.php';

    $admin = requireAdmin($pdo);
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'GET') {
        if (
            !isset($_SESSION['admin_employee_status_csrf']) ||
            !is_string($_SESSION['admin_employee_status_csrf'])
        ) {
            $_SESSION['admin_employee_status_csrf'] = bin2hex(random_bytes(32));
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'csrf_token' => $_SESSION['admin_employee_status_csrf']
        ]);
        exit;
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed.'
        ]);
        exit;
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (!preg_match('/^application\/json(?:\s*;|$)/i', $contentType)) {
        http_response_code(415);
        echo json_encode([
            'success' => false,
            'message' => 'Content-Type must be application/json.'
        ]);
        exit;
    }

    $expectedToken = $_SESSION['admin_employee_status_csrf'] ?? null;
    $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    if (
        !is_string($expectedToken) ||
        !is_string($providedToken) ||
        !hash_equals($expectedToken, $providedToken)
    ) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid security token.'
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

    $employeeId = $data['employee_id'] ?? null;
    $suspended = $data['suspended'] ?? null;

    if (
        !is_int($employeeId) ||
        $employeeId <= 0 ||
        !is_bool($suspended)
    ) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Provide a valid employee ID and suspension status.'
        ]);
        exit;
    }

    if ($employeeId === (int) $admin['id']) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'You cannot modify your own account.'
        ]);
        exit;
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'SELECT
            users.id,
            users.username,
            users.suspended
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :employee_id
           AND roles.name = :role
         FOR UPDATE'
    );

    $stmt->execute([
        'employee_id' => $employeeId,
        'role' => 'EMPLOYEE'
    ]);

    $employee = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$employee) {
        $pdo->rollBack();

        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Employee account not found.'
        ]);
        exit;
    }

    $currentStatus = (bool) $employee['suspended'];

    if ($currentStatus === $suspended) {
        $pdo->commit();

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $suspended
                ? 'Employee is already suspended.'
                : 'Employee is already active.',
            'employee' => [
                'id' => $employeeId,
                'username' => $employee['username'],
                'suspended' => $suspended,
                'status' => $suspended ? 'SUSPENDED' : 'ACTIVE'
            ],
            'changed' => false,
            'activity_logged' => null
        ]);
        exit;
    }

    $stmt = $pdo->prepare(
        'UPDATE users
         SET suspended = :suspended
         WHERE id = :employee_id'
    );

    $stmt->execute([
        'suspended' => $suspended ? 1 : 0,
        'employee_id' => $employeeId
    ]);

    $pdo->commit();

    // Record the successful change in MongoDB.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        $action = $suspended
            ? 'employee.suspended'
            : 'employee.reactivated';

        recordStaffActivity(
            (int) $admin['id'],
            $action,
            'employee',
            $employeeId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Employee status activity logging failed.'
        );
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => !$activityLogged
            ? 'Employee status updated, but activity logging failed.'
            : ($suspended
                ? 'Employee suspended successfully.'
                : 'Employee reactivated successfully.'),
        'employee' => [
            'id' => $employeeId,
            'username' => $employee['username'],
            'suspended' => $suspended,
            'status' => $suspended ? 'SUSPENDED' : 'ACTIVE'
        ],
        'changed' => true,
        'activity_logged' => $activityLogged
    ]);

} catch (AdminAccessException $e) {
    http_response_code($e->getHttpStatus());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO) {
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (Throwable $rollbackError) {
            error_log(
                'FantasyRealm: Employee update rollback failed.'
            );
        }
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to update employee account.'
    ]);
}
