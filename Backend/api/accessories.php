<?php

declare(strict_types=1);

/** Public catalogue: expose only active items and the images needed to render them. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../config/database.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
	header('Allow: GET');
	http_response_code(405);
	echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
	exit;
}
try {
	$statement = $pdo->query(
		'SELECT id, name, type, gender, image_path, body_image_path
         FROM accessories WHERE active = 1
         ORDER BY type ASC, name ASC, id ASC'
	);
	$items = $statement->fetchAll(PDO::FETCH_ASSOC);
	foreach ($items as &$item) {
		$item['id'] = (int) $item['id'];
	}
	unset($item);
	echo json_encode(['success' => true, 'accessories' => $items]);
} catch (Throwable $error) {
	error_log('FantasyRealm equipment catalogue: ' . $error->getMessage());
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => 'Unable to load equipment.']);
}
