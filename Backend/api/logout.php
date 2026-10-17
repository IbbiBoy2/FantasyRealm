<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

// Logout is performed with POST to avoid changing session state through a normal GET link.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

// Removes all session data for the authenticated user.

$_SESSION = [];

// Destroys the PHP session on the server.

session_destroy();

echo json_encode([
    'success' => true,
    'message' => 'Logout successful.'
]);