<?php

declare(strict_types=1);

/*
 * FANTASYREALM - PASSWORD RESET API
 *
 * Validates a one-time recovery token, enforces
 * password requirements, and stores the new
 * password using Argon2id.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/../config/password.php';

function respond(
	int $status,
	bool $success,
	string $message
): never {
	http_response_code($status);

	echo json_encode([
		'success' => $success,
		'message' => $message
	]);

	exit;
}

/*
 * Only POST requests may reset a password.
 */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	header('Allow: POST');

	respond(405, false, 'Method not allowed.');
}

/*
 * Accept a limited JSON request body.
 */
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (!preg_match('~^application/json(?:\s*;|$)~i', $contentType)) {
	respond(
		415,
		false,
		'Content type must be application/json.'
	);
}

$raw = file_get_contents('php://input');

if ($raw === false || strlen($raw) > 4096) {
	respond(413, false, 'Invalid request size.');
}

$input = json_decode($raw, true);

if (!is_array($input)) {
	respond(400, false, 'Invalid JSON request.');
}

/*
 * Reject invalid field types before processing
 * any password or recovery token.
 */
$tokenValue = $input['token'] ?? null;
$passwordValue = $input['password'] ?? null;
$passwordConfirmValue = $input['password_confirm'] ?? null;

if (
	!is_string($tokenValue) ||
	!is_string($passwordValue) ||
	!is_string($passwordConfirmValue)
) {
	respond(422, false, 'Invalid password reset information.');
}

$token = trim($tokenValue);
$newPassword = $passwordValue;
$passwordConfirm = $passwordConfirmValue;

if (
	$token === '' ||
	$newPassword === '' ||
	$passwordConfirm === ''
) {
	respond(400, false, 'Please fill in all fields.');
}

/*
 * Recovery tokens consist of 32 random bytes
 * represented as 64 hexadecimal characters.
 */
if (!preg_match('/\A[a-fA-F0-9]{64}\z/D', $token)) {
	respond(
		400,
		false,
		'This password reset link is invalid or has expired.'
	);
}

/*
 * Confirm both password fields match.
 */
if ($newPassword !== $passwordConfirm) {
	respond(400, false, 'Passwords do not match.');
}

/*
 * Enforce the shared password policy.
 */
$passwordError = validateAccountPassword($newPassword);

if ($passwordError !== null) {
	respond(
		422,
		false,
		$passwordError
	);
}

try {
	require_once __DIR__ . '/../config/database.php';

	/*
	 * Hash the submitted token instead of
	 * storing or searching for the raw token.
	 */
	$tokenHash = hash('sha256', $token);

	/*
	 * Hash the new password with the shared
	 * Argon2id configuration.
	 */
	$passwordHash = hashAccountPassword($newPassword);

	/*
	 * Update the password only when the token
	 * still exists and has not expired.
	 *
	 * The token is invalidated in the same SQL
	 * statement, preventing simultaneous reuse.
	 */
	$stmt = $pdo->prepare(
		'UPDATE users
         SET password_hash = :password_hash,
             reset_token_hash = NULL,
             reset_token_expires_at = NULL
         WHERE reset_token_hash = :token_hash
           AND reset_token_expires_at > NOW()
           AND suspended = 0'
	);

	$stmt->execute([
		'password_hash' => $passwordHash,
		'token_hash' => $tokenHash
	]);

	/*
	 * A successful reset must update exactly
	 * one account.
	 */
	if ($stmt->rowCount() !== 1) {
		respond(
			400,
			false,
			'This password reset link is invalid or has expired.'
		);
	}

	respond(
		200,
		true,
		'Password reset successfully.'
	);

} catch (Throwable $error) {
	error_log('Password reset request failed.');

	respond(
		500,
		false,
		'An internal server error occurred.'
	);
}
