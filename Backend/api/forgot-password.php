<?php

declare(strict_types=1);

/*
 * FANTASYREALM - PASSWORD RECOVERY API
 *
 * Verifies an email/username pair, generates a temporary
 * password reset token and delivers it privately via SMTP.
 *
 * Raw reset tokens must never be returned in API responses
 * or written to application logs.
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/security.php';

use PHPMailer\PHPMailer\PHPMailer;

startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

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

/* Only POST requests may create recovery requests. */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	header('Allow: POST');

	respond(405, false, 'Method not allowed.');
}

/*
 * Load application configuration without exposing
 * credentials to the frontend.
 */
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
$dotenv->safeLoad();

$mailHost = trim($_ENV['MAIL_HOST'] ?? '');
$mailUsername = trim($_ENV['MAIL_USERNAME'] ?? '');
$mailPassword = $_ENV['MAIL_PASSWORD'] ?? '';
$mailFrom = trim($_ENV['MAIL_FROM'] ?? '');
$mailFromName = trim(
	$_ENV['MAIL_FROM_NAME'] ?? 'FantasyRealm'
);

$appPublicUrl = rtrim(
	trim($_ENV['APP_PUBLIC_URL'] ?? ''),
	'/'
);

$mailPort = filter_var(
	$_ENV['MAIL_PORT'] ?? null,
	FILTER_VALIDATE_INT,
	[
		'options' => [
			'min_range' => 1,
			'max_range' => 65535
		]
	]
);

/*
 * Fail closed when the mail transport is not configured.
 * Do not claim that an email was delivered.
 */
if (
	$mailHost === '' ||
	$mailFrom === '' ||
	!filter_var($mailFrom, FILTER_VALIDATE_EMAIL) ||
	$mailPort === false ||
	!filter_var($appPublicUrl, FILTER_VALIDATE_URL)
) {
	error_log('Password recovery SMTP is not configured.');

	respond(
		503,
		false,
		'Password recovery is temporarily unavailable.'
	);
}

/*
 * Limit repeat submissions from one PHP session.
 * Public deployment also requires server-side rate
 * limiting across sessions and client addresses.
 */
$now = time();
$lastRequest = $_SESSION['last_password_recovery'] ?? 0;

if (
	is_int($lastRequest) &&
	$lastRequest > 0 &&
	($now - $lastRequest) < 60
) {
	respond(
		429,
		false,
		'Please wait before submitting another request.'
	);
}

/* Accept only a small JSON body with string fields. */
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (
	!preg_match(
		'~^application/json(?:\s*;|$)~i',
		$contentType
	)
) {
	respond(415, false, 'Content type must be application/json.');
}

$raw = file_get_contents('php://input');

if ($raw === false || strlen($raw) > 4096) {
	respond(413, false, 'Invalid request size.');
}

$data = json_decode($raw, true);

if (!is_array($data)) {
	respond(400, false, 'Invalid JSON request.');
}

$emailValue = $data['email'] ?? null;
$usernameValue = $data['username'] ?? null;

if (
	!is_string($emailValue) ||
	!is_string($usernameValue)
) {
	respond(422, false, 'Invalid recovery information.');
}

$email = trim($emailValue);
$accountUsername = trim($usernameValue);

if (
	!filter_var($email, FILTER_VALIDATE_EMAIL) ||
	mb_strlen($email, 'UTF-8') > 255 ||
	$accountUsername === '' ||
	mb_strlen($accountUsername, 'UTF-8') > 50
) {
	respond(422, false, 'Please check the information entered.');
}

/*
 * Return the same confirmation for existing and unknown
 * accounts to avoid account enumeration.
 */
$genericMessage =
	'If the details match an account, ' .
	'recovery instructions will be sent by email.';

try {
	require_once __DIR__ . '/../config/database.php';

	/*
	 * ACCOUNT LOOKUP
	 *
	 * First retrieve the active account by email,
	 * then compare the username in PHP.
	 *
	 * This avoids depending on an SQL comparison
	 * for both identity fields simultaneously.
	 */
	$stmt = $pdo->prepare(
		'SELECT id, email, username
     FROM users
     WHERE email = :email
       AND suspended = 0
     LIMIT 1'
	);

	$stmt->execute([
		'email' => $email
	]);

	$user = $stmt->fetch();

	if (
		!$user ||
		!hash_equals(
			(string) $user['username'],
			$accountUsername
		)
	) {
		$user = false;
	}

	/*
	 * Apply the same session cooldown whether or not
	 * the account exists.
	 */
	$_SESSION['last_password_recovery'] = time();

	if (!$user) {
		respond(200, true, $genericMessage);
	}

	/*
	 * Create a cryptographically secure one-hour token.
	 * Only its hash is stored in the database.
	 */
	$token = bin2hex(random_bytes(32));
	$tokenHash = hash('sha256', $token);


	/*
	 * Store the token hash and calculate its expiry
	 * using the database server's own clock.
	 */
	$stmt = $pdo->prepare(
		'UPDATE users
     SET reset_token_hash = :token_hash,
         reset_token_expires_at = DATE_ADD(
             NOW(),
             INTERVAL 1 HOUR
         )
     WHERE id = :id'
	);

	$stmt->execute([
		'token_hash' => $tokenHash,
		'id' => (int) $user['id']
	]);


	/*
	 * Build the reset link from trusted configuration,
	 * never from an unvalidated Host request header.
	 */
	$resetUrl =
		$appPublicUrl .
		'/FantasyRealm/Frontend/Html/reset-password.html?token=' .
		rawurlencode($token);

	$mail = new PHPMailer(true);

	try {
		$mail->isSMTP();
		$mail->Host = $mailHost;
		$mail->Port = $mailPort;

		/*
		 * Port 465 uses implicit TLS.
		 * Port 587 uses STARTTLS with authentication.
		 * Port 1025 is reserved here for a local mail
		 * testing server without SMTP credentials.
		 */
		if ($mailPort === 1025) {
			$mail->SMTPAuth = false;
			$mail->SMTPAutoTLS = false;
		} else {
			if ($mailUsername === '' || $mailPassword === '') {
				throw new RuntimeException(
					'SMTP credentials are missing.'
				);
			}

			$mail->SMTPAuth = true;
			$mail->Username = $mailUsername;
			$mail->Password = $mailPassword;

			$mail->SMTPSecure = $mailPort === 465
				? PHPMailer::ENCRYPTION_SMTPS
				: PHPMailer::ENCRYPTION_STARTTLS;
		}

		$mail->CharSet = 'UTF-8';
		$mail->setFrom($mailFrom, $mailFromName);
		$mail->addAddress($user['email']);

		$mail->isHTML(false);
		$mail->Subject = 'FantasyRealm - Password Recovery';

		$mail->Body =
			"Hello,\n\n" .
			"A password recovery request was received " .
			"for your FantasyRealm account.\n\n" .
			"Use the following link to set a new password:\n" .
			$resetUrl . "\n\n" .
			"This link expires in one hour and can only " .
			"be used once.\n\n" .
			"If you did not request this change, " .
			"you can ignore this message.\n\n" .
			"FantasyRealm";

		$mail->send();

	} catch (Throwable $mailError) {
		/*
		 * Invalidate the token if SMTP submission fails.
		 * The hash condition avoids clearing a newer
		 * request created concurrently.
		 */
		$cleanup = $pdo->prepare(
			'UPDATE users
        SET reset_token_hash = NULL,
            reset_token_expires_at = NULL
        WHERE id = :id
        AND reset_token_hash = :token_hash'
		);

		$cleanup->execute([
			'id' => (int) $user['id'],
			'token_hash' => $tokenHash
		]);

		throw $mailError;
	}

	respond(200, true, $genericMessage);

} catch (Throwable $error) {
	error_log('Password recovery request failed.');

	respond(
		503,
		false,
		'Password recovery is temporarily unavailable.'
	);
}
