// Fabriques de données de test partagées entre les fichiers de tests du moteur.
import type { Contrat, PeriodeAssimilee, Profil } from "../../types";

let compteur = 0;
function idUnique(prefixe: string): string {
  compteur += 1;
  return `${prefixe}-${compteur}`;
}

export function contrat(partiel: Partial<Contrat> & Pick<Contrat, "date">): Contrat {
  return {
    id: idUnique("contrat"),
    type: "artiste",
    typeRemuneration: "cachet",
    territoire: "france",
    salaireBrut: 0,
    employeur: "Test",
    ...partiel,
  };
}

export function periode(partiel: Partial<PeriodeAssimilee> & Pick<PeriodeAssimilee, "dateDebut" | "dateFin" | "type">): PeriodeAssimilee {
  return { id: idUnique("periode"), ...partiel };
}

export function profil(partiel: Partial<Profil> = {}): Profil {
  return {
    dateNaissance: "1990-01-01",
    dateAnniversaire: "2026-12-31",
    situation: "premiere_admission",
    ...partiel,
  };
}
