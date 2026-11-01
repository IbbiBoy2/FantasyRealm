<?php

require_once __DIR__ . '/../vendor/autoload.php';

// Loads database credentials from the environment file instead of hard-coding them.

$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
$dotenv->load();

$host = $_ENV['DB_HOST'];
$port = $_ENV['DB_PORT'];
$dbname = $_ENV['DB_NAME'];
$username = $_ENV['DB_USER'];
$password = $_ENV['DB_PASSWORD'];

// Creates the PDO connection to MariaDB using UTF-8.

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4",
        $username,
        $password
    );

    // PDO throws exceptions on errors and returns query results as associative arrays.

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

// Do not expose database credentials or connection details to the user.

} catch (PDOException $e) {
    die('Database connection failed.');
}