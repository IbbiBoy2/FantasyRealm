<?php

declare(strict_types=1);

// SECURE SESSION
require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-active-user.php';

// Blocks private requests from deleted or suspended accounts.

requireActiveUser($pdo);
// =========================
// REQUEST VALIDATION
// =========================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

// =========================
// AUTHENTICATION
// =========================

// Ownership is checked using the PHP session, never a client-supplied user ID.

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'You must be logged in.'
    ]);

    exit;
}

// =========================
// CSRF PROTECTION
// =========================

// Reject duplication requests without a valid CSRF token.
requireCsrfToken();

// =========================
// INPUT VALIDATION
// =========================

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

$characterId = filter_var(
    $data['character_id'] ?? null,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

$name = is_string($data['name'] ?? null)
    ? trim($data['name'])
    : '';

if ($characterId === false || $name === '' || mb_strlen($name) > 50) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Provide a valid character ID and a name of 1 to 50 characters.'
    ]);

    exit;
}

// =========================
// LOAD OWNED CHARACTER
// =========================

try {
    $pdo->beginTransaction();

    // Locks the source character while its related data is copied.

    $stmt = $pdo->prepare(
        'SELECT id, gender, image_path
         FROM characters
         WHERE id = :character_id
           AND user_id = :user_id
           AND deleted_at IS NULL
         FOR UPDATE'
    );

    $stmt->execute([
        'character_id' => $characterId,
        'user_id' => $_SESSION['user_id']
    ]);

    $source = $stmt->fetch();

    if (!$source) {
        $pdo->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Character not found.'
        ]);

        exit;
    }

    // =========================
    // CREATE CHARACTER COPY
    // =========================

    // A duplicate starts private and must go through approval again.

    $stmt = $pdo->prepare(
        'INSERT INTO characters (
            user_id,
            name,
            gender,
            status,
            shared,
            image_path
         ) VALUES (
            :user_id,
            :name,
            :gender,
            :status,
            :shared,
            :image_path
         )'
    );

    $stmt->execute([
        'user_id' => $_SESSION['user_id'],
        'name' => $name,
        'gender' => $source['gender'],
        'status' => 'PENDING',
        'shared' => 0,
        'image_path' => $source['image_path']
    ]);

    $newCharacterId = (int) $pdo->lastInsertId();

    // =========================
    // COPY APPEARANCE
    // =========================

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
         )
         SELECT
            :new_character_id,
            hair_style,
            eye_shape,
            nose_shape,
            mouth_shape,
            skin_color,
            hair_color,
            eye_color
         FROM appearances
         WHERE character_id = :source_character_id'
    );

    $stmt->execute([
        'new_character_id' => $newCharacterId,
        'source_character_id' => $characterId
    ]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException('Source appearance is missing.');
    }

    // =========================
    // COPY EQUIPMENT LINKS
    // =========================

    // Reuses accessory records and creates links for the new character.

    $stmt = $pdo->prepare(
        'INSERT INTO character_accessories (
            character_id,
            accessory_id
         )
         SELECT
            :new_character_id,
            accessory_id
         FROM character_accessories
         WHERE character_id = :source_character_id'
    );

    $stmt->execute([
        'new_character_id' => $newCharacterId,
        'source_character_id' => $characterId
    ]);

    $pdo->commit();

    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Character duplicated successfully.',
        'character_id' => $newCharacterId
    ]);

// =========================
// TRANSACTION ERROR HANDLING
// =========================

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // MySQL error 1062 means the unique character name is already taken.

    $duplicateName = $e instanceof PDOException
        && (int) ($e->errorInfo[1] ?? 0) === 1062;

    http_response_code($duplicateName ? 409 : 500);

    echo json_encode([
        'success' => false,
        'message' => $duplicateName
            ? 'That character name is already taken.'
            : 'Unable to duplicate character.'
    ]);
}