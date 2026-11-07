<?php

declare(strict_types=1);

/**
 * FANTASYREALM - CHARACTER COLLECTION
 *
 * GET: return approved and shared characters for the public gallery.
 * POST: create one private character with its layered appearance.
 *
 * The appearance stores numeric sprite IDs as strings and HEX colors.
 * It intentionally does not accept equipment during name approval.
 */

require_once __DIR__ . '/../config/security.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';

// Public gallery: preserve the existing API response structure.
if ($method === 'GET') {
	try {
		$statement = $pdo->prepare(
			'SELECT characters.id,
                    characters.name,
                    characters.image_path,
                    characters.created_at,
                    users.username AS creator_username
             FROM characters
             INNER JOIN users ON characters.user_id = users.id
             WHERE characters.status = :status
               AND characters.shared = 1
               AND characters.deleted_at IS NULL
             ORDER BY characters.created_at DESC'
		);
		$statement->execute(['status' => 'APPROVED']);
		$characters = $statement->fetchAll();

		foreach ($characters as &$character) {
			$character['id'] = (int) $character['id'];
		}
		unset($character);

		echo json_encode(['success' => true, 'characters' => $characters]);
	} catch (Throwable $error) {
		error_log('FantasyRealm public characters: ' . $error->getMessage());
		http_response_code(500);
		echo json_encode(['success' => false, 'message' => 'Unable to load characters.']);
	}
	exit;
}

if ($method !== 'POST') {
	header('Allow: GET, POST');
	http_response_code(405);
	echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
	exit;
}

// Reject unauthenticated and suspended accounts before processing input.
require_once __DIR__ . '/require-active-user.php';
requireActiveUser($pdo);
requireCsrfToken();

/** Return a clear validation error without exposing internal details. */
function rejectCharacterInput(string $message, int $status = 422): never
{
	http_response_code($status);
	echo json_encode(['success' => false, 'message' => $message]);
	exit;
}

try {
	$data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
	rejectCharacterInput('Invalid JSON data.', 400);
}
if (!is_array($data) || array_is_list($data)) {
	rejectCharacterInput('Invalid character payload.', 400);
}

$name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
$gender = $data['gender'] ?? null;

if (mb_strlen($name) < 2 || mb_strlen($name) > 50) {
	rejectCharacterInput('Character name must contain 2 to 50 characters.');
}
if (!is_string($gender) || !in_array($gender, ['male', 'female'], true)) {
	rejectCharacterInput('Choose a valid body type.');
}

// Validate against the actual image catalogue (not browser input alone).
// The database fields are VARCHAR(50), so numeric IDs are stored as strings.
$limits = [
	'nose_style' => 10,
	'mouth_style' => 7,
	'eye_style' => 7,
	'hair_style' => 10
];
$styles = [];
foreach ($limits as $field => $maximum) {
	$number = $data[$field] ?? null;
	if (!is_int($number) || $number < 1 || $number > $maximum) {
		rejectCharacterInput('Invalid appearance option: ' . $field . '.');
	}
	$styles[$field] = (string) $number;
}

// Preserve the exact chosen colors for rendering and future costume layers.
$colors = [];
foreach (['skin_color', 'eye_color', 'hair_color'] as $field) {
	$value = $data[$field] ?? null;
	if (!is_string($value) || preg_match('/^#[0-9a-fA-F]{6}$/D', $value) !== 1) {
		rejectCharacterInput('Invalid appearance color: ' . $field . '.');
	}
	$colors[$field] = strtolower($value);
}

try {
	// Character and appearance must always be committed together.
	$pdo->beginTransaction();

	// Database UNIQUE(name) remains the authoritative duplicate check.
	$statement = $pdo->prepare(
		'INSERT INTO characters (user_id, name, gender, status, shared)
         VALUES (:user_id, :name, :gender, :status, :shared)'
	);
	$statement->execute([
		'user_id' => (int) $_SESSION['user_id'],
		'name' => $name,
		'gender' => $gender,
		'status' => 'PENDING',
		'shared' => 0
	]);
	$characterId = (int) $pdo->lastInsertId();

	// Reuse the existing appearances table; no schema migration is required.
	$statement = $pdo->prepare(
		'INSERT INTO appearances
           (character_id, hair_style, eye_shape, nose_shape, mouth_shape,
            skin_color, hair_color, eye_color)
         VALUES
           (:character_id, :hair_style, :eye_shape, :nose_shape, :mouth_shape,
            :skin_color, :hair_color, :eye_color)'
	);
	$statement->execute([
		'character_id' => $characterId,
		'hair_style' => $styles['hair_style'],
		'eye_shape' => $styles['eye_style'],
		'nose_shape' => $styles['nose_style'],
		'mouth_shape' => $styles['mouth_style'],
		'skin_color' => $colors['skin_color'],
		'hair_color' => $colors['hair_color'],
		'eye_color' => $colors['eye_color']
	]);

	// Equipment will be selected only after staff approval.
	$pdo->commit();

	// MongoDB logging is best-effort and never rolls back a successful SQL save.
	$historyLogged = false;
	try {
		require_once __DIR__ . '/character-history-logger.php';
		recordCharacterHistory($pdo, $characterId, 'character.created');
		$historyLogged = true;
	} catch (Throwable $historyError) {
		error_log('FantasyRealm character history: ' . $historyError->getMessage());
	}

	http_response_code(201);
	echo json_encode([
		'success' => true,
		'message' => 'Character created successfully and is waiting for approval.',
		'character_id' => $characterId,
		'history_logged' => $historyLogged
	]);
} catch (PDOException $error) {
	if ($pdo->inTransaction()) {
		$pdo->rollBack();
	}
	// SQLSTATE 23000 includes UNIQUE(name) and other integrity violations.
	// Report a duplicate name only for MariaDB duplicate-key error 1062.
	if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
		rejectCharacterInput('This character name is already taken.', 409);
	}
	error_log('FantasyRealm create character: ' . $error->getMessage());
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'Unable to create character.']);
} catch (Throwable $error) {
	if ($pdo->inTransaction()) {
		$pdo->rollBack();
	}
	error_log('FantasyRealm create character: ' . $error->getMessage());
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'Unable to create character.']);
}
