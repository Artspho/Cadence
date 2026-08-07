// @vitest-environment jsdom
//
// 07/08/2026 — deux bugs réels signalés par Benoît, corrigés le même jour dans lib/routageExtraction.ts
// (évaluation) : ces tests verrouillent le GARDE-FOU CÔTÉ ÉCRAN, qu'un test de la logique pure ne
// peut pas prouver seul (cf. routageExtraction.test.ts pour la logique).
//
// 1. Réimporter une notification d'admission PASSÉE écrasait `dateOuverture`/`dateAnniversaire` en un
//    clic, sans jamais montrer l'ancienne valeur — décalant la fenêtre qui borne le moteur.
// 2. Réimporter un document sur un contrat déjà CONFIRMÉ affichait un message informatif, mais le
//    bouton « Vérifier et enregistrer » restait actif juste en dessous : un second contrat identique
//    pouvait être créé sans qu'aucun clic supplémentaire ne le signale.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RevueExtraction } from "../RevueExtraction";
import { profil, contrat } from "../../engine/__tests__/testUtils";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { ExtractionResult } from "../../types/extraction";
import type { DecompteHeuresResultat, Profil } from "../../types";

const DECOMPTE: DecompteHeuresResultat = {
  total: 0,
  repartition: { cachets: 0, heuresScene: 0, eee: 0, assimilees: 0, ptp: 0, enseignementRetenu: 0, enseignementExcedentaire: 0, formationRetenue: 0, formationExcedentaire: 0 },
  plafondEnseignementApplicable: 70,
  cachetsParMois: {},
};

describe("RevueExtraction — écraser une valeur de profil déjà saisie exige une confirmation explicite", () => {
  const resultat: ExtractionResult = {
    typeDocumentDetecte: "notification_admission",
    propositions: [
      {
        cible: "profil_ouverture_droits",
        donnees: { dateOuverture: "2025-06-01", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: null },
        confiance: { dateOuverture: "haute" },
        justification: "Date d'ouverture des droits en page 1.",
      },
    ],
    avertissementsGeneraux: [],
  };
  const profilAvecOuverture = profil({ ouvertureDroits: { dateOuverture: "2026-02-01", franchiseCPTotale: 12, delaiAttenteInitial: 7 } });

  it("montre l'ancienne ET la nouvelle valeur, sans bouton d'application en un clic", () => {
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profilAvecOuverture}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={vi.fn(() => ({ ok: true, profil: profilAvecOuverture }))}
      />
    );
    // L'ancienne valeur ET la nouvelle sont affichées côte à côte dans le tableau de comparaison —
    // jamais l'une sans l'autre (la nouvelle apparaît aussi une fois dans la carte de proposition
    // elle-même, d'où getAllByText).
    expect(screen.getByText("2026-02-01")).toBeInTheDocument();
    expect(screen.getByText("→ 2025-06-01")).toBeInTheDocument();
    expect(screen.getAllByText(/2025-06-01/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^enregistrer dans mon profil$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remplacer par les valeurs du document/i })).toBeInTheDocument();
  });

  it("écrit la nouvelle valeur seulement après ce clic explicite", () => {
    const onModifierProfil = vi.fn((_candidat: Profil) => ({ ok: true as const, profil: profilAvecOuverture }));
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profilAvecOuverture}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={onModifierProfil}
      />
    );
    expect(onModifierProfil).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /remplacer par les valeurs du document/i }));
    expect(onModifierProfil).toHaveBeenCalledTimes(1);
    expect(onModifierProfil.mock.calls[0][0].ouvertureDroits?.dateOuverture).toBe("2025-06-01");
  });

  it("« Garder mes valeurs actuelles » n'écrit rien", () => {
    const onModifierProfil = vi.fn(() => ({ ok: true as const, profil: profilAvecOuverture }));
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profilAvecOuverture}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={onModifierProfil}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /garder mes valeurs actuelles/i }));
    expect(onModifierProfil).not.toHaveBeenCalled();
  });

  it("écart < 12 mois : PAS de bouton « Ajouter à l'historique » (probablement une correction, pas une autre admission)", () => {
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profilAvecOuverture}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={vi.fn(() => ({ ok: true, profil: profilAvecOuverture }))}
      />
    );
    expect(screen.queryByRole("button", { name: /ajouter à l'historique/i })).not.toBeInTheDocument();
  });
});

// 07/08/2026 (idée de Benoît) : quand le document décrit une admission probablement DIFFÉRENTE
// (écart de dates > 12 mois) plutôt qu'une correction de l'admission en cours, une troisième option
// apparaît à côté de « Remplacer »/« Garder mes valeurs actuelles ».
describe("RevueExtraction — proposer d'ajouter à l'historique quand l'admission semble différente", () => {
  const resultat: ExtractionResult = {
    typeDocumentDetecte: "notification_admission",
    propositions: [
      {
        cible: "profil_ouverture_droits",
        // 3 ans avant l'ouverture actuelle (2026-02-01) — écart largement > 12 mois.
        donnees: { dateOuverture: "2023-02-01", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2024-01-31" },
        confiance: { dateOuverture: "haute" },
        justification: "Notification d'une admission antérieure.",
      },
    ],
    avertissementsGeneraux: [],
  };
  const profilAvecOuverture = profil({ ouvertureDroits: { dateOuverture: "2026-02-01", franchiseCPTotale: 12, delaiAttenteInitial: 7 } });

  it("affiche les trois options : Remplacer, Ajouter à l'historique, Garder mes valeurs actuelles", () => {
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profilAvecOuverture}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={vi.fn(() => ({ ok: true, profil: profilAvecOuverture }))}
      />
    );
    expect(screen.getByRole("button", { name: /remplacer par les valeurs du document/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter à l'historique des ouvertures précédentes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /garder mes valeurs actuelles/i })).toBeInTheDocument();
  });

  it("« Ajouter à l'historique » écrit historiqueOuvertureDroits SANS toucher à ouvertureDroits (l'ouverture en cours reste intacte)", () => {
    const onModifierProfil = vi.fn((_candidat: Profil) => ({ ok: true as const, profil: profilAvecOuverture }));
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profilAvecOuverture}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={onModifierProfil}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /ajouter à l'historique des ouvertures précédentes/i }));

    expect(onModifierProfil).toHaveBeenCalledTimes(1);
    const candidat = onModifierProfil.mock.calls[0][0];
    expect(candidat.historiqueOuvertureDroits).toEqual([{ dateOuverture: "2023-02-01", dateEcheance: "2024-01-31" }]);
    expect(candidat.ouvertureDroits).toEqual(profilAvecOuverture.ouvertureDroits); // inchangé
  });
});

describe("RevueExtraction — réimporter un contrat déjà confirmé ne crée pas de doublon en un clic", () => {
  const existant = contrat({
    date: "2026-03-15",
    dateDebut: "2026-03-15",
    employeur: "Conservatoire Exemple",
    salaireBrut: 245,
    statutVerification: "confirme",
  });
  const resultat: ExtractionResult = {
    typeDocumentDetecte: "bulletin_paie",
    propositions: [
      {
        cible: "contrat",
        donnees: {
          natureDocumentSource: "bulletin_paie",
          date: "2026-03-15",
          dateDebut: "2026-03-15",
          type: null,
          typeRemuneration: null,
          territoire: null,
          nbCachets: null,
          nbHeures: null,
          nbJoursEEE: null,
          salaireBrut: 245,
          employeur: "Conservatoire Exemple",
          etablissementAgree: null,
          enRapportAvecMetier: null,
        },
        confiance: { date: "haute", salaireBrut: "haute", employeur: "haute" },
        justification: "test",
      },
    ],
    avertissementsGeneraux: [],
  };

  function rendre() {
    render(
      <RevueExtraction
        resultat={resultat}
        profil={profil({})}
        config={franceTravailConfig}
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onAjouterPeriode={vi.fn()}
        onModifierProfil={vi.fn(() => ({ ok: true, profil: profil({}) }))}
        contrats={[existant]}
      />
    );
  }

  it("n'affiche PAS « Vérifier et enregistrer » d'entrée — seulement un bouton de dérogation explicite", () => {
    rendre();
    expect(screen.getByText(/déjà confirmé/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /vérifier et enregistrer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /créer quand même un nouveau contrat/i })).toBeInTheDocument();
  });

  it("le clic de dérogation révèle « Vérifier et enregistrer », qui ouvre le formulaire", () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: /créer quand même un nouveau contrat/i }));
    expect(screen.getByRole("button", { name: /vérifier et enregistrer/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /vérifier et enregistrer/i }));
    expect(screen.getByRole("button", { name: /enregistrer le contrat/i })).toBeInTheDocument();
  });
});
