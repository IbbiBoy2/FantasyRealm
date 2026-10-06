<?php

session_start();

require_once __DIR__ . '/../config/database.php';

$formMessage = '';

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $characterName = trim($_POST['character-name'] ?? '');
    $gender = $_POST['gender'] ?? '';

    $hairStyle = $_POST['hair-style'] ?? '';
    $hairColor = $_POST['hair-color'] ?? '';

    $skinTone = $_POST['skin-tone'] ?? '';

    $eyeStyle = $_POST['eye-style'] ?? '';
    $eyeColor = $_POST['eye-color'] ?? '';

    $weapon = $_POST['weapon'] ?? '';

    if (
        $characterName === '' ||
        $gender === '' ||
        $hairStyle === '' ||
        $hairColor === '' ||
        $skinTone === '' ||
        $eyeStyle === '' ||
        $eyeColor === ''
    ) {
        $formMessage = 'Please complete all required character fields.';
    } else {

        try {

            $pdo->beginTransaction();

            $stmt = $pdo->prepare(
                'INSERT INTO characters (
                    user_id,
                    name,
                    gender,
                    status,
                    shared
                ) VALUES (
                    :user_id,
                    :name,
                    :gender,
                    :status,
                    :shared
                )'
            );

            $stmt->execute([
                'user_id' => $_SESSION['user_id'],
                'name' => $characterName,
                'gender' => $gender,
                'status' => 'PENDING',
                'shared' => false
            ]);

            $characterId = $pdo->lastInsertId();

            $stmt = $pdo->prepare(
                'INSERT INTO appearances (
                    character_id,
                    hair_style,
                    eye_shape,
                    nose_shape,
                    mouth_shape,
                    skin_color,
                    hair_color,
                    eye_color
                ) VALUES (
                    :character_id,
                    :hair_style,
                    :eye_shape,
                    :nose_shape,
                    :mouth_shape,
                    :skin_color,
                    :hair_color,
                    :eye_color
                )'
            );

            $stmt->execute([
                'character_id' => $characterId,
                'hair_style' => $hairStyle,
                'eye_shape' => $eyeStyle,
                'nose_shape' => 'default',
                'mouth_shape' => 'default',
                'skin_color' => $skinTone,
                'hair_color' => $hairColor,
                'eye_color' => $eyeColor
            ]);

            $pdo->commit();

            $formMessage = 'Character created successfully and is waiting for approval.';

        } catch (PDOException $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($e->getCode() === '23000') {
                $formMessage = 'That character name is already taken.';
            } else {
                $formMessage = 'Something went wrong while creating the character.';
            }
        }
    }
}

?>


<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Create Character | FantasyRealm</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="../css/create-character.css" />
</head>

<body>

<header class="creator-navbar">

  <a class="brand" href="../index.php">
    <span class="brand-mark">✦</span>
    <span>FantasyRealm</span>
  </a>

  <nav class="nav-links">
    <a href="../index.php">Home</a>
    <a href="character-gallery.php">Characters</a>
    <a class="active" href="create-character.php">Create</a>
    <a href="login.php">Login</a>
    <a class="nav-register" href="register.php">Register</a>
  </nav>

</header>


<main class="creator-page">

  <section class="creator-heading">

    <p class="eyebrow">
      FORGE YOUR LEGEND
    </p>

    <h1>
      Create Your Character
    </h1>

    <p>
      Build the look, identity and equipment of your next FantasyRealm character.
    </p>

  </section>


  <section class="creator-shell">


    <!-- CHARACTER PREVIEW -->

    <aside class="preview-panel">

      <div class="preview-copy">

        <p class="eyebrow">
          CHARACTER PREVIEW
        </p>

        <h2>
          Your Legend
        </h2>

      </div>


      <div class="preview-stage">

        <span class="preview-glow"></span>

        <div class="character-layer-stack">

          <img
            id="base-layer"
            class="character-layer"
            src="../assets/character-parts/base/male-light.png"
            alt="Character base"
          >

          <img
            id="hair-layer"
            class="character-layer"
            src="../assets/character-parts/hair/short-black.png"
            alt=""
          >

          <img
            id="eyes-layer"
            class="character-layer"
            src="../assets/character-parts/eyes/green.png"
            alt=""
          >

          <img
            id="weapon-layer"
            class="character-layer"
            src="../assets/character-parts/weapons/iron-sword.png"
            alt=""
          >

        </div>

      </div>


      <div
        class="preview-thumbnails"
        aria-label="Character preview examples"
      >

        <button
          class="preview-thumb selected"
          type="button"
        >
          <img
            src="../assets/gallery-characters/seraphina.png"
            alt="Preview one"
          >
        </button>

        <button
          class="preview-thumb"
          type="button"
        >
          <img
            src="../assets/gallery-characters/lunaria.png"
            alt="Preview two"
          >
        </button>

        <button
          class="preview-thumb"
          type="button"
        >
          <img
            src="../assets/gallery-characters/nyxelle.png"
            alt="Preview three"
          >
        </button>

        <button
          class="preview-thumb"
          type="button"
        >
          <img
            src="../assets/gallery-characters/kaelthar.png"
            alt="Preview four"
          >
        </button>

      </div>


      <p class="preview-note">
        Character preview updates while you customize your character.
      </p>

    </aside>


    <!-- CHARACTER EDITOR -->

    <section class="editor-panel">

      <form
        method="post"
        class="creator-form"
      >


        <input
          type="hidden"
          id="selected-weapon"
          name="weapon"
          value=""
        >


        <!-- CHARACTER NAME -->

        <?php if ($formMessage !== ''): ?>
  <p class="form-message">
    <?= htmlspecialchars($formMessage) ?>
  </p>
<?php endif; ?>

        <div class="form-section">

          <label
            class="field-label"
            for="character-name"
          >
            Character name
          </label>

          <input
            id="character-name"
            name="character-name"
            type="text"
            placeholder="Enter a character name..."
            required
          >

        </div>


        <!-- GENDER -->

        <fieldset class="form-section">

          <legend>
            Gender
          </legend>

          <div class="gender-grid">


            <label class="gender-card">

              <input
                type="radio"
                name="gender"
                value="male"
              >

              <span class="gender-symbol">
                ♂
              </span>

              <span>

                <strong>
                  Male
                </strong>

                <small>
                  Masculine character base
                </small>

              </span>

            </label>


            <label class="gender-card selected-card">

              <input
                type="radio"
                name="gender"
                value="female"
                checked
              >

              <span class="gender-symbol">
                ♀
              </span>

              <span>

                <strong>
                  Female
                </strong>

                <small>
                  Feminine character base
                </small>

              </span>

            </label>


          </div>

        </fieldset>


        <!-- APPEARANCE -->

        <fieldset class="form-section">

          <legend>
            Appearance
          </legend>


          <!-- HAIR STYLE -->

          <div class="option-row">

            <span class="option-title">
              Hair style
            </span>

            <div class="image-options">


              <label class="image-choice selected-choice">

                <input
                  type="radio"
                  name="hair-style"
                  value="short"
                  checked
                >

                <img
                  src="../assets/gallery-characters/seraphina.png"
                  alt="Short hair"
                >

              </label>


              <label class="image-choice">

                <input
                  type="radio"
                  name="hair-style"
                  value="long"
                >

                <img
                  src="../assets/gallery-characters/lunaria.png"
                  alt="Long hair"
                >

              </label>


              <label class="image-choice">

                <input
                  type="radio"
                  name="hair-style"
                  value="braided"
                >

                <img
                  src="../assets/gallery-characters/nyxelle.png"
                  alt="Braided hair"
                >

              </label>


              <label class="image-choice">

                <input
                  type="radio"
                  name="hair-style"
                  value="ponytail"
                >

                <img
                  src="../assets/gallery-characters/aurelian.png"
                  alt="Ponytail hair"
                >

              </label>


            </div>

          </div>


          <!-- HAIR COLOR -->

          <div class="option-row">

            <span class="option-title">
              Hair color
            </span>

            <div
              class="color-options"
              aria-label="Hair color preview options"
            >


              <label
                class="color-choice silver selected-color"
                style="--swatch:#e9e2ff;"
              >

                <input
                  type="radio"
                  name="hair-color"
                  value="silver"
                  checked
                >

                <span></span>

              </label>


              <label
                class="color-choice black"
                style="--swatch:#17131d;"
              >

                <input
                  type="radio"
                  name="hair-color"
                  value="black"
                >

                <span></span>

              </label>


              <label
                class="color-choice brown"
                style="--swatch:#6c4430;"
              >

                <input
                  type="radio"
                  name="hair-color"
                  value="brown"
                >

                <span></span>

              </label>


              <label
                class="color-choice red"
                style="--swatch:#a9463f;"
              >

                <input
                  type="radio"
                  name="hair-color"
                  value="red"
                >

                <span></span>

              </label>


              <label
                class="color-choice purple"
                style="--swatch:#9c4cff;"
              >

                <input
                  type="radio"
                  name="hair-color"
                  value="purple"
                >

                <span></span>

              </label>


            </div>

          </div>


          <!-- SKIN TONE -->

          <div class="option-row">

            <span class="option-title">
              Skin tone
            </span>

            <div
              class="color-options"
              aria-label="Skin tone preview options"
            >


              <label
                class="color-choice selected-color"
                style="--swatch:#f6d2bd;"
              >

                <input
                  type="radio"
                  name="skin-tone"
                  value="light"
                  checked
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#dfb095;"
              >

                <input
                  type="radio"
                  name="skin-tone"
                  value="fair"
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#bc8568;"
              >

                <input
                  type="radio"
                  name="skin-tone"
                  value="medium"
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#8d5d48;"
              >

                <input
                  type="radio"
                  name="skin-tone"
                  value="tan"
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#5c382f;"
              >

                <input
                  type="radio"
                  name="skin-tone"
                  value="dark"
                >

                <span></span>

              </label>


            </div>

          </div>


          <!-- EYE STYLE -->

          <div class="option-row">

            <span class="option-title">
              Eye style
            </span>

            <div class="eye-options">


              <label class="eye-choice selected-choice">

                <input
                  type="radio"
                  name="eye-style"
                  value="round"
                  checked
                >

                <span>
                  ◉
                </span>

              </label>


              <label class="eye-choice">

                <input
                  type="radio"
                  name="eye-style"
                  value="soft"
                >

                <span>
                  ◍
                </span>

              </label>


              <label class="eye-choice">

                <input
                  type="radio"
                  name="eye-style"
                  value="sharp"
                >

                <span>
                  ◉
                </span>

              </label>


              <label class="eye-choice">

                <input
                  type="radio"
                  name="eye-style"
                  value="narrow"
                >

                <span>
                  ◌
                </span>

              </label>


            </div>

          </div>


          <!-- EYE COLOR -->

          <div class="option-row">

            <span class="option-title">
              Eye color
            </span>

            <div
              class="color-options"
              aria-label="Eye color preview options"
            >


              <label
                class="color-choice selected-color"
                style="--swatch:#48cfff;"
              >

                <input
                  type="radio"
                  name="eye-color"
                  value="blue"
                  checked
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#9e4cff;"
              >

                <input
                  type="radio"
                  name="eye-color"
                  value="purple"
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#c84052;"
              >

                <input
                  type="radio"
                  name="eye-color"
                  value="red"
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#5f9e63;"
              >

                <input
                  type="radio"
                  name="eye-color"
                  value="green"
                >

                <span></span>

              </label>


              <label
                class="color-choice"
                style="--swatch:#c98946;"
              >

                <input
                  type="radio"
                  name="eye-color"
                  value="amber"
                >

                <span></span>

              </label>


            </div>

          </div>


        </fieldset>


        <!-- EQUIPMENT -->

        <fieldset class="form-section">

          <legend>
            Equipment
          </legend>

          <div class="equipment-grid">


            <div class="weapon-options">


              <button
                type="button"
                class="weapon-choice"
                data-weapon="iron-sword"
              >
                Iron Sword
              </button>


              <button
                type="button"
                class="weapon-choice"
                data-weapon="steel-sword"
              >
                Steel Sword
              </button>


              <button
                type="button"
                class="weapon-choice"
                data-weapon="magic-staff"
              >
                Magic Staff
              </button>


              <button
                type="button"
                class="weapon-choice"
                data-weapon=""
              >
                None
              </button>


            </div>


            <button
              type="button"
              class="equipment-slot"
            >

              <span class="equipment-icon">
                ◈
              </span>

              <span>
                Armor
              </span>

            </button>


            <button
              type="button"
              class="equipment-slot"
            >

              <span class="equipment-icon">
                ♜
              </span>

              <span>
                Boots
              </span>

            </button>


            <button
              type="button"
              class="equipment-slot"
            >

              <span class="equipment-icon">
                ✧
              </span>

              <span>
                Gloves
              </span>

            </button>


            <button
              type="button"
              class="equipment-slot"
            >

              <span class="equipment-icon">
                ◇
              </span>

              <span>
                Accessory
              </span>

            </button>


          </div>

        </fieldset>


        <!-- FORM BUTTONS -->

        <div class="form-actions">

          <a
            href="../index.php"
            class="cancel-button"
          >
            Cancel
          </a>

          <button
            type="submit"
            class="create-button"
          >
            ✦ Create Character
          </button>

        </div>


        <p class="frontend-note">
          Character data will be saved to your FantasyRealm account.
        </p>


      </form>

    </section>

  </section>

</main>


<footer class="footer">

  <div class="footer-brand">
    ✦ FantasyRealm
  </div>

  <p>
    © 2026 FantasyRealm. All rights reserved.
  </p>

  <div class="footer-links">

    <a href="#">
      Legal Notice
    </a>

    <a href="#">
      Terms
    </a>

    <a href="contact.php">
      Contact
    </a>

  </div>

</footer>


<script src="../js/create-character.js"></script>

</body>

</html>