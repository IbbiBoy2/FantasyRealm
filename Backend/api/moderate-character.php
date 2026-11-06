<?php

declare(strict_types=1);

/*
 * FANTASYREALM - CHARACTER NAME MODERATION
 *
 * An approved character remains available for customization.
 * A rejected character and its dependent relational data are permanently
 * deleted in one transaction, after saving a durable moderation record.
 * Email and MongoDB logging occur after the MariaDB transaction commits.
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/security.php';

startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	header('Allow: POST');
	http_response_code(405);
	echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
	exit;
}

if (!isset($_SESSION['user_id'])) {
	http_response_code(401);
	echo json_encode(['success' => false, 'message' => 'You must be logged in.']);
	exit;
}

/**
 * Notify the character owner using the existing SMTP configuration.
 * A failed email must never reverse an already committed moderation decision.
 */
function sendCharacterDecisionEmail(array $owner, string $status, string $reason): bool
{
	try {
		// database.php has already loaded the application environment.
		$host = trim((string) ($_ENV['MAIL_HOST'] ?? ''));
		$username = trim((string) ($_ENV['MAIL_USERNAME'] ?? ''));
		$password = (string) ($_ENV['MAIL_PASSWORD'] ?? '');
		$from = trim((string) ($_ENV['MAIL_FROM'] ?? ''));
		$fromName = trim((string) ($_ENV['MAIL_FROM_NAME'] ?? 'FantasyRealm'));
		$port = filter_var(
			$_ENV['MAIL_PORT'] ?? null,
			FILTER_VALIDATE_INT,
			['options' => ['min_range' => 1, 'max_range' => 65535]]
		);

		if (
			$host === '' ||
			$port === false ||
			!filter_var($from, FILTER_VALIDATE_EMAIL) ||
			!filter_var($owner['owner_email'] ?? null, FILTER_VALIDATE_EMAIL)
		) {
			throw new RuntimeException('Invalid SMTP configuration.');
		}

		$mail = new \PHPMailer\PHPMailer\PHPMailer(true);
		$mail->isSMTP();
		$mail->Host = $host;
		$mail->Port = $port;
		$mail->Timeout = 10;

		if ($port === 1025) {
			// Local testing uses Mailpit without authentication or TLS.
			$mail->SMTPAuth = false;
			$mail->SMTPAutoTLS = false;
		} else {
			if ($username === '' || $password === '') {
				throw new RuntimeException('Missing SMTP credentials.');
			}
			$mail->SMTPAuth = true;
			$mail->Username = $username;
			$mail->Password = $password;
			$mail->SMTPSecure = $port === 465
				? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
				: \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
		}

		$mail->CharSet = 'UTF-8';
		$mail->setFrom($from, $fromName);
		$mail->addAddress((string) $owner['owner_email']);
		$mail->isHTML(false);

		$playerName = (string) $owner['owner_username'];
		$characterName = (string) $owner['character_name'];

		if ($status === 'APPROVED') {
			$mail->Subject = 'FantasyRealm - Character Name Approved';
			$mail->Body =
				"Hello {$playerName},\n\n" .
				"Your character name \"{$characterName}\" has been approved.\n" .
				"You can now continue customizing your character in FantasyRealm.\n\n" .
				"Thank you for being part of FantasyRealm!\n\n" .
				'The FantasyRealm Team';
		} else {
			$mail->Subject = 'FantasyRealm - Character Name Rejected';
			$mail->Body =
				"Hello {$playerName},\n\n" .
				"Your character name \"{$characterName}\" has been rejected.\n" .
				"The rejected character has been permanently deleted.\n\n" .
				"Reason:\n{$reason}\n\n" .
				"Please create a new character with a different name.\n\n" .
				'The FantasyRealm Team';
		}

		// A successful send means SMTP accepted the message for delivery.
		return $mail->send();
	} catch (Throwable $error) {
		// Do not write email addresses or SMTP secrets to application logs.
		error_log('FantasyRealm: Character decision email notification failed.');
		return false;
	}
}

try {
	// Always verify the employee's current role and suspension state.
	$stmt = $pdo->prepare(
		'SELECT users.suspended, roles.name AS role_name
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id'
	);
	$stmt->execute(['user_id' => $_SESSION['user_id']]);
	$user = $stmt->fetch(PDO::FETCH_ASSOC);

	if (
		!$user ||
		(bool) $user['suspended'] ||
		!in_array($user['role_name'], ['EMPLOYEE', 'ADMIN'], true)
	) {
		http_response_code(403);
		echo json_encode(['success' => false, 'message' => 'Employee access required.']);
		exit;
	}

	// Check CSRF before processing the request body.
	requireCsrfToken();

	try {
		$data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
	} catch (JsonException $error) {
		http_response_code(400);
		echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
		exit;
	}

	if (!is_array($data)) {
		http_response_code(400);
		echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
		exit;
	}

	$characterId = $data['character_id'] ?? null;
	$status = $data['status'] ?? null;
	$reason = is_string($data['rejection_reason'] ?? null)
		? trim($data['rejection_reason'])
		: '';

	if (
		!is_int($characterId) ||
		$characterId <= 0 ||
		!in_array($status, ['APPROVED', 'REJECTED'], true)
	) {
		http_response_code(422);
		echo json_encode([
			'success' => false,
			'message' => 'Provide a valid character ID and moderation status.'
		]);
		exit;
	}

	if ($status === 'REJECTED' && ($reason === '' || mb_strlen($reason) > 1000)) {
		http_response_code(422);
		echo json_encode([
			'success' => false,
			'message' => 'Rejection requires a reason of 1 to 1000 characters.'
		]);
		exit;
	}

	// Lock the pending character to prevent concurrent moderation decisions.
	$pdo->beginTransaction();
	$stmt = $pdo->prepare(
		'SELECT
            characters.id,
            characters.user_id AS owner_user_id,
            characters.name AS character_name,
            characters.status,
            users.email AS owner_email,
            users.username AS owner_username
         FROM characters
         INNER JOIN users ON characters.user_id = users.id
         WHERE characters.id = :character_id
           AND characters.deleted_at IS NULL
         FOR UPDATE'
	);
	$stmt->execute(['character_id' => $characterId]);
	$owner = $stmt->fetch(PDO::FETCH_ASSOC);

	if (!$owner || $owner['status'] !== 'PENDING') {
		$pdo->rollBack();
		http_response_code(404);
		echo json_encode([
			'success' => false,
			'message' => 'Pending character not found. It may already have been reviewed or deleted.'
		]);
		exit;
	}

	if ($status === 'APPROVED') {
		// An approved name remains available to its owner.
		$stmt = $pdo->prepare(
			'UPDATE characters
             SET status = :status, rejection_reason = NULL, shared = 0
             WHERE id = :character_id AND status = :pending_status AND deleted_at IS NULL'
		);
		$stmt->execute([
			'status' => 'APPROVED',
			'character_id' => $characterId,
			'pending_status' => 'PENDING'
		]);
		if ($stmt->rowCount() !== 1) {
			throw new RuntimeException('Character approval failed.');
		}
	} else {
		/*
		 * Preserve the rejection reason before deleting its only SQL copy.
		 * The history table deliberately has no FK to the deleted character.
		 */
		$stmt = $pdo->prepare(
			'INSERT INTO character_moderation_decisions
                (character_id, character_name, owner_user_id,
                 actor_user_id, decision, rejection_reason)
             VALUES
                (:character_id, :character_name, :owner_user_id,
                 :actor_user_id, :decision, :rejection_reason)'
		);
		$stmt->execute([
			'character_id' => $characterId,
			'character_name' => $owner['character_name'],
			'owner_user_id' => $owner['owner_user_id'],
			'actor_user_id' => (int) $_SESSION['user_id'],
			'decision' => 'REJECTED',
			'rejection_reason' => $reason
		]);

		/*
		 * The current schema has RESTRICT/NO ACTION character foreign keys.
		 * Remove dependent rows first, then delete the character. All DELETE
		 * statements are atomic: an error rolls back the entire transaction.
		 * Shared accessory catalogue rows and user accounts are untouched.
		 */
		foreach (['reviews', 'character_accessories', 'appearances'] as $table) {
			// Table names are fixed server-side, never supplied by the caller.
			$stmt = $pdo->prepare("DELETE FROM {$table} WHERE character_id = :character_id");
			$stmt->execute(['character_id' => $characterId]);
		}

		$stmt = $pdo->prepare(
			'DELETE FROM characters
             WHERE id = :character_id AND status = :pending_status AND deleted_at IS NULL'
		);
		$stmt->execute([
			'character_id' => $characterId,
			'pending_status' => 'PENDING'
		]);
		if ($stmt->rowCount() !== 1) {
			throw new RuntimeException('Character rejection deletion failed.');
		}
	}

	$pdo->commit();

	// External services are invoked only after MariaDB confirms the decision.
	$emailSent = sendCharacterDecisionEmail($owner, $status, $reason);

	$activityLogged = false;
	$loggerFile = __DIR__ . '/../config/activity-logger.php';
	if (is_file($loggerFile) && is_readable($loggerFile)) {
		try {
			require_once $loggerFile;
			if (function_exists('recordStaffActivity')) {
				recordStaffActivity(
					(int) $_SESSION['user_id'],
					$status === 'APPROVED' ? 'character.approved' : 'character.rejected',
					'character',
					$characterId
				);
				$activityLogged = true;
			}
		} catch (Throwable $logError) {
			error_log('FantasyRealm: Character moderation activity logging failed.');
		}
	} else {
		error_log('FantasyRealm: Character activity logger unavailable.');
	}

	http_response_code(200);
	echo json_encode([
		'success' => true,
		'message' => 'Character moderation completed successfully.',
		'character_id' => $characterId,
		'new_status' => $status,
		'permanently_deleted' => $status === 'REJECTED',
		'activity_logged' => $activityLogged,
		'email_sent' => $emailSent
	]);
} catch (Throwable $error) {
	if ($pdo->inTransaction()) {
		$pdo->rollBack();
	}
	error_log('FantasyRealm: Character moderation failed.');
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'An internal server error occurred.']);
}
