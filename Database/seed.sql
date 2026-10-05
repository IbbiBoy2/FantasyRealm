USE fantasyrealm;

INSERT INTO roles (name) VALUES
('USER'),
('EMPLOYEE'),
('ADMIN');

INSERT INTO users (
    role_id,
    email,
    username,
    password_hash,
    suspended
) VALUES
(1, 'player1@example.com', 'PlayerOne', 'TEST_HASH', FALSE),
(2, 'employee@example.com', 'EmployeeOne', 'TEST_HASH', FALSE),
(3, 'admin@example.com', 'AdminOne', 'TEST_HASH', FALSE);

INSERT INTO accessories (
    name,
    type,
    active
) VALUES
('Iron Sword', 'weapon', TRUE),
('Leather Armor', 'armor', TRUE),
('Black Cloak', 'clothing', TRUE),
('Silver Ring', 'accessory', TRUE);

INSERT INTO characters (
    user_id,
    name,
    gender,
    status,
    shared
) VALUES
(1, 'Arkon', 'Male', 'APPROVED', TRUE);

INSERT INTO appearances (
    character_id,
    eye_shape,
    nose_shape,
    mouth_shape,
    skin_color,
    hair_color,
    eye_color
) VALUES
(1, 'Round', 'Straight', 'Neutral', 'Light', 'Black', 'Green');

INSERT INTO character_accessories (
    character_id,
    accessory_id
) VALUES
(1, 1),
(1, 3);

INSERT INTO reviews (
    user_id,
    character_id,
    rating,
    comment,
    status
) VALUES
(1, 1, 5, 'Great character design!', 'APPROVED');