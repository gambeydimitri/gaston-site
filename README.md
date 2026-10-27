# Gaston — site gaston-ramonage.fr

Deux pages principales : l'accueil (`index.html`) et le générateur de certificat gratuit (`certificat-ramonage-gratuit.html`).

Site statique : le certificat PDF est fabriqué directement dans le navigateur du ramoneur.
Aucun serveur n'est nécessaire pour le PDF. Seule l'inscription de l'e-mail passe par
une petite fonction serveur (`api/inscription.js`).

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html`, `landing.css`, `landing.js` | La page d'accueil et la réservation des places fondateur |
| `certificat-ramonage-gratuit.html` | La page du générateur |
| `styles.css` | Le design (couleurs, polices, mise en page) |
| `app.js` | Le formulaire : mémorisation, logo, signatures, téléchargement |
| `pdf.js` | La mise en page du certificat PDF |
| `api/inscription.js` | Ajoute l'e-mail à votre liste Brevo (ramoneurs du générateur ou fondateurs) |
| `confidentialite.html`, `mentions-legales.html` | Pages légales (à compléter : passages entre crochets) |

## Mettre en ligne (gratuit, environ 30 minutes)

1. **Créer un compte GitHub** (github.com) et un dépôt « gaston-generateur ».
   Glissez-déposez tous les fichiers de ce dossier dans le dépôt (bouton « Add file » > « Upload files »).
2. **Créer un compte Vercel** (vercel.com) avec votre compte GitHub.
   « Add New » > « Project » > choisissez le dépôt > « Deploy ». Le site est en ligne sur une adresse en `.vercel.app`.
3. **Brancher votre domaine** : dans Vercel, « Settings » > « Domains » > ajoutez `gaston-ramonage.fr`.
   Vercel affiche deux lignes DNS à recopier chez votre registraire (OVH, Gandi…). Comptez de quelques minutes à quelques heures.
4. **Récupérer les e-mails des ramoneurs** (facultatif au début) :
   - créez un compte gratuit sur brevo.com, puis une liste « Ramoneurs » (notez son numéro) ;
   - « Paramètres » > « Clés API » > créez une clé ;
   - créez aussi une liste « Fondateurs » pour les réservations de la page d'accueil ;
   - dans Vercel : « Settings » > « Environment Variables » : `BREVO_API_KEY` = la clé, `BREVO_LIST_ID` = le numéro de la liste « Ramoneurs », `BREVO_LIST_ID_FONDATEURS` = le numéro de la liste « Fondateurs » ;
   - redéployez (« Deployments » > « Redeploy »).
   Sans ces variables, le générateur fonctionne quand même (les e-mails ne sont pas enregistrés), mais la réservation fondateur affiche une erreur : **branchez Brevo avant d'annoncer la page d'accueil**.

## Avant d'annoncer le site

- [x] Mois d'ouverture de Gaston Pro : février 2027.

- [ ] Faire relire un certificat PDF par un ramoneur ou la CAPEB (mentions du décret n° 2023-641).
- [ ] Compléter les mentions légales et la politique de confidentialité (nom, adresse, SIRET).
- [ ] Vérifier les règles CNIL sur la prospection par e-mail entre professionnels.
- [ ] Tester sur votre propre téléphone : remplir, signer, télécharger.

## Modifier

- Textes de la page : `index.html`.
- Couleurs : les variables en haut de `styles.css` (`--orange`, `--ink`…).
- Mise en page du PDF et texte de bas de page : `pdf.js`.
- Conseils pré-remplis pour le bois : `CONSEILS_SOLIDES` en haut de `app.js`.
