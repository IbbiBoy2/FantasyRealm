<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

$_SESSION = [];

session_destroy();

echo json_encode([
    'success' => true,
    'message' => 'Logout successful.'
]);