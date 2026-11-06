<?php

declare(strict_types=1);

/* FANTASYREALM - PUBLIC CHARACTER GALLERY */
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

try {
	// Public results remain strictly approved, shared and not deleted.
	$stmt = $pdo->prepare(
		'SELECT
            characters.id,
            characters.name,
            characters.gender,
            characters.image_path,
            characters.created_at,
            appearances.nose_shape,
            appearances.mouth_shape,
            appearances.eye_shape,
            appearances.hair_style,
            appearances.skin_color,
            appearances.eye_color,
            appearances.hair_color,
            users.username AS creator_username
         FROM characters
         INNER JOIN users ON characters.user_id = users.id
         LEFT JOIN appearances ON appearances.character_id = characters.id
         WHERE characters.status = :status
           AND characters.shared = 1
           AND characters.deleted_at IS NULL
         ORDER BY characters.created_at DESC'
	);
	$stmt->execute(['status' => 'APPROVED']);
	$characters = $stmt->fetchAll(PDO::FETCH_ASSOC);

	foreach ($characters as &$character) {
		$character['id'] = (int) $character['id'];
	}
	unset($character);

	// Add the same equipment artwork used by the approved-character editor.
	attachCharacterEquipment($pdo, $characters);

	echo json_encode(['success' => true, 'characters' => $characters]);
} catch (Throwable $error) {
	error_log('FantasyRealm gallery: ' . $error->getMessage());
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'Unable to load characters.']);
}
