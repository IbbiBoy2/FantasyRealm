<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';


if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


$characterId = filter_input(
    INPUT_GET,
    'id',
    FILTER_VALIDATE_INT
);


if (!$characterId) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid character ID.'
    ]);

    exit;
}


try {

    $stmt = $pdo->prepare(
        'SELECT
            characters.id,
            characters.name,
            characters.gender,
            characters.image_path,
            characters.created_at,

            users.username AS creator_username,

            appearances.skin_color,
            appearances.hair_style,
            appearances.hair_color,
            appearances.eye_color

         FROM characters

         INNER JOIN users
            ON characters.user_id = users.id

         LEFT JOIN appearances
            ON appearances.character_id = characters.id

         WHERE characters.id = :id
           AND characters.status = :status
           AND characters.shared = 1

         LIMIT 1'
    );


    $stmt->execute([
        'id' => $characterId,
        'status' => 'APPROVED'
    ]);


    $character = $stmt->fetch();


    if (!$character) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Character not found.'
        ]);

        exit;
    }


    $equipmentStmt = $pdo->prepare(
        'SELECT
            accessories.id,
            accessories.name

         FROM character_accessories

         INNER JOIN accessories
            ON character_accessories.accessory_id = accessories.id

         WHERE character_accessories.character_id = :character_id

         ORDER BY accessories.name'
    );


    $equipmentStmt->execute([
        'character_id' => $characterId
    ]);


    $equipment = $equipmentStmt->fetchAll();


    $character['id'] = (int) $character['id'];

    foreach ($equipment as &$item) {
        $item['id'] = (int) $item['id'];
    }

    unset($item);


    $character['equipment'] = $equipment;


    echo json_encode([
        'success' => true,
        'character' => $character
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load character.'
    ]);
}