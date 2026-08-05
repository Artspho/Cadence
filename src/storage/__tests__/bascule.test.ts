// Phase 5 — l'aiguillage d'ouverture, une fois que le serveur décide.
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//  1. AUCUNE DÉCISION AUTOMATIQUE QUI PEUT DÉTRUIRE. Les deux seuls automatismes tolérés sont ceux
//     qui n'écrasent rien : adopter le serveur quand le navigateur est vide, et continuer quand les
//     deux côtés sont déjà identiques. Tout le reste doit remonter une demande ;
//  2. AUCUNE FAUSSE DIVERGENCE. Postgres ne conserve pas l'ordre des clés d'un JSONB : une
//     comparaison naïve dresserait l'écran de décision à CHAQUE ouverture sur des données identiques ;
//  3. chaque situation reste NOMMÉE distinctement — « absent », « illisible », « autre format » et
//     « muet » mènent à des écrans et à des conduites différents, et les confondre afficherait une
//     cause fausse.
//
// ⚠️ CE QUE CE FICHIER NE COUVRE PAS : le fait que l'app REFUSE réellement d'écrire dans ces
// situations. Ce module ne rend qu'un verdict ; l'autorisation d'écriture vit dans `App.tsx`
// (`ecritureAutorisee`) et c'est un test d'intégration sur l'app qui doit l'exercer. Ne pas lire un
// « vert » ici comme une preuve que rien ne s'écrit.
import { describe, expect, it } from "vitest";
import { creerDonneesVides, type DonneesApp } from "../localStorageAdapter";
import { analyserBascule, estVide } from "../bascule";
import type { EtatServeur } from "../sourceSupabase";
import { contrat, profil } from "../../engine/__tests__/testUtils";

const JETON = "2026-08-05T01:05:26.123456+00:00";

const PLEIN: DonneesApp = {
  ...creerDonneesVides(),
  profil: profil({ dateAnniversaire: "2027-01-17" }),
  contrats: [contrat({ date: "2026-01-05", nbCachets: 3, salaireBrut: 1200 })],
};

const AUTRE: DonneesApp = { ...PLEIN, contrats: [...PLEIN.contrats, contrat({ date: "2026-02-10", nbCachets: 2, salaireBrut: 800 })] };

function lu(donnees: DonneesApp): EtatServeur {
  return { statut: "lu", donnees, jeton: JETON, brut: donnees };
}

describe("estVide", () => {
  it("reconnaît l'état vide, et ne prend pas un état rempli pour vide", () => {
    expect(estVide(creerDonneesVides())).toBe(true);
    expect(estVide(PLEIN)).toBe(false);
  });

  it("un profil seul, sans aucun contrat, n'est PAS vide", () => {
    // Sinon un profil fraîchement saisi serait remplacé par le serveur sans rien demander.
    expect(estVide({ ...creerDonneesVides(), profil: profil() })).toBe(false);
  });
});

describe("analyserBascule — les deux seuls automatismes autorisés", () => {
  it("serveur identique au navigateur : on continue, le serveur est la référence", () => {
    expect(analyserBascule(PLEIN, lu(PLEIN))).toEqual({ genre: "serveurEnPhase", jeton: JETON });
  });

  it("MÊMES données, clés rangées autrement : PAS de divergence — c'est ce que fait Postgres", () => {
    // Le cas qui compte le plus de tout ce fichier. Un JSONB relu ne rend pas ses clés dans l'ordre
    // d'écriture ; une comparaison naïve annoncerait un écart à chaque ouverture sur des données
    // rigoureusement identiques, et apprendrait à cliquer sans lire sur l'écran de décision.
    // Clés inversées à tous les niveaux — c'est le pire cas réaliste de ce que rend un JSONB relu.
    const inverserCles = <T,>(objet: T): T => Object.fromEntries(Object.entries(objet as object).reverse()) as T;
    const permute: DonneesApp = {
      exercicesGeles: PLEIN.exercicesGeles,
      soldeIndemnisationDepart: PLEIN.soldeIndemnisationDepart,
      periodes: PLEIN.periodes,
      contrats: PLEIN.contrats.map(inverserCles),
      profil: inverserCles(PLEIN.profil),
    };
    expect(analyserBascule(PLEIN, lu(permute)).genre).toBe("serveurEnPhase");
  });

  it("navigateur VIDE, serveur rempli : on adopte le serveur sans demander — rien à perdre", () => {
    // Le cas « nouvel appareil » (son téléphone), et celui d'un navigateur vidé par accident.
    expect(analyserBascule(creerDonneesVides(), lu(PLEIN))).toEqual({ genre: "adopterServeur", donnees: PLEIN, jeton: JETON });
  });

  it("les deux côtés vides : « rien à faire », et non une adoption inutile", () => {
    expect(analyserBascule(creerDonneesVides(), lu(creerDonneesVides())).genre).toBe("serveurEnPhase");
  });
});

describe("analyserBascule — tout le reste demande une décision humaine", () => {
  it("les deux côtés portent des données DIFFÉRENTES : divergence", () => {
    const bascule = analyserBascule(PLEIN, lu(AUTRE));
    // Ni fusion, ni arbitrage par la date : l'app ne sait pas laquelle des deux versions il veut,
    // donc le verdict se contente de rapporter les deux versions et de laisser la question ouverte.
    expect(bascule).toEqual({ genre: "divergence", serveur: AUTRE, jeton: JETON });
  });

  it("rien sur le serveur mais des données dans le navigateur : téléversement PROPOSÉ, pas fait", () => {
    const bascule = analyserBascule(PLEIN, { statut: "absente" });
    // « Proposé » et non « fait » : le verdict ne téléverse rien, il demande.
    expect(bascule).toEqual({ genre: "aTeleverser" });
  });

  it("rien nulle part : vrai premier lancement, rien à demander", () => {
    const bascule = analyserBascule(creerDonneesVides(), { statut: "absente" });
    expect(bascule).toEqual({ genre: "premierLancement" });
  });

  it("contenu serveur refusé par le schéma : « illisible », et le brut est conservé", () => {
    const brut = { contrats: "pas un tableau" };
    const bascule = analyserBascule(PLEIN, { statut: "illisible", detail: "contrats : attendu un tableau", brut, jeton: JETON });
    expect(bascule).toEqual({ genre: "serveurIllisible", brut, detail: "contrats : attendu un tableau", jeton: JETON });
  });

  it("format serveur inconnu : dit comme tel, jamais confondu avec un écart de données", () => {
    const brut = { schemaDuFutur: true };
    const bascule = analyserBascule(PLEIN, { statut: "versionInattendue", attendue: 1, recue: 7, jeton: JETON, brut });
    // `brut` est transmis pour que l'écran puisse le faire sauvegarder AVANT de proposer de l'écraser.
    expect(bascule).toEqual({ genre: "versionInattendue", attendue: 1, recue: 7, jeton: JETON, brut });
  });
});

describe("analyserBascule — serveur muet (pause du palier gratuit, réseau, jeton expiré)", () => {
  it("« serveurMuet », avec le motif technique rapporté tel quel", () => {
    const bascule = analyserBascule(PLEIN, { statut: "echec", message: "Failed to fetch" });
    expect(bascule).toEqual({ genre: "serveurMuet", message: "Failed to fetch" });
  });

  it("un navigateur vide ne change rien : serveur muet reste serveur muet", () => {
    // Tentation à écarter : « le navigateur est vide, donc autant le laisser démarrer ». Non — sans
    // réponse du serveur, on ne sait pas s'il porte des données, et démarrer à vide donnerait à voir
    // une app neuve à quelqu'un dont les 62 contrats sont bien là.
    expect(analyserBascule(creerDonneesVides(), { statut: "echec", message: "paused" }).genre).toBe("serveurMuet");
  });
});
