<?php

require_once __DIR__ . '/../config/database.php';

$message = '';
$token = $_GET['token'] ?? $_POST['token'] ?? '';
$user = null;

if ($token !== '') {

    $tokenHash = hash('sha256', $token);

    $stmt = $pdo->prepare(
        'SELECT id, reset_token_expires_at
         FROM users
         WHERE reset_token_hash = :token_hash
         LIMIT 1'
    );

    $stmt->execute([
        'token_hash' => $tokenHash
    ]);

    $user = $stmt->fetch();

    if (!$user) {

        $message = 'Invalid reset link.';

    } elseif (
        empty($user['reset_token_expires_at']) ||
        strtotime($user['reset_token_expires_at']) < time()
    ) {

        $message = 'This reset link has expired.';
        $user = null;

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {

        $password = $_POST['password'] ?? '';
        $passwordConfirm = $_POST['password_confirm'] ?? '';

        if ($password === '' || $passwordConfirm === '') {

            $message = 'Please fill in all fields.';

        } elseif ($password !== $passwordConfirm) {

            $message = 'Passwords do not match.';

        } else {

            $passwordHash = password_hash(
                $password,
                PASSWORD_DEFAULT
            );

            $stmt = $pdo->prepare(
                'UPDATE users
                 SET password_hash = :password_hash,
                     reset_token_hash = NULL,
                     reset_token_expires_at = NULL
                 WHERE id = :user_id'
            );

            $stmt->execute([
                'password_hash' => $passwordHash,
                'user_id' => $user['id']
            ]);

            $message = 'Your password has been reset successfully.';
            $user = null;
        }
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Reset Password | FantasyRealm</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="../css/reset-password.css">
</head>

<body>

  <main class="reset-page">

    <section class="reset-panel">

      <p class="section-label">ACCOUNT RECOVERY</p>

      <h1>Reset Password</h1>

      <?php if ($message !== ''): ?>
        <p class="form-message">
          <?= htmlspecialchars($message) ?>
        </p>
      <?php endif; ?>

      <?php if ($user): ?>

        <form class="reset-form" method="post">

          <input
            type="hidden"
            name="token"
            value="<?= htmlspecialchars($token) ?>"
          >

          <label for="password">New Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
          >

          <label for="password-confirm">Confirm New Password</label>
          <input
            type="password"
            id="password-confirm"
            name="password_confirm"
            required
          >

          <button type="submit">
            Reset Password
          </button>

        </form>

      <?php endif; ?>

      <p class="login-link">
        <a href="login.php">Back to Login</a>
      </p>

    </section>

  </main>

</body>
</html>