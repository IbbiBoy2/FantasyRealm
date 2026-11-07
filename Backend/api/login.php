<?php

declare(strict_types=1);

/*
 * FANTASYREALM - LOGIN API
 *
 * Authenticates users using email and password.
 * Protects against repeated login attempts using
 * database-backed rate limits.
 */

require_once __DIR__ . '/../config/security.php';
require_once __DIR__ . '/../config/password.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/*
 * Login rate limiting configuration.
 *
 * Account limit: 5 requests per 15 minutes.
 * IP limit: 30 requests per 15 minutes.
 */
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_ACCOUNT_LIMIT = 5;
const LOGIN_IP_LIMIT = 30;

/*
 * Return consistent JSON responses.
 */
function loginRespond(
	int $status,
	bool $success,
	string $message,
	?array $user = null
): never {
	http_response_code($status);

	$response = [
		'success' => $success,
		'message' => $message
	];

	if ($user !== null) {
		$response['user'] = $user;
	}

	echo json_encode($response);
	exit;
}

/*
 * Record one request in a fixed database time window.
 *
 * INSERT ... ON DUPLICATE KEY UPDATE increments the
 * counter atomically, including concurrent requests.
 */
function recordLoginAttempt(
	PDO $pdo,
	string $rateKey
): int {
	$stmt = $pdo->prepare(
		'INSERT INTO login_rate_limits (
            rate_key,
            attempt_count,
            window_started_at
        )
        VALUES (
            :rate_key,
            1,
            NOW()
        )
        ON DUPLICATE KEY UPDATE
            attempt_count = IF(
                window_started_at <=
                    DATE_SUB(
                        NOW(),
                        INTERVAL 15 MINUTE
                    ),
                1,
                attempt_count + 1
            ),
            window_started_at = IF(
                window_started_at <=
                    DATE_SUB(
                        NOW(),
                        INTERVAL 15 MINUTE
                    ),
                NOW(),
                window_started_at
            )'
	);

	$stmt->execute([
		'rate_key' => $rateKey
	]);

	$stmt = $pdo->prepare(
		'SELECT attempt_count
         FROM login_rate_limits
         WHERE rate_key = :rate_key'
	);

	$stmt->execute([
		'rate_key' => $rateKey
	]);

	return (int) $stmt->fetchColumn();
}

/*
 * Only POST requests can authenticate users.
 */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	header('Allow: POST');

	loginRespond(
		405,
		false,
		'Method not allowed.'
	);
}

/*
 * Accept JSON requests only.
 */
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (!preg_match('~^application/json(?:\s*;|$)~i', $contentType)) {
	loginRespond(
		415,
		false,
		'Content type must be application/json.'
	);
}

$raw = file_get_contents('php://input');

if ($raw === false || strlen($raw) > 4096) {
	loginRespond(
		413,
		false,
		'Invalid request size.'
	);
}

$input = json_decode($raw, true);

if (!is_array($input)) {
	loginRespond(
		400,
		false,
		'Invalid JSON request.'
	);
}

/*
 * Validate credential types and formats.
 */
$emailValue = $input['email'] ?? null;
$passwordValue = $input['password'] ?? null;

if (
	!is_string($emailValue) ||
	!is_string($passwordValue)
) {
	loginRespond(
		400,
		false,
		'Invalid login credentials.'
	);
}

$accountEmail = trim($emailValue);
$submittedPassword = $passwordValue;

if ($accountEmail === '' || $submittedPassword === '') {
	loginRespond(
		400,
		false,
		'Please fill in all fields.'
	);
}

if (
	!filter_var($accountEmail, FILTER_VALIDATE_EMAIL) ||
	strlen($accountEmail) > 255
) {
	loginRespond(
		400,
		false,
		'Please enter a valid email address.'
	);
}

/*
 * Generate separate rate-limit keys for the
 * submitted email and the actual client IP.
 *
 * Never trust user-supplied forwarding headers
 * without a configured trusted proxy.
 */
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

$emailRateKey = 'email:' . hash(
	'sha256',
	strtolower($accountEmail)
);

$ipRateKey = 'ip:' . hash(
	'sha256',
	$clientIp
);

try {
	require_once __DIR__ . '/../config/database.php';

	/*
	 * Both counters are updated before checking
	 * credentials, including unknown accounts.
	 *
	 * This avoids bypassing the protection by
	 * repeatedly changing PHP sessions.
	 */
	$emailAttempts = recordLoginAttempt(
		$pdo,
		$emailRateKey
	);

	$ipAttempts = recordLoginAttempt(
		$pdo,
		$ipRateKey
	);

	if (
		$emailAttempts > LOGIN_ACCOUNT_LIMIT ||
		$ipAttempts > LOGIN_IP_LIMIT
	) {
		header('Retry-After: 900');

		loginRespond(
			429,
			false,
			'Too many login attempts. Please try again later.'
		);
	}

	/*
	 * Find the account using a prepared query.
	 */
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
		'email' => $accountEmail
	]);

	$user = $stmt->fetch();

	/*
	 * Never reveal whether an email exists.
	 */
	if (
		!$user ||
		!password_verify(
			$submittedPassword,
			$user['password_hash']
		)
	) {
		loginRespond(
			401,
			false,
			'Invalid email or password.'
		);
	}

	/*
	 * Suspended accounts cannot log in.
	 */
	if ((bool) $user['suspended']) {
		loginRespond(
			403,
			false,
			'Your account is suspended.'
		);
	}

	/*
	 * Rehash older password hashes using
	 * the application's Argon2id settings.
	 */
	$argon2Options = accountPasswordHashOptions();

	if (
		password_needs_rehash(
			$user['password_hash'],
			PASSWORD_ARGON2ID,
			$argon2Options
		)
	) {
		$newHash = hashAccountPassword($submittedPassword);

		$updateStmt = $pdo->prepare(
			'UPDATE users
             SET password_hash = :password_hash
             WHERE id = :id'
		);

		$updateStmt->execute([
			'password_hash' => $newHash,
			'id' => (int) $user['id']
		]);
	}

	/*
	 * Clear the account-specific counter after
	 * successful authentication.
	 *
	 * Keep the IP counter to maintain protection
	 * against attacks involving multiple accounts.
	 */
	$clearStmt = $pdo->prepare(
		'DELETE FROM login_rate_limits
         WHERE rate_key = :rate_key'
	);

	$clearStmt->execute([
		'rate_key' => $emailRateKey
	]);

	/*
	 * Regenerate the session identifier to
	 * protect against session fixation.
	 */
	session_regenerate_id(true);

	unset($_SESSION['csrf_token']);

	$_SESSION['user_id'] = (int) $user['id'];
	$_SESSION['role_id'] = (int) $user['role_id'];
	$_SESSION['username'] = $user['username'];
	$_SESSION['email'] = $user['email'];

	loginRespond(
		200,
		true,
		'Login successful.',
		[
			'id' => (int) $user['id'],
			'role_id' => (int) $user['role_id'],
			'username' => $user['username'],
			'email' => $user['email']
		]
	);

} catch (Throwable $error) {
	error_log('Login request failed.');

	loginRespond(
		500,
		false,
		'An internal server error occurred.'
	);
}
