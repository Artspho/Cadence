// @vitest-environment jsdom
//
// Phase 4 de la refonte Supabase — ce que le panneau de vérification affiche réellement.
//
// La vérification est INJECTÉE dans chaque test : aucun appel réseau, et aucune dépendance à
// `crypto.subtle` (absent sous jsdom). Ce qui est testé ici, ce n'est pas le calcul du verdict — il
// l'est dans `storage/__tests__/verificationMigration.test.ts` — mais ce que l'écran en DIT.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VerificationServeur } from "../VerificationServeur";
import { creerDonneesVides, type DonneesApp } from "../../storage/localStorageAdapter";
import type { ClientLectureDonnees } from "../../auth/supabaseClient";
import type { Verdict } from "../../storage/verificationMigration";

const CLIENT = {} as ClientLectureDonnees;
const DONNEES: DonneesApp = creerDonneesVides();
const DECOMPTE = { contrats: 62, periodes: 0, exercicesGeles: 2, profilPresent: true };

function afficher(verdict: Verdict) {
  const verifier = vi.fn(async () => verdict);
  render(<VerificationServeur client={CLIENT} utilisateurId="u-42" donnees={DONNEES} verifier={verifier} />);
  return verifier;
}

async function cliquerPuisAttendre(verdict: Verdict, texte: RegExp) {
  afficher(verdict);
  fireEvent.click(screen.getByRole("button", { name: /vérifier la copie serveur/i }));
  await waitFor(() => expect(screen.getByText(texte)).toBeInTheDocument());
}

describe("VerificationServeur — avant tout clic", () => {
  it("ne lit RIEN au chargement : la lecture serveur est un acte délibéré", () => {
    const verifier = afficher({ statut: "absente" });
    expect(verifier).not.toHaveBeenCalled();
  });

  it("annonce que rien ne sera déplacé ni modifié", () => {
    afficher({ statut: "absente" });
    expect(screen.getByText(/aucune donnée n'est déplacée ni modifiée/i)).toBeInTheDocument();
  });

  it("dit d'emblée que les frais réels ne sont PAS dans la comparaison", () => {
    afficher({ statut: "absente" });
    expect(screen.getByText(/les frais réels n'en font pas partie/i)).toBeInTheDocument();
  });

  it("ne s'affiche pas du tout si les données locales sont illisibles", () => {
    // Comparer contre rien ne pourrait produire qu'un faux écart. Mieux vaut pas de bouton.
    render(<VerificationServeur client={CLIENT} utilisateurId="u-42" donnees={null} verifier={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("VerificationServeur — les verdicts", () => {
  it("« identique » : affiche le mot, les décomptes et l'empreinte commune", async () => {
    await cliquerPuisAttendre(
      { statut: "identique", empreinte: "a".repeat(64), local: DECOMPTE, serveur: DECOMPTE, majLe: "2026-08-05T09:12:00.000Z" },
      /identique/i,
    );
    // ÉNUMÉRÉ, jamais « les mêmes données » : les frais réels ne sont pas copiés, et un « identique »
    // large laisserait croire qu'ils le sont.
    expect(screen.getByText(/exactement les mêmes contrats, profil, périodes et exercices figés/i)).toBeInTheDocument();
    expect(screen.queryByText(/exactement les mêmes données/i)).not.toBeInTheDocument();
    expect(screen.getByText(/62/)).toBeInTheDocument();
    expect(screen.getByText(/^a{32}…$/)).toBeInTheDocument();
  });

  it("« différent » : nomme l'écart ET rassure explicitement sur le local", async () => {
    await cliquerPuisAttendre(
      {
        statut: "different",
        empreinteLocale: "a".repeat(64),
        empreinteServeur: "b".repeat(64),
        local: DECOMPTE,
        serveur: { ...DECOMPTE, contrats: 61 },
        majLe: null,
        differences: ["les contrats"],
      },
      /différent/i,
    );
    expect(screen.getByText(/écart sur : les contrats/i)).toBeInTheDocument();
    // Un cadre orange fait spontanément craindre une perte : le démentir est obligatoire ici.
    expect(screen.getByText(/tes données locales sont intactes/i)).toBeInTheDocument();
  });

  it("« absente » : ne parle PAS d'écart", async () => {
    await cliquerPuisAttendre({ statut: "absente" }, /aucune donnée n'a encore été copiée/i);
    expect(screen.getByText(/ce n'est pas un écart/i)).toBeInTheDocument();
    expect(screen.queryByText(/différent/i)).not.toBeInTheDocument();
  });

  it("version inattendue : refuse de rendre un verdict au lieu d'annoncer un écart", async () => {
    await cliquerPuisAttendre({ statut: "versionInattendue", attendue: 1, recue: 99 }, /comparaison impossible/i);
    expect(screen.getByText(/aucun verdict n'est rendu/i)).toBeInTheDocument();
  });

  it("échec : dit qu'aucun verdict n'est rendu, et ne prétend rien d'autre", async () => {
    await cliquerPuisAttendre({ statut: "echec", message: "JWT expired" }, /n'a pas pu aboutir/i);
    expect(screen.getByText(/JWT expired/)).toBeInTheDocument();
    expect(screen.queryByText(/identique/i)).not.toBeInTheDocument();
  });

  it("une vérification qui lève ne laisse pas le bouton bloqué", async () => {
    const verifier = vi.fn(async () => {
      throw new Error("incident inattendu");
    });
    render(<VerificationServeur client={CLIENT} utilisateurId="u-42" donnees={DONNEES} verifier={verifier} />);
    fireEvent.click(screen.getByRole("button", { name: /vérifier la copie serveur/i }));

    await waitFor(() => expect(screen.getByText(/incident inattendu/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /vérifier la copie serveur/i })).toBeEnabled();
  });
});
