// src/content/explicationsFraisReels.ts
//
// Contenu éditorial (pas de logique) pour les info-bulles de l'onglet Frais pro.
// Source : SNAM-CGT, "Frais professionnels" (mars 2026), formulaire "État détaillé
// des frais professionnels déduits pour leur montant réel".
// Ne pas reformuler le fond réglementaire sans revérifier la source.

export interface ExplicationFraisReels {
  titre: string;
  texte: string;
}

export const explicationsFraisReels: Record<string, ExplicationFraisReels> = {
  intro: {
    titre: 'Comment ça marche',
    texte:
      "Deux façons de déduire tes frais professionnels : un forfait automatique pour A (instrument, 14 % de ta " +
      "rémunération) et B (représentation, 5 %), sans justificatif à fournir — ou leur montant réel, si tes dépenses " +
      "réelles dépassent le forfait. Les deux choix sont indépendants : tu peux garder le forfait sur l'un et passer " +
      "en réel sur l'autre. C1 à C9 et D n'ont pas de forfait : ils se déclarent toujours pour leur montant réel, " +
      "justificatifs à l'appui.",
  },

  a: {
    titre: 'A — 14 %, frais d\u2019instrument',
    texte:
      "Achat, entretien et assurance de tes instruments de musique ; matériel technique affecté à ton activité " +
      "(platines, casques, micros...) ; un second instrument si tu en as besoin (un piano, par exemple). " +
      "Pour les artistes chorégraphiques, lyriques et choristes : cours (danse, chant, piano, solfège, langues pour choristes), " +
      "et frais médicaux liés à ta pratique (kiné, ostéo, dentaire, cordes vocales). " +
      "Les intérêts d'emprunt pour l'achat d'un instrument ne sont pas dans ce forfait — ils se déduisent en réel, à part.",
  },

  b: {
    titre: 'B — 5 %, représentation',
    texte:
      "Vêtements et coiffure professionnels, frais de représentation, communications téléphoniques professionnelles, " +
      "fournitures diverses (partitions, métronome, pupitre...), frais de formation, et frais médicaux spécifiques " +
      "autres que ceux déjà comptés en A.",
  },

  c1: {
    titre: 'C1 — Domicile ↔ travail',
    texte:
      "Tes trajets entre chez toi et ton lieu de travail. Jusqu'à 40 km, il suffit de justifier l'usage de ton véhicule " +
      "et le nombre d'allers-retours. Au-delà de 40 km, la déduction reste plafonnée à 40 km — sauf si l'éloignement " +
      "ne résulte pas d'un choix personnel. Péages, parking et intérêts d'emprunt du véhicule s'ajoutent sur justificatifs.",
  },

  c2: {
    titre: 'C2 — Autres trajets',
    texte:
      "Tout déplacement professionnel qui n'est pas ton trajet domicile-travail habituel — par exemple pour un contrat " +
      "avec un employeur occasionnel ou un remplacement.",
  },

  c3: {
    titre: 'C3 — Repas sur le lieu de travail',
    texte:
      "Le surcoût d'un repas que tu ne peux pas prendre chez toi à cause de tes horaires ou de l'éloignement de ton " +
      "lieu de travail.",
  },

  c4: {
    titre: 'C4 — Repas et hébergement en déplacement',
    texte: "Repas et hôtel lors d'un déplacement hors de ton lieu de travail habituel (tournée, résidence, festival...).",
  },

  c5: {
    titre: 'C5 — Formation et documentation',
    texte: "Stages, cours, livres, partitions d'étude, abonnements professionnels.",
  },

  c6: {
    titre: 'C6 — Local professionnel',
    texte: "La quote-part de loyer et de charges d'un espace que tu utilises spécifiquement pour ton activité.",
  },

  c7: {
    titre: 'C7 — Matériel, mobilier, fournitures',
    texte:
      "Ce qui n'est pas déjà couvert par B : fournitures, imprimés, téléphone, mobilier, matériel, outillage. " +
      "Au-delà de 500 € HT pour un même bien, la déduction passe par l'amortissement plutôt qu'en une seule fois.",
  },

  c8: {
    titre: 'C8 — Cotisations professionnelles',
    texte:
      "Cotisations syndicales (montant réel, sans limite), et cotisations d'assurance professionnelle sous certaines " +
      "conditions.",
  },

  c9: {
    titre: 'C9 — Autres frais',
    texte:
      "Tout frais réel et justifié, en lien avec ton activité, qui ne rentre dans aucune case précédente — par exemple " +
      "des frais de déménagement liés à un nouvel engagement.",
  },

  d: {
    titre: 'D — Recherche d\u2019emploi',
    texte:
      "Frais engagés pour chercher tes prochains contrats : déplacements, téléphone, photos, CV, inscription à des " +
      "annuaires professionnels, ainsi que l'entretien et le développement de ta pratique.",
  },
};
