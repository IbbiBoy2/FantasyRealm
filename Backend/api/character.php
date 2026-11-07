<?php

declare(strict_types=1);

/* FANTASYREALM - PUBLIC CHARACTER DETAIL */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/character-equipment-data.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
	header('Allow: GET');
	http_response_code(405);
	echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
	exit;
}

$characterId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, [
	'options' => ['min_range' => 1]
]);
if (!$characterId) {
	http_response_code(400);
	echo json_encode(['success' => false, 'message' => 'Invalid character ID.']);
	exit;
}

try {
	// Preserve the current public visibility constraints.
	$stmt = $pdo->prepare(
		'SELECT
            characters.id,
            characters.name,
            characters.gender,
            characters.image_path,
            characters.created_at,
            users.username AS creator_username,
            appearances.nose_shape,
            appearances.mouth_shape,
            appearances.eye_shape,
            appearances.skin_color,
            appearances.hair_style,
            appearances.hair_color,
            appearances.eye_color
         FROM characters
         INNER JOIN users ON characters.user_id = users.id
         LEFT JOIN appearances ON appearances.character_id = characters.id
         WHERE characters.id = :id
           AND characters.status = :status
           AND characters.shared = 1
           AND characters.deleted_at IS NULL
         LIMIT 1'
	);
	$stmt->execute(['id' => $characterId, 'status' => 'APPROVED']);
	$character = $stmt->fetch(PDO::FETCH_ASSOC);

	if (!$character) {
		http_response_code(404);
		echo json_encode(['success' => false, 'message' => 'Character not found.']);
		exit;
	}

	$character['id'] = (int) $character['id'];
	$equipment = loadCharacterEquipment($pdo, [(int) $characterId]);
	$character['equipment'] = $equipment[(int) $characterId] ?? [];

	echo json_encode(['success' => true, 'character' => $character]);
} catch (Throwable $error) {
	error_log('FantasyRealm character details: ' . $error->getMessage());
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'Unable to load character.']);
}
