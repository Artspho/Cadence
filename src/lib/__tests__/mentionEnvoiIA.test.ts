import { describe, expect, it } from "vitest";
import { ANNONCE_CANAL_IA, MENTION_ENVOI_IA_INTEGRALE, MENTION_ENVOI_IA_PHRASES, RAPPEL_DOCUMENT_ENVOYE } from "../../content/mentionEnvoiIA";

// Ce texte est la contrepartie d'une décision produit (rester sur le tier gratuit Mistral, où les
// documents peuvent servir à l'entraînement), pas de la décoration. Ces tests existent pour qu'il ne
// puisse pas se diluer par une retouche de style : chaque fait qu'il doit énoncer est vérifié
// séparément, et le découpage typographique ne peut pas en perdre un morceau.
describe("mention d'envoi IA — le texte validé ne peut pas dériver", () => {
  it("le découpage en trois phrases se recompose exactement en la version intégrale", () => {
    expect(MENTION_ENVOI_IA_PHRASES.join(" ")).toBe(MENTION_ENVOI_IA_INTEGRALE);
  });

  it("nomme le destinataire réel du document", () => {
    expect(MENTION_ENVOI_IA_INTEGRALE).toContain("Mistral AI");
  });

  it("dit où le document est hébergé", () => {
    expect(MENTION_ENVOI_IA_INTEGRALE).toContain("France, hébergement UE");
  });

  // Le fait le plus coûteux pour l'utilisateur : c'est celui qui doit rester dit, sans euphémisme.
  it("dit explicitement que le document peut servir à l'entraînement des modèles", () => {
    expect(MENTION_ENVOI_IA_PHRASES[1]).toContain("peut utiliser ce document pour entraîner ses modèles");
  });

  it("propose l'alternative gratuite et locale", () => {
    expect(MENTION_ENVOI_IA_PHRASES[2]).toContain("la saisie manuelle reste gratuite");
    expect(MENTION_ENVOI_IA_PHRASES[2]).toContain("ne quitte jamais ton appareil");
  });
});

describe("annonce du canal — ce que fait le bouton, avant même de choisir un fichier", () => {
  it("dit que le document part vers un serveur", () => {
    expect(ANNONCE_CANAL_IA).toContain("envoie ton document à un serveur");
  });

  it("annonce que l'accord est demandé à chaque envoi, pas une fois pour toutes", () => {
    expect(ANNONCE_CANAL_IA).toContain("avant chaque envoi");
    expect(ANNONCE_CANAL_IA).toContain("rien ne part sans ton accord");
  });

  // Elle annonce le détail, elle ne le remplace pas : le détail se lit d'un bloc dans la modale.
  it("reste distincte de la mention de consentement et n'en est pas un extrait", () => {
    expect(ANNONCE_CANAL_IA).not.toBe(MENTION_ENVOI_IA_INTEGRALE);
    for (const phrase of MENTION_ENVOI_IA_PHRASES) {
      expect(ANNONCE_CANAL_IA).not.toContain(phrase);
    }
  });
});

describe("rappel après envoi — au passé, et jamais confondu avec la mention principale", () => {
  it("est formulé au passé (l'envoi a déjà eu lieu)", () => {
    expect(RAPPEL_DOCUMENT_ENVOYE).toContain("a été envoyé");
  });

  it("redit l'entraînement plutôt que de le passer sous silence après coup", () => {
    expect(RAPPEL_DOCUMENT_ENVOYE).toContain("entraîner leurs modèles");
  });

  it("reste distinct de la mention de consentement", () => {
    expect(RAPPEL_DOCUMENT_ENVOYE).not.toBe(MENTION_ENVOI_IA_INTEGRALE);
  });
});
