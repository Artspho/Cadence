import { useEffect, useMemo, useRef, useState } from "react";
import type { Contrat, Profil, SoldeIndemnisationDepart } from "../../types";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import type { ConfigFraisReels, Depense, ProfilFiscalFraisReels, RevenuImposableArtistique } from "../../types/fraisReels";
import { calculerBaseR, calculerFraisReels } from "../../engine/fraisReels";
import { chargerFraisReels, creerDepense, sauvegarderFraisReels, type DonneesFraisReels } from "../../storage/fraisReelsStorage";
import { calculerTotalAreAnnuel } from "../../lib/totalAreAnnuel";
import { RevenuImposableForm } from "./RevenuImposableForm";
import { DepensesList } from "./DepensesList";
import { ForfaitsReglages } from "./ForfaitsReglages";
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

export function FraisReels({ profil, soldeIndemnisationDepart, contrats, config, dateDuJour }: FraisReelsProps) {
  const anneeFiscale = Number(dateDuJour.slice(0, 4));
  const [donnees, setDonnees] = useState<DonneesFraisReels | null>(null);
  const chargementTermine = useRef(false);

  useEffect(() => {
    chargementTermine.current = false;
    chargerFraisReels(anneeFiscale).then((d) => {
      setDonnees(d);
      chargementTermine.current = true;
    });
  }, [anneeFiscale]);

  useEffect(() => {
    if (donnees && chargementTermine.current) {
      sauvegarderFraisReels(anneeFiscale, donnees);
    }
  }, [donnees, anneeFiscale]);

  const totalAreCalcule = useMemo(
    () => calculerTotalAreAnnuel(profil, soldeIndemnisationDepart, contrats, config, dateDuJour, anneeFiscale),
    [profil, soldeIndemnisationDepart, contrats, config, dateDuJour, anneeFiscale],
  );

  // Toujours calculés, même avant la fin du chargement (donnees === null) — les Rules of Hooks
  // interdisent un retour anticipé AVANT un appel de hook (useMemo ci-dessous) : `donnees?.config`
  // (au lieu de `donnees!.config`) rend ce calcul valide sur CHAQUE rendu, chargement compris.
  const depenses = donnees?.depenses ?? [];
  const fraisReelsConfig = donnees?.config ?? configParDefaut(anneeFiscale, totalAreCalcule);
  const resultat = useMemo(() => calculerFraisReels(depenses, fraisReelsConfig, config), [depenses, fraisReelsConfig, config]);

  if (!donnees) {
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

  const baseR = calculerBaseR(fraisReelsConfig.revenu, fraisReelsConfig.profilFiscal, config);

  const ratioLocalPro = fraisReelsConfig.localPro && fraisReelsConfig.localPro.surfaceTotalM2 > 0 ? fraisReelsConfig.localPro.surfaceProM2 / fraisReelsConfig.localPro.surfaceTotalM2 : null;
  const nombreRepasC3Actif = Boolean(fraisReelsConfig.nombreRepasC3 && fraisReelsConfig.nombreRepasC3 > 0);

  return (
    <div className="space-y-6 max-w-[900px]">
      <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-4 py-2.5">
        Indicatif — les règles fiscales peuvent évoluer. Source : SNAM-CGT mars 2026. Année fiscale {anneeFiscale}.
      </p>

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
        onAjouter={ajouterDepense}
        onModifier={modifierDepense}
        onSupprimer={supprimerDepense}
      />

      <ForfaitsReglages config={fraisReelsConfig} depenses={depenses} ftConfig={config} onChangerConfig={ecrireConfig} />

      <FraisReelsGraphiques resultat={resultat} config={fraisReelsConfig} depenses={depenses} dateDuJour={dateDuJour} />

      <DeclarationTexte resultat={resultat} config={fraisReelsConfig} />
    </div>
  );
}
