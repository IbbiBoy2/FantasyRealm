<?php

declare(strict_types=1);

// =========================
// SECURE SESSION
// =========================

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Require HTTPS for secure cookies in production.
    // Localhost HTTP remains supported during development.
    $isHttps = (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
        (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443
    );

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    session_start();
}

// =========================
// CSRF TOKEN GENERATION
// =========================

function getCsrfToken(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        throw new LogicException('Session must be started first.');
    }

    if (
        !isset($_SESSION['csrf_token']) ||
        !is_string($_SESSION['csrf_token'])
    ) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

// =========================
// CSRF TOKEN VALIDATION
// =========================

function requireCsrfToken(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        throw new LogicException('Session must be started first.');
    }

    $expected = $_SESSION['csrf_token'] ?? null;
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;

    if (
        !is_string($expected) ||
        $expected === '' ||
        !is_string($provided) ||
        !hash_equals($expected, $provided)
    ) {
        http_response_code(403);

        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'success' => false,
            'message' => 'Invalid or missing security token.'
        ]);

        exit;
    }
}
