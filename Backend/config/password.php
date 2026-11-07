<?php

declare(strict_types=1);

/*
 * FANTASYREALM - SHARED PASSWORD SECURITY
 *
 * Defines one password policy and one hashing
 * configuration for all account operations.
 */

/*
 * Return a validation error, or null when
 * the password satisfies the application policy.
 */
function validateAccountPassword(string $password): ?string
{
  if (
    !mb_check_encoding($password, 'UTF-8') ||
    mb_strlen($password, 'UTF-8') < 12 ||
    strlen($password) > 72
  ) {
    return 'Password must contain at least 12 characters and no more than 72 bytes.';
  }

  if (
    !preg_match('/[A-Z]/', $password) ||
    !preg_match('/[a-z]/', $password) ||
    !preg_match('/[0-9]/', $password) ||
    !preg_match('/[^\p{L}\p{N}\s]/u', $password)
  ) {
    return 'Password must include an uppercase letter, a lowercase letter, a number and a special character.';
  }

  return null;
}

/*
 * Keep the Argon2id parameters consistent
 * across registration, login and password reset.
 */
function accountPasswordHashOptions(): array
{
  return [
    'memory_cost' => 19456,
    'time_cost' => 2,
    'threads' => 1
  ];
}

/*
 * Hash a valid password using Argon2id.
 *
 * Password validation is performed separately
 * so API endpoints can return useful messages.
 */
function hashAccountPassword(string $password): string
{
  return password_hash(
    $password,
    PASSWORD_ARGON2ID,
    accountPasswordHashOptions()
  );
}
