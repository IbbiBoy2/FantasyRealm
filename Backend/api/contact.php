<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

// =========================
// REQUEST VALIDATION
// =========================

// Contact messages are submitted with POST requests.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


$data = json_decode(
    file_get_contents('php://input'),
    true
);


if (!is_array($data)) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON data.'
    ]);

    exit;
}


$username = trim($data['username'] ?? '');
$email = trim($data['email'] ?? '');
$message = trim($data['message'] ?? '');


if (
    $email === '' ||
    $message === ''
) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Please fill in all fields.'
    ]);

    exit;
}

// =========================
// INPUT VALIDATION
// =========================

// Validates required fields, email format, and maximum lengths on the server.

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Please enter a valid email address.'
    ]);

    exit;
}


if (mb_strlen($username) > 50) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Username is too long.'
    ]);

    exit;
}


if (mb_strlen($email) > 255) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Email address is too long.'
    ]);

    exit;
}


if (mb_strlen($message) > 2000) {

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Message must be 2000 characters or less.'
    ]);

    exit;
}

// =========================
// SAVE MESSAGE
// =========================

// Uses a prepared statement to safely store the contact message.

try {

    $stmt = $pdo->prepare(
        'INSERT INTO contact_messages (
            user_id,
            username,
            email,
            message
        ) VALUES (
            :user_id,
            :username,
            :email,
            :message
        )'
    );

// Logged-in users are linked to their account; visitors are stored with a NULL user_id.

    $stmt->execute([
        'user_id' => $_SESSION['user_id'] ?? null,
        'username' => $username,
        'email' => $email,
        'message' => $message
    ]);


    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Your message has been sent successfully.'
    ]);

// Returns a generic server error without exposing database details.

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to send your message.'
    ]);
}