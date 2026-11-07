<?php

declare(strict_types=1);

final class AdminAccessException extends RuntimeException
{
    public function __construct(
        string $message,
        private int $httpStatus
    ) {
        parent::__construct($message);
    }

    public function getHttpStatus(): int
    {
        return $this->httpStatus;
    }
}

/**
 * Require an active administrator.
 *
 * @param PDO $pdo Active database connection.
 * @return array Authenticated administrator data.
 *
 * @throws AdminAccessException
 * @throws PDOException
 */
function requireAdmin(PDO $pdo): array
{
    // The calling API must start the session.
    if (session_status() !== PHP_SESSION_ACTIVE) {
        throw new LogicException(
            'PHP session has not been started.'
        );
    }

    // Retrieve the authenticated user's ID.
    $userId = $_SESSION['user_id'] ?? null;

    // Reject requests without a valid session user.
    if (!is_int($userId) || $userId <= 0) {
        throw new AdminAccessException(
            'Authentication required.',
            401
        );
    }

    // Retrieve the user's current role and status.
    $stmt = $pdo->prepare(
        'SELECT
            users.id,
            users.username,
            users.suspended,
            roles.name AS role_name

         FROM users

         INNER JOIN roles
            ON users.role_id = roles.id

         WHERE users.id = :user_id

         LIMIT 1'
    );

    $stmt->execute([
        'user_id' => $userId
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // The account may have been deleted.
    if (!$user) {
        throw new AdminAccessException(
            'Authentication required.',
            401
        );
    }

    // Suspended accounts cannot access admin tools.
    if ((bool) $user['suspended']) {
        throw new AdminAccessException(
            'This account is suspended.',
            403
        );
    }

    // Only the ADMIN role is authorized.
    if ($user['role_name'] !== 'ADMIN') {
        throw new AdminAccessException(
            'Administrator access required.',
            403
        );
    }

    // Return only the information needed by the API.
    return [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'role' => $user['role_name']
    ];
}
