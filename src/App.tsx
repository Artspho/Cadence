import { useEffect, useMemo, useRef, useState } from "react";
import type { Contrat, PeriodeAssimilee, Profil, SoldeIndemnisationDepart } from "./types";
import { franceTravailConfig } from "./config/franceTravailConfig";
import {
  chargerDonnees,
  creerContrat,
  creerDonneesVides,
  creerPeriode,
  exporterJSON,
  importerJSON,
  reinitialiserDonnees,
  restaurerSauvegarde,
  sauvegarderDonnees,
  type DonneesApp,
  type ResultatChargement,
} from "./storage/localStorageAdapter";
import { ecrireEtatServeur, lireEtatServeur, type EtatEnregistrement, type Jeton } from "./storage/sourceSupabase";
import { analyserBascule, type Bascule } from "./storage/bascule";
import { texteCanonique } from "./storage/verificationMigration";
import { obtenirClientAuth, obtenirClientConsentements, obtenirClientSourceDonnees } from "./auth/supabaseClient";
import { useSession } from "./auth/session";
import { synchroniserConsentement } from "./storage/consentementStorage";
import { EcranDonneesIllisibles } from "./components/EcranDonneesIllisibles";
import { DecisionServeur, type BasculeADecider } from "./components/DecisionServeur";
import { BandeauLectureSeule } from "./components/BandeauLectureSeule";
import { BandeauEchecEnregistrement } from "./components/BandeauEchecEnregistrement";
import { telechargerTexte } from "./lib/telechargement";
import { calculerFenetreEnCours } from "./engine/periodeReference";
import { calculerDecompteHeures } from "./engine/decompteHeures";
import { calculerSalaireReference } from "./engine/salaireReference";
import { calculerAJBrutePourFenetre } from "./engine/areBrute";
import { calculerAJNette, calculerSJM } from "./engine/areNette";
import { calculerStatutPrediction, construireSerieAcquisition, construireSerieAVenir } from "./engine/prediction";
import { detecterAlertes } from "./engine/alertes";
import { decouperExercices, fusionnerExercicesGeles } from "./engine/cycles";
import { diffJours } from "./engine/dateUtils";
import { TopBar, type Onglet } from "./components/TopBar";
import { Onboarding } from "./components/Onboarding";
import { Dashboard } from "./components/Dashboard";
import { ContractForm } from "./components/ContractForm";
import { ContractList } from "./components/ContractList";
import { ChecklistDocuments } from "./components/ChecklistDocuments";
import { ImportBulletins } from "./components/ImportBulletins";
import { ImportDocumentIA } from "./components/ImportDocumentIA";
import { OuvrirEspacePersonnelFT } from "./components/OuvrirEspacePersonnelFT";
// Maquette de test de l'écran de revue IA (extractions simulées, bac à sable) — ne rend rien
// hors développement, cf. RevueExtractionDemo.tsx.
import { RevueExtractionDemo } from "./components/RevueExtractionDemo";
import { AlertCenter } from "./components/AlertCenter";
import { Historique } from "./components/Historique";
import { Simulateur } from "./components/Simulateur";
import { MonProfil } from "./components/MonProfil";
import { AvertissementHorsPerimetre } from "./components/AvertissementHorsPerimetre";
import { ConfirmationImport } from "./components/ConfirmationImport";
import { DashboardVide } from "./components/DashboardVide";
import { RevenusMensuels } from "./components/RevenusMensuels";
import { FraisReels } from "./components/fraisReels/FraisReels";
import { dashboardEstVide } from "./lib/dashboardVide";
import { perimetreBloquant, profilHorsPerimetre } from "./lib/profilHorsPerimetre";
import { AvertissementContradictionHorsA10 } from "./components/AvertissementContradictionHorsA10";
import { centreAlertesPourEcran } from "./lib/alertesAffichage";
import { validerProfilPourEcriture } from "./lib/coherenceProfil";
import { validerContratsPourEcriture } from "./lib/contratUnSeulMois";
import { validerContratsEEEPourEcriture } from "./lib/contratTerritoireEEE";
import { BandeauStockagePlein } from "./components/BandeauStockagePlein";
import { MonDossier } from "./components/MonDossier";
import { EcranConnexionObligatoire } from "./components/EcranConnexionObligatoire";
import { EcranNouveauMotDePasse } from "./components/EcranNouveauMotDePasse";
import { INDICE_RETOUR_LIEN, marquerReinitialisationReussie, texteAvertissementLienConnecte } from "./auth/retourLienMagique";
import { MARQUEUR_REINITIALISATION } from "./auth/actions";

const dateDuJour = new Date().toISOString().slice(0, 10);

/**
 * PHASE 5 — OÙ EN EST LA RELATION AVEC LE SERVEUR, ET DONC QUI A LE DROIT D'ÉCRIRE.
 *
 * C'est cet état, et lui seul, qui autorise ou interdit les écritures (cf. `ecritureAutorisee`).
 * Même rôle que `chargement` pour le `localStorage` depuis le correctif du 03/08/2026 : une
 * situation qu'on ne sait pas trancher ne doit JAMAIS pouvoir déclencher une écriture.
 */
type EtatBascule =
  /**
   * Supabase n'est pas configuré, ou aucune session n'est ouverte. ⚠️ DEVENU UN FILET, PAS UN MODE
   * NORMAL depuis la connexion obligatoire (05/08/2026, cf. `EcranConnexionObligatoire.tsx`) : le mur
   * posé plus bas dans le rendu de `App` empêche désormais d'atteindre ce code sans session — ce cas
   * ne devrait donc plus jamais se produire en pratique. Conservé tel quel (pas supprimé) parce que
   * retirer ce filet reviendrait à supposer, sans le prouver, qu'aucun chemin ne peut plus jamais
   * l'atteindre — hors périmètre de ce chantier, cf. plan `fluttering-beaming-summit.md`.
   */
  | { statut: "localSeul" }
  /** Lecture du serveur en cours. Écriture suspendue le temps de savoir à quoi s'en tenir. */
  | { statut: "interrogation" }
  /** Le serveur fait référence. `jeton` est `null` avant la toute première écriture (insertion). */
  | { statut: "active"; jeton: Jeton | null }
  /** Une question est en suspens : écran bloquant, aucune écriture nulle part. */
  | { statut: "decision"; bascule: BasculeADecider }
  /** Serveur muet : consultation autorisée, écriture interdite. */
  | { statut: "lectureSeule"; message: string };

export default function App() {
  // ⚠️ `setDonneesBrut` CONTOURNE LE VERROU D'ÉCRITURE — réservé aux trois cas où c'est légitime :
  // la lecture initiale, une restauration décidée par l'utilisateur, et l'adoption de la version
  // serveur. Partout ailleurs, on passe par `setDonnees` (défini plus bas), qui refuse quand le
  // serveur ne permet pas d'enregistrer.
  const [donnees, setDonneesBrut] = useState<DonneesApp | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("dashboard");
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [fichierEnAttenteImport, setFichierEnAttenteImport] = useState<File | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
  // État d'édition d'un contrat (ContractList.tsx) remonté ici : le formulaire "Nouveau contrat"
  // ci-dessous doit disparaître pendant une édition, sinon deux <ContractForm> coexistent avec les
  // mêmes `id` de champs (bug trouvé en vérifiant dans le navigateur, 01/08/2026).
  const [contratEnEdition, setContratEnEdition] = useState<Contrat | null>(null);
  // Issue de la lecture initiale — `null` tant qu'elle n'a pas répondu. C'est CET état, et non un
  // `useRef`, qui autorise ou interdit l'écriture (correctif du 03/08/2026, point 🔴 n°1 de
  // docs/critique_2026-08-03.md) : l'ancien drapeau `chargementTermine` passait à `true` même après
  // une lecture ratée, et l'effet de sauvegarde écrasait alors les données d'origine par un état
  // vide, sans aucun clic de l'utilisateur.
  const [chargement, setChargement] = useState<ResultatChargement | null>(null);
  const [erreurSauvegarde, setErreurSauvegarde] = useState<string | null>(null);
  // Écriture de contrat refusée (contrat à cheval sur deux mois, cf. lib/contratUnSeulMois.ts).
  // Remonté ici et non dans un composant : le refus peut venir du formulaire, de l'import de
  // bulletin ou de la revue d'extraction IA — le bandeau doit être visible depuis n'importe quel
  // onglet, comme celui de `erreurSauvegarde`. Un rejet silencieux serait pire que le bug d'origine.
  const [refusEcriture, setRefusEcriture] = useState<string | null>(null);
  /**
   * Le bandeau ci-dessous a été fermé par l'utilisateur — sans cet état, il resterait affiché à
   * chaque rendu jusqu'au rechargement de la page, `indiceRetour` étant figé pour toute la vie du
   * module (cf. `auth/retourLienMagique.ts`).
   *
   * 🔴 DÉFAUT TROUVÉ EN CONDITIONS RÉELLES LE 06/08/2026, PAS PAR UN TEST : Benoît a cliqué un lien de
   * réinitialisation expiré (« Email link is invalid or has expired ») ALORS QU'IL ÉTAIT DÉJÀ
   * CONNECTÉ. `EcranConnexionObligatoire` porte déjà un bandeau qui explique cette erreur — mais il
   * ne s'affiche QUE quand aucune session n'est ouverte (le mur). Avec une session déjà active, l'app
   * continue tout droit sur le tableau de bord, sans jamais dire que le lien a été refusé : un état
   * muet, exactement ce que le devoir n°2 interdit. Ce bandeau couvre le cas symétrique : présent en
   * dehors du mur, dès qu'une session existe déjà.
   */
  const [avertissementLienFerme, setAvertissementLienFerme] = useState(false);
  /**
   * Le mot de passe vient d'être redéfini au retour du lien de réinitialisation (06/08/2026).
   *
   * ⚠️ POURQUOI UN ÉTAT LOCAL ET PAS UNE RELECTURE DE L'URL : `EcranNouveauMotDePasse` retire le
   * marqueur de l'URL en réussissant, mais `INDICE_RETOUR_LIEN` est figé À L'IMPORT du module et ne
   * changera donc jamais pendant la vie de la page. Sans ce drapeau, l'écran se réafficherait à chaque
   * rendu suivant, indéfiniment.
   */
  const [reinitialisationFaite, setReinitialisationFaite] = useState(false);
  /**
   * Capturé à l'import (cf. `auth/retourLienMagique.ts`), donc constant sur toute la vie de la page.
   * Lu ici plutôt qu'injecté en prop : `App` n'accepte aucune prop, et le comportement de cet écran est
   * couvert par ses propres tests (`EcranNouveauMotDePasse.test.tsx`) plus ceux du marqueur
   * (`retourLienMagique.test.ts`). Le branchement lui-même — ce seul `if` plus bas — n'est pas couvert
   * par un test React : limite assumée et vérifiée à l'écran, comme pour l'onboarding.
   */
  const indiceRetour = INDICE_RETOUR_LIEN;
  // Texte du bandeau affiché plus bas quand une session est déjà active (cf. `avertissementLienFerme`
  // ci-dessus) — `null` quand `indiceRetour` n'a rien à signaler, ce qui masque le bandeau.
  // `reinitialisationFaite` en plus depuis le 07/08/2026 : sans lui, ce bandeau annoncerait un faux
  // échec juste après un succès (cf. le commentaire de `marquerReinitialisationReussie` dans
  // `auth/retourLienMagique.ts` — `indiceRetour.present` reste vrai même quand tout a fonctionné).
  const avertissementLien = reinitialisationFaite ? null : texteAvertissementLienConnecte(indiceRetour);
  const inputImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chargerDonnees().then((resultat) => {
      setChargement(resultat);
      if (resultat.statut === "ok") setDonneesBrut(resultat.donnees);
      else if (resultat.statut === "vide") setDonneesBrut(creerDonneesVides());
      // "illisible" : `donnees` reste `null`, donc l'app ne rend jamais son interface normale et
      // l'effet de sauvegarde ci-dessous ne peut structurellement pas s'exécuter.
    });
  }, []);

  // Verrou d'écriture. Les deux conditions sont nécessaires : `donnees` non nul (il ne l'est jamais
  // en statut "illisible") ET une lecture explicitement saine. Une lecture illisible ne peut donc
  // JAMAIS déclencher d'écriture — c'est la règle que ce correctif installe.
  const lectureSaine = chargement !== null && chargement.statut !== "illisible";

  // ── PHASE 5 : LA BASCULE ────────────────────────────────────────────────────────────────────────
  // Remplace le miroir en écriture seule de la phase 3, qui a été SUPPRIMÉ — il écrivait par `upsert`,
  // donc sans condition, et aurait contourné le verrou installé ici (cf. auth/supabaseClient.ts).
  const clientAuth = obtenirClientAuth();
  const clientSource = obtenirClientSourceDonnees();
  const clientConsentements = obtenirClientConsentements();
  const session = useSession(clientAuth);
  /**
   * ⚠️ L'ÉTAT INITIAL DÉPEND DE LA CONFIGURATION, ET CE N'EST PAS UN DÉTAIL. Une première version
   * démarrait toujours sur `localSeul`, donc écriture OUVERTE — et un test d'intégration a montré que
   * l'app enregistrait alors dans le navigateur pendant la fraction de seconde qui précède la réponse
   * du serveur. Écrire avant de savoir ce que le serveur porte, c'est précisément ce que cette phase
   * interdit : la divergence aurait été créée par l'app elle-même.
   *
   * Sans configuration Supabase, en revanche, il n'y a rien à attendre : `localSeul` immédiatement,
   * sinon Cadence deviendrait inutilisable en développement sans `.env`.
   */
  const [etatBascule, setEtatBascule] = useState<EtatBascule>(clientSource ? { statut: "interrogation" } : { statut: "localSeul" });
  const [echecEnregistrement, setEchecEnregistrement] = useState<string | null>(null);
  const [horodatageEnregistrement, setHorodatageEnregistrement] = useState<string | null>(null);
  const [decisionEnCours, setDecisionEnCours] = useState(false);
  /** Incrémenté pour redemander une lecture du serveur (bouton « réessayer », reprise après conflit). */
  const [relanceLecture, setRelanceLecture] = useState(0);
  /**
   * Empreinte de ce qui est CONFIRMÉ sur le serveur. Empêche de réécrire ce qu'on vient d'y lire ou
   * d'y écrire — sans quoi le moindre rafraîchissement de jeton relancerait une écriture inutile.
   * Canonique (clés triées), pour la même raison que dans `analyserBascule` : Postgres ne conserve pas
   * l'ordre des clés d'un JSONB.
   */
  const empreinteServeur = useRef<string | null>(null);
  /** Utilisateur dont la preuve de consentement a déjà fait l'objet d'une tentative de recopie. */
  const consentementRecopie = useRef<string | null>(null);
  /** Ce qui a déjà été interrogé, pour ne lire le serveur qu'une fois par session (et par relance). */
  const interrogationFaite = useRef<string | null>(null);

  /**
   * LE VERROU D'ÉCRITURE. Quatre situations le ferment, et chacune pour une raison distincte :
   *  - `interrogation` : on ne sait pas encore ce que porte le serveur, donc rien ne doit bouger ;
   *  - `decision` : une question est posée, et y répondre déterminera quelle version survit ;
   *  - `lectureSeule` : le serveur se tait. Écrire dans le navigateur creuserait un écart que
   *    personne n'a demandé, et dont personne ne saurait qu'il existe ;
   *  - `localSeul` : DEPUIS LA CONNEXION OBLIGATOIRE (05/08/2026), ce n'est plus « le mode local
   *    légitime » — c'est ce que porte l'app PENDANT que le mur (`EcranConnexionObligatoire.tsx`) est
   *    affiché. ⚠️ Les effets de ce fichier (dont celui qui écrit, juste en dessous) sont déclarés
   *    AVANT le `return` du mur dans le rendu : React les exécute quand même, quel que soit ce que le
   *    rendu affiche ensuite. Sans ce garde-fou, écrire ici derrière un écran qui prétend bloquer
   *    « toute utilisation » aurait été un mensonge silencieux (constaté par
   *    `App.connexionNonConfiguree.test.tsx`, « n'écrit rien dans le localStorage », avant ce correctif).
   *    Seul `active` ouvre donc l'écriture désormais.
   */
  const ecritureAutorisee = etatBascule.statut === "active";

  useEffect(() => {
    if (!lectureSaine || !donnees) return;
    // Le verrou vaut AUSSI pour l'écriture locale, et c'est le point délicat de toute la bascule :
    // sans ça, un serveur muet laisserait le navigateur continuer d'enregistrer, et la divergence
    // serait créée par l'app elle-même, en silence, sans le moindre geste de l'utilisateur.
    if (!ecritureAutorisee) return;
    // L'échec d'écriture remonte désormais à l'écran au lieu d'être avalé (filet minimal du point
    // n°2 de la critique — le sujet complet, quota plein et purge, reste ouvert).
    sauvegarderDonnees(donnees).then((resultat) => setErreurSauvegarde(resultat.ok ? null : resultat.message));
  }, [donnees, lectureSaine, ecritureAutorisee]);

  // ── La preuve du consentement, recopiée à la PREMIÈRE session ──────────────────────────────────
  //
  // Pourquoi ici et pas à l'inscription : au moment où la case est cochée, aucune session n'existe,
  // donc RLS interdit d'écrire dans `consentements` (cf. storage/consentementStorage.ts et la
  // migration 0004). La métadonnée écrite par `signUp` attend donc la première session, et c'est cet
  // effet qui la transforme en preuve durable.
  //
  // ⚠️ JAMAIS BLOQUANT, DANS AUCUN CAS. Un échec (réseau, migration 0004 pas encore appliquée) ne doit
  // empêcher personne d'utiliser Cadence : le consentement a bien été donné et sa métadonnée reste
  // intacte côté Supabase. Une tentative par session, puis on laisse tomber jusqu'à la suivante —
  // réessayer à chaque rendu martèlerait le serveur pour un archivage qui n'est pas urgent.
  useEffect(() => {
    if (session.statut !== "connecte" || !clientAuth || !clientConsentements) return;
    if (consentementRecopie.current === session.utilisateurId) return;
    consentementRecopie.current = session.utilisateurId;
    synchroniserConsentement(clientAuth, clientConsentements).then((resultat) => {
      if (resultat.statut === "echec") {
        console.error("Preuve de consentement non archivée (nouvelle tentative à la prochaine session).", resultat.message);
      }
    });
  }, [session, clientAuth, clientConsentements]);

  // ── Ce que porte le serveur, et ce qu'on en conclut ─────────────────────────────────────────────
  useEffect(() => {
    if (!lectureSaine || !donnees) return;

    // La session n'est pas encore tranchée : on ATTEND, écriture fermée. Basculer en `localSeul` ici
    // rouvrirait la fenêtre d'écriture prématurée décrite plus haut.
    if (clientSource && session.statut === "chargement") return;

    // On ne SAIT PAS si une session existe (`getSession` a échoué). Le traiter comme « déconnecté »
    // autoriserait l'écriture alors que le serveur porte peut-être des données pour cet utilisateur :
    // on préfère dire l'ignorance et ne rien écrire (même principe que le statut « illisible » du
    // `localStorage`).
    //
    // ⚠️ CE `lectureSeule` N'ATTEINT JAMAIS L'ÉCRAN, C'EST ARBITRÉ — NE PAS LE « RÉPARER ». Cette
    // branche s'exécute bel et bien (les hooks tournent tous avant le rendu), mais le mur
    // `EcranConnexionObligatoire` rend l'écran de connexion À LA PLACE de toute l'app dès que la
    // session n'est pas `connecte` : le bandeau de lecture seule n'est donc jamais affiché.
    // Le cas réel qui y mène : hors ligne depuis plus d'une heure (durée du jeton), le
    // rafraîchissement échoue faute de réseau et `@supabase/auth-js@2.112.0` rend une ERREUR — pas
    // « déconnecté », contrairement à ce que ce commentaire affirmait jusqu'au 06/08/2026 (lu dans
    // `GoTrueClient.__loadSession`, pas supposé).
    // Benoît a tranché le 06/08/2026, trois options présentées : ON NE CHANGE RIEN. Le mur reste,
    // Cadence est inutilisable hors ligne au-delà d'une heure, et c'est assumé (cf. décision 2 de la
    // phase 5 dans `CLAUDE.md`).
    // On garde quand même cet état, et ce n'est pas décoratif : lui seul FERME L'ÉCRITURE
    // (`ecritureAutorisee` n'accepte que `active`), or l'effet de sauvegarde ci-dessus tourne même
    // quand le mur est à l'écran. Le supprimer rouvrirait l'écriture pendant qu'on ignore ce que
    // porte le serveur — exactement la divergence que la bascule interdit.
    if (clientSource && session.statut === "indetermine") {
      setEtatBascule({ statut: "lectureSeule", message: session.detail });
      return;
    }

    if (session.statut !== "connecte" || !clientSource) {
      // Pas de session (ou pas de configuration) : ce navigateur suffit, et il n'y a rien à afficher.
      setEtatBascule({ statut: "localSeul" });
      empreinteServeur.current = null;
      interrogationFaite.current = null;
      return;
    }

    const cle = `${session.utilisateurId}#${relanceLecture}`;
    if (interrogationFaite.current === cle) return;
    interrogationFaite.current = cle;

    let annule = false;
    setEtatBascule({ statut: "interrogation" });
    lireEtatServeur(clientSource, session.utilisateurId).then((etat) => {
      if (annule) return;
      appliquerBascule(analyserBascule(donnees, etat));
    });

    return () => {
      annule = true;
    };
    // `donnees` est lu ici mais volontairement absent des dépendances : cet effet ne doit PAS se
    // relancer à chaque saisie, seulement quand la session ou une relance l'exige. Le garde
    // `interrogationFaite` suffirait, mais l'omission rend l'intention explicite — et l'écriture est
    // de toute façon fermée pendant l'interrogation, donc `donnees` ne peut pas changer entre-temps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureSaine, session, clientSource, relanceLecture]);

  /**
   * Traduit un verdict d'ouverture en état d'application.
   *
   * Les deux seules branches qui touchent aux données sont celles que `analyserBascule` a déjà
   * jugées incapables de détruire quoi que ce soit (cf. son en-tête) : adopter le serveur quand le
   * navigateur est vide, et ne rien faire quand les deux côtés concordent.
   */
  function appliquerBascule(bascule: Bascule) {
    switch (bascule.genre) {
      case "serveurEnPhase":
        empreinteServeur.current = texteCanonique(donnees);
        setEtatBascule({ statut: "active", jeton: bascule.jeton });
        return;

      case "premierLancement":
        // Rien de part ni d'autre : la première écriture sera une insertion, d'où le jeton `null`.
        empreinteServeur.current = null;
        setEtatBascule({ statut: "active", jeton: null });
        return;

      case "adopterServeur":
        // Le navigateur est vide : on prend le serveur sans rien détruire. L'empreinte est posée
        // AVANT, pour que l'effet d'écriture ne renvoie pas aussitôt au serveur ce qu'il vient d'en
        // lire. La copie locale, elle, sera rafraîchie par l'effet de sauvegarde.
        empreinteServeur.current = texteCanonique(bascule.donnees);
        setDonneesBrut(bascule.donnees);
        setEtatBascule({ statut: "active", jeton: bascule.jeton });
        return;

      case "serveurMuet":
        setEtatBascule({ statut: "lectureSeule", message: bascule.message });
        return;

      default:
        setEtatBascule({ statut: "decision", bascule });
    }
  }

  // ── L'enregistrement sur le serveur, sous condition ─────────────────────────────────────────────
  useEffect(() => {
    if (!lectureSaine || !donnees) return;
    if (etatBascule.statut !== "active" || !clientSource || session.statut !== "connecte") return;

    const empreinte = texteCanonique(donnees);
    if (empreinteServeur.current === empreinte) return;

    let annule = false;
    ecrireEtatServeur(clientSource, session.utilisateurId, donnees, etatBascule.jeton).then((resultat) => {
      if (annule) return;
      switch (resultat.statut) {
        case "ecrit":
          empreinteServeur.current = empreinte;
          setEchecEnregistrement(null);
          setHorodatageEnregistrement(resultat.jeton);
          setEtatBascule({ statut: "active", jeton: resultat.jeton });
          return;

        case "ecritJetonPerdu":
          // L'écriture A eu lieu : ne jamais l'annoncer comme un échec. Il manque seulement la
          // nouvelle version, donc on relit pour la retrouver avant d'écrire à nouveau.
          empreinteServeur.current = empreinte;
          setEchecEnregistrement(null);
          setRelanceLecture((v) => v + 1);
          return;

        case "conflit":
          // Quelqu'un d'autre a écrit entre-temps. On ne force RIEN : on relit, et la comparaison
          // conduira à l'écran de décision si les deux versions diffèrent réellement.
          setRelanceLecture((v) => v + 1);
          return;

        default:
          // On ne mémorise pas l'empreinte : la prochaine modification réessaiera. Et surtout, on ne
          // prétend pas avoir enregistré — c'est ce que dit le témoin de la section « Compte ».
          setEchecEnregistrement(resultat.message);
      }
    });

    return () => {
      annule = true;
    };
  }, [donnees, etatBascule, clientSource, session, lectureSaine]);

  /**
   * Le seul chemin d'écriture pour tout le reste de l'app.
   *
   * Porte le nom qu'avait le `setState` d'origine, donc les seize appels existants n'ont pas bougé :
   * le verrou s'installe en UN endroit, et aucun appelant ne peut l'oublier. Un refus ne se contente
   * pas de ne rien faire — il le DIT, via le bandeau déjà en place. Un formulaire qui n'a aucun effet
   * et ne s'explique pas serait pris pour une panne, et surtout : quelqu'un croirait avoir enregistré.
   */
  function setDonnees(maj: DonneesApp | null | ((precedent: DonneesApp | null) => DonneesApp | null)) {
    if (!ecritureAutorisee) {
      setRefusEcriture(
        etatBascule.statut === "lectureSeule"
          ? "Cadence est en lecture seule : le serveur ne répond pas. Ta modification n'a PAS été enregistrée — reprends-la quand la connexion sera rétablie."
          : "Cadence attend ta réponse sur la version à conserver. Rien n'est enregistré tant que la question n'est pas tranchée.",
      );
      return;
    }
    setDonneesBrut(maj as Parameters<typeof setDonneesBrut>[0]);
  }

  /**
   * « Garder ce navigateur » : envoie l'état local sur le serveur, en remplaçant ce qu'il portait.
   *
   * Le jeton distingue les deux situations, et cette distinction EST la protection : pour
   * `aTeleverser` aucune ligne n'existait, donc insertion — qui échouera si une ligne est apparue
   * entre-temps ; ailleurs, on remplace précisément la version qu'on a lue, et pas une autre.
   */
  async function televerserNavigateur(bascule: BasculeADecider, local: DonneesApp) {
    if (!clientSource || session.statut !== "connecte") return;
    setDecisionEnCours(true);
    const resultat = await ecrireEtatServeur(clientSource, session.utilisateurId, local, bascule.genre === "aTeleverser" ? null : bascule.jeton);
    setDecisionEnCours(false);

    switch (resultat.statut) {
      case "ecrit":
        empreinteServeur.current = texteCanonique(local);
        setEchecEnregistrement(null);
        setHorodatageEnregistrement(resultat.jeton);
        setEtatBascule({ statut: "active", jeton: resultat.jeton });
        return;

      case "ecritJetonPerdu":
        empreinteServeur.current = texteCanonique(local);
        setEchecEnregistrement(null);
        setRelanceLecture((v) => v + 1);
        return;

      case "conflit":
        // Un troisième écrivain est passé pendant que l'écran était affiché. On relit plutôt que
        // d'insister : la question doit être reposée sur la version réellement en place.
        setRelanceLecture((v) => v + 1);
        return;

      default:
        setEchecEnregistrement(resultat.message);
    }
  }

  /**
   * « Prendre le serveur » : la version serveur devient celle de ce navigateur.
   *
   * Aucune écriture serveur ici — il porte déjà cette version. L'empreinte est posée AVANT le
   * changement d'état pour que l'effet d'enregistrement ne renvoie pas au serveur ce qu'il vient d'en
   * lire ; la copie locale, elle, est rafraîchie par l'effet de sauvegarde.
   */
  function adopterVersionServeur(donneesServeur: DonneesApp, jeton: Jeton) {
    empreinteServeur.current = texteCanonique(donneesServeur);
    setDonneesBrut(donneesServeur);
    setEchecEnregistrement(null);
    setEtatBascule({ statut: "active", jeton });
  }

  /** L'état de l'enregistrement, tel que la section « Compte » a le droit de l'affirmer. */
  const etatEnregistrement: EtatEnregistrement = (() => {
    if (etatBascule.statut === "localSeul") return { statut: "inactif" };
    if (etatBascule.statut === "lectureSeule") return { statut: "lectureSeule", message: etatBascule.message };
    if (echecEnregistrement !== null) return { statut: "echec", message: echecEnregistrement };
    if (etatBascule.statut === "interrogation") return { statut: "encours" };
    if (horodatageEnregistrement !== null) return { statut: "enregistre", horodatage: horodatageEnregistrement };
    return { statut: "inactif" };
  })();

  const calculs = useMemo(() => {
    if (!donnees?.profil) return null;
    const profil = donnees.profil;
    const { contrats, periodes } = donnees;
    const config = franceTravailConfig;

    // calculerFenetreEnCours (pas calculerFenetreReference seule) : la borne de réadmission du cycle
    // en cours doit toujours être dérivée de dateAnniversaire, jamais lue depuis
    // dateAnniversairePrecedente tel quel — réservé à sa vraie vocation historique (cf. engine/cycles.ts,
    // engine/periodeReference.ts pour le détail complet du conflit corrigé le 31/07/2026).
    const fenetre = calculerFenetreEnCours(profil, contrats, periodes, config, dateDuJour);
    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, fenetre);
    const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, fenetre);
    const ajBrute = calculerAJBrutePourFenetre(fenetre, decompte.total, sar ?? sr, nht, config);
    // Corrigé le 31/07/2026 (chantier renouvellement anticipé, cas E1) : le SJM (base des cotisations
    // — retraite complémentaire, CSG/CRDS) doit être calculé sur le MÊME salaire retenu que l'AJ
    // brute, `sar ?? sr` — jamais `sr` seul quand un SAR s'applique. Confirmé par le simulateur
    // officiel France Travail (simucalcul.pole-emploi-services.fr, 31/07/2026) : il n'expose qu'un
    // champ « salaire de référence » unique, utilisé identiquement partout en aval — pas de second
    // calcul possible sur le SR brut une fois le SAR retenu. Avant ce correctif, la retraite
    // complémentaire (et donc l'AJ nette) était sous-évaluée en présence d'un SAR, un faux "vert"
    // (devoir sacré n°2) : SAR > SR par construction (même numérateur, dénominateur réduit).
    const sjm = calculerSJM(sar ?? sr, nht, config);
    const ajNette = calculerAJNette(ajBrute.brut, sjm, profil, config);
    const prediction = calculerStatutPrediction(profil, contrats, periodes, config, dateDuJour);
    const dateCap = diffJours(dateDuJour, fenetre.dateFin) >= 0 ? dateDuJour : fenetre.dateFin;
    const serie = construireSerieAcquisition(profil, contrats, periodes, config, fenetre, dateCap);
    const serieAVenir = construireSerieAVenir(profil, contrats, periodes, config, fenetre, dateCap);
    const alertes = detecterAlertes(profil, contrats, periodes, config, dateDuJour, donnees.soldeIndemnisationDepart);
    const exercicesCalcules = decouperExercices(profil, contrats, periodes, config, dateDuJour);
    // Un exercice déjà figé (donnees.exercicesGeles) n'est plus jamais recalculé — un import ou une
    // nouvelle FCT ne doit plus changer silencieusement l'AJ affichée pour un cycle déjà clos (cf.
    // engine/cycles.ts, fusionnerExercicesGeles). `aGeler` est persisté à part, dans le useEffect
    // ci-dessous (ce useMemo reste une fonction pure, aucun effet de bord ici).
    const { exercices, aGeler } = fusionnerExercicesGeles(exercicesCalcules, donnees.exercicesGeles);

    return { fenetre, decompte, ajBrute, ajNette, prediction, dateCap, serie, serieAVenir, alertes, exercices, aGeler, sr, nht, sar };
  }, [donnees]);

  // Fige, une fois pour toutes, tout exercice qui vient de clôturer (cf. calculs.aGeler ci-dessus) —
  // effet de bord volontairement séparé du useMemo pur : écrit dans `donnees.exercicesGeles`, ce qui
  // déclenche l'auto-sauvegarde existante (useEffect ci-dessus) comme tout autre changement de
  // `donnees`. Sans nouvel exercice à figer, `calculs.aGeler` est un tableau vide et ce useEffect ne
  // touche jamais `donnees` (pas de boucle, pas d'écriture superflue).
  useEffect(() => {
    if (!calculs || calculs.aGeler.length === 0) return;
    // ⚠️ TESTÉ AVANT `setDonnees`, ET NON DÉLÉGUÉ À LUI : c'est la seule écriture que l'app déclenche
    // toute seule. Passer par le verrou afficherait le bandeau « ta modification n'a pas été
    // enregistrée » sans que personne n'ait rien saisi — une alerte incompréhensible, donc une
    // fausse alerte. Ici, ne rien faire est le bon comportement : au prochain rendu, `aGeler`
    // reproposera ces exercices, et ils seront figés dès que le serveur répondra.
    if (!ecritureAutorisee) return;
    setDonnees((d) => {
      if (!d) return d;
      const nouveauxGeles = { ...d.exercicesGeles };
      for (const exercice of calculs.aGeler) nouveauxGeles[exercice.id] = exercice;
      return { ...d, exercicesGeles: nouveauxGeles };
    });
  }, [calculs?.aGeler, ecritureAutorisee]);

  // LE MUR (05/08/2026) : décision de Benoît, prise en dehors du plan de la phase 6 — Cadence exige
  // désormais un compte pour être utilisée, sans exception. Placé AVANT tout le reste du rendu (avant
  // même l'écran de récupération de données illisibles ci-dessous) : c'est la lecture la plus stricte
  // de « sans compte, pas d'utilisation ». Ne bloque rien d'autre : le mécanisme de bascule (phase 5,
  // juste en dessous) suppose déjà une session pour s'activer et n'a besoin d'aucun changement.
  if (session.statut !== "connecte") {
    return <EcranConnexionObligatoire session={session} client={clientAuth} />;
  }

  /*
   * RETOUR DU LIEN DE RÉINITIALISATION (06/08/2026) — placé JUSTE APRÈS le mur, et l'ordre compte.
   *
   * Ce lien OUVRE UNE SESSION : c'est ce qui autorise `updateUser` sans connaître l'ancien mot de
   * passe. Sans cet écran, la session étant valide, le mur ci-dessus se tairait, ce rendu continuerait,
   * et l'utilisateur atterrirait sur son tableau de bord SANS qu'on lui ait jamais demandé de nouveau
   * mot de passe — donc toujours avec celui qu'il a oublié. Le parcours « mot de passe oublié »
   * n'aurait rien réinitialisé du tout, en silence.
   *
   * Le marqueur est lu dans `INDICE_RETOUR_LIEN`, capturé À L'IMPORT du module (la bibliothèque nettoie
   * l'URL, un composant arriverait trop tard). `reinitialisationFaite` est le seul moyen de quitter cet
   * écran : un état local, et non une relecture de l'URL, parce que l'URL a justement été nettoyée.
   */
  if (indiceRetour.reinitialisation && !reinitialisationFaite) {
    return (
      <EcranNouveauMotDePasse
        client={clientAuth}
        onTermine={() => {
          setReinitialisationFaite(true);
          // Fait taire le bandeau du mur (`EcranConnexionObligatoire`) si l'utilisateur se déconnecte
          // ensuite dans cet onglet — cf. `marquerReinitialisationReussie` dans `retourLienMagique.ts`.
          marquerReinitialisationReussie();
          // Le marqueur est retiré de l'URL pour qu'un simple rechargement ne repropose pas l'écran
          // alors que le mot de passe est déjà changé. `replaceState` et non `location.href` : on ne
          // veut ni rechargement ni entrée d'historique supplémentaire.
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete(MARQUEUR_REINITIALISATION);
            window.history.replaceState(null, "", url.toString());
          }
        }}
      />
    );
  }

  // Écran bloquant : ni navigation, ni onboarding, ni tableau de bord à vide — l'utilisateur ne doit
  // jamais voir une app « neuve » alors que ses données sont peut-être intactes et récupérables.
  if (chargement?.statut === "illisible") {
    return (
      <EcranDonneesIllisibles
        brut={chargement.brut}
        detail={chargement.detail}
        sauvegarde={chargement.sauvegarde}
        // `setDonneesBrut` et non `setDonnees` : ces deux gestes ont DÉJÀ écrit dans le navigateur
        // (`restaurerSauvegarde`, `reinitialiserDonnees`) et sont explicitement décidés par
        // l'utilisateur. Les faire passer par le verrou refuserait de mettre à jour l'affichage après
        // une écriture pourtant réussie — l'écran resterait bloqué sans raison compréhensible.
        onRestaurer={() => {
          const restaurees = chargement.sauvegarde;
          if (!restaurees) return;
          restaurerSauvegarde(restaurees).then(() => {
            setDonneesBrut(restaurees);
            setChargement({ statut: "ok", donnees: restaurees });
          });
        }}
        onRepartirDeZero={() => {
          reinitialiserDonnees().then((vides) => {
            setDonneesBrut(vides);
            setChargement({ statut: "ok", donnees: vides });
          });
        }}
      />
    );
  }

  if (!donnees) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Chargement…</div>;
  }

  // Second écran bloquant, pour la même raison que le premier : personne ne doit pouvoir saisir un
  // contrat pendant qu'une question sur la version à conserver est en suspens — la réponse déterminera
  // quelle version survit. Placé APRÈS le test `!donnees` : sans état local lu, il n'y aurait rien à
  // comparer ni à proposer.
  if (etatBascule.statut === "decision") {
    const bascule = etatBascule.bascule;
    return (
      <DecisionServeur
        bascule={bascule}
        local={donnees}
        enCours={decisionEnCours}
        erreur={echecEnregistrement}
        onReessayer={() => setRelanceLecture((v) => v + 1)}
        onGarderNavigateur={() => televerserNavigateur(bascule, donnees)}
        // Le bouton « prendre le serveur » n'existe que pour une divergence — les autres genres n'ont
        // pas de version serveur lisible à adopter. Le garde n'est donc pas défensif pour rien : il
        // est ce qui rend le type exact, puisque `aTeleverser` ne porte aucun jeton.
        onPrendreServeur={(donneesServeur) => {
          if (bascule.genre !== "divergence") return;
          adopterVersionServeur(donneesServeur, bascule.jeton);
        }}
      />
    );
  }

  // Machinerie d'import, définie UNE fois et rendue dans les deux branches (onboarding et app
  // complète) — point 23 de docs/critique_2026-08-03.md. Aucune logique ici : le sélecteur de
  // fichier et la confirmation ne font que remplir `fichierEnAttenteImport` puis appeler
  // `confirmerImport`, exactement le même chemin qu'avant. C'est le fond du correctif : l'import
  // n'était pas techniquement dépendant du profil (`confirmerImport` teste `!donnees`, jamais
  // `donnees.profil`, et le schéma d'écriture déclare `profil` nullable) — seul un `return`
  // anticipé de rendu le rendait inatteignable. On lève la contrainte d'affichage, on ne crée pas
  // un second chemin d'écriture.
  const machinerieImport = (
    <>
      <input
        ref={inputImportRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          if (fichier) setFichierEnAttenteImport(fichier);
          e.target.value = ""; // permet de resélectionner le même fichier ensuite
        }}
      />
      {fichierEnAttenteImport && (
        <ConfirmationImport
          nbContratsActuels={donnees.contrats.length}
          profilActuel={Boolean(donnees.profil)}
          nomFichier={fichierEnAttenteImport.name}
          enCours={importEnCours}
          onAnnuler={() => setFichierEnAttenteImport(null)}
          onConfirmer={confirmerImport}
        />
      )}
    </>
  );

  if (!donnees.profil) {
    return (
      <>
        <Onboarding
          onTerminer={(profil: Profil) => setDonnees({ ...donnees, profil })}
          onRestaurerSauvegarde={() => inputImportRef.current?.click()}
          erreurImport={erreurImport}
          serveurFaitReference={etatBascule.statut === "active"}
        />
        {machinerieImport}
      </>
    );
  }

  const profil = donnees.profil;

  /**
   * Refuse un contrat qui viole une règle d'intégrité d'écriture. Deux règles à ce jour, chacune dans
   * son module avec son pourquoi :
   *   - couvrir deux mois civils (lib/contratUnSeulMois.ts, point 7) ;
   *   - être en territoire EEE sans jours travaillés, ou avec des cachets/heures que le décompte
   *     ignore (lib/contratTerritoireEEE.ts, point 17).
   * Placé ici, sur les fonctions d'écriture, et NON dans un schéma Zod : celui de lecture
   * rendrait illisible un fichier légitime, celui d'écriture valide le jeu de données entier et
   * bloquerait toute sauvegarde à cause d'un seul contrat hérité (devoir sacré n°1 dans les deux cas).
   * Ces trois fonctions sont le seul point de passage commun à toutes les portes d'écriture :
   * ContractForm, ContractList (édition), ImportBulletins, RevueExtraction (IA).
   * Retourne `false` et affiche le bandeau quand le contrat est refusé — jamais un rejet silencieux.
   * Les règles sont évaluées dans l'ordre et le premier refus gagne : chaque message nomme UNE action
   * à faire, en enchaîner deux dans le même bandeau les rendrait illisibles.
   */
  function refuserContratNonConforme(contrats: Omit<Contrat, "id">[]): boolean {
    const verdict = [validerContratsPourEcriture(contrats), validerContratsEEEPourEcriture(contrats)].find((v) => !v.ok);
    setRefusEcriture(verdict === undefined || verdict.ok ? null : verdict.message);
    return verdict !== undefined && !verdict.ok;
  }

  function ajouterContrat(partiel: Omit<Contrat, "id">) {
    if (refuserContratNonConforme([partiel])) return;
    setDonnees((d) => (d ? { ...d, contrats: [...d.contrats, creerContrat(partiel)] } : d));
  }

  function supprimerContrat(id: string) {
    setDonnees((d) => (d ? { ...d, contrats: d.contrats.filter((c) => c.id !== id) } : d));
  }

  /**
   * Remplace TOUS les champs d'un contrat existant (id inchangé) — n'existait pas avant le 01/08/2026
   * (seuls ajouterContrat/supprimerContrat existaient). Deux appelants : l'édition libre depuis
   * ContractList.tsx (préserve explicitement statutVerification, cf. son commentaire) et la
   * confirmation de correspondance AEM depuis RevueExtraction.tsx (bascule statutVerification à
   * "confirme" avec les valeurs du document) — chacun décide de statutVerification à l'appel, cette
   * fonction ne fait que remplacer, aucune règle métier ici (même esprit que ajouterContrat).
   */
  function modifierContrat(id: string, nouveauContrat: Omit<Contrat, "id">) {
    if (refuserContratNonConforme([nouveauContrat])) return;
    setDonnees((d) => (d ? { ...d, contrats: d.contrats.map((c) => (c.id === id ? { ...nouveauContrat, id } : c)) } : d));
  }

  function ajouterPeriode(partiel: Omit<PeriodeAssimilee, "id">) {
    setDonnees((d) => (d ? { ...d, periodes: [...d.periodes, creerPeriode(partiel)] } : d));
  }

  function supprimerPeriode(id: string) {
    setDonnees((d) => (d ? { ...d, periodes: d.periodes.filter((p) => p.id !== id) } : d));
  }

  /**
   * Efface le gel d'un exercice (cf. engine/cycles.ts, fusionnerExercicesGeles) — filet de
   * rattrapage manuel pour un exercice figé à tort (bug réel signalé le 31/07/2026). Ne recalcule
   * rien ici : au prochain rendu, `calculs.aGeler` le reproposera si toujours clos, et le useEffect
   * ci-dessus le regèlera automatiquement avec les données actuelles.
   */
  function viderExerciceGele(id: string) {
    setDonnees((d) => {
      if (!d) return d;
      const { [id]: _ignore, ...reste } = d.exercicesGeles;
      return { ...d, exercicesGeles: reste };
    });
  }

  function ajouterContratsRecurrents(contrats: Contrat[]) {
    // Le générateur (lib/contratRecurrent.ts) cale déjà chaque contrat sur un mois civil ; ce garde
    // est là pour que la règle ne dépende pas de cette promesse, et tienne si le générateur change.
    if (refuserContratNonConforme(contrats)) return;
    setDonnees((d) => (d ? { ...d, contrats: [...d.contrats, ...contrats] } : d));
  }

  function supprimerSerie(recurrenceId: string) {
    setDonnees((d) => (d ? { ...d, contrats: d.contrats.filter((c) => c.recurrenceId !== recurrenceId) } : d));
  }

  function configurerSoldeIndemnisation(solde: SoldeIndemnisationDepart) {
    setDonnees((d) => (d ? { ...d, soldeIndemnisationDepart: solde } : d));
  }


  // Rempart devoir n°1 : forme (Zod) puis cohérence (situation/date), jamais l'un sans l'autre.
  // Pas de fichier de sauvegarde téléchargé ici (contrairement à l'import, qui remplace TOUT) —
  // le garde-fou tient par construction : setDonnees n'est jamais appelé tant que le candidat n'a
  // pas passé validerProfilPourEcriture, donc l'ancien profil valide reste en place sans risque.
  function modifierProfil(candidat: Profil) {
    const resultat = validerProfilPourEcriture(candidat);
    if (!resultat.ok) return resultat;
    setDonnees((d) => (d ? { ...d, profil: resultat.profil } : d));
    return resultat;
  }

  function exporter() {
    telechargerTexte(`cadence-export-${dateDuJour}.json`, exporterJSON(donnees!));
  }

  /**
   * Ordre non négociable (devoir sacré n°1) :
   *   1. sauvegarde de secours de l'état actuel → téléchargée, inconditionnellement ;
   *   2. validation complète du fichier importé (JSON valide + schemaVersion + forme Zod) ;
   *   3. écriture du nouvel état UNIQUEMENT si (2) a réussi.
   * Si (2) lève, on tombe dans le catch : setDonnees n'est jamais appelé, l'état
   * existant n'a donc pas bougé — la sauvegarde de l'étape 1 reste disponible.
   */
  async function confirmerImport() {
    if (!fichierEnAttenteImport || !donnees) return;
    setImportEnCours(true);
    try {
      telechargerTexte(`cadence-sauvegarde-avant-import-${dateDuJour}.json`, exporterJSON(donnees)); // (1)
      const texte = await fichierEnAttenteImport.text();
      const importees = importerJSON(texte); // (2) — lève si invalide, rien n'est écrit
      setDonnees(importees); // (3)
      setErreurImport(null);
    } catch (erreur) {
      setErreurImport(erreur instanceof Error ? erreur.message : "Fichier invalide : ce n'est pas un export Cadence reconnu.");
    } finally {
      setImportEnCours(false);
      setFichierEnAttenteImport(null);
    }
  }

  // Statut de périmètre calculé une seule fois : `bloquant` masque tout un onglet (déclaration
  // explicite), `contradictionHorsA10` laisse l'app utilisable mais marque les montants ARE comme
  // non fiables partout où ils apparaissent (cf. lib/profilHorsPerimetre.ts).
  const perimetre = profilHorsPerimetre(profil);
  const contradictionHorsA10 = perimetre.motif === "salaires_hors_a10_contradictoires";
  const bandeauContradiction = contradictionHorsA10 ? <AvertissementContradictionHorsA10 onAllerVersProfil={() => setOnglet("profil")} /> : null;
  // Le tableau de bord est le seul écran où le centre d'alertes et le bandeau coexistent : sans ce
  // filtrage, la contradiction y serait écrite deux fois de suite (cf. lib/alertesAffichage.ts).
  // L'alerte reste comptée par AlertCenterResume ci-dessous, sur tous les onglets.
  const centreAlertes = centreAlertesPourEcran(calculs?.alertes ?? [], contradictionHorsA10);

  return (
    <div className="min-h-screen">
      {/* Point n°2 de la critique : une écriture qui échoue (stockage plein, navigation privée) ne
          disparaît plus dans la console — et depuis le 04/08/2026 le bandeau permet d'AGIR sans quitter
          l'écran : export immédiat, occupation réelle mesurée clé par clé, suppression de la copie de
          quarantaine sur clic explicite. Non refermable : tant qu'il est là, ce que l'utilisateur
          saisit n'est PAS enregistré. Détail des choix dans components/BandeauStockagePlein.tsx. */}
      {erreurSauvegarde !== null && <BandeauStockagePlein erreur={erreurSauvegarde} onExporter={exporter} />}
      {/* Phase 5 : le serveur ne répond pas (pause du palier gratuit, réseau, jeton expiré). En
          PREMIER, avant tout le reste : c'est le bandeau qui conditionne la lecture de tous les
          chiffres affichés en dessous — ils viennent de la copie locale et peuvent être en retard. */}
      {etatBascule.statut === "lectureSeule" && (
        <BandeauLectureSeule message={etatBascule.message} onExporter={exporter} onReessayer={() => setRelanceLecture((v) => v + 1)} />
      )}
      {/* L'écriture serveur a échoué alors que l'app fonctionne : la saisie est dans ce navigateur mais
          pas à l'endroit qui fait référence. Visible partout, et pas seulement dans l'onglet « Mon
          profil » — la section « Compte » est trop peu trouvable pour porter seule cette information. */}
      {echecEnregistrement !== null && etatBascule.statut === "active" && <BandeauEchecEnregistrement message={echecEnregistrement} onExporter={exporter} />}
      {/* Contrat refusé parce qu'il couvre deux mois civils (cf. lib/contratUnSeulMois.ts). Même motif
          que le bandeau de sauvegarde ci-dessus, mais surtout PAS le même texte : ce sont deux échecs
          de nature différente, et les confondre dirait à l'utilisateur une raison fausse (le devoir
          sacré n°2 vaut aussi pour « dire la bonne raison », pas seulement pour les chiffres).
          « Refusé » et non « non enregistré » : Cadence a délibérément décliné une saisie, le stockage
          n'a rien à voir là-dedans. Ambre et refermable, là où le bandeau de stockage est rouge et
          permanent : ici rien n'est en péril, il y a juste une saisie à refaire en deux fois. */}
      {refusEcriture !== null && (
        <div role="alert" className="bg-amber/15 text-amber px-6 py-3 text-sm flex items-start justify-between gap-4">
          <span>
            <strong className="font-medium">Contrat refusé.</strong> {refusEcriture} Aucune de tes données existantes n'a été modifiée.
          </span>
          <button type="button" onClick={() => setRefusEcriture(null)} className="text-amber/70 hover:text-amber shrink-0" aria-label="Fermer l'avertissement">
            ✕
          </button>
        </div>
      )}
      {/* Cf. le commentaire de `avertissementLienFerme` plus haut : symétrique du bandeau de
          `EcranConnexionObligatoire`, pour le cas où une session est déjà active. Texte partagé via
          `texteAvertissementLienConnecte` (retourLienMagique.ts) plutôt que dupliqué ici. */}
      {avertissementLien !== null && !avertissementLienFerme && (
        <div role="alert" className="bg-amber/15 text-amber px-6 py-3 text-sm flex items-start justify-between gap-4">
          <span>
            <strong className="font-medium">{avertissementLien.titre}</strong> {avertissementLien.detail}
          </span>
          <button type="button" onClick={() => setAvertissementLienFerme(true)} className="text-amber/70 hover:text-amber shrink-0" aria-label="Fermer l'avertissement">
            ✕
          </button>
        </div>
      )}
      <TopBar
        ongletActif={onglet}
        onChangerOnglet={setOnglet}
        periodeLabel={profil.dateAnniversaire ? `Cycle → ${profil.dateAnniversaire}` : "Première admission"}
      />

      <main className="max-w-[1040px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Même correction que DashboardVide, l'autre bout du faux signal : sans contrat, les
              alertes prédictives (ex. "rythme insuffisant") ne veulent rien dire pour un compte
              neuf. On ne les fait pas fuiter via ce chip, visible sur tous les onglets. L'alerte
              "situation_mixte" reste affichée dans tous les cas : elle est vraie indépendamment
              du nombre de contrats. */}
          <AlertCenterResume alertes={dashboardEstVide(donnees.contrats) && !profilHorsPerimetre(profil).horsPerimetre ? [] : (calculs?.alertes ?? [])} />
          <div className="flex items-center gap-2 text-xs">
            <button onClick={exporter} className="px-3 py-1.5 rounded-full border border-line text-muted hover:text-ink transition-colors">
              Exporter mes données (JSON)
            </button>
            <button onClick={() => inputImportRef.current?.click()} className="px-3 py-1.5 rounded-full border border-line text-muted hover:text-ink transition-colors">
              Importer
            </button>
          </div>
        </div>
        {erreurImport && <p className="text-sm text-red">{erreurImport}</p>}

        {machinerieImport}

        {onglet === "dashboard" &&
          calculs &&
          (perimetreBloquant(profil) ? (
            <AvertissementHorsPerimetre />
          ) : dashboardEstVide(donnees.contrats) ? (
            <DashboardVide onAllerVersContrats={() => setOnglet("contrats")} />
          ) : (
            <>
              {centreAlertes.afficherCentre && <AlertCenter alertes={centreAlertes.alertes} />}
              {bandeauContradiction}
              <Dashboard
                montantsNonFiables={contradictionHorsA10}
                prediction={calculs.prediction}
                serie={calculs.serie}
                serieAVenir={calculs.serieAVenir}
                fenetreDebut={calculs.fenetre.dateDebut}
                dateCap={calculs.dateCap}
                decompte={calculs.decompte}
                ajBrute={calculs.ajBrute}
                ajNette={calculs.ajNette}
                sr={calculs.sr}
                nht={calculs.nht}
                sar={calculs.sar}
              />
            </>
          ))}

        {onglet === "contrats" && calculs && (
          <div className="space-y-6">
            {/* Masqué pendant une édition (cf. le commentaire sur contratEnEdition ci-dessus) : deux
                <ContractForm> montés en même temps partageraient les mêmes `id` de champs. */}
            {!contratEnEdition && (
              <ContractForm profil={profil} config={franceTravailConfig} decompteActuel={calculs.decompte} onValider={ajouterContrat} onValiderRecurrent={ajouterContratsRecurrents} />
            )}
            <ContractList
              profil={profil}
              contrats={donnees.contrats}
              config={franceTravailConfig}
              decompteActuel={calculs.decompte}
              onSupprimer={supprimerContrat}
              onSupprimerSerie={supprimerSerie}
              onModifierContrat={modifierContrat}
              contratEnEdition={contratEnEdition}
              onChangerContratEnEdition={setContratEnEdition}
            />
          </div>
        )}

        {onglet === "import" && calculs && (
          <div className="space-y-6">
            {/* AU-DESSUS des deux blocs qui suivent, et volontairement pas dans l'un d'eux : savoir
                quel document aller chercher précède le fait d'en déposer un, et cette information
                est NEUTRE au canal — une saisie manuelle éteint un manque exactement comme un import
                (cf. lib/documentsRequis.ts, qui ne lit que les données enregistrées). */}
            <ChecklistDocuments profil={profil} contrats={donnees.contrats} />

            {/* Parcours en deux temps, rendu explicite par la numérotation des deux titres : avec
                l'arrivée d'un second bouton de redirection (§ci-dessous), un bloc unique aurait mêlé
                « aller chercher le fichier » et « le déposer ici », deux étapes qui se suivent mais ne
                se confondent pas. Étape 1 seule, avant les deux canaux d'import : elle ne dépend
                d'aucun des deux et ne doit pas se lire comme une dépendance de l'un ou l'autre. */}
            <div>
              <h3 className="font-display text-base font-medium tracking-tight mb-3">1. Récupérer un document depuis France Travail</h3>
              <OuvrirEspacePersonnelFT />
            </div>

            <div className="border-t border-line pt-6">
              <h3 className="font-display text-base font-medium tracking-tight mb-3">2. Importer le document</h3>
              <div className="space-y-6">
                <ImportBulletins profil={profil} config={franceTravailConfig} decompteActuel={calculs.decompte} onImporterContrat={ajouterContrat} />

                {/* Deuxième canal, distinct du local ci-dessus : celui-ci envoie le document à un
                    serveur. Aucun état ni code partagé entre les deux — la seule chose commune est
                    l'onglet. L'accent visuel est ambre (et non menthe) parce que ce canal fait quitter
                    l'appareil : la couleur suit la conséquence, comme dans la modale de consentement. */}
                <div className="border-t border-line pt-6">
                  <ImportDocumentIA
                    profil={profil}
                    config={franceTravailConfig}
                    decompteActuel={calculs.decompte}
                    contrats={donnees.contrats}
                    onAjouterContrat={ajouterContrat}
                    onAjouterPeriode={ajouterPeriode}
                    onModifierProfil={modifierProfil}
                    onModifierContrat={modifierContrat}
                  />
                </div>
              </div>
            </div>

            {/* Chantier en cours : import IA premium. Replié par défaut, invisible en production
                (double garde : `import.meta.env.DEV` ici ET dans le composant). Les extractions
                sont simulées et le bac à sable n'écrit jamais dans les vraies données. */}
            {import.meta.env.DEV && (
              <details className="bg-surface border border-line rounded-card p-4">
                <summary className="cursor-pointer text-sm text-muted">Maquette — revue des extractions IA (développement)</summary>
                <div className="pt-4">
                  <RevueExtractionDemo profilReel={profil} config={franceTravailConfig} decompteActuel={calculs.decompte} />
                </div>
              </details>
            )}
          </div>
        )}

        {onglet === "historique" &&
          calculs &&
          (perimetreBloquant(profil) ? (
            <AvertissementHorsPerimetre />
          ) : (
            <div className="space-y-6">
              {bandeauContradiction}
              <Historique exercices={calculs.exercices} onEffacerGel={viderExerciceGele} montantsNonFiables={contradictionHorsA10} />
            </div>
          ))}

        {onglet === "simulateur" &&
          calculs &&
          (perimetreBloquant(profil) ? (
            <AvertissementHorsPerimetre />
          ) : (
            <div className="space-y-6">
              {bandeauContradiction}
              <Simulateur
                profil={profil}
                contrats={donnees.contrats}
                periodes={donnees.periodes}
                config={franceTravailConfig}
                dateDuJour={dateDuJour}
                decompteActuel={calculs.decompte}
                montantsNonFiables={contradictionHorsA10}
              />
            </div>
          ))}

        {onglet === "revenus" &&
          calculs &&
          (perimetreBloquant(profil) ? (
            <AvertissementHorsPerimetre />
          ) : (
            <div className="space-y-6">
              {bandeauContradiction}
              <RevenusMensuels
              profil={profil}
              soldeDepart={donnees.soldeIndemnisationDepart}
              contrats={donnees.contrats}
              periodes={donnees.periodes}
              config={franceTravailConfig}
              onConfigurerSolde={configurerSoldeIndemnisation}
              onAllerVersProfil={() => setOnglet("profil")}
                dateDuJour={dateDuJour}
              />
            </div>
          ))}

        {onglet === "profil" && (
          <MonProfil
            dateDuJour={dateDuJour}
            profil={profil}
            onModifierProfil={modifierProfil}
            contrats={donnees.contrats}
            periodes={donnees.periodes}
            onAjouterPeriode={ajouterPeriode}
            onSupprimerPeriode={supprimerPeriode}
            session={session}
            etatEnregistrement={etatEnregistrement}
            donnees={donnees}
          />
        )}

        {onglet === "fraisPro" && (
          <FraisReels
            profil={profil}
            soldeIndemnisationDepart={donnees.soldeIndemnisationDepart}
            contrats={donnees.contrats}
            config={franceTravailConfig}
            dateDuJour={dateDuJour}
            onExporterSauvegarde={exporter}
            session={session}
          />
        )}

        {onglet === "dossier" && <MonDossier />}
      </main>
    </div>
  );
}

function AlertCenterResume({ alertes }: { alertes: { niveau: string }[] }) {
  if (alertes.length === 0) return <span />;
  const critiques = alertes.filter((a) => a.niveau === "critique").length;
  const attentions = alertes.filter((a) => a.niveau === "attention").length;
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      {critiques > 0 && <span className="text-red">{critiques} alerte(s) critique(s)</span>}
      {attentions > 0 && <span className="text-amber">{attentions} à surveiller</span>}
    </div>
  );
}
