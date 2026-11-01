<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use MongoDB\Client;
use MongoDB\BSON\UTCDateTime;

function recordStaffActivity(
    int $actorId,
    string $action,
    string $targetType,
    int $targetId,
    ?string $eventId = null
): void {

    // Define the actions that may be recorded.
    $allowedActions = [
        'employee.created' => 'employee',
        'employee.promoted' => 'employee',
        'employee.suspended' => 'employee',
        'employee.reactivated' => 'employee',


        'character.approved' => 'character',
        'character.rejected' => 'character',

        'review.approved' => 'review',
        'review.rejected' => 'review',

        'player.suspended' => 'player',
        'player.reactivated' => 'player',
        'player.deleted' => 'player',

        'accessory.created' => 'accessory',
        'accessory.updated' => 'accessory',
        'accessory.deleted' => 'accessory'
    ];

    if ($actorId <= 0 || $targetId <= 0) {
        throw new InvalidArgumentException(
            'Invalid activity identifiers.'
        );
    }

    if (
        !isset($allowedActions[$action]) ||
        $allowedActions[$action] !== $targetType
    ) {
        throw new InvalidArgumentException(
            'Unsupported activity type.'
        );
    }

    // Allow a stable event ID for safe retries.
    if ($eventId === null) {
        $eventId = bin2hex(random_bytes(16));
    }

    if (!preg_match('/\A[a-f0-9]{32}\z/D', $eventId)) {
        throw new InvalidArgumentException(
            'Invalid activity event ID.'
        );
    }

    // Check that PHP can use MongoDB.
    if (
        !extension_loaded('mongodb') ||
        !class_exists(Client::class)
    ) {
        throw new RuntimeException(
            'MongoDB PHP support is unavailable.'
        );
    }

    // Use environment configuration when available.
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

    // Connect to MongoDB.
    $client = new Client(
        $mongoUri,
        [
            'serverSelectionTimeoutMS' => 3000,
            'connectTimeoutMS' => 3000
        ]
    );

    $collection = $client->selectCollection(
        $databaseName,
        'activity_logs'
    );

    // Store only the information needed for auditing.
    $document = [
        '_id' => $eventId,
        'actor_id' => $actorId,
        'action' => $action,
        'target_type' => $targetType,
        'target_id' => $targetId,
        'created_at' => new UTCDateTime()
    ];

    // Save the activity record.
    $result = $collection->insertOne($document);

    if ($result->getInsertedCount() !== 1) {
        throw new RuntimeException(
            'Activity log could not be saved.'
        );
    }
}
