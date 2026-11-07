<?php

declare(strict_types=1);

/*
 * Email notifications use the existing
 * Composer installation of PHPMailer.
 */
require_once __DIR__ . '/../vendor/autoload.php';

// =========================
// SECURE SESSION
// =========================

require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	header('Allow: POST');
	http_response_code(405);
	echo json_encode([
		'success' => false,
		'message' => 'Method not allowed.'
	]);
	exit;
}

if (!isset($_SESSION['user_id'])) {
	http_response_code(401);
	echo json_encode([
		'success' => false,
		'message' => 'You must be logged in.'
	]);
	exit;
}

try {
	// Verify the current employee role and account status.
	$stmt = $pdo->prepare(
		'SELECT users.suspended, roles.name AS role_name
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :user_id'
	);

	$stmt->execute([
		'user_id' => $_SESSION['user_id']
	]);

	$user = $stmt->fetch(PDO::FETCH_ASSOC);

	if (
		!$user ||
		(bool) $user['suspended'] ||
		!in_array($user['role_name'], ['EMPLOYEE', 'ADMIN'], true)
	) {
		http_response_code(403);
		echo json_encode([
			'success' => false,
			'message' => 'Employee access required.'
		]);
		exit;
	}

	// =========================
// CSRF PROTECTION
// =========================

	// Reject unauthorized POST requests before reading input.

	requireCsrfToken();

	// Read and validate the JSON request.
	try {
		$data = json_decode(
			file_get_contents('php://input'),
			true,
			512,
			JSON_THROW_ON_ERROR
		);
	} catch (JsonException $e) {
		http_response_code(400);
		echo json_encode([
			'success' => false,
			'message' => 'Invalid JSON data.'
		]);
		exit;
	}

	if (!is_array($data)) {
		http_response_code(400);
		echo json_encode([
			'success' => false,
			'message' => 'Invalid JSON data.'
		]);
		exit;
	}

	$reviewId = $data['review_id'] ?? null;
	$status = $data['status'] ?? null;

	if (
		!is_int($reviewId) ||
		$reviewId <= 0 ||
		!in_array($status, ['APPROVED', 'REJECTED'], true)
	) {
		http_response_code(422);
		echo json_encode([
			'success' => false,
			'message' => 'Provide a valid review ID and moderation status.'
		]);
		exit;
	}

	// Only pending reviews on undeleted characters can be moderated.
	$stmt = $pdo->prepare(
		'UPDATE reviews
         INNER JOIN characters
            ON reviews.character_id = characters.id
         SET reviews.status = :status
         WHERE reviews.id = :review_id
           AND reviews.status = :pending_status
           AND characters.deleted_at IS NULL'
	);

	$stmt->execute([
		'status' => $status,
		'review_id' => $reviewId,
		'pending_status' => 'PENDING'
	]);

	if ($stmt->rowCount() === 0) {
		http_response_code(404);
		echo json_encode([
			'success' => false,
			'message' => 'Pending review not found. It may already have been reviewed or its character deleted.'
		]);
		exit;
	}

	/*
	 * EMAIL NOTIFICATION AFTER REVIEW APPROVAL
	 *
	 * Notify the character owner only when an
	 * employee has approved a pending review.
	 *
	 * Moderation remains successful if email
	 * delivery fails.
	 */
	$emailSent = false;

	if ($status === 'APPROVED') {
		try {
			/*
			 * Retrieve the character owner directly
			 * from the moderated review.
			 */
			$ownerStmt = $pdo->prepare(
				'SELECT
                users.email AS owner_email,
                users.username AS owner_username,
                characters.id AS character_id,
                characters.name AS character_name
             FROM reviews
             INNER JOIN characters
                ON reviews.character_id = characters.id
             INNER JOIN users
                ON characters.user_id = users.id
             WHERE reviews.id = :review_id
               AND reviews.status = :status
             LIMIT 1'
			);

			$ownerStmt->execute([
				'review_id' => $reviewId,
				'status' => 'APPROVED'
			]);

			$owner = $ownerStmt->fetch(PDO::FETCH_ASSOC);

			if (!$owner) {
				throw new RuntimeException(
					'Review owner information unavailable.'
				);
			}

			/*
			 * Load SMTP configuration from the same
			 * environment used by password recovery.
			 */
			$dotenv = Dotenv\Dotenv::createImmutable(
				dirname(__DIR__)
			);

			$dotenv->safeLoad();

			$mailHost = trim($_ENV['MAIL_HOST'] ?? '');
			$mailUsername = trim($_ENV['MAIL_USERNAME'] ?? '');
			$mailPassword = $_ENV['MAIL_PASSWORD'] ?? '';
			$mailFrom = trim($_ENV['MAIL_FROM'] ?? '');

			$mailFromName = trim(
				$_ENV['MAIL_FROM_NAME'] ?? 'FantasyRealm'
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

			$appPublicUrl = rtrim(
				trim($_ENV['APP_PUBLIC_URL'] ?? ''),
				'/'
			);

			if (
				$mailHost === '' ||
				!filter_var($mailFrom, FILTER_VALIDATE_EMAIL) ||
				$mailPort === false ||
				!filter_var($appPublicUrl, FILTER_VALIDATE_URL)
			) {
				throw new RuntimeException(
					'Email notification configuration is invalid.'
				);
			}

			/*
			 * Build the public link from trusted
			 * application configuration.
			 */
			$characterUrl =
				$appPublicUrl .
				'/FantasyRealm/Frontend/Html/character.html?id=' .
				rawurlencode((string) $owner['character_id']);

			/*
			 * Configure SMTP using the same settings
			 * as the password recovery endpoint.
			 */
			$mail = new \PHPMailer\PHPMailer\PHPMailer(true);

			$mail->isSMTP();
			$mail->Host = $mailHost;
			$mail->Port = $mailPort;

			if ($mailPort === 1025) {
				// Local SMTP testing server.
				$mail->SMTPAuth = false;
				$mail->SMTPAutoTLS = false;
			} else {
				if (
					$mailUsername === '' ||
					$mailPassword === ''
				) {
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

			$mail->setFrom(
				$mailFrom,
				$mailFromName
			);

			$mail->addAddress($owner['owner_email']);

			$mail->isHTML(false);

			$mail->Subject =
				'FantasyRealm - New Review Approved';

			$mail->Body =
				"Hello " . $owner['owner_username'] . ",\n\n" .
				"A new review has been approved for your character:\n\n" .
				$owner['character_name'] . "\n\n" .
				"You can view the character and its reviews here:\n" .
				$characterUrl . "\n\n" .
				"Thank you for being part of FantasyRealm!\n\n" .
				"The FantasyRealm Team";

			/*
			 * Sending success means the configured
			 * SMTP server accepted the message.
			 */
			$mail->send();
			$emailSent = true;

		} catch (Throwable $mailError) {
			/*
			 * Do not disclose addresses or SMTP
			 * credentials in logs or API responses.
			 */
			error_log(
				'FantasyRealm: Review approval email notification failed.'
			);
		}
	}

	// =========================
// ACTIVITY LOGGING
// =========================

	// Review moderation must still succeed when
// the optional MongoDB activity logger is unavailable.

	$activityLogged = false;

	$loggerFile = __DIR__ . '/../config/activity-logger.php';

	if (is_file($loggerFile) && is_readable($loggerFile)) {
		try {
			require_once $loggerFile;

			if (function_exists('recordStaffActivity')) {
				$action = $status === 'APPROVED'
					? 'review.approved'
					: 'review.rejected';

				recordStaffActivity(
					(int) $_SESSION['user_id'],
					$action,
					'review',
					$reviewId
				);

				$activityLogged = true;
			}
		} catch (Throwable $logError) {
			error_log(
				'FantasyRealm: Review moderation activity logging failed.'
			);
		}
	} else {
		error_log(
			'FantasyRealm: Review moderation activity logger unavailable.'
		);
	}

	echo json_encode([
		'success' => true,
		'message' => 'Review moderation successful.',
		'activity_logged' => $activityLogged,
		'email_sent' => $emailSent
	]);
} catch (Throwable $e) {
	http_response_code(500);
	echo json_encode([
		'success' => false,
		'message' => 'Unable to moderate the review.'
	]);
}