// @vitest-environment jsdom
//
// LE GARDIEN DE LA PROMESSE DE LA PHASE 2, faite à Benoît le 04/08/2026 :
// « jusqu'à la bascule de la phase 5, l'app doit continuer de s'ouvrir et de fonctionner SANS COMPTE,
// sur le localStorage, exactement comme aujourd'hui. La connexion s'ajoute à côté. »
//
// Ce test ne vérifie pas un composant isolé : il rend le VRAI App, sans aucune configuration
// Supabase (état par défaut des tests, cf. .env.test), et parcourt les onglets. Il doit rougir le
// jour où quelqu'un ajouterait un « connectez-vous pour continuer », ferait dépendre un onglet de la
// session, ou laisserait une absence de configuration faire tomber le rendu.
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../App";
import { CLE_STOCKAGE } from "../../storage/localStorageAdapter";

const DONNEES = JSON.stringify({
  schemaVersion: 1,
  profil: { dateNaissance: "1985-06-15", dateAnniversaire: "2027-01-17", situation: "readmission", regimeDeclare: "annexe10_pur" },
  contrats: [
    {
      id: "c1",
      dateDebut: "2026-01-05",
      date: "2026-01-05",
      type: "artiste",
      typeRemuneration: "cachet",
      territoire: "france",
      nbCachets: 3,
      salaireBrut: 1200,
      employeur: "Orchestre Sans Compte",
    },
  ],
  periodes: [],
  soldeIndemnisationDepart: null,
  exercicesGeles: {},
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(CLE_STOCKAGE, DONNEES);
});

describe("App sans compte — la promesse de la phase 2", () => {
  it("s'ouvre et affiche les données locales, sans configuration Supabase", async () => {
    render(<App />);
    // Les données du localStorage sont là : c'est ce qui prouve que l'authentification ne s'est pas
    // interposée entre l'app et son stockage.
    expect(await screen.findByRole("navigation", { name: /navigation principale/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Contrats" }));
    expect(await screen.findByText(/Orchestre Sans Compte/)).toBeInTheDocument();
  });

  it("ne dresse AUCUN mur de connexion : tous les onglets restent atteignables", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });

    for (const onglet of ["Tableau de bord", "Mon profil", "Contrats", "Import PDF", "Historique", "Simulateur", "Revenus mensuels", "Frais pro"]) {
      fireEvent.click(screen.getByRole("button", { name: onglet }));
      // Aucun écran ne réclame une connexion pour afficher son contenu.
      expect(screen.queryByText(/connecte-toi pour|connectez-vous pour|réservé aux comptes/i)).not.toBeInTheDocument();
      // Laisse retomber les chargements asynchrones de l'onglet (Frais pro lit son stockage) : sans
      // ça, leurs mises à jour arrivent après la fin du test et polluent la sortie d'avertissements
      // `act(...)` qui n'ont rien à voir avec ce qu'on vérifie.
      await act(async () => {});
    }
  });

  it("la section Compte est visible dans Mon profil, et annonce honnêtement qu'elle n'est pas configurée", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });
    fireEvent.click(screen.getByRole("button", { name: "Mon profil" }));

    expect(await screen.findByRole("heading", { name: "Compte" })).toBeInTheDocument();
    expect(screen.getByText(/n'est pas configurée/i)).toBeInTheDocument();
    // Elle dit aussi qu'elle est facultative : c'est ce qui empêche de croire qu'il faut un compte.
    expect(screen.getByText(/Cadence fonctionne sans compte/i)).toBeInTheDocument();
  });

  it("le reste de l'onglet Mon profil fonctionne toujours (la section s'ajoute, elle ne remplace rien)", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });
    fireEvent.click(screen.getByRole("button", { name: "Mon profil" }));

    expect(await screen.findByRole("heading", { name: "Ton profil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Périmètre du MVP/i })).toBeInTheDocument();
    // Et la saisie reste vivante : la date de naissance chargée est bien dans le formulaire. Elle
    // est saisie en trois champs (JJ / mois / AAAA, cf. DateNaissanceInput), pas en un seul.
    await waitFor(() => expect(screen.getByLabelText("Jour de naissance")).toHaveValue("15"));
    expect(screen.getByLabelText("Année de naissance")).toHaveValue("1985");
  });

  it("aucune copie serveur n'est tentée ni annoncée sans compte (phase 3)", async () => {
    // Sans configuration Supabase, le client de données vaut `null` et l'effet de copie sort
    // immédiatement en état « inactif ». Rien ne doit apparaître à l'écran : parler d'une copie qui
    // n'a pas lieu d'être laisserait croire qu'il manque quelque chose.
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });
    fireEvent.click(screen.getByRole("button", { name: "Mon profil" }));
    await screen.findByRole("heading", { name: "Compte" });

    expect(screen.queryByText(/copie sur le serveur/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/copie vers le serveur/i)).not.toBeInTheDocument();
  });

  it("aucune écriture parasite : le contenu du localStorage reste celui qu'on a posé", async () => {
    // Devoir n°1. La phase 2 n'écrit RIEN — ni dans Supabase, ni dans le stockage local. Si un jour
    // l'authentification se mettait à toucher aux données, ce test le dirait.
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });
    fireEvent.click(screen.getByRole("button", { name: "Mon profil" }));
    await screen.findByRole("heading", { name: "Compte" });

    const stocke = window.localStorage.getItem(CLE_STOCKAGE);
    expect(stocke).not.toBeNull();
    const relu = JSON.parse(stocke as string);
    expect(relu.contrats).toHaveLength(1);
    expect(relu.contrats[0].employeur).toBe("Orchestre Sans Compte");
    expect(relu.profil.dateNaissance).toBe("1985-06-15");
  });
});
