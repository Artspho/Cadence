/**
 * Banc d'essai de l'écran de revue, en développement uniquement.
 *
 * But : valider l'UX et le routage des propositions AVANT de brancher le moindre appel réseau à
 * Mistral (aucun document réel ne doit transiter tant que le DPA n'est pas réglé). Les extractions
 * viennent de lib/fixturesExtraction.ts, en dur.
 *
 * ⚠️ DEUX GARDE-FOUS, tous les deux volontaires :
 *
 * 1. Rendu uniquement si `import.meta.env.DEV`. Les montants des fixtures sont FICTIFS : les
 *    montrer à un vrai utilisateur serait exactement le faux chiffre que le devoir sacré n°2
 *    interdit. Le garde vit ici (et non seulement chez l'appelant) pour que ce composant reste
 *    inoffensif où qu'on l'importe.
 *
 * 2. BAC À SABLE : les propositions validées ici n'écrivent RIEN dans les vraies données. Elles
 *    atterrissent dans une copie locale du profil, jetée au rechargement de la page. Sans ça, un
 *    clic sur « Enregistrer dans mon profil » inscrirait une allocation journalière inventée et
 *    une franchise inventée dans le vrai profil, et faussererait tous les montants affichés
 *    ensuite (devoirs sacrés n°1 ET n°2). La validation appelée est en revanche la VRAIE
 *    (`validerProfilPourEcriture`, celle d'App.tsx) : c'est bien elle qu'on veut éprouver.
 */

import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { validerProfilPourEcriture, type ResultatEcritureProfil } from "../lib/coherenceProfil";
import { FIXTURES_EXTRACTION } from "../lib/fixturesExtraction";
import { LABELS_VALEURS, RevueExtraction } from "./RevueExtraction";

interface RevueExtractionDemoProps {
  /** Profil réel, utilisé UNIQUEMENT comme point de départ de la copie de travail. Jamais modifié. */
  profilReel: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
}

/** Enveloppe : aucun hook ici, pour que le garde `DEV` puisse court-circuiter sans risque. */
export function RevueExtractionDemo(props: RevueExtractionDemoProps) {
  if (!import.meta.env.DEV) return null;
  return <BancEssaiRevue {...props} />;
}

function BancEssaiRevue({ profilReel, config, decompteActuel }: RevueExtractionDemoProps) {
  const [fixtureId, setFixtureId] = useState(FIXTURES_EXTRACTION[0].id);
  const [profilBacASable, setProfilBacASable] = useState<Profil>(profilReel);
  const [contratsBacASable, setContratsBacASable] = useState<Omit<Contrat, "id">[]>([]);

  const fixture = FIXTURES_EXTRACTION.find((f) => f.id === fixtureId) ?? FIXTURES_EXTRACTION[0];

  function changerFixture(id: string) {
    setFixtureId(id);
    reinitialiser();
  }

  function reinitialiser() {
    setProfilBacASable(profilReel);
    setContratsBacASable([]);
  }

  /** Même validation que la vraie écriture (App.tsx modifierProfil) — seule la destination diffère. */
  function modifierProfilBacASable(candidat: Profil): ResultatEcritureProfil {
    const resultat = validerProfilPourEcriture(candidat);
    if (resultat.ok) setProfilBacASable(resultat.profil);
    return resultat;
  }

  const bandeau = (
    <div className="bg-red/10 border border-red/40 rounded-card p-4 space-y-2">
      <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-red/15 text-red">
        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
        Maquette de test — données inventées
      </span>
      <p className="text-sm text-muted leading-relaxed">
        Cet écran tourne sur une extraction <span className="text-ink">simulée</span> : aucun document n'est envoyé, aucun appel réseau n'a lieu, et
        les montants affichés sont <span className="text-ink">fictifs</span>. Ce que tu valides ici va dans une copie de travail jetable —{" "}
        <span className="text-ink">ton vrai profil et tes vrais contrats ne sont pas touchés</span>.
      </p>
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <label className="text-xs text-muted" htmlFor="demo-fixture">
          Extraction simulée
        </label>
        <select
          id="demo-fixture"
          value={fixtureId}
          onChange={(e) => changerFixture(e.target.value)}
          className="bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
        >
          {FIXTURES_EXTRACTION.map((f) => (
            <option key={f.id} value={f.id}>
              {f.libelle}
            </option>
          ))}
        </select>
        <button onClick={reinitialiser} className="px-3 py-1.5 rounded-lg border border-line text-muted text-xs hover:text-ink transition-colors">
          Vider la copie de travail
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* `key` : remet à zéro l'état interne de l'écran de revue (cartes traitées, formulaire
          ouvert) quand on change de fixture — sinon une carte « Enregistré » resterait marquée
          comme telle sur l'extraction suivante. */}
      <RevueExtraction
        key={fixtureId}
        resultat={fixture.resultat}
        profil={profilBacASable}
        config={config}
        decompteActuel={decompteActuel}
        onAjouterContrat={(contrat) => setContratsBacASable((liste) => [...liste, contrat])}
        onModifierProfil={modifierProfilBacASable}
        bandeau={bandeau}
      />

      <EtatBacASable profil={profilBacASable} contrats={contratsBacASable} />
    </div>
  );
}

/**
 * Montre où les propositions ont réellement atterri. C'est la preuve du routage : une valeur qui
 * s'affiche dans la mauvaise ligne ici s'afficherait dans le mauvais champ en production.
 */
function EtatBacASable({ profil, contrats }: { profil: Profil; contrats: Omit<Contrat, "id">[] }) {
  const lignes: { libelle: string; valeur: string }[] = [
    { libelle: "Date anniversaire", valeur: profil.dateAnniversaire || "—" },
    { libelle: "Date de naissance", valeur: profil.dateNaissance || "—" },
    { libelle: "Situation", valeur: LABELS_VALEURS[profil.situation] ?? profil.situation },
    { libelle: "Durée des droits (mois)", valeur: profil.dureeDroitsMois?.toString() ?? "—" },
    { libelle: "Ouverture — date", valeur: profil.ouvertureDroits?.dateOuverture ?? "—" },
    { libelle: "Ouverture — franchise CP (jours)", valeur: profil.ouvertureDroits?.franchiseCPTotale?.toString() ?? "—" },
    { libelle: "Ouverture — délai d'attente (jours)", valeur: profil.ouvertureDroits?.delaiAttenteInitial?.toString() ?? "—" },
    { libelle: "Ouverture — date limite", valeur: profil.ouvertureDroits?.dateLimiteIndemnisation ?? "—" },
    { libelle: "Ouverture — prélèvement à la source (%)", valeur: profil.ouvertureDroits?.tauxPrelevementSource?.toString() ?? "—" },
    {
      libelle: "AJ nette (historique)",
      valeur: (profil.ajReelleHistorique ?? []).map((e) => `${e.dateEffet} → ${e.valeur} €`).join(" · ") || "—",
    },
  ];

  return (
    <div className="bg-surface-2 border border-line rounded-card p-5 space-y-3">
      <h3 className="font-display text-base font-medium tracking-tight">Copie de travail — où les valeurs ont atterri</h3>
      <p className="text-xs text-faint leading-relaxed">
        Contenu de la copie jetable, pour vérifier que chaque proposition va bien dans le champ attendu. Rien de tout ceci n'est enregistré.
      </p>
      <dl className="text-sm divide-y divide-line/60 border-y border-line/60">
        {lignes.map((l) => (
          <div key={l.libelle} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-muted">{l.libelle}</dt>
            <dd className={l.valeur === "—" ? "text-faint" : "text-ink"}>{l.valeur}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs uppercase tracking-[.03em] text-muted mb-2">Contrats retenus ({contrats.length})</p>
        {contrats.length === 0 ? (
          <p className="text-sm text-faint">Aucun contrat validé dans cette copie de travail.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {contrats.map((c, i) => (
              <li key={i} className="text-ink">
                {c.dateDebut} → {c.date} · {c.employeur} · {c.salaireBrut} € · {c.type} / {c.typeRemuneration}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
