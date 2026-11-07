<?php

declare(strict_types=1);

/*
 * FANTASYREALM - EQUIPMENT DATA FOR THE PUBLIC AND PRIVATE RENDERERS
 *
 * Batch-load equipment for a group of characters to avoid one SQL query
 * per card. The caller remains responsible for authenticating the user
 * and filtering approved/shared/private/deleted characters.
 */

/**
 * @param list<int> $characterIds
 * @return array<int, list<array<string, mixed>>>
 */
function loadCharacterEquipment(PDO $pdo, array $characterIds): array
{
	$ids = array_values(array_unique(array_filter(
		array_map('intval', $characterIds),
		static fn(int $id): bool => $id > 0
	)));

	if ($ids === []) {
		return [];
	}

	$placeholders = implode(', ', array_fill(0, count($ids), '?'));

	$sql = 'SELECT
                ca.character_id,
                a.id,
                a.name,
                a.type,
                a.gender,
                a.image_path,
                a.body_image_path
            FROM character_accessories ca
            INNER JOIN accessories a ON a.id = ca.accessory_id
            WHERE ca.character_id IN (' . $placeholders . ')
            ORDER BY a.id ASC';

	$statement = $pdo->prepare($sql);
	$statement->execute($ids);

	$result = [];
	while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
		$characterId = (int) $row['character_id'];
		unset($row['character_id']);
		$row['id'] = (int) $row['id'];
		$result[$characterId][] = $row;
	}

	return $result;
}

/**
 * Add a stable `equipment` array to every returned character.
 * This is safe for public results because callers have already
 * enforced their visibility restrictions in SQL.
 *
 * @param array<int, array<string, mixed>> $characters
 */
function attachCharacterEquipment(PDO $pdo, array &$characters): void
{
	$equipmentByCharacter = loadCharacterEquipment(
		$pdo,
		array_map(static fn(array $character): int => (int) $character['id'], $characters)
	);

	foreach ($characters as &$character) {
		$character['equipment'] = $equipmentByCharacter[(int) $character['id']] ?? [];
	}
	unset($character);
}
