<?php

declare(strict_types=1);

/*
 * FANTASYREALM - DELETE CHARACTER AS STAFF
 *
 * An employee or administrator may permanently remove a character.
 * A mandatory explanation is retained in a separate SQL audit table.
 * Related records are deleted atomically, without deleting users or
 * accessory catalogue entries. MongoDB activity is logged after commit.
 */

require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  header('Allow: POST');
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
  exit;
}

if (!isset($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['success' => false, 'message' => 'You must be logged in.']);
  exit;
}

require_once __DIR__ . '/../config/database.php';

try {
  // Verify current authorization and suspension status.
  $stmt = $pdo->prepare(
    'SELECT users.suspended, roles.name AS role_name
         FROM users
         INNER JOIN roles ON roles.id = users.role_id
         WHERE users.id = :user_id'
  );
  $stmt->execute(['user_id' => $_SESSION['user_id']]);
  $actor = $stmt->fetch(PDO::FETCH_ASSOC);

  if (
    !$actor ||
    (bool) $actor['suspended'] ||
    !in_array($actor['role_name'], ['EMPLOYEE', 'ADMIN'], true)
  ) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Employee access required.']);
    exit;
  }

  // Reject requests lacking the session's CSRF token.
  requireCsrfToken();

  try {
    $input = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
  } catch (JsonException $error) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
    exit;
  }

  if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
    exit;
  }

  $characterId = $input['character_id'] ?? null;
  $reason = is_string($input['reason'] ?? null) ? trim($input['reason']) : '';

  if (!is_int($characterId) || $characterId <= 0 || $reason === '' || mb_strlen($reason) > 1000) {
    http_response_code(422);
    echo json_encode([
      'success' => false,
      'message' => 'Provide a valid character ID and a deletion reason of 1 to 1000 characters.'
    ]);
    exit;
  }

  // Lock the target to prevent concurrent staff actions on the same row.
  $pdo->beginTransaction();
  $stmt = $pdo->prepare(
    "SELECT characters.id, characters.user_id, characters.name, characters.status
         FROM characters
         WHERE characters.id = :character_id
           AND characters.deleted_at IS NULL
           AND characters.status IN ('PENDING', 'APPROVED')
         FOR UPDATE"
  );
  $stmt->execute(['character_id' => $characterId]);
  $character = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$character) {
    $pdo->rollBack();
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Character not found or already deleted.']);
    exit;
  }

  // Preserve the name, owner, staff actor and reason before deletion.
  // This history deliberately has no FK to the removed character.
  $stmt = $pdo->prepare(
    'INSERT INTO character_staff_deletions
         (character_id, character_name, owner_user_id, actor_user_id, reason)
         VALUES (:character_id, :character_name, :owner_user_id, :actor_user_id, :reason)'
  );
  $stmt->execute([
    'character_id' => $characterId,
    'character_name' => $character['name'],
    'owner_user_id' => $character['user_id'],
    'actor_user_id' => (int) $_SESSION['user_id'],
    'reason' => $reason
  ]);

  // Delete dependent rows before the parent, respecting RESTRICT FKs.
  // Only the association rows are removed, not the accessory catalogue.
  foreach (['reviews', 'character_accessories', 'appearances'] as $table) {
    $stmt = $pdo->prepare("DELETE FROM {$table} WHERE character_id = :character_id");
    $stmt->execute(['character_id' => $characterId]);
  }

  $stmt = $pdo->prepare('DELETE FROM characters WHERE id = :character_id');
  $stmt->execute(['character_id' => $characterId]);
  if ($stmt->rowCount() !== 1) {
    throw new RuntimeException('Character deletion was not completed.');
  }

  $pdo->commit();

  // MongoDB is an additional audit channel, not part of the SQL transaction.
  // Failure must never make the client retry an already committed deletion.
  $activityLogged = false;
  try {
    require_once __DIR__ . '/../config/activity-logger.php';
    recordStaffActivity(
      (int) $_SESSION['user_id'],
      'character.deleted',
      'character',
      $characterId
    );
    $activityLogged = true;
  } catch (Throwable $error) {
    error_log('FantasyRealm: Staff character deletion activity logging failed.');
  }

  echo json_encode([
    'success' => true,
    'message' => 'Character permanently deleted.',
    'character_id' => $characterId,
    'activity_logged' => $activityLogged
  ]);
} catch (Throwable $error) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  error_log('FantasyRealm: Staff character deletion failed.');
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Unable to delete this character.']);
}
