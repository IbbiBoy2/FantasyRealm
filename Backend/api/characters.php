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

    $weapon = $data['weapon'] ?? '';


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

    $allowedWeapons = [
        '',
        'iron-sword',
        'steel-sword',
        'magic-staff'
    ];


    if (
        !in_array($gender, $allowedGenders, true) ||
        !in_array($hairStyle, $allowedHairStyles, true) ||
        !in_array($hairColor, $allowedHairColors, true) ||
        !in_array($skinTone, $allowedSkinTones, true) ||
        !in_array($eyeStyle, $allowedEyeStyles, true) ||
        !in_array($eyeColor, $allowedEyeColors, true) ||
        !in_array($weapon, $allowedWeapons, true)
    ) {

        http_response_code(422);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid character options.'
        ]);

        exit;
    }


    $weaponNameMap = [
        'iron-sword' => 'Iron Sword',
        'steel-sword' => 'Steel Sword',
        'magic-staff' => 'Magic Staff'
    ];


    try {

        $pdo->beginTransaction();


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


        /*
        |--------------------------------------------------------------------------
        | 3. WEAPON
        |--------------------------------------------------------------------------
        */

        if ($weapon !== '') {

            $weaponName = $weaponNameMap[$weapon];


            $stmt = $pdo->prepare(
                'SELECT id
                 FROM accessories
                 WHERE name = :name
                   AND active = 1
                 LIMIT 1'
            );

            $stmt->execute([
                'name' => $weaponName
            ]);


            $accessory = $stmt->fetch();


            if (!$accessory) {

                throw new RuntimeException(
                    'Selected weapon is not available.'
                );
            }


            $stmt = $pdo->prepare(
                'INSERT INTO character_accessories (
                    character_id,
                    accessory_id
                ) VALUES (
                    :character_id,
                    :accessory_id
                )'
            );

            $stmt->execute([
                'character_id' => $characterId,
                'accessory_id' => $accessory['id']
            ]);
        }


        $pdo->commit();


        http_response_code(201);

        echo json_encode([
            'success' => true,
            'message' => 'Character created successfully and is waiting for approval.',
            'character_id' => $characterId
        ]);


    } catch (PDOException $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }


        if ($e->getCode() === '23000') {

            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => 'That character name is already taken.'
            ]);

        } else {

            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Unable to create character.'
            ]);
        }


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