<?php

declare(strict_types=1);


// =========================
// SESSION
// =========================

session_start();

// =========================
// RESPONSE HEADERS
// =========================

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

    // Check administrator permissions.
    $admin = requireAdmin($pdo);

    // =========================
    // DASHBOARD STATISTICS
    // =========================

    $stmt = $pdo->query(
        "SELECT

            COUNT(
                CASE
                    WHEN roles.name = 'EMPLOYEE'
                    THEN 1
                END
            ) AS total_employees,

            COUNT(
                CASE
                    WHEN roles.name = 'EMPLOYEE'
                    AND users.suspended = 0
                    THEN 1
                END
            ) AS active_employees,

            COUNT(
                CASE
                    WHEN roles.name = 'EMPLOYEE'
                    AND users.suspended = 1
                    THEN 1
                END
            ) AS suspended_employees,

            COUNT(
                CASE
                    WHEN roles.name = 'USER'
                    THEN 1
                END
            ) AS total_players,

            COUNT(
                CASE
                    WHEN roles.name = 'ADMIN'
                    THEN 1
                END
            ) AS total_admins

         FROM users

         INNER JOIN roles
            ON users.role_id = roles.id"
    );

    $statistics = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!is_array($statistics)) {
        throw new RuntimeException(
            'Dashboard statistics unavailable.'
        );
    }

    // Convert SQL counts to integers.
    foreach ($statistics as $key => $value) {
        $statistics[$key] = (int) $value;
    }

    // =========================
    // SUCCESS RESPONSE
    // =========================

    http_response_code(200);

    echo json_encode([
        'success' => true,

        'admin' => [
            'id' => $admin['id'],
            'username' => $admin['username'],
            'role' => $admin['role']
        ],

        'statistics' => $statistics
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

    // Never expose database details to users.

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load administrator dashboard.'
    ]);
}

