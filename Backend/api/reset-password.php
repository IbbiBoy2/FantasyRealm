<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';


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


$token = trim($input['token'] ?? '');
$password = $input['password'] ?? '';
$passwordConfirm = $input['password_confirm'] ?? '';


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
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Passwords do not match.'
    ]);

    exit;
}


try {

    $tokenHash = hash(
        'sha256',
        $token
    );


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


    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );


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