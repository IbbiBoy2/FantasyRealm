<?php

declare(strict_types=1);

/**
 * FANTASYREALM - STAFF CONTACT INBOX
 *
 * Read-only API for messages submitted through contact.php.
 * Only active EMPLOYEE and ADMIN accounts can read personal messages.
 * The endpoint uses pagination to avoid returning an unbounded dataset.
 */

require_once __DIR__ . '/../config/security.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

/** Send a consistent JSON error response without exposing SQL details. */
function contactInboxError(int $status, string $message): never
{
	http_response_code($status);
	echo json_encode(['success' => false, 'message' => $message]);
	exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
	header('Allow: GET');
	contactInboxError(405, 'Method not allowed.');
}

if (!isset($_SESSION['user_id'])) {
	contactInboxError(401, 'Please sign in.');
}

require_once __DIR__ . '/../config/database.php';

try {
	// Re-check the role in MariaDB, never trust a browser-provided role.
	$actorStmt = $pdo->prepare(
		'SELECT users.suspended, roles.name AS role_name
         FROM users
         INNER JOIN roles ON roles.id = users.role_id
         WHERE users.id = :user_id
         LIMIT 1'
	);
	$actorStmt->execute(['user_id' => (int) $_SESSION['user_id']]);
	$actor = $actorStmt->fetch(PDO::FETCH_ASSOC);

	if (
		!$actor || (bool) $actor['suspended'] ||
		!in_array($actor['role_name'], ['EMPLOYEE', 'ADMIN'], true)
	) {
		contactInboxError(403, 'Employee access required.');
	}

	$page = filter_var(
		$_GET['page'] ?? '1',
		FILTER_VALIDATE_INT,
		['options' => ['min_range' => 1, 'max_range' => 1000000]]
	);
	if ($page === false) {
		contactInboxError(422, 'Invalid page number.');
	}

	$query = $_GET['q'] ?? '';
	if (!is_string($query) || mb_strlen($query, 'UTF-8') > 100) {
		contactInboxError(422, 'Search must be at most 100 characters.');
	}
	$query = trim($query);
	$pageSize = 20;
	$offset = ($page - 1) * $pageSize;

	// Search the sender's username/email only. Message bodies are not
	// included in search to limit unnecessary processing of personal data.
	$filter = '';
	$parameters = [];
	if ($query !== '') {
		$filter = ' WHERE (username LIKE :username OR email LIKE :email)';
		$pattern = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $query) . '%';
		$parameters = ['username' => $pattern, 'email' => $pattern];
	}

	$countStmt = $pdo->prepare(
		'SELECT COUNT(*) FROM contact_messages' . $filter
	);
	$countStmt->execute($parameters);
	$total = (int) $countStmt->fetchColumn();

	$messagesStmt = $pdo->prepare(
		'SELECT id, user_id, username, email, message, created_at
         FROM contact_messages' . $filter . '
         ORDER BY created_at DESC, id DESC
         LIMIT :page_size OFFSET :page_offset'
	);

	foreach ($parameters as $key => $value) {
		$messagesStmt->bindValue(':' . $key, $value, PDO::PARAM_STR);
	}
	$messagesStmt->bindValue(':page_size', $pageSize, PDO::PARAM_INT);
	$messagesStmt->bindValue(':page_offset', $offset, PDO::PARAM_INT);
	$messagesStmt->execute();

	$messages = $messagesStmt->fetchAll(PDO::FETCH_ASSOC);
	foreach ($messages as &$item) {
		$item['id'] = (int) $item['id'];
		$item['user_id'] = $item['user_id'] === null ? null : (int) $item['user_id'];
	}
	unset($item);

	echo json_encode([
		'success' => true,
		'messages' => $messages,
		'page' => $page,
		'page_size' => $pageSize,
		'total' => $total,
		'total_pages' => (int) ceil($total / $pageSize)
	]);
} catch (Throwable $error) {
	error_log('FantasyRealm contact inbox: ' . $error->getMessage());
	contactInboxError(500, 'Unable to load contact messages.');
}
