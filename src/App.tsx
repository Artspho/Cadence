import { useEffect, useMemo, useRef, useState } from "react";
import type { Contrat, PeriodeAssimilee, Profil, SoldeIndemnisationDepart } from "./types";
import { franceTravailConfig } from "./config/franceTravailConfig";
import { chargerDonnees, creerContrat, creerPeriode, exporterJSON, importerJSON, sauvegarderDonnees, type DonneesApp } from "./storage/localStorageAdapter";
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

const dateDuJour = new Date().toISOString().slice(0, 10);

export default function App() {
  const [donnees, setDonnees] = useState<DonneesApp | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("dashboard");
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [fichierEnAttenteImport, setFichierEnAttenteImport] = useState<File | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
  // État d'édition d'un contrat (ContractList.tsx) remonté ici : le formulaire "Nouveau contrat"
  // ci-dessous doit disparaître pendant une édition, sinon deux <ContractForm> coexistent avec les
  // mêmes `id` de champs (bug trouvé en vérifiant dans le navigateur, 01/08/2026).
  const [contratEnEdition, setContratEnEdition] = useState<Contrat | null>(null);
  const chargementTermine = useRef(false);
  const inputImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chargerDonnees().then((d) => {
      setDonnees(d);
      chargementTermine.current = true;
    });
  }, []);

  useEffect(() => {
    if (donnees && chargementTermine.current) {
      sauvegarderDonnees(donnees);
    }
  }, [donnees]);

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
    setDonnees((d) => {
      if (!d) return d;
      const nouveauxGeles = { ...d.exercicesGeles };
      for (const exercice of calculs.aGeler) nouveauxGeles[exercice.id] = exercice;
      return { ...d, exercicesGeles: nouveauxGeles };
    });
  }, [calculs?.aGeler]);

  if (!donnees) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Chargement…</div>;
  }

  if (!donnees.profil) {
    return <Onboarding onTerminer={(profil: Profil) => setDonnees({ ...donnees, profil })} />;
  }

  const profil = donnees.profil;

  function ajouterContrat(partiel: Omit<Contrat, "id">) {
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

  function declencherTelechargement(nomFichier: string, contenu: string) {
    const blob = new Blob([contenu], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exporter() {
    declencherTelechargement(`cadence-export-${dateDuJour}.json`, exporterJSON(donnees!));
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
      declencherTelechargement(`cadence-sauvegarde-avant-import-${dateDuJour}.json`, exporterJSON(donnees)); // (1)
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
      <TopBar
        ongletActif={onglet}
        onChangerOnglet={setOnglet}
        periodeLabel={profil.dateAnniversaire ? `Cycle → ${profil.dateAnniversaire}` : "Première admission"}
        dateDuJour={dateDuJour}
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
          </div>
        </div>
        {erreurImport && <p className="text-sm text-red">{erreurImport}</p>}

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
          />
        )}

        {onglet === "fraisPro" && (
          <FraisReels profil={profil} soldeIndemnisationDepart={donnees.soldeIndemnisationDepart} contrats={donnees.contrats} config={franceTravailConfig} dateDuJour={dateDuJour} />
        )}
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
