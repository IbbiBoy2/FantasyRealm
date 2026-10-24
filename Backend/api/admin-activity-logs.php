<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

try {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/require-admin.php';

    requireAdmin($pdo);

    if (
        !extension_loaded('mongodb') ||
        !class_exists(MongoDB\Client::class)
    ) {
            // DEBUG: Check MongoDB support in Apache.
    error_log(
        '[MongoDB Debug] Extension: ' .
        (extension_loaded('mongodb') ? 'YES' : 'NO') .
        ' | Composer Client: ' .
        (class_exists(MongoDB\Client::class) ? 'YES' : 'NO') .
        ' | PHP INI: ' .
        (php_ini_loaded_file() ?: 'NONE')
    );
        throw new RuntimeException(
            'MongoDB PHP support is unavailable.'
        );
    }

    $mongoUri = $_ENV['MONGODB_URI']
        ?? 'mongodb://127.0.0.1:27017';

    $databaseName = $_ENV['MONGODB_DATABASE']
        ?? 'fantasyrealm';

    // Validate MongoDB configuration.
    if (
        !is_string($mongoUri) ||
        trim($mongoUri) === '' ||
        !is_string($databaseName) ||
        !preg_match('/\A[a-zA-Z0-9_-]{1,64}\z/', $databaseName)
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
        'activity_logs'
    );

    // Retrieve the 50 most recent events.
    $cursor = $collection->find(
        [],
        [
            'sort' => [
                'created_at' => -1,
                '_id' => -1
            ],
            'limit' => 50,
            'typeMap' => [
                'root' => 'array',
                'document' => 'array',
                'array' => 'array'
            ]
        ]
    );

    $logs = [];
    $actorIds = [];

    foreach ($cursor as $document) {
        $actorId = (int) ($document['actor_id'] ?? 0);
        $targetId = (int) ($document['target_id'] ?? 0);

        if ($actorId <= 0 || $targetId <= 0) {
            continue;
        }

        $createdAt = null;

        if (
            ($document['created_at'] ?? null)
            instanceof MongoDB\BSON\UTCDateTime
        ) {
            $date = $document['created_at']->toDateTime();
            $date->setTimezone(new DateTimeZone('UTC'));
            $createdAt = $date->format('Y-m-d\TH:i:s.v\Z');
        }

        $logs[] = [
            'event_id' => (string) ($document['_id'] ?? ''),
            'actor_id' => $actorId,
            'action' => (string) ($document['action'] ?? ''),
            'target_type' => (string) ($document['target_type'] ?? ''),
            'target_id' => $targetId,
            'created_at' => $createdAt
        ];

        $actorIds[] = $actorId;
    }

    // Retrieve staff usernames from MariaDB.
    $actorIds = array_values(array_unique($actorIds));
    $usernames = [];

    if ($actorIds !== []) {
        $placeholders = implode(
            ',',
            array_fill(0, count($actorIds), '?')
        );

        $stmt = $pdo->prepare(
            "SELECT id, username
             FROM users
             WHERE id IN ($placeholders)"
        );

        $stmt->execute($actorIds);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $user) {
            $usernames[(int) $user['id']] = $user['username'];
        }
    }

    foreach ($logs as &$log) {
        $log['actor_username'] =
            $usernames[$log['actor_id']] ?? null;
    }

    unset($log);

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'logs' => $logs,
        'count' => count($logs)
    ]);

} catch (AdminAccessException $e) {
        http_response_code($e->getHttpStatus());

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);

} catch (Throwable $e) {
    // Log the actual error for debugging.
    error_log(
        '[FantasyRealm Activity Logs] ' .
        get_class($e) . ': ' . $e->getMessage() .
        ' in ' . $e->getFile() .
        ' on line ' . $e->getLine()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load activity logs.'
    ]);
}
