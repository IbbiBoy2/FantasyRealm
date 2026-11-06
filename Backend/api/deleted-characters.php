<?php

declare(strict_types=1);

/* FANTASYREALM - PRIVATE SOFT-DELETED CHARACTERS */
require_once __DIR__ . '/../config/security.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-active-user.php';
require_once __DIR__ . '/character-equipment-data.php';
requireActiveUser($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
	header('Allow: GET');
	http_response_code(405);
	echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
	exit;
}
if (!isset($_SESSION['user_id'])) {
	http_response_code(401);
	echo json_encode(['success' => false, 'message' => 'You must be logged in.']);
	exit;
}

try {
	$stmt = $pdo->prepare(
		'SELECT
            characters.id,
            characters.name,
            characters.gender,
            characters.status,
            characters.deleted_at,
            characters.created_at,
            appearances.nose_shape,
            appearances.mouth_shape,
            appearances.eye_shape,
            appearances.hair_style,
            appearances.hair_color,
            appearances.skin_color,
            appearances.eye_color
         FROM characters
         LEFT JOIN appearances ON appearances.character_id = characters.id
         WHERE characters.user_id = :user_id
           AND characters.deleted_at IS NOT NULL
         ORDER BY characters.deleted_at DESC'
	);
	$stmt->execute(['user_id' => (int) $_SESSION['user_id']]);
	$characters = $stmt->fetchAll(PDO::FETCH_ASSOC);

	foreach ($characters as &$character) {
		$character['id'] = (int) $character['id'];
	}
	unset($character);
	attachCharacterEquipment($pdo, $characters);
	echo json_encode(['success' => true, 'characters' => $characters]);
} catch (Throwable $error) {
	error_log('FantasyRealm deleted characters: ' . $error->getMessage());
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'Unable to load deleted characters.']);
}
