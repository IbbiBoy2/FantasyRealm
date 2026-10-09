<?php

declare(strict_types=1);

session_start();

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
$password = $input['password'] ?? '';


if ($email === '' || $password === '') {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please fill in all fields.'
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
        'SELECT
            id,
            role_id,
            email,
            username,
            password_hash,
            suspended
        FROM users
        WHERE email = :email
        LIMIT 1'
    );

    $stmt->execute([
        'email' => $email
    ]);

    $user = $stmt->fetch();


    if (
        !$user ||
        !password_verify(
            $password,
            $user['password_hash']
        )
    ) {

        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid email or password.'
        ]);

        exit;
    }


    if ((bool) $user['suspended']) {

        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'Your account is suspended.'
        ]);

        exit;
    }


    session_regenerate_id(true);


    $_SESSION['user_id'] = (int) $user['id'];

    $_SESSION['role_id'] = (int) $user['role_id'];

    $_SESSION['username'] = $user['username'];

    $_SESSION['email'] = $user['email'];


    http_response_code(200);


    echo json_encode([
        'success' => true,

        'message' => 'Login successful.',

        'user' => [
            'id' => (int) $user['id'],
            'role_id' => (int) $user['role_id'],
            'username' => $user['username'],
            'email' => $user['email']
        ]
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'An internal server error occurred.'
    ]);

}