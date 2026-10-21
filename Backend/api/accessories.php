<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';

// =========================
// REQUEST VALIDATION
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
// LOAD AVAILABLE ACCESSORIES
// =========================

// Only active catalogue items are offered for new character selections.

try {
    $stmt = $pdo->query(
        'SELECT id, name, type
         FROM accessories
         WHERE active = 1
         ORDER BY type ASC, name ASC, id ASC'
    );

    $accessories = $stmt->fetchAll();

    foreach ($accessories as &$accessory) {
        $accessory['id'] = (int) $accessory['id'];
    }

    unset($accessory);

    echo json_encode([
        'success' => true,
        'accessories' => $accessories
    ]);

// =========================
// ERROR HANDLING
// =========================

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load available accessories.'
    ]);
}