<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'authenticated' => false,
        'user' => null
    ]);

    exit;
}

echo json_encode([
    'authenticated' => true,
    'user' => [
        'id' => (int) $_SESSION['user_id'],
        'role_id' => (int) $_SESSION['role_id'],
        'username' => $_SESSION['username'],
        'email' => $_SESSION['email']
    ]
]);