import { useEffect, useMemo, useRef, useState } from "react";
import type { Contrat, Profil, SoldeIndemnisationDepart } from "../../types";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import type { BienAmorti, ConfigFraisReels, Depense, ProfilFiscalFraisReels, RevenuImposableArtistique } from "../../types/fraisReels";
import { calculerBaseR, calculerFraisReels, genererTexteDeclaration } from "../../engine/fraisReels";
import { construireFraisKmDossier } from "../../lib/fraisKilometriquesUi";
import type { DossierFraisReels, JustificatifFraisReels } from "../../lib/exportPdfFraisReels";
import type { IdentiteDeclarative as Identite } from "../../storage/identiteDeclarativeStorage";
import { IdentiteDeclarative } from "./IdentiteDeclarative";
import { chargerBiensAmortis, chargerFraisReels, creerBienAmorti, creerDepense, sauvegarderBiensAmortis, sauvegarderFraisReels, type DonneesFraisReels } from "../../storage/fraisReelsStorage";
import { calculerTotalAreAnnuel } from "../../lib/totalAreAnnuel";
import { RevenuImposableForm } from "./RevenuImposableForm";
import { DepensesList } from "./DepensesList";
import { ForfaitsReglages } from "./ForfaitsReglages";
import { AmortissementBiens } from "./AmortissementBiens";
import { EncartDepliable } from "./AideContextuelle";
import { RecapitulatifCategories } from "./RecapitulatifCategories";
import { explicationsFraisReels } from "../../content/explicationsFraisReels";
import { FraisReelsGraphiques } from "./FraisReelsGraphiques";
import { DeclarationTexte } from "./DeclarationTexte";

interface FraisReelsProps {
  profil: Profil;
  soldeIndemnisationDepart: SoldeIndemnisationDepart | null;
  contrats: Contrat[];
  config: FranceTravailConfig;
  dateDuJour: string;
}

function configParDefaut(anneeFiscale: number, totalAreCalcule: number | null): ConfigFraisReels {
  return {
    anneeFiscale,
    profilFiscal: "artiste_exclusif",
    revenu: { anneeFiscale, salaireNetImposable: 0, allocationsAre: totalAreCalcule ?? 0, congesSpectacles: 0, indemnitesJournalieres: 0 },
    modeA: "forfait",
    modeB: "forfait",
  };
}

// Années sélectionnables : l'année courante et les 3 précédentes. La déclaration se fait l'année
// suivant l'exercice (les frais 2025 se déclarent en 2026), donc l'année passée est le cas le plus
// courant — et le délai de conservation des justificatifs court sur 3 ans (cf. exportPdfFraisReels).
const PROFONDEUR_ANNEES = 4;

function anneesSelectionnables(anneeCourante: number): number[] {
  return Array.from({ length: PROFONDEUR_ANNEES }, (_, i) => anneeCourante - i);
}

export function FraisReels({ profil, soldeIndemnisationDepart, contrats, config, dateDuJour }: FraisReelsProps) {
  const anneeCourante = Number(dateDuJour.slice(0, 4));
  // Année d'exercice affichée — état, plus une valeur dérivée de `dateDuJour` : chaque exercice a sa
  // propre clé localStorage (`cadence_frais_reels_<annee>`), des données 2025 étaient donc
  // inatteignables tant que l'onglet restait verrouillé sur l'année courante.
  const [anneeFiscale, setAnneeFiscale] = useState(anneeCourante);
  const [donnees, setDonnees] = useState<DonneesFraisReels | null>(null);
  const chargementTermine = useRef(false);

  // Biens amortis : état DURABLE, volontairement hors du state par année ci-dessus — un bien acheté
  // en 2025 et amorti sur 5 ans doit encore produire une annuité en 2029 sans ressaisie. D'où un
  // chargement unique (dépendances vides), là où `donnees` est rechargé à chaque changement
  // d'année fiscale. Cf. `CLE_BIENS_AMORTIS`, storage/fraisReelsStorage.ts.
  const [biensAmortis, setBiensAmortis] = useState<BienAmorti[] | null>(null);
  const chargementBiensTermine = useRef(false);

  useEffect(() => {
    chargementTermine.current = false;
    chargerFraisReels(anneeFiscale).then((d) => {
      setDonnees(d);
      chargementTermine.current = true;
    });
  }, [anneeFiscale]);

  useEffect(() => {
    chargerBiensAmortis().then((b) => {
      setBiensAmortis(b);
      chargementBiensTermine.current = true;
    });
  }, []);

  useEffect(() => {
    if (donnees && chargementTermine.current) {
      sauvegarderFraisReels(anneeFiscale, donnees);
    }
  }, [donnees, anneeFiscale]);

  useEffect(() => {
    if (biensAmortis && chargementBiensTermine.current) {
      sauvegarderBiensAmortis(biensAmortis);
    }
  }, [biensAmortis]);

  const totalAreCalcule = useMemo(
    () => calculerTotalAreAnnuel(profil, soldeIndemnisationDepart, contrats, config, dateDuJour, anneeFiscale),
    [profil, soldeIndemnisationDepart, contrats, config, dateDuJour, anneeFiscale],
  );

  // Toujours calculés, même avant la fin du chargement (donnees === null) — les Rules of Hooks
  // interdisent un retour anticipé AVANT un appel de hook (useMemo ci-dessous) : `donnees?.config`
  // (au lieu de `donnees!.config`) rend ce calcul valide sur CHAQUE rendu, chargement compris.
  const depenses = donnees?.depenses ?? [];
  const fraisReelsConfig = donnees?.config ?? configParDefaut(anneeFiscale, totalAreCalcule);
  // `biensAmortis`/`anneeFiscale` transmis au moteur : leur annuité de l'année est ajoutée au poste
  // C7 et le détail exposé via `resultat.amortissements` (cf. engine/fraisReels.ts).
  const biens = biensAmortis ?? [];
  const resultat = useMemo(() => calculerFraisReels(depenses, fraisReelsConfig, config, biens, anneeFiscale), [depenses, fraisReelsConfig, config, biens, anneeFiscale]);

  if (!donnees || !biensAmortis) {
    return <div className="text-muted text-sm">Chargement…</div>;
  }

  function ecrireConfig(nouvelleConfig: ConfigFraisReels) {
    setDonnees((d) => (d ? { ...d, config: nouvelleConfig } : d));
  }

  function changerRevenu(revenu: RevenuImposableArtistique) {
    ecrireConfig({ ...fraisReelsConfig, revenu });
  }

  function changerProfilFiscal(profilFiscal: ProfilFiscalFraisReels) {
    ecrireConfig({ ...fraisReelsConfig, profilFiscal });
  }

  function ajouterDepense(partiel: Omit<Depense, "id">) {
    setDonnees((d) => (d ? { ...d, config: fraisReelsConfig, depenses: [...d.depenses, creerDepense(partiel)] } : d));
  }

  function modifierDepense(depense: Depense) {
    setDonnees((d) => (d ? { ...d, config: fraisReelsConfig, depenses: d.depenses.map((dep) => (dep.id === depense.id ? depense : dep)) } : d));
  }

  function supprimerDepense(id: string) {
    setDonnees((d) => (d ? { ...d, config: fraisReelsConfig, depenses: d.depenses.filter((dep) => dep.id !== id) } : d));
  }

  function ajouterBienAmorti(partiel: Omit<BienAmorti, "id">) {
    setBiensAmortis((b) => (b ? [...b, creerBienAmorti(partiel)] : b));
  }

  function supprimerBienAmorti(id: string) {
    setBiensAmortis((b) => (b ? b.filter((bien) => bien.id !== id) : b));
  }

  const baseR = calculerBaseR(fraisReelsConfig.revenu, fraisReelsConfig.profilFiscal, config);

  // Assemblage du dossier PDF : purement de la recomposition d'état déjà calculé plus haut (aucun
  // recalcul). `resultat.amortissements` est déjà rempli par le moteur pour l'exercice affiché, et
  // `construireFraisKmDossier` réutilise le descriptif produit par FraisKilometriques.
  function construireDossier(identite: Identite): DossierFraisReels {
    const justificatifs: JustificatifFraisReels[] = depenses
      .filter((d) => d.statutJustificatif === "fourni" && (d.justificatifNom || d.driveWebViewLink))
      .map((d) => ({
        depenseId: d.id,
        libelle: d.description,
        categorie: d.categorie,
        montant: d.montantDeductible,
        reference: d.driveWebViewLink ?? d.justificatifNom ?? "",
        source: d.driveFileId ? "drive" : "local",
      }));

    return {
      profil: {
        nom: identite.nom.trim(),
        prenom: identite.prenom.trim(),
        adresse: identite.adresse?.trim() || undefined,
        profession: identite.profession.trim(),
        revenuImposable: baseR,
        anneeImposition: anneeFiscale,
      },
      resultat,
      texteDeclaration: genererTexteDeclaration(resultat, fraisReelsConfig),
      amortissements: resultat.amortissements,
      fraisKm: construireFraisKmDossier(fraisReelsConfig.fraisKm, config),
      justificatifs,
      dateGeneration: new Date().toISOString(),
    };
  }

  const ratioLocalPro = fraisReelsConfig.localPro && fraisReelsConfig.localPro.surfaceTotalM2 > 0 ? fraisReelsConfig.localPro.surfaceProM2 / fraisReelsConfig.localPro.surfaceTotalM2 : null;
  const nombreRepasC3Actif = Boolean(fraisReelsConfig.nombreRepasC3 && fraisReelsConfig.nombreRepasC3 > 0);
  const driveActif = Boolean(fraisReelsConfig.driveConnecte) && fraisReelsConfig.stockageJustificatifs === "drive";

  return (
    <div className="space-y-6 max-w-[900px]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-4 py-2.5 flex-1 min-w-[280px]">
          Indicatif — les règles fiscales peuvent évoluer. Source : SNAM-CGT mars 2026.
          {anneeFiscale !== anneeCourante && <span className="text-amber"> Exercice {anneeFiscale}, déclaré en {anneeFiscale + 1}.</span>}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs uppercase tracking-[.03em] text-muted" htmlFor="frais-annee-fiscale">
            Exercice
          </label>
          <select
            id="frais-annee-fiscale"
            value={anneeFiscale}
            onChange={(e) => setAnneeFiscale(Number(e.target.value))}
            className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm tabular-nums"
          >
            {anneesSelectionnables(anneeCourante).map((annee) => (
              <option key={annee} value={annee}>
                {annee}
              </option>
            ))}
          </select>
        </div>
      </div>

      <EncartDepliable explication={explicationsFraisReels.intro} />

      <RevenuImposableForm
        revenu={fraisReelsConfig.revenu}
        profilFiscal={fraisReelsConfig.profilFiscal}
        baseR={baseR}
        plafondBaseR={config.fraisReels.plafondBaseR2025}
        totalAreCalcule={totalAreCalcule}
        onChangerRevenu={changerRevenu}
        onChangerProfilFiscal={changerProfilFiscal}
      />

      <DepensesList
        anneeFiscale={anneeFiscale}
        depenses={depenses}
        ratioLocalPro={ratioLocalPro}
        nombreRepasC3Actif={nombreRepasC3Actif}
        driveActif={driveActif}
        onAjouter={ajouterDepense}
        onModifier={modifierDepense}
        onSupprimer={supprimerDepense}
      />

      <ForfaitsReglages config={fraisReelsConfig} depenses={depenses} ftConfig={config} onChangerConfig={ecrireConfig}>
        <AmortissementBiens anneeImposition={anneeFiscale} biens={biens} ftConfig={config} onAjouter={ajouterBienAmorti} onSupprimer={supprimerBienAmorti} />
      </ForfaitsReglages>

      <RecapitulatifCategories resultat={resultat} />

      <FraisReelsGraphiques config={fraisReelsConfig} ftConfig={config} depenses={depenses} dateDuJour={dateDuJour} />

      <DeclarationTexte resultat={resultat} config={fraisReelsConfig} />

      <IdentiteDeclarative construireDossier={construireDossier} />
    </div>
  );
}
