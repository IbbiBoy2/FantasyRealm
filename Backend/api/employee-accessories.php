<?php

declare(strict_types=1);

/*
 * FANTASYREALM - STAFF EQUIPMENT CATALOGUE
 * Include gender and the optional replacement body image while preserving
 * existing usage counts and access restrictions.
 */
require_once __DIR__ . '/../config/security.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'You must be logged in.']);
    exit;
}
require_once __DIR__ . '/../config/database.php';

try {
    $stmt = $pdo->prepare(
        'SELECT users.suspended, roles.name AS role_name
         FROM users INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id'
    );
    $stmt->execute(['user_id' => $_SESSION['user_id']]);
    $actor = $stmt->fetch(PDO::FETCH_ASSOC);
    if (
        !$actor || (bool) $actor['suspended'] ||
        !in_array($actor['role_name'], ['EMPLOYEE', 'ADMIN'], true)
    ) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Employee access required.']);
        exit;
    }
    $stmt = $pdo->query(
        'SELECT accessories.id, accessories.name, accessories.type,
                accessories.gender, accessories.image_path,
                accessories.body_image_path, accessories.active,
                (SELECT COUNT(*) FROM character_accessories
                 WHERE character_accessories.accessory_id = accessories.id) AS usage_count
         FROM accessories
         ORDER BY accessories.type ASC, accessories.name ASC, accessories.id ASC'
    );
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$item) {
        $item['id'] = (int) $item['id'];
        $item['active'] = (bool) $item['active'];
        $item['usage_count'] = (int) $item['usage_count'];
    }
    unset($item);
    echo json_encode(['success' => true, 'accessories' => $items]);
} catch (Throwable $error) {
    error_log('FantasyRealm: Staff equipment listing failed.');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load equipment.']);
}
