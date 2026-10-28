<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

// =========================
// REQUEST VALIDATION
// =========================

// Registration only accepts POST requests.

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

// Only accept strings for registration fields.

$username = is_string($input['username'] ?? null)
    ? trim($input['username'])
    : '';

$email = is_string($input['email'] ?? null)
    ? trim($input['email'])
    : '';

$password = is_string($input['password'] ?? null)
    ? $input['password']
    : '';

$passwordConfirm = is_string($input['password_confirm'] ?? null)
    ? $input['password_confirm']
    : '';


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

// =========================
// PASSWORD SECURITY 
// =========================

// Require at least 12 characters.
// Limit passwords to 72 bytes to avoid silent truncation by bcrypt.

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
// DUPLICATE ACCOUNT CHECK
// =========================

// Prevents duplicate email addresses and usernames.

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

// =========================
// DEFAULT ROLE
// =========================

// New accounts are assigned the standard USER role.

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

// Prepared statements keep user input separate from SQL.

$passwordHash = password_hash(
    $password,
    PASSWORD_ARGON2ID,
    [
        'memory_cost' => 19456,
        'time_cost' => 2,
        'threads' => 1
    ]
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

// Database constraint errors are converted into safe API responses.

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