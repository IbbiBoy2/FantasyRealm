<?php

declare(strict_types=1);

/*
 * FANTASYREALM - ADMIN EMPLOYEE PASSWORD RESET
 *
 * An active administrator can assign a new password
 * to an existing employee account.
 */

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-admin.php';
require_once __DIR__ . '/../config/password.php';

function sendPasswordResponse(int $status, array $body): never
{
  http_response_code($status);
  echo json_encode($body);
  exit;
}

try {
  $admin = requireAdmin($pdo);
  $method = $_SERVER['REQUEST_METHOD'] ?? '';

  /*
   * Provide a CSRF token only to administrators.
   */
  if ($method === 'GET') {
    if (
      !isset($_SESSION['admin_employee_password_csrf']) ||
      !is_string($_SESSION['admin_employee_password_csrf'])
    ) {
      $_SESSION['admin_employee_password_csrf'] =
        bin2hex(random_bytes(32));
    }

    sendPasswordResponse(200, [
      'success' => true,
      'csrf_token' => $_SESSION['admin_employee_password_csrf']
    ]);
  }

  if ($method !== 'POST') {
    header('Allow: GET, POST');

    sendPasswordResponse(405, [
      'success' => false,
      'message' => 'Method not allowed.'
    ]);
  }

  $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

  if (
    !preg_match(
      '/^application\/json(?:\s*;|$)/i',
      $contentType
    )
  ) {
    sendPasswordResponse(415, [
      'success' => false,
      'message' => 'Content-Type must be application/json.'
    ]);
  }

  /*
   * Validate the dedicated CSRF token.
   */
  $expectedToken =
    $_SESSION['admin_employee_password_csrf'] ?? null;

  $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

  if (
    !is_string($expectedToken) ||
    $expectedToken === '' ||
    !is_string($providedToken) ||
    !hash_equals($expectedToken, $providedToken)
  ) {
    sendPasswordResponse(403, [
      'success' => false,
      'message' => 'Invalid security token.'
    ]);
  }

  try {
    $data = json_decode(
      file_get_contents('php://input'),
      true,
      512,
      JSON_THROW_ON_ERROR
    );
  } catch (JsonException $error) {
    sendPasswordResponse(400, [
      'success' => false,
      'message' => 'Invalid JSON data.'
    ]);
  }

  if (!is_array($data)) {
    sendPasswordResponse(400, [
      'success' => false,
      'message' => 'Invalid JSON data.'
    ]);
  }

  $employeeId = $data['employee_id'] ?? null;
  $password = $data['password'] ?? null;
  $passwordConfirm = $data['password_confirm'] ?? null;

  if (
    !is_int($employeeId) ||
    $employeeId <= 0 ||
    !is_string($password) ||
    !is_string($passwordConfirm)
  ) {
    sendPasswordResponse(422, [
      'success' => false,
      'message' => 'Invalid employee or password information.'
    ]);
  }

  if ($employeeId === (int) $admin['id']) {
    sendPasswordResponse(403, [
      'success' => false,
      'message' => 'You cannot reset your own password here.'
    ]);
  }

  /*
   * Apply the same policy as registration and
   * password reset.
   */
  $passwordError = validateAccountPassword($password);

  if ($passwordError !== null) {
    sendPasswordResponse(422, [
      'success' => false,
      'message' => $passwordError
    ]);
  }

  if ($password !== $passwordConfirm) {
    sendPasswordResponse(422, [
      'success' => false,
      'message' => 'Passwords do not match.'
    ]);
  }

  /*
   * Hash before locking the target account so
   * password hashing does not prolong the lock.
   */
  $passwordHash = hashAccountPassword($password);

  $pdo->beginTransaction();

  /*
   * Lock and verify the employee's current role.
   * USER and ADMIN accounts must not be updated.
   */
  $stmt = $pdo->prepare(
    'SELECT users.id, users.username
         FROM users
         INNER JOIN roles ON users.role_id = roles.id
         WHERE users.id = :employee_id
           AND roles.name = :role
         FOR UPDATE'
  );

  $stmt->execute([
    'employee_id' => $employeeId,
    'role' => 'EMPLOYEE'
  ]);

  $employee = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$employee) {
    $pdo->rollBack();

    sendPasswordResponse(404, [
      'success' => false,
      'message' => 'Employee account not found.'
    ]);
  }

  $stmt = $pdo->prepare(
    'UPDATE users
         SET password_hash = :password_hash
         WHERE id = :employee_id'
  );

  $stmt->execute([
    'password_hash' => $passwordHash,
    'employee_id' => $employeeId
  ]);

  $pdo->commit();

  /*
   * Log the operation, never the password.
   * Logging errors do not undo the database update.
   */
  $activityLogged = false;

  try {
    require_once __DIR__ . '/../config/activity-logger.php';

    recordStaffActivity(
      (int) $admin['id'],
      'employee.password_updated',
      'employee',
      $employeeId
    );

    $activityLogged = true;
  } catch (Throwable $error) {
    error_log(
      'FantasyRealm: Employee password logging failed.'
    );
  }

  sendPasswordResponse(200, [
    'success' => true,
    'message' => 'Employee password updated successfully.',
    'employee' => [
      'id' => $employeeId,
      'username' => $employee['username']
    ],
    'activity_logged' => $activityLogged
  ]);

} catch (AdminAccessException $error) {
  sendPasswordResponse($error->getHttpStatus(), [
    'success' => false,
    'message' => $error->getMessage()
  ]);

} catch (Throwable $error) {
  if (
    isset($pdo) &&
    $pdo instanceof PDO &&
    $pdo->inTransaction()
  ) {
    $pdo->rollBack();
  }

  error_log('FantasyRealm: Employee password update failed.');

  sendPasswordResponse(500, [
    'success' => false,
    'message' => 'Unable to update employee password.'
  ]);
}
