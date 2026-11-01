# FantasyRealm — Recherche technique en anglais

**Projet :** FantasyRealm  
**Formation :** Studi — Développeur Web et Web Mobile (DWWM)  
**Sujet :** Résolution d'un problème de jeton de sécurité CSRF  
**Langue des sources :** Anglais  
**Date de documentation :** 01/11/2026

---

## 1. Présentation du problème

Lors du développement de FantasyRealm, j'ai rencontré un problème concernant la sécurité des requêtes envoyées entre le frontend JavaScript et le backend PHP.

Certaines fonctionnalités, notamment la gestion des personnages, ne fonctionnaient pas correctement.

L'API PHP renvoyait le message suivant :

```text
Invalid or missing security token.
```

Ce message indiquait que la requête ne contenait pas le jeton CSRF attendu par le serveur.

Le problème empêchait certaines opérations de modification des données.

## 2. Recherche d'une solution

Pour comprendre le problème, je me suis appuyé sur la documentation technique anglophone relative à la protection CSRF et aux requêtes HTTP JavaScript.

### Source principale — OWASP

**Titre :** Cross-Site Request Forgery Prevention Cheat Sheet  
**Organisme :** OWASP  
**Langue :** Anglais

**Lien :** https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

### Extrait original en anglais

> The request should be rejected if that token was not found within the request

### Traduction française

> La requête doit être rejetée si le jeton n'a pas été trouvé dans celle-ci.

### Explication

La documentation OWASP explique qu'un jeton CSRF permet de vérifier qu'une requête provient d'une session autorisée.

Le serveur génère un jeton aléatoire et l'associe à la session de l'utilisateur.

Lorsqu'une opération protégée est envoyée, le navigateur doit transmettre ce jeton au serveur.

Le backend compare ensuite le jeton reçu avec celui enregistré dans la session.

Si le jeton est absent ou incorrect, la requête est refusée.

Cette vérification permet de réduire le risque d'attaques Cross-Site Request Forgery.

## 3. Source complémentaire — MDN Web Docs

**Titre :** Using the Fetch API  
**Organisme :** Mozilla Developer Network  
**Langue :** Anglais

**Lien :** https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

### Extrait original en anglais

> To set request headers, assign them to the `headers` option.

### Traduction française

> Pour définir les en-têtes d'une requête, il faut les renseigner dans l'option `headers`.

### Explication

Cette documentation explique comment ajouter des en-têtes HTTP personnalisés à une requête JavaScript utilisant `fetch()`.

J'ai ainsi pu comprendre comment transmettre le jeton CSRF au backend PHP avec l'en-tête :

```http
X-CSRF-Token: <jeton-de-session>
```

Cette méthode permet de conserver la protection CSRF tout en utilisant les requêtes asynchrones de JavaScript.

## 4. Solution appliquée à FantasyRealm

La solution repose sur trois étapes.

### Étape 1 — Génération du jeton

Dans le fichier :

`Backend/config/security.php`

La fonction `getCsrfToken()` génère un jeton avec `random_bytes(32)` et le conserve dans la session PHP.

### Étape 2 — Récupération et transmission

Dans le frontend JavaScript, une requête est envoyée vers :

`Backend/api/session.php`

L'API renvoie les informations de session, dont le jeton CSRF.

Le frontend transmet ensuite ce jeton dans les en-têtes des requêtes protégées.

Extrait simplifié de l'implémentation :

```javascript
headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-Token': sessionData.csrf_token
}
```

Cette solution est notamment utilisée dans :

- `Frontend/js/create-character.js`
- `Frontend/js/dashboard.js`
- `Frontend/js/character.js`

### Étape 3 — Vérification côté PHP

Dans `Backend/config/security.php`, la fonction `requireCsrfToken()` récupère le jeton envoyé et le compare avec celui de la session.

La comparaison utilise la fonction PHP `hash_equals()`.

Si le jeton est absent ou incorrect, le serveur renvoie le code HTTP `403 Forbidden`.

La création des personnages utilise notamment cette vérification dans :

`Backend/api/characters.php`

## 5. Résultat obtenu

Après correction de la transmission du jeton CSRF, les fonctionnalités concernées ont de nouveau fonctionné lors des tests locaux.

La correction a permis de conserver les vérifications de sécurité sans désactiver la protection.

Le code actuel montre que le frontend récupère le jeton depuis la session et le transmet au backend.

Cette résolution a été confirmée au cours du développement. Le présent document ne constitue toutefois pas un audit complet de tous les endpoints.

## 6. Compétences acquises

Cette recherche m'a permis de mieux comprendre :

- Le fonctionnement des sessions PHP.
- Le rôle des jetons CSRF.
- L'utilisation des en-têtes HTTP personnalisés.
- La communication entre JavaScript et une API PHP.
- L'importance de la vérification côté serveur.
- La lecture et l'exploitation d'une documentation technique rédigée en anglais.

J'ai également appris qu'une fonctionnalité peut échouer non pas à cause de sa logique métier, mais parce qu'une protection de sécurité n'est pas correctement intégrée à la communication entre le frontend et le backend.

## 7. Conclusion

Cette recherche technique m'a aidé à comprendre et à documenter une difficulté réelle rencontrée pendant le développement de FantasyRealm.

L'utilisation de sources anglophones fiables m'a permis de relier le fonctionnement de l'API Fetch à celui de la protection CSRF mise en place dans mon backend PHP.

La solution consiste à récupérer le jeton CSRF associé à la session, à le transmettre dans un en-tête HTTP et à le vérifier côté serveur.

Cette expérience m'a permis de progresser dans la compréhension de la sécurité web et de développer ma capacité à rechercher, traduire et appliquer des informations techniques en anglais.

---

## 8. Références

**Source 1 — OWASP**

Cross-Site Request Forgery Prevention Cheat Sheet

https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

**Source 2 — MDN Web Docs**

Using the Fetch API

https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

**Code source du projet**

https://github.com/IbbiBoy2/FantasyRealm

Branche examinée : `feature/user-dashboard`

**Date de consultation :** 01/11/2026

---

**Document réalisé dans le cadre du projet FantasyRealm — Studi DWWM.**