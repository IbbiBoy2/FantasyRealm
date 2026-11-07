# ✦ FantasyRealm

Application web de création, de personnalisation et de partage de personnages fantastiques, développée pour l'univers fictif *FantasyRealm Online* de PixelVerse Studios.

> **État du projet :** application développée et testée localement avec Docker. Le déploiement public est à vérifier indépendamment. Ce README cible le dépôt de livraison et suppose que les fichiers Docker et la documentation de la branche `dev` du dépôt de travail y ont été intégrés.

## Fonctionnalités

**Visiteurs :** découverte du site, consultation de la galerie des personnages approuvés et partagés, consultation des fiches et envoi d'un message de contact.

**Joueurs inscrits :** inscription et connexion, création de personnages en couches graphiques, modification après approbation, équipements, duplication, partage, suppression/restauration et dépôt d'avis soumis à modération.

**Employés :** modération des noms et des avis, gestion des équipements et des comptes joueurs, consultation des messages de contact.

**Administrateurs :** fonctionnalités employé, gestion des comptes employés, consultation des événements d'activité et des historiques de personnalisation.

## Technologies

| Couche | Technologies |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript natif, Canvas API, Fetch API |
| Serveur / API | PHP 8.5 avec Apache, API JSON |
| Base relationnelle | MariaDB 11.4, PDO |
| Base documentaire | MongoDB 7.0, extension PHP MongoDB |
| Dépendances | Composer, `vlucas/phpdotenv`, `mongodb/mongodb`, `phpmailer/phpmailer` |
| Environnement | Docker Desktop / Docker Compose |
| Versionnement | Git et GitHub |

## Prérequis pour le lancement local

- Git, **Git Bash** et **OpenSSL** (souvent fourni avec Git Bash sous Windows).
- Docker Desktop démarré, avec moteur Linux et prise en charge de `docker compose`.
- Un navigateur récent et le port local `8080` disponible.

Aucune installation séparée de XAMPP, MariaDB, MongoDB ou Composer n'est nécessaire.

## Installation et démarrage local

### 1. Cloner le dépôt de livraison

```bash
git clone -b main https://github.com/IbbiBoy2/FantasyRealm.git
cd FantasyRealm
```

Pour examiner le travail en cours, utiliser la branche `dev` plutôt que `main`.

### 2. Créer la configuration privée

```bash
bash scripts/init-local.sh
```

Ce script génère les secrets aléatoires et les fichiers `.local/compose.env` et `.local/backend.env`. Le dossier `.local/` est ignoré par Git.

### 3. Construire et démarrer les services

```bash
bash scripts/start-local.sh
```

Cette commande combine `compose.yml` et `compose.local.yml`, construit l'image PHP/Apache et démarre les services `web`, `db` et `mongodb`.

### 4. Accéder à l'application

**Accueil :** http://localhost:8080/FantasyRealm/Frontend/Html/index.html

| Page | Chemin sous `http://localhost:8080` |
| --- | --- |
| Inscription | `/FantasyRealm/Frontend/Html/register.html` |
| Connexion | `/FantasyRealm/Frontend/Html/login.html` |
| Créateur | `/FantasyRealm/Frontend/Html/create-character.html` |
| Galerie | `/FantasyRealm/Frontend/Html/character-gallery.html` |
| Tableau de bord joueur | `/FantasyRealm/Frontend/Html/dashboard.html` |
| Tableau de bord employé | `/FantasyRealm/Frontend/Html/employee-dashboard.html` |
| Administration | `/FantasyRealm/Frontend/Html/admin-dashboard.html` |
| Contact | `/FantasyRealm/Frontend/Html/contact.html` |

Ouvrir les pages **dans le navigateur via Apache**, et non directement depuis l'explorateur de fichiers.

### 5. Vérifier les conteneurs

```bash
docker compose --env-file .local/compose.env -f compose.yml -f compose.local.yml ps
```

Les trois services doivent être démarrés ; MariaDB dispose d'un contrôle de santé.

## Bases de données

À la **première création d'un volume MariaDB vide**, les scripts suivants sont exécutés automatiquement et dans cet ordre :

1. `Backend/Database/shema.sql` — tables, index et contraintes.
2. `Backend/Database/seed.sql` — rôles `USER`, `EMPLOYEE`, `ADMIN`.

Les comptes de démonstration ne sont **pas** créés automatiquement. Créer d'abord un utilisateur via le formulaire d'inscription ; l'attribution d'un rôle privilégié doit être effectuée uniquement dans un environnement de test maîtrisé.

MongoDB stocke les événements du personnel dans `activity_logs` et les instantanés de personnalisation dans `character_history`.

Les volumes Docker conservent les données SQL, NoSQL et les images d'accessoires entre les démarrages.

### Initialisation du premier compte administrateur

Lors d'une installation neuve, le fichier `seed.sql` initialise les rôles `USER`, `EMPLOYEE` et `ADMIN`, mais ne crée aucun compte utilisateur.

Pour disposer d'un premier administrateur dans un environnement local de développement ou de démonstration :

1. Démarrer FantasyRealm avec Docker.
2. Créer un compte standard depuis le formulaire d'inscription.
3. Ouvrir un terminal à la racine du projet.
4. Accéder à MariaDB avec la commande suivante :

```bash
docker compose --env-file .local/compose.env -f compose.yml -f compose.local.yml exec db mariadb -u root -p fantasyrealm
```

Le mot de passe root se trouve dans le fichier privé `.local/compose.env`, sous la variable `MARIADB_ROOT_PASSWORD`.

5. Dans la console MariaDB, vérifier le compte à promouvoir :

```sql
SELECT id, username, email
FROM users
WHERE username = 'NOM_DU_COMPTE';
```

6. Attribuer le rôle administrateur à ce compte :

```sql
UPDATE users
SET role_id = (
    SELECT id
    FROM roles
    WHERE name = 'ADMIN'
)
WHERE username = 'NOM_DU_COMPTE';
```

7. Vérifier la modification :

```sql
SELECT users.username, roles.name AS role
FROM users
INNER JOIN roles ON users.role_id = roles.id
WHERE users.username = 'NOM_DU_COMPTE';
```

8. Quitter la console avec `exit;`, puis se déconnecter et se reconnecter à l'application.

Le compte doit désormais pouvoir accéder à l'espace administrateur.

**Sécurité :** cette procédure est réservée à l'initialisation contrôlée d'un environnement. La promotion d'un compte ne doit jamais être accessible depuis une fonctionnalité publique. En production, l'opération doit être réalisée directement par un administrateur système autorisé, depuis un accès privé et sécurisé à la base de données.

## Configuration SMTP

Le script d'initialisation **ne fournit pas** de configuration SMTP. Pour tester les notifications de contact, de modération et la récupération du mot de passe, compléter `.local/backend.env` avec les variables adaptées à son fournisseur :

```dotenv
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=adresse-de-test@example.com
MAIL_PASSWORD=MOT_DE_PASSE_APPLICATION
MAIL_FROM=adresse-de-test@example.com
MAIL_FROM_NAME=FantasyRealm
MAIL_CONTACT_TO=adresse-de-reception@example.com
APP_PUBLIC_URL=http://localhost:8080
```

Les valeurs ci-dessus sont fictives. Ne jamais publier de secrets ni de comptes réels dans le dépôt ou la documentation. Après modification des variables utilisées par le service web, recréer le conteneur si nécessaire.

Le formulaire de contact **enregistre d'abord le message dans MariaDB**, puis tente une notification SMTP. Un échec d'e-mail ne supprime pas le message stocké.

## Commandes courantes

```bash
# Arrêt sans suppression des données
bash scripts/stop-local.sh

# Démarrage et reconstruction de l'image si nécessaire
bash scripts/start-local.sh

# Journaux des services
docker compose --env-file .local/compose.env -f compose.yml -f compose.local.yml logs -f

# Console MariaDB
docker compose --env-file .local/compose.env -f compose.yml -f compose.local.yml exec db mariadb -u root -p
```

**Attention :** la commande `docker compose ... down -v` supprime les volumes et entraîne la perte des données locales correspondantes. Les scripts SQL ne sont pas rejoués automatiquement sur un volume MariaDB déjà initialisé.

## Sécurité

- Authentification par session PHP et vérification des rôles côté serveur.
- Mots de passe hachés avec Argon2id.
- Vérification CSRF sur les opérations protégées et requêtes SQL préparées avec PDO.
- Secrets stockés dans les fichiers d'environnement privés, hors Git.
- Aucune publication de port MariaDB ou MongoDB vers l'ordinateur hôte.
- Répertoires accessibles par HTTP limités par la configuration Apache.

Ces mesures ne dispensent pas d'une recette de sécurité avant publication.

## Déploiement

Le projet comprend `compose.prod.yml`, conçu pour rattacher le service web au réseau externe Docker `proxy` utilisé par Caddy. Les secrets du serveur, la configuration HTTPS, les sauvegardes et les tests publics doivent être préparés séparément.

**Adresse publique prévue :** https://fantasy-realm.mkcodecreations.dev/ — à confirmer lors de la recette de production.

La documentation du déploiement doit décrire les opérations réellement effectuées, et non seulement le plan prévu.

## Documentation

Les documents à inclure dans le dépôt de livraison se trouvent dans `docs/` :

- `docs/cahier_charges/cahier_des_charges.pdf`
- `docs/charte_graphique/FantasyRealm_Charte_Graphique.pdf` et les exports des maquettes/wireframes
- `docs/documentation_technique/documentation_technique.pdf`
- `docs/environnement_developpement/environnement_developpement.pdf`
- `docs/gestion_projet/gestion_projet.pdf`
- `docs/manuel_utilisation/manuel_utilisation.pdf`
- `docs/diagrammes/`

**Suivi de projet :** https://trello.com/b/OaO0sxyk

## Organisation Git

`main` correspond à la branche stable destinée à la livraison ; `dev` centralise les fonctionnalités en préparation. Les changements sont idéalement développés sur des branches dédiées, vérifiés, fusionnés dans `dev`, puis intégrés à `main` après validation.

## Préparation de la branche production

Le projet utilise une branche `production` distincte de `dev` et de `main`.

Cette branche contient uniquement les fichiers nécessaires au fonctionnement de l'application sur le serveur : code frontend, API PHP, configuration Apache, schéma MariaDB, dépendances Composer et fichiers Docker de production.

La préparation est automatisée par le script :

`scripts/build-production.sh`

### Vérifier les fichiers sélectionnés

Depuis la branche `dev`, exécuter :

```bash
bash scripts/build-production.sh --dry-run
```

Cette commande affiche la liste des fichiers destinés à la production, sans créer de commit ni effectuer de publication.

### Publier la version de production

Après validation du code et synchronisation de `dev` avec GitHub :

```bash
bash scripts/build-production.sh --publish
```

Le script crée ou actualise la branche `production` sur le dépôt distant configuré comme `origin`.

Il utilise un worktree Git temporaire et une liste blanche de fichiers afin de ne pas publier les documentations, les fichiers de configuration locale, les dépendances générées ou les secrets.

Il n'effectue aucun déploiement sur le serveur.

### Consulter la branche

Le dépôt de travail contient la branche :

`https://github.com/MyriamKuhn/FantasyRealm-ECF-Tests/tree/production`

**Important :** ce script est destiné aux personnes disposant du dépôt de développement et des droits de publication. Il n'est pas nécessaire pour installer l'application en local depuis la branche `main` du dépôt public.

Le déploiement du serveur s'effectue ensuite à partir de la branche `production`, selon la procédure décrite dans la documentation de déploiement.

## Crédits

Projet FantasyRealm — univers fictif PixelVerse Studios.
