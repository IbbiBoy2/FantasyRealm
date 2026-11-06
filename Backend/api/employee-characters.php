<?php

declare(strict_types=1);

/*
 * FANTASYREALM - STAFF CHARACTER CATALOGUE
 *
 * Lists existing, non-deleted characters for employee moderation.
 * All permissions are checked on the server for each request.
 */

require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  header('Allow: GET');
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
  // Never trust a role cached in the browser or session.
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

  // Exclude soft-deleted and legacy rejected characters.
  // Search is performed client-side over this staff-only catalogue.
  $stmt = $pdo->query(
    "SELECT characters.id, characters.name, characters.status,
                characters.created_at, users.username AS creator_username
         FROM characters
         INNER JOIN users ON users.id = characters.user_id
         WHERE characters.deleted_at IS NULL
           AND characters.status IN ('PENDING', 'APPROVED')
         ORDER BY characters.created_at DESC, characters.id DESC"
  );

  $characters = $stmt->fetchAll(PDO::FETCH_ASSOC);
  foreach ($characters as &$character) {
    $character['id'] = (int) $character['id'];
  }
  unset($character);

  echo json_encode(['success' => true, 'characters' => $characters]);
} catch (Throwable $error) {
  error_log('FantasyRealm: Staff character catalogue failed.');
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Unable to load characters.']);
}
