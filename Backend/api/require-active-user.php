<?php

declare(strict_types=1);

// =========================
// ACTIVE ACCOUNT CHECK
// =========================

// Protected endpoints call this before reading or changing private data.

function requireActiveUser(PDO $pdo): void
{
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'You must be logged in.'
        ]);

        exit;
    }

    try {
        $stmt = $pdo->prepare(
            'SELECT suspended
             FROM users
             WHERE id = :user_id'
        );

        $stmt->execute([
            'user_id' => $_SESSION['user_id']
        ]);

        $user = $stmt->fetch();

        // Invalidates this session if the account was deleted or suspended.

        if (!$user || (bool) $user['suspended']) {
            $_SESSION = [];
            session_destroy();

            http_response_code($user ? 403 : 401);

            echo json_encode([
                'success' => false,
                'message' => $user
                    ? 'Your account is suspended.'
                    : 'Your account is no longer available.'
            ]);

            exit;
        }

    } catch (Throwable $e) {
        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => 'Unable to verify account access.'
        ]);

        exit;
    }
}