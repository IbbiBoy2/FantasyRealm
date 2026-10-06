<?php

require_once __DIR__ . '/../config/database.php';

$message = '';
$devResetLink = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $email = trim($_POST['email'] ?? '');

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {

        $message = 'Please enter a valid email address.';

    } else {

        $stmt = $pdo->prepare(
            'SELECT id
             FROM users
             WHERE email = :email
             LIMIT 1'
        );

        $stmt->execute([
            'email' => $email
        ]);

        $user = $stmt->fetch();

        if ($user) {

            $token = bin2hex(random_bytes(32));

            $tokenHash = hash('sha256', $token);

            $expiresAt = date(
                'Y-m-d H:i:s',
                time() + 1800
            );

            $stmt = $pdo->prepare(
                'UPDATE users
                 SET reset_token_hash = :token_hash,
                     reset_token_expires_at = :expires_at
                 WHERE id = :user_id'
            );

            $stmt->execute([
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt,
                'user_id' => $user['id']
            ]);

            $devResetLink =
                'http://localhost/FantasyRealm/pages/reset-password.php?token='
                . urlencode($token);
        }

        $message =
            'If an account exists for this email, a password reset link has been created.';
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Forgot Password | FantasyRealm</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="../css/forgot-password.css">
</head>

<body>

  <header class="forgot-navbar">
    <a class="brand" href="../index.php">
      <span class="brand-mark">✦</span>
      <span>FantasyRealm</span>
    </a>

    <nav class="nav-links">
      <a href="../index.php">Home</a>
      <a href="character-gallery.php">Characters</a>
      <a href="login.php">Login</a>
      <a class="nav-register" href="register.php">Register</a>
    </nav>
  </header>

  <main class="forgot-page">

    <section class="forgot-panel">

      <p class="section-label">ACCOUNT RECOVERY</p>

      <h1>Forgot Password?</h1>

      <p class="forgot-intro">
        Enter your email address and we will create a secure password reset link.
      </p>

      <?php if ($message !== ''): ?>
        <p class="form-message">
          <?= htmlspecialchars($message) ?>
        </p>
      <?php endif; ?>

      <?php if ($devResetLink !== ''): ?>
  <p class="dev-reset-link">
    Development reset link:
    <a href="<?= htmlspecialchars($devResetLink) ?>">
      Reset Password
    </a>
  </p>
<?php endif; ?>

      <form class="forgot-form" method="post">

        <label for="email">Email</label>

        <input
          type="email"
          id="email"
          name="email"
          required
        >

        <button type="submit">
          Send Reset Link
        </button>

      </form>

      <p class="login-link">
        Remember your password?
        <a href="login.php">Back to Login</a>
      </p>

    </section>

  </main>

</body>
</html>