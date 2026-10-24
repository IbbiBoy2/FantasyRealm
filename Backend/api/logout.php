<?php

declare(strict_types=1);

// =========================
// SECURE SESSION
// =========================

require_once __DIR__ . '/../config/security.php';
startSecureSession();

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

// =========================
// SECURE LOGOUT
// =========================

// Remove all session data.
$_SESSION = [];

// Expire the session cookie in the browser.
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();

    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => $params['samesite'] ?? 'Lax'
    ]);
}

// Destroy the session on the server.
session_destroy();

echo json_encode([
    'success' => true,
    'message' => 'Logout successful.'
]);