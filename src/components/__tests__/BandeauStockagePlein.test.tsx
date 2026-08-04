// @vitest-environment jsdom
//
// Point 2 de docs/critique_2026-08-03.md : le bandeau d'échec d'écriture doit permettre d'AGIR, pas
// seulement d'alerter. Ces tests rendent le vrai composant et lisent ce qui s'affiche — les tests de
// lib/__tests__/capaciteStockage.test.ts prouvent la mesure, celui-ci prouve ce que l'utilisateur voit
// et ce que les boutons font réellement.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BandeauStockagePlein } from "../BandeauStockagePlein";
import { CLE_QUARANTAINE, CLE_SAUVEGARDE, CLE_STOCKAGE } from "../../storage/localStorageAdapter";

const ERREUR = "QuotaExceededError : Setting the value exceeded the quota.";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("BandeauStockagePlein — dire que rien n'est enregistré, et permettre d'agir", () => {
  it("annonce l'échec, cite le message brut du navigateur, et n'est pas refermable", () => {
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);
    expect(screen.getByText(/n'ont PAS été enregistrées/i)).toBeInTheDocument();
    // Le message brut est repris tel quel : reformuler l'erreur d'un navigateur, c'est risquer de dire
    // une cause fausse (devoir n°2).
    expect(screen.getByText(/QuotaExceededError/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fermer|masquer ce message/i })).not.toBeInTheDocument();
  });

  it("le bouton d'export appelle l'export — et rien ne part sans ce clic", () => {
    const onExporter = vi.fn();
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={onExporter} />);
    // Décision par défaut assumée : export MANUEL. Aucun téléchargement au montage du bandeau.
    expect(onExporter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /télécharger ma sauvegarde maintenant/i }));
    expect(onExporter).toHaveBeenCalledTimes(1);
  });

  it("affiche l'occupation mesurée, et le détail clé par clé une fois déplié", () => {
    window.localStorage.setItem(CLE_STOCKAGE, "x".repeat(20_000));
    window.localStorage.setItem(CLE_SAUVEGARDE, "x".repeat(2_000));
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);

    // Replié : le total seulement.
    expect(screen.getByRole("button", { name: /voir ce qui occupe la place/i })).toBeInTheDocument();
    expect(screen.queryByText(/tes données actuelles/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /voir ce qui occupe la place/i }));
    // Les clés sont nommées en français, jamais affichées comme des noms techniques nus.
    expect(screen.getByText(/tes données actuelles/i)).toBeInTheDocument();
    expect(screen.getByText(/copie de secours automatique/i)).toBeInTheDocument();
    expect(screen.getByText("19,5 Ko")).toBeInTheDocument();
  });

  it("ne déroule que les six plus grosses entrées, et CHIFFRE le reste au lieu de le taire", () => {
    // Défaut trouvé à l'écran le 04/08/2026 : un stockage saturé comptait 85 clés, et la liste
    // complète rendait le bandeau d'urgence illisible. Borner sans le dire aurait été pire — le détail
    // aurait menti par omission.
    for (let i = 0; i < 10; i += 1) window.localStorage.setItem(`cle${i}`, "x".repeat(1000 * (i + 1)));
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /voir ce qui occupe la place/i }));

    // 6 lignes détaillées + 1 ligne de résumé = 7.
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText(/4 autres entrées de ce navigateur/i)).toBeInTheDocument();
  });

  it("une seule entrée restante se dit au singulier", () => {
    for (let i = 0; i < 7; i += 1) window.localStorage.setItem(`cle${i}`, "x".repeat(1000 * (i + 1)));
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /voir ce qui occupe la place/i }));
    expect(screen.getByText(/1 autre entrée de ce navigateur/i)).toBeInTheDocument();
  });

  it("dit où va vraiment la place : les justificatifs", () => {
    // C'est le fait mesuré le 04/08/2026, et la seule information qui permette d'agir utilement.
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /voir ce qui occupe la place/i }));
    expect(screen.getByText(/justificatifs de dépenses qui pèsent le plus lourd/i)).toBeInTheDocument();
  });
});

describe("BandeauStockagePlein — la copie de quarantaine", () => {
  it("n'est mentionnée que si elle existe réellement", () => {
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /voir ce qui occupe la place/i }));
    // Aucune quarantaine en place : parler de la supprimer serait proposer un geste sans objet.
    expect(screen.queryByRole("button", { name: /supprimer cette copie/i })).not.toBeInTheDocument();
  });

  it("est supprimée SEULEMENT après un clic explicite, et la place libérée est constatée", () => {
    window.localStorage.setItem(CLE_STOCKAGE, "x".repeat(1_000));
    window.localStorage.setItem(CLE_QUARANTAINE, "x".repeat(30_000));
    render(<BandeauStockagePlein erreur={ERREUR} onExporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /voir ce qui occupe la place/i }));

    // Rien n'a été purgé par le simple fait d'afficher le bandeau (devoir n°1).
    expect(window.localStorage.getItem(CLE_QUARANTAINE)).not.toBeNull();
    expect(screen.getByText(/Cadence ne la supprime jamais d'elle-même/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /supprimer cette copie/i }));
    expect(window.localStorage.getItem(CLE_QUARANTAINE)).toBeNull();
    // Les données de record, elles, sont intactes : on n'a supprimé que la quarantaine.
    expect(window.localStorage.getItem(CLE_STOCKAGE)).not.toBeNull();
    // Et le bandeau se remesure : la ligne de quarantaine a disparu du détail.
    expect(screen.queryByRole("button", { name: /supprimer cette copie/i })).not.toBeInTheDocument();
  });
});
