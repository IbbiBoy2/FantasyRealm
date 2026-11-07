<?php

declare(strict_types=1);

/*
 * FANTASYREALM - STAFF EQUIPMENT UPLOAD
 *
 * Armor/clothing: a gender-specific transparent outfit PNG plus a
 * gender-specific tintable body PNG, both aligned to 568 x 1275.
 * Weapon/accessory: one unisex image, with no replacement body.
 * The existing staff permission and CSRF checks are preserved.
 */

require_once __DIR__ . '/../config/security.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function failUpload(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    failUpload(405, 'Method not allowed.');
}
if (!isset($_SESSION['user_id'])) {
    failUpload(401, 'You must be logged in.');
}

require_once __DIR__ . '/../config/database.php';
$createdFiles = [];

/**
 * Check actual file bytes and size; never trust an extension or browser MIME.
 * Requiring the same canvas size keeps character layers perfectly aligned.
 */
function validateEquipmentImage(?array $file, bool $strictCanvas): string
{
    if (
        $file === null || !isset($file['error'], $file['size'], $file['tmp_name']) ||
        !is_int($file['error']) || !is_int($file['size']) ||
        !is_string($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK ||
        $file['size'] <= 0 || $file['size'] > 4 * 1024 * 1024 ||
        !is_uploaded_file($file['tmp_name'])
    ) {
        throw new InvalidArgumentException('Each image must be a valid upload of at most 4 MB.');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $dimensions = @getimagesize($file['tmp_name']);
    $types = $strictCanvas
        ? ['image/png' => 'png']
        : ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    if (
        !is_string($mime) || !isset($types[$mime]) ||
        $dimensions === false || ($dimensions['mime'] ?? null) !== $mime ||
        $dimensions[0] <= 0 || $dimensions[1] <= 0 ||
        $dimensions[0] > 4096 || $dimensions[1] > 4096
    ) {
        throw new InvalidArgumentException('Invalid image format or dimensions.');
    }
    if ($strictCanvas && ($dimensions[0] !== 568 || $dimensions[1] !== 1275)) {
        throw new InvalidArgumentException('Armor and clothing images must be PNG files of 568 x 1275 pixels.');
    }
    return $types[$mime];
}

/** Move a validated upload into the public artwork directory. */
function storeEquipmentImage(array $file, string $ext, string $directory, array &$createdFiles): string
{
    $filename = 'equipment_' . bin2hex(random_bytes(16)) . '.' . $ext;
    $destination = $directory . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        throw new RuntimeException('Unable to save uploaded artwork.');
    }
    $createdFiles[] = $destination;
    return '/FantasyRealm/Frontend/assets/accessories/' . $filename;
}

try {
    // Use the same database-backed authorization as the existing employee API.
    $stmt = $pdo->prepare(
        'SELECT users.suspended, roles.name AS role_name
         FROM users INNER JOIN roles ON roles.id = users.role_id
         WHERE users.id = :user_id'
    );
    $stmt->execute(['user_id' => $_SESSION['user_id']]);
    $actor = $stmt->fetch(PDO::FETCH_ASSOC);
    if (
        !$actor || (bool) $actor['suspended'] ||
        !in_array($actor['role_name'], ['EMPLOYEE', 'ADMIN'], true)
    ) {
        failUpload(403, 'Employee access required.');
    }
    requireCsrfToken();

    $name = is_string($_POST['name'] ?? null) ? trim($_POST['name']) : '';
    $type = is_string($_POST['type'] ?? null) ? strtolower(trim($_POST['type'])) : '';
    $gender = is_string($_POST['gender'] ?? null) ? strtolower(trim($_POST['gender'])) : '';
    $wearable = in_array($type, ['armor', 'clothing'], true);

    if ($name === '' || mb_strlen($name) > 100) {
        failUpload(422, 'Enter a name of 1 to 100 characters.');
    }
    if (!in_array($type, ['weapon', 'armor', 'clothing', 'accessory'], true)) {
        failUpload(422, 'Choose a valid equipment type.');
    }
    if ($wearable && !in_array($gender, ['male', 'female'], true)) {
        failUpload(422, 'Choose male or female for armor and clothing.');
    }
    if (!$wearable && $gender !== '') {
        failUpload(422, 'Weapons and accessories must be unisex.');
    }

    // Browser form field "image" remains the equipment artwork field.
    $image = isset($_FILES['image']) && is_array($_FILES['image']) ? $_FILES['image'] : null;
    $bodyImage = isset($_FILES['body_image']) && is_array($_FILES['body_image']) ? $_FILES['body_image'] : null;
    $imageExt = validateEquipmentImage($image, $wearable);
    $bodyExt = $wearable ? validateEquipmentImage($bodyImage, true) : null;
    if (!$wearable && $bodyImage !== null && ($bodyImage['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        failUpload(422, 'Weapons and accessories cannot replace the body.');
    }

    $directory = dirname(__DIR__, 2) . '/Frontend/assets/accessories';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the upload directory.');
    }

    $imagePath = storeEquipmentImage($image, $imageExt, $directory, $createdFiles);
    $bodyPath = $wearable
        ? storeEquipmentImage($bodyImage, $bodyExt, $directory, $createdFiles)
        : null;
    $storedGender = $wearable ? $gender : null;

    $stmt = $pdo->prepare(
        'INSERT INTO accessories (name, type, image_path, body_image_path, gender, active)
         VALUES (:name, :type, :image_path, :body_image_path, :gender, 1)'
    );
    $stmt->execute([
        'name' => $name,
        'type' => $type,
        'image_path' => $imagePath,
        'body_image_path' => $bodyPath,
        'gender' => $storedGender
    ]);
    $accessoryId = (int) $pdo->lastInsertId();

    // MongoDB logging must never undo a successful MariaDB insert.
    $logged = false;
    try {
        require_once __DIR__ . '/../config/activity-logger.php';
        recordStaffActivity((int) $_SESSION['user_id'], 'accessory.created', 'accessory', $accessoryId);
        $logged = true;
    } catch (Throwable $logError) {
        error_log('FantasyRealm: Equipment activity logging failed.');
    }

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Equipment added successfully.',
        'accessory' => [
            'id' => $accessoryId,
            'name' => $name,
            'type' => $type,
            'gender' => $storedGender,
            'image_path' => $imagePath,
            'body_image_path' => $bodyPath,
            'active' => true,
            'usage_count' => 0
        ],
        'activity_logged' => $logged
    ]);
} catch (InvalidArgumentException $error) {
    foreach ($createdFiles as $path) {
        @unlink($path);
    }
    failUpload(422, $error->getMessage());
} catch (Throwable $error) {
    foreach ($createdFiles as $path) {
        @unlink($path);
    }
    error_log('FantasyRealm: Equipment creation failed.');
    failUpload(500, 'Unable to add equipment.');
}
