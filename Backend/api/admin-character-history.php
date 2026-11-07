<?php

declare(strict_types=1);

/*
 * FANTASYREALM - ADMIN CHARACTER HISTORY
 *
 * Returns recent character customization snapshots.
 * Only active administrators can access these records.
 */

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
  require_once __DIR__ . '/../config/database.php';
  require_once __DIR__ . '/require-admin.php';

  requireAdmin($pdo);

  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);

    echo json_encode([
      'success' => false,
      'message' => 'Method not allowed.'
    ]);
    exit;
  }

  require_once __DIR__ . '/../vendor/autoload.php';

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

  $collection = $client->selectCollection(
    $databaseName,
    'character_history'
  );

  $cursor = $collection->find(
    [],
    [
      'sort' => [
        'created_at' => -1,
        '_id' => -1
      ],
      'limit' => 100,
      'typeMap' => [
        'root' => 'array',
        'document' => 'array',
        'array' => 'array'
      ]
    ]
  );

  $history = [];

  foreach ($cursor as $document) {
    $createdAt = null;

    if (
      ($document['created_at'] ?? null)
      instanceof MongoDB\BSON\UTCDateTime
    ) {
      $createdAt = $document['created_at']
        ->toDateTime()
        ->format('Y-m-d\TH:i:s.v\Z');
    }

    $appearance = $document['appearance'] ?? [];
    $equipment = $document['equipment'] ?? [];

    $history[] = [
      'event_id' => (string) ($document['_id'] ?? ''),
      'action' => (string) ($document['action'] ?? ''),
      'character_id' => (int) ($document['character_id'] ?? 0),
      'character_name' => (string) ($document['character_name'] ?? ''),
      'user_id' => (int) ($document['user_id'] ?? 0),
      'username' => (string) ($document['username'] ?? ''),
      'gender' => (string) ($document['gender'] ?? ''),
      'appearance' => is_array($appearance)
        ? $appearance
        : [],
      'equipment' => is_array($equipment)
        ? array_values($equipment)
        : [],
      'source_character_id' => isset(
        $document['source_character_id']
      )
        ? (int) $document['source_character_id']
        : null,
      'created_at' => $createdAt
    ];
  }

  http_response_code(200);

  echo json_encode([
    'success' => true,
    'history' => $history,
    'count' => count($history)
  ]);

} catch (AdminAccessException $error) {
  http_response_code($error->getHttpStatus());

  echo json_encode([
    'success' => false,
    'message' => $error->getMessage()
  ]);

} catch (Throwable $error) {
  error_log(
    'FantasyRealm: Unable to load character history.'
  );

  http_response_code(500);

  echo json_encode([
    'success' => false,
    'message' => 'Unable to load character history.'
  ]);
}
