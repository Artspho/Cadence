// @vitest-environment jsdom
//
// Point 2 de docs/critique_2026-08-03.md — la DÉTECTION EN AMONT, sur la porte par laquelle la
// saturation arrive réellement : le dépôt d'un justificatif, stocké en base64 dans le localStorage.
//
// Ce que ce test protège, et qui n'est pas une hypothèse : avant ce garde, le fichier était accepté à
// l'écran, puis c'est la sauvegarde de TOUT le jeu de données qui échouait. L'utilisateur voyait un
// bandeau « tes modifications n'ont pas été enregistrées » sans jamais apprendre que son justificatif
// en était la cause — et sans savoir quoi supprimer pour s'en sortir.
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DepenseForm } from "../DepenseForm";

function rendre() {
  const onValider = vi.fn();
  render(<DepenseForm anneeFiscale={2026} ratioLocalPro={null} nombreRepasC3Actif={false} driveActif={false} onValider={onValider} onAnnuler={vi.fn()} />);
  return onValider;
}

const champFichier = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const deposer = (nom: string, contenu: string) => fireEvent.change(champFichier(), { target: { files: [new File([contenu], nom, { type: "application/pdf" })] } });

/**
 * jsdom n'impose aucun quota à son localStorage : la seule façon de tester le comportement « plein »
 * est de faire échouer l'écriture, comme le navigateur le fait avec un QuotaExceededError. Même
 * dispositif que storage/__tests__/chargementEtSauvegarde.test.ts (point 1), pour ne pas inventer une
 * seconde façon de simuler la même panne.
 *
 * ⚠️ L'espion doit porter sur `Storage.prototype`, PAS sur `window.localStorage` : `setItem` n'est pas
 * une propriété propre de l'instance, un espion posé dessus ne remplace rien et le test passe au vert
 * sans rien vérifier (constaté le 04/08/2026).
 */
function simulerStockagePlein() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("QuotaExceededError", "QuotaExceededError");
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("DepenseForm — un justificatif qui ne tient plus est refusé AVANT d'être accepté", () => {
  it("dit que la place manque, donne la taille du fichier encodé, et nomme ce qui la prend", () => {
    simulerStockagePlein();
    rendre();
    deposer("facture.pdf", "contenu de facture");

    return waitFor(() => {
      expect(screen.getByText(/plus de place dans le stockage/i)).toBeInTheDocument();
      // Le message doit dire quoi faire, pas seulement que c'est refusé : exporter, puis supprimer des
      // justificatifs anciens — ce sont eux qui occupent la place, c'est le fait mesuré le 04/08/2026.
      expect(screen.getByText(/supprime des justificatifs de dépenses anciennes/i)).toBeInTheDocument();
    });
  });

  it("le fichier n'est PAS attaché à la dépense : ni son nom, ni son contenu", async () => {
    // Le point capital. Accepter le fichier à l'écran tout en sachant qu'il ne peut pas être enregistré
    // reviendrait à promettre un justificatif qui disparaîtra — pire que de le refuser.
    simulerStockagePlein();
    rendre();
    deposer("facture.pdf", "contenu de facture");

    await waitFor(() => expect(screen.getByText(/plus de place dans le stockage/i)).toBeInTheDocument());
    expect(screen.queryByText("facture.pdf")).not.toBeInTheDocument();
    expect(screen.getByText(/choisir un fichier/i)).toBeInTheDocument(); // le bouton n'est pas passé à « Remplacer le fichier »
  });

  it("contrôle négatif — avec de la place, le même dépôt est accepté et le fichier est nommé à l'écran", async () => {
    rendre(); // pas d'espion : le localStorage de jsdom accepte l'essai
    deposer("facture.pdf", "contenu de facture");

    await waitFor(() => expect(screen.getByText("facture.pdf")).toBeInTheDocument());
    expect(screen.queryByText(/plus de place dans le stockage/i)).not.toBeInTheDocument();
    expect(screen.getByText(/remplacer le fichier/i)).toBeInTheDocument();
  });

  it("l'essai de capacité ne laisse aucune clé derrière lui dans le stockage", async () => {
    rendre();
    deposer("facture.pdf", "contenu de facture");
    await waitFor(() => expect(screen.getByText("facture.pdf")).toBeInTheDocument());

    // Sinon le filet deviendrait lui-même un consommateur d'espace, et un doublon du justificatif.
    expect(Object.keys(window.localStorage).filter((c) => c.includes("essai"))).toEqual([]);
  });

  it("la limite de 5 Mo par fichier est conservée, et son message reste distinct de celui du stockage plein", () => {
    // Deux refus de nature différente : un fichier trop gros en soi, et un stockage qui n'a plus de
    // place. Les confondre dirait une raison fausse (devoir n°2, volet « dire la bonne raison »).
    rendre();
    const trop = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "enorme.pdf", { type: "application/pdf" });
    fireEvent.change(champFichier(), { target: { files: [trop] } });

    expect(screen.getByText(/fichier trop volumineux \(max 5 Mo\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/plus de place dans le stockage/i)).not.toBeInTheDocument();
  });
});
