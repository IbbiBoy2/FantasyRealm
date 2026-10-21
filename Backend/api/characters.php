<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';


$method = $_SERVER['REQUEST_METHOD'];


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
| Returns all approved + shared characters for the public gallery.
*/

if ($method === 'GET') {

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
               AND characters.deleted_at IS NULL

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

    exit;
}


/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
| Creates a new character for the currently logged-in user.
*/

if ($method === 'POST') {

    if (!isset($_SESSION['user_id'])) {

        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'You must be logged in to create a character.'
        ]);

        exit;
    }


    $data = json_decode(
        file_get_contents('php://input'),
        true
    );


    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid JSON data.'
        ]);

        exit;
    }


    $name = trim($data['name'] ?? '');

    $gender = $data['gender'] ?? '';

    $hairStyle = $data['hair_style'] ?? '';
    $hairColor = $data['hair_color'] ?? '';

    $skinTone = $data['skin_tone'] ?? '';

    $eyeStyle = $data['eye_style'] ?? '';
    $eyeColor = $data['eye_color'] ?? '';

// =========================
// EQUIPMENT INPUT VALIDATION
// =========================

// Accepts up to four different equipment IDs, one per category.
// PHP will check their categories and availability against the database.

$accessoryIds = $data['accessory_ids'] ?? [];

if (
    !is_array($accessoryIds) ||
    array_values($accessoryIds) !== $accessoryIds ||
    count($accessoryIds) > 4
) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Provide a list of up to four equipment IDs.'
    ]);

    exit;
}

foreach ($accessoryIds as $accessoryId) {
    if (!is_int($accessoryId) || $accessoryId <= 0) {
        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Equipment IDs must be positive integers.'
        ]);

        exit;
    }
}

if (count(array_unique($accessoryIds)) !== count($accessoryIds)) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'The same equipment item cannot be selected twice.'
    ]);

    exit;
}

    if (
        $name === '' ||
        $gender === '' ||
        $hairStyle === '' ||
        $hairColor === '' ||
        $skinTone === '' ||
        $eyeStyle === '' ||
        $eyeColor === ''
    ) {

        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Please complete all required character fields.'
        ]);

        exit;
    }


    if (mb_strlen($name) > 50) {

        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Character name must be 50 characters or less.'
        ]);

        exit;
    }


    $allowedGenders = [
        'male',
        'female'
    ];

    $allowedHairStyles = [
        'short',
        'long',
        'braided',
        'ponytail'
    ];

    $allowedHairColors = [
        'silver',
        'black',
        'brown',
        'red',
        'purple'
    ];

    $allowedSkinTones = [
        'light',
        'fair',
        'medium',
        'tan',
        'dark'
    ];

    $allowedEyeStyles = [
        'round',
        'soft',
        'sharp',
        'narrow'
    ];

    $allowedEyeColors = [
        'blue',
        'purple',
        'red',
        'green',
        'amber'
    ];

    if (
        !in_array($gender, $allowedGenders, true) ||
        !in_array($hairStyle, $allowedHairStyles, true) ||
        !in_array($hairColor, $allowedHairColors, true) ||
        !in_array($skinTone, $allowedSkinTones, true) ||
        !in_array($eyeStyle, $allowedEyeStyles, true) ||
        !in_array($eyeColor, $allowedEyeColors, true)
    ) {

        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid character options.'
        ]);

        exit;
    }

    try {

        $pdo->beginTransaction();

        // =========================
// CHECK AVAILABLE EQUIPMENT
// =========================

// Locks selected items until creation finishes, preventing availability changes
// or deletion during this transaction.

if ($accessoryIds !== []) {
    $placeholders = implode(
        ',',
        array_fill(0, count($accessoryIds), '?')
    );

    $equipmentStmt = $pdo->prepare(
        'SELECT id, type
         FROM accessories
         WHERE id IN (' . $placeholders . ')
           AND active = 1
         ORDER BY id
         FOR UPDATE'
    );

    $equipmentStmt->execute($accessoryIds);

    $equipment = $equipmentStmt->fetchAll();

    if (count($equipment) !== count($accessoryIds)) {
        throw new InvalidArgumentException(
            'Some selected equipment is no longer available. Refresh the creator and choose again.'
        );
    }

    $selectedTypes = [];

    foreach ($equipment as $item) {
        if (
            !in_array(
                $item['type'],
                ['weapon', 'armor', 'clothing', 'accessory'],
                true
            )
        ) {
            throw new InvalidArgumentException(
                'An equipment item has an unsupported type.'
            );
        }

        if (in_array($item['type'], $selectedTypes, true)) {
            throw new InvalidArgumentException(
                'Choose only one item per equipment category.'
            );
        }

        $selectedTypes[] = $item['type'];
    }
}


        /*
        |--------------------------------------------------------------------------
        | 1. CHARACTER
        |--------------------------------------------------------------------------
        */

        $stmt = $pdo->prepare(
            'INSERT INTO characters (
                user_id,
                name,
                gender,
                status,
                shared
            ) VALUES (
                :user_id,
                :name,
                :gender,
                :status,
                :shared
            )'
        );

        $stmt->execute([
            'user_id' => $_SESSION['user_id'],
            'name' => $name,
            'gender' => $gender,
            'status' => 'PENDING',
            'shared' => 0
        ]);


        $characterId = (int) $pdo->lastInsertId();


        /*
        |--------------------------------------------------------------------------
        | 2. APPEARANCE
        |--------------------------------------------------------------------------
        */

        $stmt = $pdo->prepare(
            'INSERT INTO appearances (
                character_id,
                hair_style,
                eye_shape,
                nose_shape,
                mouth_shape,
                skin_color,
                hair_color,
                eye_color
            ) VALUES (
                :character_id,
                :hair_style,
                :eye_shape,
                :nose_shape,
                :mouth_shape,
                :skin_color,
                :hair_color,
                :eye_color
            )'
        );

        $stmt->execute([
            'character_id' => $characterId,
            'hair_style' => $hairStyle,
            'eye_shape' => $eyeStyle,
            'nose_shape' => 'default',
            'mouth_shape' => 'default',
            'skin_color' => $skinTone,
            'hair_color' => $hairColor,
            'eye_color' => $eyeColor
        ]);

// =========================
// CHARACTER EQUIPMENT
// =========================

// Links each selected catalogue item to the new character.

if ($accessoryIds !== []) {
    $equipmentStmt = $pdo->prepare(
        'INSERT INTO character_accessories (
            character_id,
            accessory_id
         ) VALUES (
            :character_id,
            :accessory_id
         )'
    );

    foreach ($accessoryIds as $accessoryId) {
        $equipmentStmt->execute([
            'character_id' => $characterId,
            'accessory_id' => $accessoryId
        ]);
    }
}


        $pdo->commit();


        http_response_code(201);

        echo json_encode([
            'success' => true,
            'message' => 'Character created successfully and is waiting for approval.',
            'character_id' => $characterId
        ]);


    } catch (InvalidArgumentException $e) {

    // Cancels creation if a selected item is unavailable or invalid.

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);

} catch (PDOException $e) {


    } catch (Throwable $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }


        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => 'Unable to create character.'
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| OTHER HTTP METHODS
|--------------------------------------------------------------------------
*/

http_response_code(405);

echo json_encode([
    'success' => false,
    'message' => 'Method not allowed.'
]);