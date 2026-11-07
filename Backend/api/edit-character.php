<?php

declare(strict_types=1);

/**
 * FANTASYREALM - EDIT AN APPROVED CHARACTER
 *
 * GET: load the owner's approved character and its equipped items.
 * POST: update appearance and equipment without changing approved identity.
 *
 * Important: the MongoDB history event is written before the SQL commit.
 * If writing the mandatory history fails, MariaDB rolls back the edit.
 */
require_once __DIR__ . '/../config/security.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-active-user.php';

function editResponse(int $status, string $message): never
{
  http_response_code($status);
  echo json_encode(['success' => false, 'message' => $message]);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
  header('Allow: GET, POST');
  editResponse(405, 'Method not allowed.');
}
requireActiveUser($pdo);
if (!isset($_SESSION['user_id'])) {
  editResponse(401, 'Please sign in.');
}
$userId = (int) $_SESSION['user_id'];

/** Load only the current owner's approved, non-deleted character. */
function ownedApprovedCharacter(PDO $pdo, int $characterId, int $userId, bool $lock = false): ?array
{
  $statement = $pdo->prepare(
    'SELECT c.id, c.name, c.gender, c.status, c.shared,
                a.nose_shape, a.mouth_shape, a.eye_shape, a.hair_style,
                a.skin_color, a.eye_color, a.hair_color
         FROM characters c
         INNER JOIN appearances a ON a.character_id = c.id
         WHERE c.id = :character_id
           AND c.user_id = :user_id
           AND c.status = :status
           AND c.deleted_at IS NULL' . ($lock ? ' FOR UPDATE' : '')
  );
  $statement->execute([
    'character_id' => $characterId,
    'user_id' => $userId,
    'status' => 'APPROVED'
  ]);
  $value = $statement->fetch(PDO::FETCH_ASSOC);
  return $value ?: null;
}

if ($method === 'GET') {
  $characterId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
  if ($characterId === false || $characterId === null) {
    editResponse(422, 'Invalid character ID.');
  }
  try {
    $character = ownedApprovedCharacter($pdo, $characterId, $userId);
    if ($character === null) {
      editResponse(404, 'Approved character not found.');
    }
    $statement = $pdo->prepare(
      'SELECT accessory_id FROM character_accessories
             WHERE character_id = :id ORDER BY accessory_id'
    );
    $statement->execute(['id' => $characterId]);
    $equipped = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    $character['id'] = (int) $character['id'];
    $character['shared'] = (bool) $character['shared'];
    $character['equipment_ids'] = $equipped;
    echo json_encode(['success' => true, 'character' => $character]);
  } catch (Throwable $error) {
    error_log('FantasyRealm edit character GET: ' . $error->getMessage());
    editResponse(500, 'Unable to load the character.');
  }
  exit;
}

requireCsrfToken();
try {
  $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
  editResponse(400, 'Invalid JSON data.');
}
if (!is_array($data) || array_is_list($data)) {
  editResponse(400, 'Invalid character data.');
}
$characterId = filter_var($data['character_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($characterId === false || $characterId === null) {
  editResponse(422, 'Invalid character ID.');
}

// Name and gender are intentionally never read from the submitted data.
$limits = ['nose_style' => 10, 'mouth_style' => 7, 'eye_style' => 7, 'hair_style' => 10];
$styles = [];
foreach ($limits as $field => $maximum) {
  $number = $data[$field] ?? null;
  if (!is_int($number) || $number < 1 || $number > $maximum) {
    editResponse(422, 'Invalid appearance option: ' . $field . '.');
  }
  $styles[$field] = (string) $number;
}
$colors = [];
foreach (['skin_color', 'eye_color', 'hair_color'] as $field) {
  $color = $data[$field] ?? null;
  if (!is_string($color) || !preg_match('/^#[a-fA-F0-9]{6}$/D', $color)) {
    editResponse(422, 'Invalid color: ' . $field . '.');
  }
  $colors[$field] = strtolower($color);
}

$equipmentIds = $data['equipment_ids'] ?? [];
if (!is_array($equipmentIds) || count($equipmentIds) > 30 || array_is_list($equipmentIds) === false) {
  editResponse(422, 'Invalid equipment selection.');
}
$equipmentIds = array_values(array_unique($equipmentIds));
foreach ($equipmentIds as $id) {
  if (!is_int($id) || $id <= 0) {
    editResponse(422, 'Invalid equipment ID.');
  }
}

try {
  $pdo->beginTransaction();
  $character = ownedApprovedCharacter($pdo, $characterId, $userId, true);
  if ($character === null) {
    $pdo->rollBack();
    editResponse(404, 'Approved character not found.');
  }

  $typeCount = ['armor' => 0, 'clothing' => 0, 'weapon' => 0, 'accessory' => 0];
  if ($equipmentIds !== []) {
    $placeholders = implode(',', array_fill(0, count($equipmentIds), '?'));
    $statement = $pdo->prepare(
      "SELECT id, type, gender, active FROM accessories WHERE id IN ($placeholders)"
    );
    $statement->execute($equipmentIds);
    $items = $statement->fetchAll(PDO::FETCH_ASSOC);
    if (count($items) !== count($equipmentIds)) {
      $pdo->rollBack();
      editResponse(422, 'One or more equipment items do not exist.');
    }
    foreach ($items as $item) {
      $type = (string) $item['type'];
      if (!isset($typeCount[$type]) || !(bool) $item['active']) {
        $pdo->rollBack();
        editResponse(422, 'An equipment item is unavailable.');
      }
      if (in_array($type, ['armor', 'clothing'], true) && $item['gender'] !== $character['gender']) {
        $pdo->rollBack();
        editResponse(422, 'This armor or clothing is incompatible with the character.');
      }
      if (in_array($type, ['weapon', 'accessory'], true) && $item['gender'] !== null) {
        $pdo->rollBack();
        editResponse(422, 'Weapons and accessories must be unisex.');
      }
      $typeCount[$type]++;
    }
  }
  if ($typeCount['armor'] + $typeCount['clothing'] > 1 || $typeCount['weapon'] > 1) {
    $pdo->rollBack();
    editResponse(422, 'Choose at most one armor/clothing item and one weapon.');
  }

  $statement = $pdo->prepare(
    'UPDATE appearances SET
            nose_shape = :nose, mouth_shape = :mouth, eye_shape = :eyes,
            hair_style = :hair, skin_color = :skin,
            eye_color = :eye_color, hair_color = :hair_color
         WHERE character_id = :id'
  );
  $statement->execute([
    'nose' => $styles['nose_style'],
    'mouth' => $styles['mouth_style'],
    'eyes' => $styles['eye_style'],
    'hair' => $styles['hair_style'],
    'skin' => $colors['skin_color'],
    'eye_color' => $colors['eye_color'],
    'hair_color' => $colors['hair_color'],
    'id' => $characterId
  ]);

  $statement = $pdo->prepare('DELETE FROM character_accessories WHERE character_id = :id');
  $statement->execute(['id' => $characterId]);
  if ($equipmentIds !== []) {
    $statement = $pdo->prepare(
      'INSERT INTO character_accessories (character_id, accessory_id)
             VALUES (:character_id, :accessory_id)'
    );
    foreach ($equipmentIds as $itemId) {
      $statement->execute(['character_id' => $characterId, 'accessory_id' => $itemId]);
    }
  }

  // Mandatory audit: do not commit the SQL update if MongoDB history fails.
  require_once __DIR__ . '/character-history-logger.php';
  recordCharacterHistory($pdo, $characterId, 'character.updated');
  $pdo->commit();

  echo json_encode([
    'success' => true,
    'message' => 'Character updated successfully.',
    'character_id' => $characterId,
    'history_logged' => true
  ]);
} catch (Throwable $error) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  error_log('FantasyRealm edit character POST: ' . $error->getMessage());
  editResponse(500, 'Unable to update character. The change was not confirmed.');
}
