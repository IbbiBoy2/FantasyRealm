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


try {

    $stmt = $pdo->prepare(
        'SELECT
            characters.id,
            characters.name,
            characters.image_path,
            characters.created_at,
            users.username AS creator_username
         FROM characters
         INNER JOIN users
            ON characters.user_id = users.id
         WHERE characters.status = :status
           AND characters.shared = 1
         ORDER BY characters.created_at DESC'
    );

    $stmt->execute([
        'status' => 'APPROVED'
    ]);

    $characters = $stmt->fetchAll();


    foreach ($characters as &$character) {
        $character['id'] = (int) $character['id'];
    }

    unset($character);


    echo json_encode([
        'success' => true,
        'characters' => $characters
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load characters.'
    ]);
}