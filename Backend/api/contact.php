<?php

declare(strict_types=1);

/*
 * FANTASYREALM - CONTACT API
 *
 * Accepts contact messages from guests and authenticated users.
 * Validates JSON input and stores messages in MariaDB using PDO.
 *
 * A successful response confirms database storage,
 * not delivery of an email notification.
 */

require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/*
 * Return a consistent JSON response without exposing
 * database details or internal exception messages.
 */
function respond(int $status, bool $success, string $message): never
{
	http_response_code($status);

	echo json_encode([
		'success' => $success,
		'message' => $message
	]);

	exit;
}

/* Only accept POST requests. */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	header('Allow: POST');

	respond(405, false, 'Method not allowed.');
}

/*
 * Reject requests explicitly originating from another site.
 * Requests without an Origin header remain possible,
 * so this check is not a substitute for full abuse prevention.
 */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '') {
	$originHost = parse_url($origin, PHP_URL_HOST);
	$originScheme = parse_url($origin, PHP_URL_SCHEME);

	$requestHost = $_SERVER['HTTP_HOST'] ?? '';
	$requestScheme = !empty($_SERVER['HTTPS']) &&
		$_SERVER['HTTPS'] !== 'off'
		? 'https'
		: 'http';

	$expectedOrigin = $requestScheme . '://' . $requestHost;

	if (
		!is_string($originHost) ||
		!is_string($originScheme) ||
		!hash_equals($expectedOrigin, $origin)
	) {
		respond(403, false, 'Request origin not allowed.');
	}
}

/*
 * Apply a basic per-session submission cooldown.
 * This limits accidental duplicate submissions but is
 * not a replacement for IP-based rate limiting.
 */
$now = time();
$lastSubmission = $_SESSION['last_contact_submission'] ?? 0;

if (
	is_int($lastSubmission) &&
	$lastSubmission > 0 &&
	($now - $lastSubmission) < 30
) {
	respond(
		429,
		false,
		'Please wait before sending another message.'
	);
}

/* Decode JSON and reject unsupported input types. */
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (
	!preg_match(
		'~^application/json(?:\s*;|$)~i',
		$contentType
	)
) {
	respond(415, false, 'Content type must be application/json.');
}

$rawInput = file_get_contents('php://input');

if (
	$rawInput === false ||
	strlen($rawInput) > 12000
) {
	respond(413, false, 'Request body is too large.');
}

$data = json_decode($rawInput, true);

if (!is_array($data)) {
	respond(400, false, 'Invalid JSON request.');
}

$usernameValue = $data['username'] ?? '';
$emailValue = $data['email'] ?? null;
$messageValue = $data['message'] ?? null;

if (
	!is_string($usernameValue) ||
	!is_string($emailValue) ||
	!is_string($messageValue)
) {
	respond(422, false, 'Invalid contact form data.');
}

$username = trim($usernameValue);
$email = trim($emailValue);
$message = trim($messageValue);

/* Validate required fields. */
if ($email === '' || $message === '') {
	respond(
		422,
		false,
		'Please provide your email address and a message.'
	);
}

/* Validate email format and all field lengths. */
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
	respond(422, false, 'Please enter a valid email address.');
}

if (mb_strlen($username, 'UTF-8') > 50) {
	respond(422, false, 'Username is too long.');
}

if (mb_strlen($email, 'UTF-8') > 255) {
	respond(422, false, 'Email address is too long.');
}

if (mb_strlen($message, 'UTF-8') > 2000) {
	respond(
		422,
		false,
		'Message must be 2000 characters or less.'
	);
}

/*
 * Save the validated message.
 *
 * Logged-in users are linked to their account.
 * Guest messages use a NULL user_id.
 */
try {
	require_once __DIR__ . '/../config/database.php';

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

	$stmt->execute([
		'user_id' => $_SESSION['user_id'] ?? null,
		'username' => $username,
		'email' => $email,
		'message' => $message
	]);

	/*
	 * EMAIL NOTIFICATION
	 *
	 * The contact message has already been saved
	 * in MariaDB.
	 *
	 * Email failures must not remove the stored message.
	 */

	$emailSent = false;

	try {
		// SMTP configuration already loaded by database.php
		$mailHost = trim($_ENV['MAIL_HOST'] ?? '');
		$mailPort = (int) ($_ENV['MAIL_PORT'] ?? 0);
		$mailUsername = trim($_ENV['MAIL_USERNAME'] ?? '');
		$mailPassword = $_ENV['MAIL_PASSWORD'] ?? '';
		$mailFrom = trim($_ENV['MAIL_FROM'] ?? '');
		$mailFromName = trim(
			$_ENV['MAIL_FROM_NAME'] ?? 'FantasyRealm'
		);

		// Default to the existing Gmail account.
		$mailRecipient = trim(
			$_ENV['MAIL_CONTACT_TO'] ?? $mailUsername
		);

		if (
			$mailHost === '' ||
			$mailPort < 1 ||
			$mailPort > 65535 ||
			!filter_var($mailFrom, FILTER_VALIDATE_EMAIL) ||
			!filter_var($mailRecipient, FILTER_VALIDATE_EMAIL)
		) {
			throw new RuntimeException(
				'Contact SMTP configuration is incomplete.'
			);
		}

		// PHPMailer is installed through Composer.
		$mail = new \PHPMailer\PHPMailer\PHPMailer(true);

		$mail->isSMTP();
		$mail->Host = $mailHost;
		$mail->Port = $mailPort;
		$mail->Timeout = 10;

		// Compatible with the existing local Mailpit setup.
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
				? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
				: \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
		}

		$mail->CharSet = 'UTF-8';

		// Sender: existing configured Gmail account.
		$mail->setFrom($mailFrom, $mailFromName);

		// Recipient: company contact mailbox.
		$mail->addAddress($mailRecipient);

		// Allows replying directly to the visitor.
		$mail->addReplyTo(
			$email,
			$username !== '' ? $username : $email
		);

		$mail->isHTML(false);

		$mail->Subject = 'FantasyRealm - New Contact Message';

		$mail->Body =
			"A new contact message has been received.\n\n" .
			"Username: {$username}\n" .
			"Email: {$email}\n\n" .
			"Message:\n{$message}\n\n" .
			"This message is also available " .
			"in the employee dashboard.\n\n" .
			"FantasyRealm Contact System";

		$emailSent = $mail->send();

	} catch (Throwable $mailError) {

		// Do not expose SMTP credentials or exception details.
		error_log(
			'FantasyRealm: Contact email notification failed.'
		);
	}

	/*
	 * Keep the existing anti-spam cooldown.
	 * The message remains stored even if SMTP fails.
	 */
	$_SESSION['last_contact_submission'] = time();

	/*
	 * Confirm message storage.
	 * Email status is returned separately.
	 */
	http_response_code(201);

	echo json_encode([
		'success' => true,
		'message' => 'Your message has been received successfully.',
		'email_sent' => $emailSent
	]);

	exit;

} catch (Throwable $error) {
	error_log('Contact message storage failed.');

	respond(
		500,
		false,
		'Unable to submit your message. Please try again.'
	);
}
