<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-admin.php';

function sendJson(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    $admin = requireAdmin($pdo);
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'GET') {
        if (
            !isset($_SESSION['admin_create_employee_csrf']) ||
            !is_string($_SESSION['admin_create_employee_csrf'])
        ) {
            $_SESSION['admin_create_employee_csrf'] =
                bin2hex(random_bytes(32));
        }

        sendJson(200, [
            'success' => true,
            'csrf_token' => $_SESSION['admin_create_employee_csrf']
        ]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        sendJson(405, [
            'success' => false,
            'message' => 'Method not allowed.'
        ]);
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (!preg_match('/^application\/json(?:\s*;|$)/i', $contentType)) {
        sendJson(415, [
            'success' => false,
            'message' => 'Content-Type must be application/json.'
        ]);
    }

    $expectedToken = $_SESSION['admin_create_employee_csrf'] ?? null;
    $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    if (
        !is_string($expectedToken) ||
        !is_string($providedToken) ||
        !hash_equals($expectedToken, $providedToken)
    ) {
        sendJson(403, [
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
        sendJson(400, [
            'success' => false,
            'message' => 'Invalid JSON data.'
        ]);
    }

    if (!is_array($data)) {
        sendJson(400, [
            'success' => false,
            'message' => 'Invalid JSON data.'
        ]);
    }

    if (
        !is_string($data['username'] ?? null) ||
        !is_string($data['email'] ?? null) ||
        !is_string($data['password'] ?? null) ||
        !is_string($data['password_confirm'] ?? null)
    ) {
        sendJson(422, [
            'success' => false,
            'message' => 'Invalid employee information.'
        ]);
    }

    $username = trim($data['username']);
    $email = trim($data['email']);
    $password = $data['password'];
    $passwordConfirm = $data['password_confirm'];

    if (
        mb_strlen($username) < 3 ||
        mb_strlen($username) > 100 ||
        preg_match('/[\x00-\x1F\x7F]/', $username)
    ) {
        sendJson(422, [
            'success' => false,
            'message' => 'Username must contain 3 to 100 valid characters.'
        ]);
    }

    if (
        strlen($email) > 255 ||
        !filter_var($email, FILTER_VALIDATE_EMAIL)
    ) {
        sendJson(422, [
            'success' => false,
            'message' => 'Please provide a valid email address.'
        ]);
    }

    if (strlen($password) < 12 || strlen($password) > 72) {
        sendJson(422, [
            'success' => false,
            'message' => 'Password must contain between 12 and 72 bytes.'
        ]);
    }

    if ($password !== $passwordConfirm) {
        sendJson(422, [
            'success' => false,
            'message' => 'Passwords do not match.'
        ]);
    }

    $stmt = $pdo->prepare(
        'SELECT id FROM roles
         WHERE name = :role
         LIMIT 1'
    );

    $stmt->execute(['role' => 'EMPLOYEE']);
    $roleId = $stmt->fetchColumn();

    if ($roleId === false) {
        throw new RuntimeException('Employee role not found.');
    }

    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    $stmt = $pdo->prepare(
        'INSERT INTO users (
            role_id,
            username,
            email,
            password_hash,
            suspended
        ) VALUES (
            :role_id,
            :username,
            :email,
            :password_hash,
            0
        )'
    );

    $stmt->execute([
        'role_id' => (int) $roleId,
        'username' => $username,
        'email' => $email,
        'password_hash' => $passwordHash
    ]);

    $employeeId = (int) $pdo->lastInsertId();

    // Record the creation after MariaDB confirms success.
    $activityLogged = false;

    try {
        require_once __DIR__ . '/../config/activity-logger.php';

        recordStaffActivity(
            (int) $admin['id'],
            'employee.created',
            'employee',
            $employeeId
        );

        $activityLogged = true;
    } catch (Throwable $logError) {
        error_log(
            'FantasyRealm: Employee creation activity logging failed.'
        );
    }

    sendJson(201, [
        'success' => true,
        'message' => $activityLogged
            ? 'Employee created successfully.'
            : 'Employee created, but the activity log could not be saved.',
        'employee' => [
            'id' => $employeeId,
            'username' => $username,
            'email' => $email,
            'role' => 'EMPLOYEE',
            'suspended' => false
        ],
        'activity_logged' => $activityLogged
    ]);

} catch (AdminAccessException $e) {
    sendJson($e->getHttpStatus(), [
        'success' => false,
        'message' => $e->getMessage()
    ]);

} catch (PDOException $e) {
    $isDuplicate = (int) ($e->errorInfo[1] ?? 0) === 1062;

    sendJson($isDuplicate ? 409 : 500, [
        'success' => false,
        'message' => $isDuplicate
            ? 'This username or email is already in use.'
            : 'Unable to create employee.'
    ]);

} catch (Throwable $e) {
    sendJson(500, [
        'success' => false,
        'message' => 'Unable to create employee.'
    ]);
}
