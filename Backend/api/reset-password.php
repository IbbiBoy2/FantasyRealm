<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

// =========================
// REQUEST VALIDATION
// =========================

// Password resets only accept POST requests.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


$input = json_decode(
    file_get_contents('php://input'),
    true
);


if (!is_array($input)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON request.'
    ]);

    exit;
}


// =========================
// INPUT TYPE VALIDATION
// =========================

// Reject malformed input before processing reset requests.
$token = is_string($input['token'] ?? null)
    ? trim($input['token'])
    : '';

$password = is_string($input['password'] ?? null)
    ? $input['password']
    : '';

$passwordConfirm = is_string($input['password_confirm'] ?? null)
    ? $input['password_confirm']
    : '';


if (
    $token === '' ||
    $password === '' ||
    $passwordConfirm === ''
) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please fill in all fields.'
    ]);

    exit;
}


if ($password !== $passwordConfirm) {

// =========================
// PASSWORD SECURITY
// =========================

// Enforce the same password requirements as registration.
if (
    mb_strlen($password, 'UTF-8') < 12 ||
    strlen($password) > 72
) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 12 characters and no more than 72 bytes.'
    ]);

    exit;
}

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Passwords do not match.'
    ]);

    exit;
}

// =========================
// PASSWORD SECURITY
// =========================

// Enforce password requirements before checking the reset token.
if (
    mb_strlen($password, 'UTF-8') < 12 ||
    strlen($password) > 72
) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 12 characters and no more than 72 bytes.'
    ]);

    exit;
}

// =========================
// TOKEN VERIFICATION
// =========================

// Hashes the submitted token so it can be compared with the hash stored in the database.

try {

    $tokenHash = hash(
        'sha256',
        $token
    );

// The reset token must exist and still be within its expiration time.

    $stmt = $pdo->prepare(
        'SELECT id
         FROM users
         WHERE reset_token_hash = :reset_token_hash
           AND reset_token_expires_at > NOW()
         LIMIT 1'
    );

    $stmt->execute([
        'reset_token_hash' => $tokenHash
    ]);

    $user = $stmt->fetch();


    if (!$user) {
        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'This password reset link is invalid or has expired.'
        ]);

        exit;
    }

// Hashes the new password before saving it.

    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    // Updates the password and immediately invalidates the reset token.

    $stmt = $pdo->prepare(
        'UPDATE users
         SET password_hash = :password_hash,
             reset_token_hash = NULL,
             reset_token_expires_at = NULL
         WHERE id = :id'
    );

    $stmt->execute([
        'password_hash' => $passwordHash,
        'id' => $user['id']
    ]);


    echo json_encode([
        'success' => true,
        'message' => 'Password reset successfully.'
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'An internal server error occurred.'
    ]);
}