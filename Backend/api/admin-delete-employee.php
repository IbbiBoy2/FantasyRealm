<?php

declare(strict_types=1);

/*
 * FANTASYREALM - DELETE EMPLOYEE
 *
 * Only active administrators may delete employee accounts.
 * Accounts with characters or reviews are protected from
 * accidental deletion of associated player content.
 */

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/require-admin.php';

function deleteEmployeeResponse(int $status, array $data): never
{
  http_response_code($status);
  echo json_encode($data);
  exit;
}

try {
  $admin = requireAdmin($pdo);
  $method = $_SERVER['REQUEST_METHOD'] ?? '';

  if ($method === 'GET') {
    if (
      !isset($_SESSION['admin_delete_employee_csrf']) ||
      !is_string($_SESSION['admin_delete_employee_csrf'])
    ) {
      $_SESSION['admin_delete_employee_csrf'] =
        bin2hex(random_bytes(32));
    }

    deleteEmployeeResponse(200, [
      'success' => true,
      'csrf_token' => $_SESSION['admin_delete_employee_csrf']
    ]);
  }

  if ($method !== 'POST') {
    header('Allow: GET, POST');

    deleteEmployeeResponse(405, [
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
    deleteEmployeeResponse(415, [
      'success' => false,
      'message' => 'Content-Type must be application/json.'
    ]);
  }

  $expectedToken =
    $_SESSION['admin_delete_employee_csrf'] ?? null;

  $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

  if (
    !is_string($expectedToken) ||
    $expectedToken === '' ||
    !is_string($providedToken) ||
    !hash_equals($expectedToken, $providedToken)
  ) {
    deleteEmployeeResponse(403, [
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
    deleteEmployeeResponse(400, [
      'success' => false,
      'message' => 'Invalid JSON data.'
    ]);
  }

  if (!is_array($data)) {
    deleteEmployeeResponse(400, [
      'success' => false,
      'message' => 'Invalid JSON data.'
    ]);
  }

  $employeeId = $data['employee_id'] ?? null;

  if (!is_int($employeeId) || $employeeId <= 0) {
    deleteEmployeeResponse(422, [
      'success' => false,
      'message' => 'Provide a valid employee ID.'
    ]);
  }

  if ($employeeId === (int) $admin['id']) {
    deleteEmployeeResponse(403, [
      'success' => false,
      'message' => 'You cannot delete your own account.'
    ]);
  }

  $pdo->beginTransaction();

  /*
   * Lock the employee record and verify its current role.
   * USER and ADMIN accounts cannot be deleted here.
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

    deleteEmployeeResponse(404, [
      'success' => false,
      'message' => 'Employee account not found.'
    ]);
  }

  /*
   * Prevent accidental removal of player-generated data.
   * This particularly protects players promoted to employees.
   */
  $stmt = $pdo->prepare(
    'SELECT COUNT(*) FROM characters WHERE user_id = :id'
  );
  $stmt->execute(['id' => $employeeId]);

  $characterCount = (int) $stmt->fetchColumn();

  $stmt = $pdo->prepare(
    'SELECT COUNT(*) FROM reviews WHERE user_id = :id'
  );
  $stmt->execute(['id' => $employeeId]);

  $reviewCount = (int) $stmt->fetchColumn();

  if ($characterCount > 0 || $reviewCount > 0) {
    $pdo->rollBack();

    deleteEmployeeResponse(409, [
      'success' => false,
      'message' =>
        'This employee still owns characters or reviews. ' .
        'Account deletion is blocked to protect that content.'
    ]);
  }

  /*
   * Keep contact messages for support history,
   * but remove the link to the deleted account.
   */
  $stmt = $pdo->prepare(
    'UPDATE contact_messages
         SET user_id = NULL
         WHERE user_id = :id'
  );
  $stmt->execute(['id' => $employeeId]);

  /*
   * Delete only the employee account.
   */
  $stmt = $pdo->prepare(
    'DELETE FROM users WHERE id = :id'
  );
  $stmt->execute(['id' => $employeeId]);

  if ($stmt->rowCount() !== 1) {
    throw new RuntimeException(
      'Employee deletion did not complete.'
    );
  }

  $pdo->commit();

  /*
   * Preserve the employee ID in the audit log,
   * even though the SQL account no longer exists.
   */
  $activityLogged = false;

  try {
    require_once __DIR__ . '/../config/activity-logger.php';

    recordStaffActivity(
      (int) $admin['id'],
      'employee.deleted',
      'employee',
      $employeeId
    );

    $activityLogged = true;
  } catch (Throwable $error) {
    error_log(
      'FantasyRealm: Employee deletion logging failed.'
    );
  }

  deleteEmployeeResponse(200, [
    'success' => true,
    'message' => 'Employee account deleted successfully.',
    'employee_id' => $employeeId,
    'activity_logged' => $activityLogged
  ]);

} catch (AdminAccessException $error) {
  deleteEmployeeResponse($error->getHttpStatus(), [
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

  error_log('FantasyRealm: Employee deletion failed.');

  deleteEmployeeResponse(500, [
    'success' => false,
    'message' => 'Unable to delete employee account.'
  ]);
}
