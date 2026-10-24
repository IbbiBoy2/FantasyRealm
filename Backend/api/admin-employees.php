<?php

declare(strict_types=1);

// =========================
// SESSION AND HEADERS
// =========================

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// =========================
// REQUEST METHOD
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
// DATABASE AND SECURITY
// =========================

try {

    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/require-admin.php';

    // Only active administrators may continue.
    $admin = requireAdmin($pdo);

    // =========================
    // RETRIEVE EMPLOYEES
    // =========================

    $stmt = $pdo->prepare(
        'SELECT
            users.id,
            users.username,
            users.email,
            users.suspended,
            users.created_at

         FROM users

         INNER JOIN roles
            ON users.role_id = roles.id

         WHERE roles.name = :role

         ORDER BY users.created_at DESC,
                  users.id DESC'
    );

    $stmt->execute([
        'role' => 'EMPLOYEE'
    ]);

    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // =========================
    // FORMAT EMPLOYEE DATA
    // =========================

    foreach ($employees as &$employee) {

        $employee['id'] = (int) $employee['id'];

        $employee['suspended'] =
            (bool) $employee['suspended'];

        $employee['status'] =
            $employee['suspended']
                ? 'SUSPENDED'
                : 'ACTIVE';
    }

    unset($employee);

    // =========================
    // SUCCESS RESPONSE
    // =========================

    http_response_code(200);

    echo json_encode([
        'success' => true,

        'employees' => $employees,

        'total' => count($employees)
    ]);

} catch (AdminAccessException $e) {

    // =========================
    // AUTHORIZATION ERRORS
    // =========================

    http_response_code($e->getHttpStatus());

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);

} catch (Throwable $e) {

    // =========================
    // SERVER ERRORS
    // =========================

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load employee accounts.'
    ]);
}
