# RAPPORT D'ANALYSE STRATEGIQUE - Base de Donnees CRM Demarchage

**Date d'analyse** : 26 fevrier 2026
**Source** : Export Pipedrive - dmearchage - deal list.csv
**Volume** : 1 426 lignes (1 header + 1 425 deals)
**Contexte** : SaaS de conciergerie (gestion locations courte duree type Airbnb) - Marche francais

---

## TABLE DES MATIERES

1. [A. Vue d'ensemble](#a-vue-densemble)
2. [B. Analyse des deals GAGNES](#b-analyse-des-deals-gagnes)
3. [C. Analyse des deals EN COURS](#c-analyse-des-deals-en-cours)
4. [D. Analyse des deals PERDUS](#d-analyse-des-deals-perdus)
5. [E. Analyse concurrentielle](#e-analyse-concurrentielle)
6. [F. Donnees exploitables](#f-donnees-exploitables)
7. [G. Recommandations commerciales](#g-recommandations-commerciales)

---

## A. Vue d'ensemble

### Repartition par statut

| Statut | Nombre | % du total |
|--------|--------|------------|
| **Perdue** | 1 008 | 70,7% |
| **En cours** | 406 | 28,5% |
| **Gagnee** | 11 | 0,8% |
| **TOTAL** | **1 425** | 100% |

**Taux de conversion global : 0,8%** -- Ce chiffre est alarmant. Sur 1 425 contacts, seulement 11 ont ete convertis en clients.

### Contacts exploitables

| Critere | Nombre | % du total |
|---------|--------|------------|
| Deals avec au moins un email | 826 | 57,9% |
| Deals avec au moins un telephone | 503 | 35,3% |
| Deals SANS email NI telephone | 580 | 40,7% |
| Deals avec nb logements renseigne | 137 | 9,6% |

**Point critique** : 40,7% des deals n'ont aucune coordonnee exploitable (ni email, ni telephone). Cela represente 580 deals totalement inutilisables pour une relance.

### Geographie

| Region | Nombre de deals renseignes |
|--------|--------------------------|
| Auvergne-Rhone-Alpes | 66 |
| Provence-Alpes-Cote d'Azur | 34 |
| Nouvelle-Aquitaine | 11 |
| Pays de la Loire | 8 |
| Ile-de-France | 7 |
| Occitanie | 7 |
| Normandie | 6 |
| Bretagne | 4 |
| Corse | 3 |
| Hauts-de-France | 2 |

**Note** : La region n'est renseignee que pour ~160 deals sur 1 425 (11%). L'Auvergne-Rhone-Alpes domine largement, ce qui est coherent avec la prospection sur les stations de ski.

### Sources de leads

| Source | Nombre | % |
|--------|--------|---|
| (non renseignee) | 1 240 | 87% |
| Prospection | 129 | 9% |
| Scale France | 20 | 1,4% |
| Bouche a oreille | 16 | 1,1% |
| LinkedIn Claire | 13 | 0,9% |
| Contact Claire | 3 | 0,2% |
| Meta Ads | 2 | 0,1% |

**87% des deals n'ont pas de source renseignee.** Il est impossible de savoir quel canal a genere ces leads. C'est un manque critique de tracabilite.

---

## B. Analyse des deals GAGNES (clients actuels)

### Liste complete des 11 deals gagnes

| # | Organisation | Contact | Email | Telephone | Logements | Region | Source | Type |
|---|-------------|---------|-------|-----------|-----------|--------|--------|------|
| 1 | **Placid Gap** | Florian Gibon | florian@agences-placid.com | 06 89 41 27 18 | 37 | PACA | Bouche a oreille | Franchise |
| 2 | **Latin Exclusive** | Arnaud | arnaud@latinexclusive.com | - | 1 000 | International | Bouche a oreille | - |
| 3 | **Mas Des Becasses** | Vincent Piot | - | - | 1 | PACA | Bouche a oreille | Independante |
| 4 | **Solimare** | Sanne van Houts | sanne@solimare.corsica | - | 35 | Corse | - | Independante |
| 5 | **Auptima** | - | - | - | - | - | - | - |
| 6 | **Edgar Conciergerie** | - | - | - | - | - | - | - |
| 7 | **Conciergerie du Croco** | Philippe Alexandre | contact@laconciergerieducroco.fr | 04 13 33 30 69 | - | - | - | - |
| 8 | **Mon petit fare** | Martignoni | contact@monpetitfare.fr | 09 78 80 10 52 | - | - | - | - |
| 9 | **Terreta Spain** | terreta spain | - | - | - | - | - | - |
| 10 | **Placid** (siege) | Catheline | catheline@agences-placid.com | 06 27 42 08 08 | - | - | - | - |
| 11 | **VillaVEO** | Gombart | catherine@villaveo.com | - | - | - | - | - |

### 4 deals supplementaires marques "Client !" dans le pipeline En cours

| Organisation | Contact | Email | Logements |
|-------------|---------|-------|-----------|
| **sergeconciergerie.com** | Serge Carena | info@sergeconciergerie.com | 7 |
| **CSEM** | CSEM | csem@bred.fr | - |
| **Terra Spain** | Geoffroy | - | - |
| **Odelie (ex-BARNES)** | HIGELIN | ehigelin.immobilier@gmail.com | - |

### Profil type du client gagne

- **Source dominante** : Bouche a oreille (3 deals gagnes sur les 4 ou la source est renseignee). Aucun deal gagne ne vient de la prospection froide.
- **Reseau Placid** : 2 deals gagnes viennent du reseau Placid (franchise), ce qui en fait le meilleur partenaire.
- **Taille** : Tres variable - de 1 logement (Mas Des Becasses) a 1 000 (Latin Exclusive). Les 2 plus gros sont hors France.
- **International** : Plusieurs clients sont hors France (Latin Exclusive, Terreta Spain, Terra Spain, VillaVEO).
- **Donnees lacunaires** : La plupart des deals gagnes manquent d'informations cles (region, nb logements, type).

---

## C. Analyse des deals EN COURS (pipeline actif)

### Total : 406 deals

### Repartition par etape

| Etape | Nombre | % | Signification |
|-------|--------|---|--------------|
| **A contacter** | 236 | 58,1% | Leads froids - jamais contactes |
| **Negociations commencees** | 61 | 15,0% | En discussion active |
| **Demonstration effectuee** | 25 | 6,2% | Ont vu le produit |
| **Contact effectue** | 20 | 4,9% | Premier contact fait |
| **Inscription** | 17 | 4,2% | Se sont inscrits (probablement site web) |
| **Stand-by** | 17 | 4,2% | En attente |
| **Demo programmee** | 14 | 3,4% | Demo planifiee mais pas encore faite |
| **Perdu mais a relancer** | 8 | 2,0% | A retenter plus tard |
| **Periode d'essai en cours** | 4 | 1,0% | Testent le produit |
| **Client !** | 4 | 1,0% | Deja clients |

### Coordonnees exploitables (pipeline en cours)

| Critere | Nombre | % des 406 |
|---------|--------|-----------|
| Avec email | 161 | 39,7% |
| Avec telephone | 102 | 25,1% |
| **SANS aucun contact** | **235** | **57,9%** |

**Plus de la moitie du pipeline "En cours" n'a aucune coordonnee.** Ce sont majoritairement les 236 deals "a contacter" qui sont des noms d'entreprises sans aucune info de contact -- des coquilles vides, inutilisables en l'etat.

### Deals les plus prometteurs (demo effectuee/programmee + negociations + essais)

Il y a **104 deals actifs prometteurs** (hors "a contacter" et "contact effectue" simples).

#### Top deals par volume de logements (>= 30 logements)

| Logements | Organisation | Etape | Email | Telephone |
|-----------|-------------|-------|-------|-----------|
| 4 500 | VVF Saint-Lary-Soulan | Demo effectuee | - | - |
| 2 300 | Mountain Collection | Negociations | - | - |
| 691 | Cis Immobilier | Negociations | - | - |
| 500 | Flexliving.fr | Demo effectuee | alexandre@flexliving.fr | - |
| 347 | Val Thorens Immobilier | Negociations | - | - |
| 250 | Terreva | Demo effectuee | cassy.bougard@terreva.com | - |
| 150 | Enova Immobilier | Negociations | Ocharbaut@enova-immobilier.fr | - |
| 150 | KEYPERS | Demo effectuee | Paul-farell@keypers.paris | - |
| 150 | Agence Bru et fils | Negociations | fionablanccommunication@gmail.com | 06 10 80 53 93 |
| 140 | Atherac Location | Negociations | - | - |
| 135 | easyBNB | Demo effectuee | faical@easybnb.co | +420735971931 |
| 120 | Smart Stay | Negociations | - | - |
| 103 | Ma Cle Immo | Negociations | - | - |
| 100 | La Clusaz Immobilier | Negociations | - | - |
| 89 | Homebooker | Negociations | - | - |
| 85 | Sealodge Mauritius | Negociations | - | - |
| 80 | Agence Olivier | Negociations | - | 04 50 75 86 28 |
| 70 | Placid Mont de Marsan | Essai en cours | marine@agences-placid.com | 06 46 39 95 71 |
| 60 | Premiere Conciergerie | Demo effectuee | contact@premiere-conciergerie.com | - |
| 60 | Agence du Grand Mont | Negociations | - | - |
| 50 | Conciergerie Newpulse | Demo effectuee | chris@newpulse.fr | 07 45 08 09 11 |
| 47 | Les Clefs de Jeanne | Negociations | lesclefsdejeanne@gmail.com | 06 24 36 71 34 |
| 40 | Mana Immobilier | Negociations | mana.conciergerie@gmail.com | - |
| 37 | Fine Stone Immobilier | Demo effectuee | gauthier@fine-stone.fr | - |
| 30 | Reve de Sud Location | Demo effectuee | andrea@revedesud.com | 0667681562 |
| 30 | AD Conciergerie | Demo effectuee | contact@adconciergerie.fr | 05 56 96 90 60 |

**Deals critiques a closer en priorite absolue** :
- **VVF Saint-Lary (4 500 logements)** : Le plus gros deal du pipeline. Pas d'email ni telephone dans le CRM -- a completer d'urgence.
- **Mountain Collection (2 300 logements)** : Auvergne-Rhone-Alpes, en nego. Pas de contact.
- **Cis Immobilier (691 logements)** : Auvergne-Rhone-Alpes, en nego. Pas de contact.
- **Flexliving (500 logements)** : Demo effectuee avec email. A relancer immediatement.
- **Terreva (250 logements)** : Demo effectuee, franchise en Nouvelle-Aquitaine.
- **Placid Mont de Marsan (70 logements)** : En essai, reseau Placid -- forte probabilite de conversion.

### Focus Dubai/International

Il y a environ 11 deals Dubai et plusieurs internationaux dans le pipeline "En cours", tous au stade "a contacter" ou "contact effectue". Ce sont des prospects precoces non travailles : Silkhaus (300 logements), PK Holiday Homes, One Perfect Stay, etc.

---

## D. Analyse des deals PERDUS

### Total : 1 008 deals perdus

### Top 10 raisons de perte (categorisees)

| # | Categorie | Nombre | % des perdus |
|---|-----------|--------|-------------|
| 1 | **Mauvaise cible / hors scope** | 435 | 43,2% |
| 2 | **Pas de reponse / ghosting** | 208 | 20,6% |
| 3 | **Entreprise fermee / n'existe plus** | 76 | 7,5% |
| 4 | **Pas interesse / refus explicite** | 62 | 6,2% |
| 5 | **Timing / budget / pas la priorite** | 26 | 2,6% |
| 6 | **Fait tout manuellement / pas besoin** | 23 | 2,3% |
| 7 | **Utilise un concurrent** | 21 | 2,1% |
| 8 | **Pas de coordonnees / site introuvable** | 18 | 1,8% |
| 9 | **Trop petit** | 16 | 1,6% |
| 10 | **Pas de raison renseignee** | 12 | 1,2% |
| 11 | **No-show / lapin demo** | 7 | 0,7% |
| 12 | **Pas de location courte duree** | 5 | 0,5% |
| 13 | **Produit inadequat / features manquantes** | 4 | 0,4% |
| - | **Autre / non categorisable** | 90 | 8,9% |

### Analyse detaillee par categorie

#### 1. Mauvaise cible (435 deals -- 43,2%)

C'est le probleme numero 1. **Pres de la moitie des deals perdus n'auraient jamais du etre prospectes.** On retrouve :
- Des conciergeries d'entreprise (Sodexo, Domusvi, Circles France...)
- Des hotels de luxe (Ritz Paris, Peninsula Paris, Le Bristol, Carlton Cannes...)
- Des entreprises sans rapport (Disneyland Paris, American Express, Schneider Electric, LVMH, Patek Philippe, Renault...)
- Des conciergeries de luxe privees (chauffeurs, yachts, bijoux...)
- Des restaurants, pressing, coiffeurs...
- Des startups tech sans rapport (Agicap, The Kooples, Withings...)

**Conclusion** : Le fichier de prospection initial etait de tres mauvaise qualite. Le commercial a prospecte sur le mot-cle "conciergerie" sans distinguer les conciergeries de location saisonniere des autres types.

#### 2. Pas de reponse / ghosting (208 deals -- 20,6%)

La majorite de ces deals sont au stade "Negociations commencees", ce qui signifie que le commercial a envoye un message mais n'a jamais eu de retour. Beaucoup portent la mention "Pas de reponse = abandon" ou "Ne repond pas = perdu".

**Pattern identifie** : Le commercial envoie un message LinkedIn ou email, puis abandonne apres 1-2 relances. Il n'y a pas de sequence de relance structuree.

#### 3. Entreprise fermee / n'existe plus (76 deals -- 7,5%)

76 entreprises prospectees avaient deja ferme, n'avaient plus de site web, ou avaient arrete leur activite. Cela indique un manque de verification prealable des leads.

#### 4. Fait tout manuellement / pas besoin (23 deals -- 2,3%)

Ces conciergeries font l'etat des lieux en physique, le menage elles-memes, et ne voient pas l'interet d'un outil digital. C'est un objection recurrente : **"je fais tout en physique, ca marche tres bien"**.

#### 5. Produit inadequat (4 deals -- 0,4%)

Quelques deals mentionnent des features manquantes :
- "Il manque la fonctionnalite signature"
- "l'IA ne peut pas voir le menage"
- "Outils pas conforme"
- "besoin de planning menage"

### Combien sont "Perdu mais a relancer un jour" ?

**49 deals** sont marques avec l'etape "Perdu mais a relancer un jour" parmi les perdus.

Parmi eux, les plus gros :

| Logements | Organisation | Raison | Email | Telephone |
|-----------|-------------|--------|-------|-----------|
| 6 000 | Interhome | Trop gros groupe, pas d'actualite | - | - |
| 1 588 | GSI by Foncia | N'a jamais repondu | - | - |
| 350 | Avoriaz Holidays | Pas de reponse | info@avoriaz-holidays.com | 04 50 74 16 08 |
| 315 | Agence des Alpes | Utilise Arkiane | - | - |
| 200 | Boan Immobilier | Pour l'annee prochaine | - | - |
| 188 | Menuires Immobilier | Ne repond pas | - | - |
| 149 | Mont Blanc Immobilier | Pour l'annee prochaine | - | - |
| 136 | Agence Immo'Select | Utilise Google Form | conciergerie@agenceimmoselect.com | 04 50 79 10 86 |
| 100 | Alpissime | Ne veut pas passer le responsable | - | - |
| 100 | Thibon Immobilier | Fiche papier, 0 controle | - | 04 50 75 83 20 |
| 97 | La Grive Immobilier | "L'IA ne peut pas voir le menage" | - | - |
| 96 | Agence la Cime | Fait tout en physique | - | - |
| 93 | Hoosteez | Veut faire payer son presta menage | contact@hoosteez.com | 06 63 41 57 52 |
| 92 | Agence Anthonioz | Fait tout en physique | - | 04 50 79 80 09 |
| 90 | Immo Valley | Pas interessee | - | - |
| 87 | Arvis Immo | Pense que les agents ne l'utiliseront pas | - | - |
| 80 | Holidays Provence (Luckeyloc) | Pas de reponse | Belinda@luckeyloc.com | 06 13 01 13 88 |

### Combien sont vraiment morts vs recuperables ?

| Categorie | Nombre |
|-----------|--------|
| **Vraiment morts** (mauvaise cible, ferme, doublon, hotel, etc.) | 520 (51,6%) |
| **Potentiellement recuperables** | 488 (48,4%) |
| Recuperables **avec coordonnees** | 339 (33,6%) |

**Conclusion** : Sur les 1 008 deals perdus, environ **339 ont un potentiel de relance** (coordonnees + raison de perte non definitive).

---

## E. Analyse concurrentielle

### Tous les concurrents mentionnes dans les raisons de perte

| Concurrent | Deals perdus | Positionnement |
|-----------|-------------|----------------|
| **Pass Pass** | 6 | Check-in / check-out digital |
| **Keep In Touch** | 3 | Gestion conciergerie |
| **Breezeway** | 3 | Operations / cleaning management |
| **Arkiane** | 3 | Check-in / check-out (Alpes) |
| **Yago** | 2 | Gestion conciergerie |
| **SuperHote** | 2 | Gestion conciergerie |
| **Lofty** | 1 | PMS / gestion (moins cher) |
| **Projet Clean** | 1 | Nettoyage longue duree |
| **Mews** | 1 | PMS hotelerie |
| **Aventio/Avantio** | 1 | PMS / channel manager |
| **GuestLucky** | 1 | Gestion conciergerie |
| **Lodgify** | 1 | PMS / gestion |
| **Swikly** | 1 | Cautions en ligne |
| **Airtable** | 1 | Outil generique (no-code) |

**Total : 27 deals perdus face a un concurrent identifie.**

### Analyse par concurrent

**Pass Pass (6 deals)** : Le concurrent le plus cite. Un des fondateurs (Baijot) utilise lui-meme Pass Pass pour sa conciergerie Loca Ren't. Pass Pass semble bien implante dans le segment des petites conciergeries independantes.

**Keep In Touch (3 deals)** : Mentionne pour des deals significatifs : ACM Immobilier (71 logements), Cimalpes (1 311 logements -- un enorme compte perdu). Un deal (Maeva) est en "test avec Keep In Touch" -- potentiel de reconversion si le test echoue.

**Breezeway (3 deals)** : Concurrent americain present sur le segment haut de gamme. Emerald Stay (100 logements, luxe/haut de gamme) et Booking Guys l'ont choisi. Hestia Conciergerie est "partie avec Breezeway" pendant l'essai.

**Arkiane (3 deals)** : Specialise check-in/check-out, tres present en Auvergne-Rhone-Alpes (Agence des Alpes avec 315 logements, Oxygene Immobilier avec 68 logements).

**SuperHote (2 deals)** : Mademoiselle Keys (44 logements, IDF, Scale France) et Home Partner.

### Enseignement cle

Le paysage concurrentiel est tres fragmente. Aucun concurrent ne domine massivement. Les pertes face a la concurrence ne representent que 2,7% des deals perdus -- **le vrai probleme n'est pas la concurrence, c'est le ciblage et le process de vente.**

---

## F. Donnees exploitables

### Synthese des coordonnees

| Critere | Deals | % total |
|---------|-------|---------|
| Au moins un email | 826 | 57,9% |
| Au moins un telephone | 503 | 35,3% |
| Email ET telephone | ~350 | ~24,6% |
| **RIEN (ni email, ni tel)** | **580** | **40,7%** |

### Repartition par statut

| Statut | Avec email | Avec tel | Sans rien |
|--------|-----------|----------|-----------|
| Perdue (1 008) | ~600 | ~380 | ~345 |
| En cours (406) | 161 (39,7%) | 102 (25,1%) | 235 (57,9%) |
| Gagnee (11) | 6 | 4 | 3 |

### Qualite globale de la data

| Champ | Rempli | % |
|-------|--------|---|
| Organisation | 1 319 | 92% |
| Personne a contacter | 1 087 | 76% |
| Source du lead | 185 | **13%** |
| Pays | 175 | **12%** |
| Nombre de logements | 137 | **10%** |
| Type de conciergerie | 130 | **9%** |
| Region | ~160 | **11%** |

**Verdict : La qualite de la data est MEDIOCRE.**

- Le nom de l'organisation est bien renseigne (92%) -- c'est le minimum.
- Le contact est correct (76%).
- Tout le reste est catastrophique : moins de 15% de remplissage pour les champs metier critiques (source, region, nb logements, type).
- **Le nombre de logements, pourtant l'indicateur cle de la taille du prospect, n'est renseigne que pour 10% des deals.**
- **La source du lead est inconnue pour 87% des deals**, rendant impossible toute analyse de ROI par canal.

---

## G. Recommandations commerciales

### 1. Deals perdus a relancer en PRIORITE

Voici les 20 deals perdus a plus fort potentiel de reconversion, classes par score de priorite :

| Prio | Organisation | Logements | Raison de perte | Email | Tel |
|------|-------------|-----------|-----------------|-------|-----|
| 1 | **Agence Immo'Select** | 136 | Google Form, a relancer | conciergerie@agenceimmoselect.com | 04 50 79 10 86 |
| 2 | **Avoriaz Holidays** | 350 | Pas de reponse, a relancer | info@avoriaz-holidays.com | 04 50 74 16 08 |
| 3 | **Conciergerie Suzette** | 60 | Timing + features manquantes | maurin@conciergerie-suzette.fr | - |
| 4 | **Holidays Provence** | 80 | Pas de reponse, a relancer | Belinda@luckeyloc.com | 06 13 01 13 88 |
| 5 | **Thibon Immobilier** | 100 | 0 controle, fiche papier | - | 04 50 75 83 20 |
| 6 | **Les freres de la loc'** | 70 | Pas de reponse, a relancer | contact@conciergerie-marseille.fr | - |
| 7 | **Mademoiselle Keys** | 44 | Utilise SuperHote (a relancer) | mademoisellekeys@gmail.com | 07 66 70 02 21 |
| 8 | **Hoosteez** | 93 | Veut facturer presta menage | contact@hoosteez.com | 06 63 41 57 52 |
| 9 | **Agence Anthonioz** | 92 | Fait tout en physique | - | 04 50 79 80 09 |
| 10 | **Riviera Holiday Homes** | 100 | Utilise Yago, ne repond pas | contact@rivieraholidayhomes.com | 04 93 16 03 44 |
| 11 | **Placid Reims** | 11 | Utilise Lofty (moins cher) | reims@agences-placid.com | 06 81 07 12 98 |
| 12 | **Risoul Ski** | 16 | Trop de nego, a relancer | info@risoulski.com | 07 89 51 59 69 |
| 13 | **Agence la conciergerie Lacanau** | 45 | Besoin de plug PMS | morgan@agencelaconciergerie.com | - |
| 14 | **La conciergerie du lac** | 312 | Pas de reponse, abandon | lionel@laconciergeriedulac.com | 04 57 41 36 95 |
| 15 | **Conciergerie D'Alexia** | - | Changement de projet, plus tard | alexia.nappe@laconciergeriedalexia.fr | - |
| 16 | **Maeva** | - | Test Keep In Touch en cours | nicolas.beaurain@gmail.com | 06 09 63 69 70 |
| 17 | **Kleidos** | 20 | "Plus tard" | contact@kleidos-bnb.com | 07 56 13 71 99 |
| 18 | **Avoriaz location SARL** | 64 | Fait tout en physique | p.marra@avoriaz-location.com | 04 50 74 04 53 |
| 19 | **Home Partner** | - | Utilise SuperHote | patricia.chatelus@homepart.fr | - |
| 20 | **ACM Immobilier** | 71 | Utilise Keep In Touch | - | 04 50 75 89 26 |

**Strategie de relance recommandee** :
- Pour les "pas de reponse / abandon" (Avoriaz Holidays, La conciergerie du lac, etc.) : Relancer avec une approche differente (email + LinkedIn + appel). Le produit a evolue depuis, c'est l'argument.
- Pour les "utilise un concurrent" (Mademoiselle Keys, Maeva, Placid Reims) : Attendre 3-6 mois puis relancer avec une comparaison factuelle. Surveiller s'ils publient des avis negatifs sur le concurrent.
- Pour les "timing / plus tard" (Conciergerie Suzette, Kleidos, Boan Immobilier) : Mettre en nurturing automatique et relancer a la prochaine saison.
- Pour les "fait tout en physique" (Agence Anthonioz, Avoriaz location) : Preparer un cas client concret montrant les gains de temps. Ces prospects sont les plus difficiles a convertir.

### 2. Segment le plus rentable

**Profil du prospect ideal** :
- **Region** : Auvergne-Rhone-Alpes (stations de ski) et PACA (locations bord de mer)
- **Taille** : 30 a 200 logements (assez gros pour avoir un vrai besoin, assez petit pour decider vite)
- **Type** : Independante ou franchise (Placid est un excellent canal)
- **Source** : Bouche a oreille et reseau Scale France (meilleurs taux de conversion)
- **Standing** : Standard et Haut de gamme (le luxe a des process differents)

**Le reseau Placid est le meilleur canal de distribution.** 2 deals gagnes, plusieurs en cours (Placid Beauvais, Placid Arras, Placid Mont de Marsan en essai), et le bouche a oreille fonctionne entre franchises. Il faut transformer cette relation en partenariat formel.

### 3. Points d'amelioration du process commercial

#### PROBLEME 1 : Ciblage catastrophique (43% de mauvaises cibles)

**Cause** : Le commercial a prospecte en masse sur le mot "conciergerie" sans filtre. Resultat : hotels de luxe, conciergeries d'entreprise, pressings, services VTC, et meme des clubs de handball se retrouvent dans le CRM.

**Solution** :
- Definir une ICP (Ideal Customer Profile) stricte : "Conciergerie de location saisonniere / courte duree, France, gere 20+ logements, fait du check-in/check-out et du menage"
- Avant toute prospection, verifier le site web en 30 secondes : le prospect gere-t-il des appartements Airbnb/Booking ?
- Automatiser le pre-filtrage (scraping de sites, verification Societe.com)

#### PROBLEME 2 : Absence de qualification (10% de logements renseignes)

**Cause** : Le commercial ne demande pas combien de logements sont geres. C'est pourtant LE critere de taille qui determine la valeur du deal.

**Solution** :
- Rendre le champ "Nombre de logements" obligatoire avant de passer au stade "Negociations"
- Ajouter le script de qualification au premier appel : "Combien de logements gerez-vous ?" + "Quel outil utilisez-vous actuellement ?"

#### PROBLEME 3 : Pas de sequence de relance (20,6% de ghosting)

**Cause** : Le commercial envoie 1-2 messages puis marque "pas de reponse = abandon". Il n'y a pas de cadence de relance structuree.

**Solution** :
- Implementer une sequence de 5-7 touchpoints (email + LinkedIn + appel + SMS) sur 3-4 semaines
- Ne marquer "perdu" qu'apres la sequence complete (pas apres 1 message sans reponse)
- Utiliser des outils d'automatisation (Lemlist, La Growth Machine)

#### PROBLEME 4 : Absence totale de tracabilite des sources (87% sans source)

**Cause** : Le champ "Source du lead" n'est presque jamais rempli.

**Solution** :
- Rendre la source obligatoire a la creation du deal dans Pipedrive
- Taguer automatiquement via des UTM (inbound) ou des workflows (prospection LinkedIn, Scale France, etc.)
- Analyser mensuellement le ROI par canal

#### PROBLEME 5 : Pipeline "En cours" pollue par des fantomes

**Cause** : 236 deals "a contacter" sans aucune coordonnee, dont certains datent de septembre 2025. Ce sont des noms d'entreprises copies en masse dans le CRM, jamais travailles.

**Solution** :
- Nettoyer le pipeline : archiver tous les deals "a contacter" sans email ni telephone ni activite depuis 3 mois
- Requalifier les deals "a contacter" qui ont des coordonnees
- Ne creer un deal que quand on a au minimum un email OU un telephone

#### PROBLEME 6 : Pas d'utilisation strategique des demos

**Cause** : 7 lapins sur des demos programmees. Pas de confirmation/relance systematique avant les demos.

**Solution** :
- Envoyer une confirmation 24h avant + rappel 1h avant
- Si lapin, replanifier automatiquement (pas de "perdu" apres 1 lapin)

### 4. Quick wins immediats

1. **Closer les 4 deals en essai** : Placid Mont de Marsan (70 logements), Florian Gibon (deja gagne), futterer property, Camille Goter. Ce sont les plus proches de la conversion.

2. **Relancer les 25 demos effectuees "En cours"** : Flexliving (500 logements), Terreva (250), KEYPERS (150), easyBNB (135), Premiere Conciergerie (60), etc. Ces prospects ont VU le produit et n'ont pas dit non.

3. **Activer le reseau Placid** : Contacter le siege Placid pour un partenariat formel. Plusieurs franchises sont deja clientes ou en essai. Proposer un tarif groupe.

4. **Nettoyer le CRM** : Supprimer les 435+ mauvaises cibles, archiver les 76 entreprises fermees, enrichir les fiches des deals prometteurs avec nb logements, email, telephone.

5. **Mettre en place une sequence automatisee** : Pour les 173 deals perdus recuperables avec coordonnees et un score de relance positif.

---

## RESUME EXECUTIF

| Indicateur | Valeur | Verdict |
|-----------|--------|---------|
| Taux de conversion | 0,8% (11/1425) | CRITIQUE |
| Deals perdus pour mauvais ciblage | 43,2% | CRITIQUE |
| Qualite data (champs metier remplis) | 9-13% | CATASTROPHIQUE |
| Pipeline actif exploitable (avec contact) | 171 deals | A TRAVAILLER |
| Deals a relancer en priorite | ~30 deals chauds | OPPORTUNITE |
| Concurrents reels | 6-8 (Pass Pass, Keep In Touch, Breezeway, Arkiane...) | FRAGMENTE |
| Meilleur canal d'acquisition | Bouche a oreille / Reseau Placid | A INDUSTRIALISER |
| Segment le plus rentable | ARA + PACA, 30-200 logements, independantes | A CIBLER |

**En une phrase** : Cette base CRM revele un effort de prospection massif (1 425 contacts) mais extremement mal cible (43% de mauvaises cibles), mal qualifie (10% de logements renseignes), et mal suivi (20% de ghosting par manque de relance). Le potentiel est la -- 339 deals recuperables avec coordonnees, un pipeline de 27 deals avec demos effectuees -- mais il faut en urgence nettoyer le CRM, redefinir l'ICP, structurer les sequences de relance, et capitaliser sur le reseau Placid qui est le seul canal qui convertit reellement.

---

*Rapport genere le 26/02/2026 -- Document strategique confidentiel*
