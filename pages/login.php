<?php

session_start();

require_once __DIR__ . '/../config/database.php';

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        $message = 'Please fill in all fields.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = 'Please enter a valid email address.';
    } else {

        $stmt = $pdo->prepare(
            'SELECT id, role_id, email, username, password_hash, suspended
             FROM users
             WHERE email = :email
             LIMIT 1'
        );

        $stmt->execute([
            'email' => $email
        ]);

        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {

            $message = 'Invalid email or password.';

        } elseif ($user['suspended']) {

            $message = 'Your account is suspended.';

        } else {

            session_regenerate_id(true);

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role_id'] = $user['role_id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['email'] = $user['email'];

            header('Location: ../index.php');
            exit;
        }
    }
}

?>


<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Login | FantasyRealm</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="../css/login.css">
</head>

<body>

  <header class="login-navbar">
    <a class="brand" href="../index.php">
      <span class="brand-mark">✦</span>
      <span>FantasyRealm</span>
    </a>

    <nav class="nav-links">
      <a href="../index.php">Home</a>
      <a href="character-gallery.php">Characters</a>
      <a class="active" href="login.php">Login</a>
      <a class="nav-register" href="register.php">Register</a>
    </nav>
  </header>

  <main class="login-page">

    <section class="login-panel">

      <p class="section-label">WELCOME BACK</p>

      <h1>Login</h1>

      <p class="login-intro">
        Enter your account details to continue your journey.
      </p>

      <?php if ($message !== ''): ?>
        <p class="form-message">
          <?= htmlspecialchars($message) ?>
        </p>
      <?php endif; ?>

      <form class="login-form" method="post">

        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
        >

        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          required
        >

        <button type="submit">
          Login
        </button>

      </form>
      <p class="forgot-link">
  <a href="forgot-password.php">Forgot your password?</a>
</p>
      <p class="register-link">
        Don't have an account?
        <a href="register.php">Create one</a>
      </p>

    </section>

  </main>

</body>
</html>