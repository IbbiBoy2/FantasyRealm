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


$email = trim($input['email'] ?? '');


if ($email === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please enter your email address.'
    ]);

    exit;
}


if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please enter a valid email address.'
    ]);

    exit;
}


try {

    $stmt = $pdo->prepare(
        'SELECT id
         FROM users
         WHERE email = :email
         LIMIT 1'
    );

    $stmt->execute([
        'email' => $email
    ]);

    $user = $stmt->fetch();


    $response = [
        'success' => true,
        'message' =>
            'If an account exists for this email, a password reset link has been created.'
    ];


    if ($user) {

        $token = bin2hex(
            random_bytes(32)
        );

        $tokenHash = hash(
            'sha256',
            $token
        );

        $expiresAt = date(
            'Y-m-d H:i:s',
            strtotime('+1 hour')
        );


        $stmt = $pdo->prepare(
            'UPDATE users
             SET reset_token_hash = :reset_token_hash,
                 reset_token_expires_at = :reset_token_expires_at
             WHERE id = :id'
        );

        $stmt->execute([
            'reset_token_hash' => $tokenHash,
            'reset_token_expires_at' => $expiresAt,
            'id' => $user['id']
        ]);


        $response['reset_url'] =
            '/FantasyRealm/Frontend/Html/reset-password.html?token='
            . urlencode($token);
    }


    echo json_encode($response);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'An internal server error occurred.'
    ]);
}