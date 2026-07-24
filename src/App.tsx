import { useEffect, useMemo, useRef, useState } from "react";
import type { Contrat, Profil, SoldeIndemnisationDepart } from "./types";
import { franceTravailConfig } from "./config/franceTravailConfig";
import { chargerDonnees, creerContrat, exporterJSON, importerJSON, sauvegarderDonnees, type DonneesApp } from "./storage/localStorageAdapter";
import { calculerFenetreReference } from "./engine/periodeReference";
import { calculerDecompteHeures } from "./engine/decompteHeures";
import { calculerSalaireReference } from "./engine/salaireReference";
import { calculerAJBrutePourFenetre } from "./engine/areBrute";
import { calculerAJNette, calculerSJM } from "./engine/areNette";
import { calculerStatutPrediction, construireSerieAcquisition, construireSerieAVenir } from "./engine/prediction";
import { detecterAlertes } from "./engine/alertes";
import { decouperExercices } from "./engine/cycles";
import { diffJours } from "./engine/dateUtils";
import { TopBar, type Onglet } from "./components/TopBar";
import { Onboarding } from "./components/Onboarding";
import { Dashboard } from "./components/Dashboard";
import { ContractForm } from "./components/ContractForm";
import { ContractList } from "./components/ContractList";
import { ImportBulletins } from "./components/ImportBulletins";
import { AlertCenter } from "./components/AlertCenter";
import { Historique } from "./components/Historique";
import { Simulateur } from "./components/Simulateur";
import { MonProfil } from "./components/MonProfil";
import { AvertissementHorsPerimetre } from "./components/AvertissementHorsPerimetre";
import { ConfirmationImport } from "./components/ConfirmationImport";
import { DashboardVide } from "./components/DashboardVide";
import { RevenusMensuels } from "./components/RevenusMensuels";
import { dashboardEstVide } from "./lib/dashboardVide";
import { profilHorsPerimetre } from "./lib/profilHorsPerimetre";
import { validerProfilPourEcriture } from "./lib/coherenceProfil";

const dateDuJour = new Date().toISOString().slice(0, 10);

export default function App() {
  const [donnees, setDonnees] = useState<DonneesApp | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("dashboard");
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [fichierEnAttenteImport, setFichierEnAttenteImport] = useState<File | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
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

    const fenetre = calculerFenetreReference(profil, contrats, periodes, config, dateDuJour);
    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, fenetre);
    const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, fenetre);
    const ajBrute = calculerAJBrutePourFenetre(fenetre, decompte.total, sar ?? sr, nht, config);
    const sjm = calculerSJM(sr, nht, config);
    const ajNette = calculerAJNette(ajBrute.brut, sjm, profil, config);
    const prediction = calculerStatutPrediction(profil, contrats, periodes, config, dateDuJour);
    const dateCap = diffJours(dateDuJour, fenetre.dateFin) >= 0 ? dateDuJour : fenetre.dateFin;
    const serie = construireSerieAcquisition(profil, contrats, periodes, config, fenetre, dateCap);
    const serieAVenir = construireSerieAVenir(profil, contrats, periodes, config, fenetre, dateCap);
    const alertes = detecterAlertes(profil, contrats, periodes, config, dateDuJour);
    const exercices = decouperExercices(profil, contrats, periodes, config, dateDuJour);

    return { fenetre, decompte, ajBrute, ajNette, prediction, dateCap, serie, serieAVenir, alertes, exercices, sr, nht, sar };
  }, [donnees]);

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
          <AlertCenterResume alertes={dashboardEstVide(donnees.contrats) && !profilHorsPerimetre(profil) ? [] : (calculs?.alertes ?? [])} />
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
          (profilHorsPerimetre(profil) ? (
            <AvertissementHorsPerimetre />
          ) : dashboardEstVide(donnees.contrats) ? (
            <DashboardVide onAllerVersContrats={() => setOnglet("contrats")} />
          ) : (
            <>
              <AlertCenter alertes={calculs.alertes} />
              <Dashboard
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
            <ContractForm profil={profil} config={franceTravailConfig} decompteActuel={calculs.decompte} onValider={ajouterContrat} onValiderRecurrent={ajouterContratsRecurrents} />
            <ContractList contrats={donnees.contrats} config={franceTravailConfig} onSupprimer={supprimerContrat} onSupprimerSerie={supprimerSerie} />
          </div>
        )}

        {onglet === "import" && calculs && (
          <ImportBulletins profil={profil} config={franceTravailConfig} decompteActuel={calculs.decompte} onImporterContrat={ajouterContrat} />
        )}

        {onglet === "historique" && calculs && (profilHorsPerimetre(profil) ? <AvertissementHorsPerimetre /> : <Historique exercices={calculs.exercices} />)}

        {onglet === "simulateur" &&
          calculs &&
          (profilHorsPerimetre(profil) ? (
            <AvertissementHorsPerimetre />
          ) : (
            <Simulateur profil={profil} contrats={donnees.contrats} periodes={donnees.periodes} config={franceTravailConfig} dateDuJour={dateDuJour} decompteActuel={calculs.decompte} />
          ))}

        {onglet === "revenus" &&
          calculs &&
          (profilHorsPerimetre(profil) ? (
            <AvertissementHorsPerimetre />
          ) : (
            <RevenusMensuels
              profil={profil}
              soldeDepart={donnees.soldeIndemnisationDepart}
              contrats={donnees.contrats}
              config={franceTravailConfig}
              onConfigurerSolde={configurerSoldeIndemnisation}
              onAllerVersProfil={() => setOnglet("profil")}
              dateDuJour={dateDuJour}
            />
          ))}

        {onglet === "profil" && <MonProfil dateDuJour={dateDuJour} profil={profil} onModifierProfil={modifierProfil} />}
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
