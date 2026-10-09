<?php

session_start();

require_once __DIR__ . '/../config/database.php';

$email = $_SESSION['email'] ?? '';
$username = $_SESSION['username'] ?? '';
$messageText = '';
$formMessage = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $messageText = trim($_POST['message'] ?? '');

    if (
        $username === '' ||
        $email === '' ||
        $messageText === ''
    ) {
        $formMessage = 'Please fill in all fields.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $formMessage = 'Please enter a valid email address.';
    } else {

        $stmt = $pdo->prepare(
            'INSERT INTO contact_messages (
                user_id,
                username,
                email,
                message
            ) VALUES (
                :user_id,
                :username,
                :email,
                :message
            )'
        );

        $stmt->execute([
            'user_id' => $_SESSION['user_id'] ?? null,
            'username' => $username,
            'email' => $email,
            'message' => $messageText
        ]);

        $formMessage = 'Your message has been sent successfully.';
        $messageText = '';
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Contact | FantasyRealm</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="../css/contact.css">
</head>

<body>

  <header class="contact-navbar">
    <a class="brand" href="../index.php">
      <span class="brand-mark">✦</span>
      <span>FantasyRealm</span>
    </a>

    <nav class="nav-links">
      <a href="../index.php">Home</a>
      <a href="character-gallery.php">Characters</a>

      <?php if (isset($_SESSION['user_id'])): ?>
        <span class="nav-username">
          <?= htmlspecialchars($_SESSION['username']) ?>
        </span>

        <a href="logout.php">Logout</a>
      <?php else: ?>
        <a href="login.php">Login</a>
        <a class="nav-register" href="register.php">Register</a>
      <?php endif; ?>
    </nav>
  </header>

  <main class="contact-page">

  <section class="contact-panel">

    <p class="section-label">CONTACT</p>

    <h1>Contact FantasyRealm</h1>

    <p class="contact-intro">
      Have a question or need help? Send us a message.
    </p>

    <?php if ($formMessage !== ''): ?>
      <p class="form-message">
        <?= htmlspecialchars($formMessage) ?>
      </p>
    <?php endif; ?>

    <form class="contact-form" method="post">

      <label for="username">Username</label>
      <input
        type="text"
        id="username"
        name="username"
        value="<?= htmlspecialchars($username) ?>"
        required
      >

      <label for="email">Email</label>
      <input
        type="email"
        id="email"
        name="email"
        value="<?= htmlspecialchars($email) ?>"
        required
      >

      <label for="message">Message</label>
      <textarea
        id="message"
        name="message"
        rows="6"
        required
      ><?= htmlspecialchars($messageText) ?></textarea>

      <button type="submit">
        Send Message
      </button>

    </form>

    <div class="contact-actions">
      <a href="../index.php" class="back-link">Back to Home</a>
      <a href="character-gallery.php" class="back-link">View Characters</a>
    </div>

  </section>

</main>

</body>
</html>