CREATE DATABASE fantasyrealm;

USE fantasyrealm;

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    suspended BOOLEAN NOT NULL DEFAULT FALSE,
    reset_token_hash VARCHAR(255) NULL,
    reset_token_expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
    
);

CREATE TABLE characters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL UNIQUE,
    gender VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE appearances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    character_id INT NOT NULL UNIQUE,
    eye_shape VARCHAR(50) NOT NULL,
    nose_shape VARCHAR(50) NOT NULL,
    mouth_shape VARCHAR(50) NOT NULL,
    skin_color VARCHAR(50) NOT NULL,
    hair_color VARCHAR(50) NOT NULL,
    eye_color VARCHAR(50) NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE accessories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    character_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE character_accessories (
    character_id INT NOT NULL,
    accessory_id INT NOT NULL,
    PRIMARY KEY (character_id, accessory_id),
    FOREIGN KEY (character_id) REFERENCES characters(id),
    FOREIGN KEY (accessory_id) REFERENCES accessories(id)
);