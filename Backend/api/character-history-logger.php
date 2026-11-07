<?php

declare(strict_types=1);

/*
 * FANTASYREALM - CHARACTER CUSTOMIZATION HISTORY
 *
 * Stores a snapshot of a successfully saved character
 * in a dedicated MongoDB collection.
 */

require_once __DIR__ . '/../vendor/autoload.php';

function recordCharacterHistory(
  PDO $pdo,
  int $characterId,
  string $action,
  ?int $sourceCharacterId = null
): void {
  $allowedActions = [
    'character.created',
    'character.duplicated',
    'character.updated'
  ];

  if (
    $characterId <= 0 ||
    !in_array($action, $allowedActions, true)
  ) {
    throw new InvalidArgumentException(
      'Invalid character history event.'
    );
  }

  $stmt = $pdo->prepare(
    'SELECT
            c.id,
            c.user_id,
            c.name,
            c.gender,
            u.username,
            a.hair_style,
            a.hair_color,
            a.eye_shape,
            a.eye_color,
            a.nose_shape,
            a.mouth_shape,
            a.skin_color
         FROM characters c
         INNER JOIN users u ON u.id = c.user_id
         INNER JOIN appearances a ON a.character_id = c.id
         WHERE c.id = :id'
  );

  $stmt->execute(['id' => $characterId]);
  $character = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$character) {
    throw new RuntimeException(
      'Character history snapshot unavailable.'
    );
  }

  $stmt = $pdo->prepare(
    'SELECT
            accessories.id,
            accessories.name,
            accessories.type
         FROM character_accessories
         INNER JOIN accessories
            ON accessories.id = character_accessories.accessory_id
         WHERE character_accessories.character_id = :id
         ORDER BY accessories.id'
  );

  $stmt->execute(['id' => $characterId]);

  $equipment = [];

  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
    $equipment[] = [
      'id' => (int) $item['id'],
      'name' => $item['name'],
      'type' => $item['type']
    ];
  }

  $mongoUri = $_ENV['MONGODB_URI']
    ?? 'mongodb://127.0.0.1:27017';

  $databaseName = $_ENV['MONGODB_DATABASE']
    ?? 'fantasyrealm';

  if (
    !is_string($mongoUri) ||
    trim($mongoUri) === '' ||
    !is_string($databaseName) ||
    !preg_match(
      '/\A[a-zA-Z0-9_-]{1,64}\z/D',
      $databaseName
    )
  ) {
    throw new RuntimeException(
      'Invalid MongoDB configuration.'
    );
  }

  $client = new MongoDB\Client($mongoUri, [
    'serverSelectionTimeoutMS' => 3000,
    'connectTimeoutMS' => 3000
  ]);

  $document = [
    '_id' => bin2hex(random_bytes(16)),
    'action' => $action,
    'character_id' => (int) $character['id'],
    'character_name' => $character['name'],
    'user_id' => (int) $character['user_id'],
    'username' => $character['username'],
    'gender' => $character['gender'],
    'appearance' => [
      'hair_style' => $character['hair_style'],
      'hair_color' => $character['hair_color'],
      'eye_shape' => $character['eye_shape'],
      'eye_color' => $character['eye_color'],
      'nose_shape' => $character['nose_shape'],
      'mouth_shape' => $character['mouth_shape'],
      'skin_color' => $character['skin_color']
    ],
    'equipment' => $equipment,
    'created_at' => new MongoDB\BSON\UTCDateTime()
  ];

  if ($sourceCharacterId !== null) {
    $document['source_character_id'] = $sourceCharacterId;
  }

  $collection = $client->selectCollection(
    $databaseName,
    'character_history'
  );

  $result = $collection->insertOne($document);

  if ($result->getInsertedCount() !== 1) {
    throw new RuntimeException(
      'Character history could not be recorded.'
    );
  }
}
