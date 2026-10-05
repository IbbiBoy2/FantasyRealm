<?php


require_once __DIR__ . '/../config/database.php';

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $passwordConfirm = $_POST['password_confirm'] ?? '';

    if (
        $username === '' ||
        $email === '' ||
        $password === '' ||
        $passwordConfirm === ''
    ) {
        $message = 'Please fill in all fields.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = 'Please enter a valid email address.';
    } elseif ($password !== $passwordConfirm) {
        $message = 'Passwords do not match.';
    } else {

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO users (
                    role_id,
                    email,
                    username,
                    password_hash,
                    suspended
                ) VALUES (
                    :role_id,
                    :email,
                    :username,
                    :password_hash,
                    FALSE
                )'
            );

            $stmt->execute([
                'role_id' => 1,
                'email' => $email,
                'username' => $username,
                'password_hash' => $passwordHash
            ]);

            $message = 'Account created successfully.';

        } catch (PDOException $e) {

            if ($e->getCode() === '23000') {
                $message = 'This email or username is already in use.';
            } else {
                $message = 'Registration failed. Please try again.';
            }
        }
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Register | FantasyRealm</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="../css/register.css">
</head>

<body>

  <header class="register-navbar">
    <a class="brand" href="../index.php">
      <span class="brand-mark">✦</span>
      <span>FantasyRealm</span>
    </a>

    <nav class="nav-links">
      <a href="../index.php">Home</a>
      <a href="character-gallery.php">Characters</a>
      <a href="#">Login</a>
      <a class="nav-register active" href="register.php">Register</a>
    </nav>
  </header>

  <main class="register-page">

    <section class="register-panel">

      <p class="section-label">JOIN THE REALM</p>

      <h1>Create Your Account</h1>

      <p class="register-intro">
        Begin your journey and create your own FantasyRealm characters.
      </p>

      <?php if ($message !== ''): ?>
        <p class="form-message">
          <?= htmlspecialchars($message) ?>
        </p>
      <?php endif; ?>

      <form class="register-form" method="post">

        <label for="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          required
        >

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

        <label for="password-confirm">Confirm Password</label>
        <input
          type="password"
          id="password-confirm"
          name="password_confirm"
          required
        >

        <button type="submit">
          Create Account
        </button>

      </form>

      <p class="login-link">
        Already have an account?
        <a href="#">Login</a>
      </p>

    </section>

  </main>

</body>
</html>