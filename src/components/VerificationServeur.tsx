/**
 * Panneau de vérification chiffrée, construit en phase 4 — ⚠️ REPRIS APRÈS LA BASCULE (phase 5,
 * 05/08/2026) : son texte affirmait encore « ce navigateur reste la référence », trouvé faux en
 * vérifiant à l'écran une session réelle. Aucun des tests alors verts ne l'avait détecté — un test
 * ne compare un composant qu'à lui-même, jamais à ce que dit le reste de l'app.
 *
 * CE QU'IL NE FAIT PAS, ET C'EST TOUJOURS TOUT L'INTÉRÊT : il n'a aucun bouton qui télécharge,
 * restaure, remplace ou efface quoi que ce soit. Il lit le serveur, il compare, il affiche un
 * verdict — un second regard, sur demande, en plus de la comparaison automatique que `App.tsx` fait
 * déjà à chaque ouverture (`storage/bascule.ts`).
 *
 * ⚠️ CE QU'IL NE FAUT PLUS LUI FAIRE DIRE : quel des deux côtés fait référence. Avant la bascule, la
 * réponse était fixe (le navigateur, toujours). Depuis, ça dépend de l'état de l'app au moment du
 * clic — ce panneau ne le connaît pas, donc il ne doit plus trancher.
 *
 * POURQUOI LA LECTURE EST DÉCLENCHÉE PAR UN BOUTON ET NON AU CHARGEMENT : rester un acte délibéré,
 * daté, décidé par l'utilisateur — pas déclenché dans le dos de quelqu'un qui ouvrait simplement
 * l'onglet.
 */

import { useState } from "react";
import type { ClientLectureDonnees } from "../auth/supabaseClient";
import type { DonneesApp } from "../storage/localStorageAdapter";
import { verifierMigration, type Decompte, type Verdict } from "../storage/verificationMigration";

interface VerificationServeurProps {
  client: ClientLectureDonnees | null;
  utilisateurId: string;
  donnees: DonneesApp | null;
  /** Injecté par les tests, pour ne pas dépendre de `crypto.subtle` sous jsdom. */
  verifier?: typeof verifierMigration;
}

/** L'empreinte en entier serait illisible ; tronquée, elle reste comparable à l'œil. */
function Empreinte({ valeur }: { valeur: string }) {
  return <code className="text-[11px] break-all">{valeur.slice(0, 32)}…</code>;
}

function LigneDecompte({ titre, decompte }: { titre: string; decompte: Decompte }) {
  return (
    <p className="text-xs text-faint">
      {titre} : <span className="text-ink">{decompte.contrats}</span> contrats, <span className="text-ink">{decompte.periodes}</span> périodes,{" "}
      <span className="text-ink">{decompte.exercicesGeles}</span> exercices figés, profil {decompte.profilPresent ? "présent" : "absent"}
    </p>
  );
}

function Resultat({ verdict }: { verdict: Verdict }) {
  if (verdict.statut === "identique") {
    return (
      <div className="rounded-lg border border-mint/40 bg-mint/5 px-3 py-2 space-y-1" role="status">
        {/* ⚠️ ÉNUMÉRATION OBLIGATOIRE, ET NON « les mêmes données » : la comparaison ne porte que sur
            ce que le miroir de la phase 3 copie. Les frais réels et l'identité déclarative ont leurs
            propres stockages et ne sont PAS ici. Un « identique » formulé largement laisserait croire
            que tout est sur le serveur — la fausse affirmation la plus coûteuse possible à cet
            endroit, puisqu'elle inviterait à faire confiance à une copie qui n'existe pas. */}
        <p className="text-mint">Identique. Le serveur porte exactement les mêmes contrats, profil, périodes et exercices figés que ce navigateur.</p>
        <LigneDecompte titre="Des deux côtés" decompte={verdict.local} />
        <p className="text-xs text-faint">
          Empreinte SHA-256 commune : <Empreinte valeur={verdict.empreinte} />
        </p>
        {verdict.majLe !== null && <p className="text-xs text-faint">Copie serveur datée du {new Date(verdict.majLe).toLocaleString("fr-FR")}.</p>}
      </div>
    );
  }

  if (verdict.statut === "different") {
    return (
      <div className="rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 space-y-1" role="alert">
        <p className="text-amber">Différent. Le serveur ne porte pas les mêmes contrats, profil, périodes ou exercices figés que ce navigateur.</p>
        <p className="text-xs text-faint">Écart sur : {verdict.differences.join(", ")}.</p>
        <LigneDecompte titre="Ce navigateur" decompte={verdict.local} />
        <LigneDecompte titre="Le serveur" decompte={verdict.serveur} />
        <p className="text-xs text-faint">
          Empreinte locale : <Empreinte valeur={verdict.empreinteLocale} />
        </p>
        <p className="text-xs text-faint">
          Empreinte serveur : <Empreinte valeur={verdict.empreinteServeur} />
        </p>
        {verdict.majLe !== null && <p className="text-xs text-faint">Copie serveur datée du {new Date(verdict.majLe).toLocaleString("fr-FR")}.</p>}
        {/* Dit explicitement, parce qu'un cadre orange fait spontanément craindre une perte — mais
            SANS trancher lequel des deux côtés fait référence : ce panneau ne le sait pas, et
            l'affirmer à sa place serait exactement la fausse réassurance trouvée le 05/08/2026. */}
        <p className="text-xs text-faint">Ce bouton n'a rien modifié, ni ici ni sur le serveur. Recharge Cadence pour revoir la comparaison automatique et, si l'écart est réel, la question qu'elle pose.</p>
      </div>
    );
  }

  if (verdict.statut === "absente") {
    return (
      <p className="text-xs text-faint leading-relaxed" role="status">
        Aucune donnée n'a encore été copiée sur le serveur pour ce compte. Ce n'est pas un écart : il n'y a simplement rien à comparer.
      </p>
    );
  }

  if (verdict.statut === "versionInattendue") {
    return (
      <div className="rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 space-y-1" role="alert">
        <p className="text-amber">Comparaison impossible : la copie serveur a été écrite dans un autre format.</p>
        <p className="text-xs text-faint">
          Format attendu : {verdict.attendue}. Format trouvé : {String(verdict.recue)}. Aucun verdict n'est rendu — un écart annoncé ici viendrait du format, pas de tes
          données.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 space-y-1" role="alert">
      <p className="text-amber">La vérification n'a pas pu aboutir. Aucun verdict n'est rendu.</p>
      <p className="text-xs text-faint">Détail : {verdict.message}</p>
    </div>
  );
}

export function VerificationServeur({ client, utilisateurId, donnees, verifier = verifierMigration }: VerificationServeurProps) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Pas de configuration, ou données locales illisibles : il n'y a rien d'honnête à comparer. On
  // n'affiche donc pas un bouton qui ne pourrait rendre qu'un échec.
  if (!client || !donnees) return null;

  async function lancer() {
    setEnCours(true);
    setVerdict(null);
    try {
      setVerdict(await verifier(client!, utilisateurId, donnees!));
    } catch (incident: unknown) {
      // `verifierMigration` ne lève pas ; ce filet couvre une future implémentation injectée qui,
      // elle, pourrait lever. Un bouton bloqué sur « … » serait une panne visible sans explication.
      setVerdict({ statut: "echec", message: incident instanceof Error ? incident.message : String(incident) });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="border-t border-line pt-3 space-y-2">
      <p className="text-xs text-faint leading-relaxed">
        Vérification de la copie serveur : compare, octet par octet, les contrats, le profil, les périodes et les exercices figés. Les frais réels n'en font pas partie — ils ne sont
        pas encore copiés. Aucune donnée n'est déplacée ni modifiée.
      </p>
      <button type="button" onClick={lancer} disabled={enCours} className="px-4 py-2 rounded-lg border border-line text-muted disabled:opacity-40">
        {enCours ? "Vérification…" : "Vérifier la copie serveur"}
      </button>
      {verdict !== null && <Resultat verdict={verdict} />}
    </div>
  );
}
