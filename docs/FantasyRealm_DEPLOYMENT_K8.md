# FantasyRealm — Guide de déploiement en production (K8)

**Dernière mise à jour : 7 novembre 2026**  
**Statut : infrastructure en ligne ; recette métier complète restant à finaliser**  
**URL :** https://fantasy-realm.mkcodecreations.dev/

> Ce document décrit les opérations effectivement réalisées sur le serveur K8. Il ne contient aucun mot de passe, secret SMTP ou webhook Discord.

## 1. Infrastructure et architecture

| Élément | Configuration constatée |
| --- | --- |
| Serveur | K8 — Ubuntu Server 26.04.1 LTS |
| Réseau local | `192.168.1.51` (SSH) |
| Répertoire | `/srv/docker/fantasyrealm` |
| Dépôt de production | `https://github.com/IbbiBoy2/FantasyRealm`, branche `production` |
| Dépôt de travail | `MyriamKuhn/FantasyRealm-ECF-Tests`, branche `dev` |
| Web | PHP 8.5 / Apache, image construite par Docker |
| SQL | MariaDB 11.4 |
| NoSQL | MongoDB 7.0 |
| HTTPS | Caddy — `/srv/docker/caddy/Caddyfile` |
| Docker | Docker Engine 29.9.3, Compose 5.7.0 (après maintenance) |
| Noyau | Linux `7.0.0-43-generic` (après redémarrage) |

Le projet Compose est nommé `fantasyrealm-ecf`. Il démarre les services `web`, `db` et `mongodb`. Le réseau Docker interne `fantasyrealm-ecf_private` relie les services entre eux. Le service web est également relié au réseau externe `proxy`, utilisé par Caddy, avec l'alias `fantasyrealm-ecf-web`.

Les ports MariaDB et MongoDB ne sont pas publiés directement sur l'hôte. Le trafic public passe par Caddy puis Apache.

**Version initialement déployée :** commit `e126306` de la branche `production` (`chore(production): snapshot de dev aa2b0fbae084`). Cette référence décrit la mise en ligne initiale et doit être réévaluée après toute nouvelle publication.

## 2. Préparer la branche de production

Depuis le dépôt de développement, sur la branche `dev` :

```bash
bash scripts/build-production.sh --dry-run
bash scripts/build-production.sh --publish
```

Le script prépare une sélection des seuls fichiers nécessaires au fonctionnement de l'application et publie la branche `production`. Les documents de travail, secrets et dossiers locaux sont exclus. **Ce script ne met pas directement le serveur à jour.**

## 3. Installation initiale sur K8

Depuis Windows PowerShell :

```powershell
ssh myriam@192.168.1.51
```

Sur le serveur :

```bash
docker network inspect proxy --format '{{.Name}}'
cd /srv/docker
git clone --branch production --single-branch https://github.com/IbbiBoy2/FantasyRealm.git fantasyrealm
cd /srv/docker/fantasyrealm
git log -1 --oneline
```

### Configuration privée

Deux fichiers ont été créés **directement sur le serveur** dans `/srv/docker/fantasyrealm/.private/` :

- `compose.env` : mots de passe générés aléatoirement pour MariaDB et MongoDB, plus chemin de la configuration backend ;
- `backend.env` : paramètres de connexion SQL et MongoDB, URL du site et paramètres SMTP.

Le dossier `.private` est protégé et ses fichiers ne doivent jamais être versionnés ni partagés. Des secrets ont été générés avec `openssl rand -hex 24` lors de l'installation.

Variables attendues dans **`.private/compose.env`** (exemples sans secrets) :

```dotenv
MARIADB_ROOT_PASSWORD=<secret-prive>
MARIADB_PASSWORD=<secret-prive>
MONGODB_PASSWORD=<secret-prive>
BACKEND_ENV_FILE=/srv/docker/fantasyrealm/.private/backend.env
```

Variables attendues dans **`.private/backend.env`** :

```dotenv
DB_HOST=db
DB_PORT=3306
DB_NAME=fantasyrealm
DB_USER=fantasyrealm
DB_PASSWORD=<meme-secret-que-MARIADB_PASSWORD>

MONGODB_URI=mongodb://fantasyrealm:<meme-secret-MongoDB>@mongodb:27017/?authSource=admin
MONGODB_DATABASE=fantasyrealm
APP_PUBLIC_URL=https://fantasy-realm.mkcodecreations.dev

MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=<adresse-expediteur>
MAIL_PASSWORD=<mot-de-passe-application>
MAIL_FROM=<adresse-expediteur>
MAIL_FROM_NAME=FantasyRealm
MAIL_CONTACT_TO=<adresse-destinataire>
```

Pour Gmail, `MAIL_PASSWORD` est un **mot de passe d'application**, pas le mot de passe principal du compte. Ne pas envoyer les fichiers `.env` dans des journaux, captures ou demandes de support.

### Démarrage

```bash
cd /srv/docker/fantasyrealm

docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml config -q

docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml up -d --build --wait

docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml ps
```

Les volumes persistants créés sont :

- `fantasyrealm-ecf_mariadb_data`
- `fantasyrealm-ecf_mongodb_data`
- `fantasyrealm-ecf_accessory_images`

MariaDB initialise `Backend/Database/shema.sql` puis `Backend/Database/seed.sql` **seulement au premier démarrage avec un volume SQL vide**. Le fichier `seed.sql` crée les rôles `USER`, `EMPLOYEE`, `ADMIN`, mais pas d'utilisateur initial.

**Attention :** ne jamais exécuter `docker compose down -v` sur cette installation, car l'option `-v` supprimerait des volumes persistants.

## 4. Reverse proxy Caddy et HTTPS

Le bloc suivant a été ajouté dans `/srv/docker/caddy/Caddyfile` :

```caddy
fantasy-realm.mkcodecreations.dev {
    redir / /FantasyRealm/Frontend/Html/index.html 302
    reverse_proxy fantasyrealm-ecf-web:80
}
```

L'ajout de `redir /` corrige un problème constaté au départ : le renvoi depuis `/` était produit par Apache en `http://`, malgré l'accès initial en HTTPS. Une redirection relative au niveau de Caddy conserve HTTPS.

Pour vérifier puis recharger Caddy sans arrêter les autres sites :

```bash
cd /srv/docker/caddy
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Contrôle du domaine :

```bash
curl -IL https://fantasy-realm.mkcodecreations.dev/
```

**Résultat constaté après maintenance le 7 novembre :** `HTTP/2 302` avec `location: /FantasyRealm/Frontend/Html/index.html`, suivi de `HTTP/2 200`, servi par Apache via Caddy.

## 5. SMTP et récupération des mots de passe

Au premier essai, l'API affichait `Password recovery is temporarily unavailable.`. La cause constatée était l'absence des variables `MAIL_*` dans `.private/backend.env`.

Après ajout de la configuration SMTP, le conteneur web a été recréé **sans redémarrer les bases** :

```bash
cd /srv/docker/fantasyrealm
docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml up -d --no-deps --force-recreate web
```

**Résultat rapporté :** les e-mails fonctionnent. Les liens de réinitialisation utilisent `APP_PUBLIC_URL` et doivent conserver le domaine HTTPS public. Ne jamais journaliser de jetons de réinitialisation ou publier les identifiants SMTP.

## 6. Compte administrateur initial

Un compte `MegaAdmin` a été créé par inscription sur le site. **L'attribution effective du rôle `ADMIN` n'est pas établie par les résultats conservés** : la vérifier dans MariaDB avant de la déclarer validée.

Pour ouvrir une console MariaDB sans communiquer le mot de passe dans la conversation :

```bash
cd /srv/docker/fantasyrealm
docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml exec db sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -u root fantasyrealm'
```

Ensuite, vérifier l'utilisateur et son rôle :

```sql
SELECT u.id, u.username, u.email, r.name AS role
FROM users AS u
JOIN roles AS r ON r.id = u.role_id
WHERE u.username = 'MegaAdmin';
```

Uniquement si la promotion est encore nécessaire, après avoir vérifié le compte :

```sql
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'ADMIN')
WHERE username = 'MegaAdmin';
```

Se déconnecter puis se reconnecter au site pour actualiser la session. Cette opération doit rester réservée à un administrateur système autorisé.

## 7. Sauvegardes K8 et FantasyRealm

Le serveur utilise `/usr/local/lib/k8-backup/backup.sh`, déclenché chaque jour par `k8-backup.timer` à **03:00 UTC**.

Deux modes de lancement possibles :

```bash
# Via systemd (journal consultable séparément)
sudo systemctl start k8-backup.service

# Exécution directe dans le terminal
sudo /usr/local/lib/k8-backup/backup.sh
```

Il s'agit du **même script**, appelé soit par systemd soit directement. Éviter deux exécutions simultanées. Pour suivre un lancement systemd :

```bash
sudo journalctl -u k8-backup.service -f
systemctl status k8-backup.service --no-pager
systemctl show k8-backup.service -p Result -p ExecMainStatus
```

**Sauvegarde manuelle confirmée le 7 novembre 2026 :** de `00:48:36` à `00:55:07` UTC, environ **6 min 31 s**, statut `SUCCESS`, code de sortie `0`.

Les journaux ont confirmé explicitement :

| Élément FantasyRealm | État |
| --- | --- |
| Dump SQL `fantasyrealm-ecf-db-1` | OK |
| Volume `fantasyrealm-ecf_accessory_images` | OK |
| Volume `fantasyrealm-ecf_mariadb_data` | OK |
| Volume `fantasyrealm-ecf_mongodb_data` | OK |

**Limite importante :** une copie du volume MongoDB alors que le serveur fonctionne n'est pas une preuve de restauration cohérente. Un `mongodump` et un test de restauration restent recommandés.

Une notification Discord « Sauvegarde K8 réussie » a bien été reçue. Le webhook est stocké dans un fichier privé sur le serveur, jamais dans le dépôt : `/usr/local/lib/k8-backup/discord-webhook`.

### Rapport de santé complet

Le contrôle complet s'exécute manuellement avec :

```bash
sudo /usr/local/lib/k8-backup/health-report.sh
```

Rapport reçu après maintenance : sauvegarde du jour **22 Go**, variation **2 %**, **6/6 bases SQL** contrôlées, dump ZIP Forgejo valide, **23/25 conteneurs Docker actifs**, SSD système **8 % utilisé**, disque WD **6 % utilisé**. Les conteneurs `ollama` et `adigon-ws` étaient arrêtés. La vérification des sauvegardes Crafty indiquait **0/3 récentes** ; il reste à contrôler la situation après la prochaine exécution planifiée de Crafty.

## 8. Maintenance Ubuntu du 7 novembre 2026

Opérations réalisées :

1. Mise à jour de l'index APT : `sudo apt update`.
2. Simulation `sudo apt-get -s upgrade` : 26 paquets actualisés, 0 suppression.
3. Simulation `sudo apt-get -s full-upgrade` : 29 paquets actualisés, 8 installés, **0 suppression**.
4. Sauvegarde manuelle complète et contrôle des volumes FantasyRealm.
5. Installation des mises à jour avec `sudo apt-get full-upgrade`.
6. Contrôle : `sudo apt-get check` sans erreur, Docker Engine **29.9.3**, Compose **5.7.0**, service Docker `active`.
7. Redémarrage : `sudo reboot`.
8. Vérification post-redémarrage : noyau actif **`7.0.0-43-generic`**, 23 conteneurs attendus en fonctionnement, accès HTTPS de FantasyRealm confirmé (302 puis 200).

Le contrôle `fwupdmgr get-upgrades` a également signalé une mise à jour de la base de révocation **Secure Boot UEFI dbx**, version proposée `20260707`, urgence élevée. **Cette mise à jour firmware n'a pas été appliquée** dans le cadre de la maintenance documentée : à évaluer séparément.

## 9. Mise à jour de FantasyRealm après publication

Publier et vérifier d'abord les modifications sur la branche `production` depuis le dépôt de travail.

Puis, sur le serveur :

```bash
cd /srv/docker/fantasyrealm
git status --short
git pull --ff-only origin production

docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml config -q

docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml up -d --build --wait

docker compose --env-file .private/compose.env -f compose.yml -f compose.prod.yml ps
curl -IL https://fantasy-realm.mkcodecreations.dev/
```

Avant toute migration de schéma, manipulation des données ou mise à jour majeure des services, effectuer une sauvegarde et préparer un plan de retour arrière. Ne pas supprimer les volumes, écraser les secrets du serveur ni intervenir sur d'autres applications du K8.

## 10. Recette restant à documenter

Les points suivants ne sont **pas tous confirmés** par les vérifications déjà effectuées :

- rôle `ADMIN` réellement attribué à `MegaAdmin` et autorisations testées ;
- création, édition, approbation, équipement et partage de personnages ;
- modération des avis et des comptes ;
- présence et exploitation des collections MongoDB `activity_logs` et `character_history` ;
- tests de restauration réelle des données SQL, MongoDB et accessoires ;
- résultat des sauvegardes Crafty après la prochaine exécution prévue ;
- éventuels liens autres que la page racine qui pourraient encore rediriger vers HTTP.

**Conclusion :** le déploiement de l'infrastructure, le HTTPS, l'inscription rapportée, le SMTP, la sauvegarde et la reprise après maintenance sont attestés. La validation métier et les exercices de restauration restent à compléter.
