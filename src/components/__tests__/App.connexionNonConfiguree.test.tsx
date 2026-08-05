// @vitest-environment jsdom
//
// Cas `nonConfigure` du mur (05/08/2026) : le comportement PAR DÉFAUT de la suite de tests, puisque
// `.env.test` laisse VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY vides — aucun mock nécessaire ici, comme
// pour l'ancien `App.sansCompte.test.tsx` dont ce fichier retourne exactement la promesse : avant la
// connexion obligatoire, cette absence de configuration laissait Cadence fonctionner quand même. Ce
// n'est plus le cas — assumé comme une fragilité nouvelle (cf. CLAUDE.md et le plan
// `fluttering-beaming-summit.md`) : sans configuration, plus personne ne peut ouvrir Cadence.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../App";
import { CLE_STOCKAGE } from "../../storage/localStorageAdapter";

const DONNEES = JSON.stringify({
  schemaVersion: 1,
  profil: { dateNaissance: "1985-06-15", dateAnniversaire: "2027-01-17", situation: "readmission", regimeDeclare: "annexe10_pur" },
  contrats: [{ id: "c1", dateDebut: "2026-01-05", date: "2026-01-05", type: "artiste", typeRemuneration: "cachet", territoire: "france", nbCachets: 3, salaireBrut: 1200, employeur: "Orchestre X" }],
  periodes: [],
  soldeIndemnisationDepart: null,
  exercicesGeles: {},
});

describe("App — connexion non configurée : panne bloquante, pas un mode dégradé", () => {
  it("bloque tout et le dit comme une panne à signaler, jamais comme 'tout fonctionne normalement'", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES);
    render(<App />);

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/ne peut pas fonctionner sans elle/i);
    // L'ancienne phrase rassurante (avant la connexion obligatoire) ne doit plus jamais apparaître ici.
    expect(screen.queryByText(/tout le reste fonctionne normalement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sans compte, cadence fonctionne/i)).not.toBeInTheDocument();
  });

  it("aucun onglet, aucune donnée locale visible, aucun formulaire de connexion proposé", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES);
    render(<App />);

    await screen.findByRole("alert");
    expect(screen.queryByRole("navigation", { name: /navigation principale/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Orchestre X/)).not.toBeInTheDocument();
    // Se connecter n'aurait aucun sens sans configuration : pas de formulaire à proposer non plus.
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });

  it("n'écrit rien dans le localStorage", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES);
    render(<App />);
    await screen.findByRole("alert");

    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    expect(brut).not.toBeNull();
    expect(JSON.parse(brut as string).schemaVersion).toBe(1);
  });
});
