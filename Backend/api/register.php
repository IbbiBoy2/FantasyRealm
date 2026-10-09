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


$username = trim($input['username'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$passwordConfirm = $input['password_confirm'] ?? '';


if (
    $username === '' ||
    $email === '' ||
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


if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please enter a valid email address.'
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

    $stmt = $pdo->prepare(
        'SELECT id
         FROM users
         WHERE email = :email
            OR username = :username
         LIMIT 1'
    );

    $stmt->execute([
        'email' => $email,
        'username' => $username
    ]);

    $existingUser = $stmt->fetch();


    if ($existingUser) {
        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'This email or username is already in use.'
        ]);

        exit;
    }


    $stmt = $pdo->prepare(
        'SELECT id
         FROM roles
         WHERE name = :name
         LIMIT 1'
    );

    $stmt->execute([
        'name' => 'USER'
    ]);

    $role = $stmt->fetch();


    if (!$role) {
        throw new RuntimeException(
            'Default USER role was not found.'
        );
    }


    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );


    $stmt = $pdo->prepare(
        'INSERT INTO users (
            role_id,
            email,
            username,
            password_hash,
            suspended
        )
        VALUES (
            :role_id,
            :email,
            :username,
            :password_hash,
            0
        )'
    );

    $stmt->execute([
        'role_id' => $role['id'],
        'email' => $email,
        'username' => $username,
        'password_hash' => $passwordHash
    ]);


    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully.',
        'user' => [
            'id' => (int) $pdo->lastInsertId(),
            'username' => $username,
            'email' => $email
        ]
    ]);

} catch (PDOException $e) {

    if ($e->getCode() === '23000') {
        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'This email or username is already in use.'
        ]);

        exit;
    }


    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'An internal server error occurred.'
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'An internal server error occurred.'
    ]);
}