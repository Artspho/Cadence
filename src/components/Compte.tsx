/**
 * Section « Compte » de l'onglet Mon profil — phase 2, reprise à la BASCULE de la phase 5,
 * simplifiée à la CONNEXION OBLIGATOIRE (05/08/2026).
 *
 * ⚠️ CE QUE CETTE SECTION DISAIT JUSQU'AU 05/08/2026 (BASCULE), ET QUI ÉTAIT DEVENU FAUX : « se
 * connecter ne déplace aucune donnée ». C'était exact tant que Supabase ne recevait qu'une copie.
 * Depuis la bascule, se connecter change la source de vérité — le serveur est lu à l'ouverture et
 * écrit à chaque enregistrement.
 *
 * ⚠️ CE QUI A CHANGÉ LE MÊME JOUR, PLUS TARD, AVEC LA CONNEXION OBLIGATOIRE : ce composant ne gère
 * plus les états `nonConfigure`/`chargement`/`indetermine`/`deconnecte` — ils sont devenus
 * inatteignables. `MonProfil` (donc `Compte`) n'est monté par `App.tsx` qu'APRÈS le mur
 * (`components/EcranConnexionObligatoire.tsx`), qui est aussi désormais le seul appelant de
 * `useSession` dans toute l'app : ce composant reçoit sa session déjà résolue et connectée, en prop,
 * plutôt que de la dériver une seconde fois avec son propre abonnement (ce qu'il faisait avant, en
 * double de `App.tsx`). Les quatre branches retirées, et leurs tests, ont migré vers
 * `EcranConnexionObligatoire.tsx` — sauf le cycle de vie du hook lui-même (abonnement/désabonnement),
 * qui vit maintenant dans `auth/__tests__/session.test.ts`.
 *
 * Ce qui reste vrai, et qui est dit tel quel : les frais réels et l'identité déclarative ne partent
 * toujours PAS sur le serveur (stockages séparés) — dette ouverte, à traiter avant la phase 6.
 */

import { useState } from "react";
import { obtenirClientAuth, obtenirClientLectureDonnees, type ClientAuth, type ClientLectureDonnees } from "../auth/supabaseClient";
import type { SessionConnectee } from "../auth/session";
import type { EtatEnregistrement } from "../storage/sourceSupabase";
import type { DonneesApp } from "../storage/localStorageAdapter";
import { VerificationServeur } from "./VerificationServeur";
import { LONGUEUR_MINIMALE_MOT_DE_PASSE, definirMotDePasse, seDeconnecter } from "../auth/actions";

interface CompteProps {
  /** Résolue par le mur (`EcranConnexionObligatoire.tsx`, via `App.tsx`) — jamais dérivée ici. */
  session: SessionConnectee;
  /** Pour les actions (déconnexion, mot de passe) — injecté par les tests ; par défaut le client de l'app. */
  client?: ClientAuth | null;
  /** État du dernier enregistrement sur le serveur (phase 5). Calculé dans App. */
  etatEnregistrement?: EtatEnregistrement;
  /** Phase 4 : les données de CE navigateur, pour les comparer à la copie serveur. Jamais écrites. */
  donnees?: DonneesApp | null;
  /** Phase 4 : la surface de lecture. Injectée par les tests ; par défaut celle de l'app. */
  clientLecture?: ClientLectureDonnees | null;
}

/**
 * Le témoin de l'enregistrement serveur.
 *
 * ⚠️ SES FORMULATIONS ONT ÉTÉ REPRISES À LA BASCULE (05/08/2026), ET IL FAUT COMPRENDRE POURQUOI
 * AVANT D'Y RETOUCHER. En phase 3, ce témoin était volontairement discret et ne s'alarmait jamais :
 * un échec de copie était bénin, puisque l'écriture locale — la seule qui faisait référence — avait
 * réussi. Il disait donc « tes données sont enregistrées dans ce navigateur, comme d'habitude », et
 * c'était vrai.
 *
 * Depuis la bascule, la même situation a changé de sens : un échec signifie que la saisie n'est PAS
 * à l'endroit qui fait référence. Continuer à rassurer serait un faux feu vert (devoir n°2), et
 * précisément le genre de croyance qui coûte des données. D'où un ton différent selon les cas : muet
 * quand tout va bien, explicite quand ça ne va pas.
 */
function TemoinEnregistrement({ etat }: { etat: EtatEnregistrement }) {
  if (etat.statut === "inactif") return null;

  if (etat.statut === "encours") {
    return (
      <p className="text-xs text-faint" aria-live="polite">
        Enregistrement sur le serveur…
      </p>
    );
  }

  if (etat.statut === "enregistre") {
    // On date la CONFIRMATION rendue par le serveur, jamais une heure d'écriture supposée.
    return (
      <p className="text-xs text-faint" aria-live="polite">
        Enregistré sur le serveur à {new Date(etat.horodatage).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
      </p>
    );
  }

  if (etat.statut === "lectureSeule") {
    return (
      <div className="text-xs leading-relaxed" aria-live="polite">
        <p className="text-amber">Lecture seule : le serveur ne répond pas. Rien de ce que tu saisirais ne serait conservé.</p>
        <p className="text-faint mt-0.5">Détail : {etat.message}</p>
      </div>
    );
  }

  return (
    <div className="text-xs leading-relaxed" aria-live="polite">
      {/* Formulation retournée par rapport à la phase 3, et c'est le cœur du changement : ce n'est
          plus « rien n'est perdu », c'est « ce n'est pas au bon endroit ». */}
      <p className="text-red">
        L'enregistrement sur le serveur a échoué. Ta dernière saisie est dans ce navigateur, mais elle n'est <strong className="font-medium">pas</strong> sur le serveur — et c'est le
        serveur qui fait référence. Ne compte pas dessus depuis un autre appareil.
      </p>
      <p className="text-faint mt-0.5">Détail : {etat.message}</p>
    </div>
  );
}

const CLASSE_ETIQUETTE = "block text-xs uppercase tracking-[.03em] text-muted mb-1";

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h4 className="font-display text-sm font-medium tracking-tight">Compte</h4>
        <p className="text-xs text-faint leading-relaxed mt-1">
          C'est le serveur qui fait référence : tes contrats y sont enregistrés, et relus à chaque ouverture. Tes justificatifs de frais réels, eux, restent dans ce navigateur.
        </p>
      </div>
      <div className="border-t border-line px-4 py-4 space-y-3 text-sm">{children}</div>
    </section>
  );
}

export function Compte({
  session,
  client = obtenirClientAuth(),
  etatEnregistrement = { statut: "inactif" },
  donnees = null,
  clientLecture = obtenirClientLectureDonnees(),
}: CompteProps) {
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [information, setInformation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Toute action passe par ici : un seul endroit qui remet les messages à zéro avant d'agir, et un
  // seul endroit qui relâche `enCours` — y compris si l'action lève, sinon un bouton resterait
  // désactivé pour toujours après un incident réseau.
  async function lancer(action: (client: ClientAuth) => Promise<{ ok: boolean; message: string | null }>) {
    if (!client) return;
    setEnCours(true);
    setErreur(null);
    setInformation(null);
    try {
      const resultat = await action(client);
      if (resultat.ok) setInformation(resultat.message);
      else setErreur(resultat.message);
    } catch (incident: unknown) {
      setErreur(incident instanceof Error ? incident.message : String(incident));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Cadre>
      <p className="text-ink">
        Connecté en tant que <span className="text-mint">{session.email ?? session.utilisateurId}</span>
      </p>
      {/*
       * Énumération volontairement précise : le serveur ne couvre QUE `donnees_utilisateur` (contrats,
       * profil, périodes, exercices figés). Les frais réels et l'identité déclarative ont leurs propres
       * stockages, jamais recopiés — dette ouverte, cf. cadence_refonte_supabase.md. Laisser croire que
       * tout part sur le serveur serait la fausse affirmation la plus coûteuse possible ici.
       */}
      <p className="text-xs text-faint leading-relaxed">
        Tes contrats et ton profil sont enregistrés sur le serveur : c'est lui qui fait référence, et il est relu à chaque ouverture de Cadence. Tes frais réels, eux, restent uniquement
        dans ce navigateur.
      </p>
      <TemoinEnregistrement etat={etatEnregistrement} />
      <VerificationServeur client={clientLecture} utilisateurId={session.utilisateurId} donnees={donnees} />

      <div className="border-t border-line pt-3">
        <label className={CLASSE_ETIQUETTE} htmlFor="compte-nouveau-mot-de-passe">
          Définir un mot de passe
        </label>
        <p className="text-xs text-faint leading-relaxed mb-2">
          Pour te connecter aussi sans lien magique, par exemple depuis un autre appareil.
        </p>
        <div className="flex gap-2">
          <input
            id="compte-nouveau-mot-de-passe"
            type="password"
            autoComplete="new-password"
            value={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)}
            className="flex-1 w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
          />
          <button
            type="button"
            onClick={() => lancer((c) => definirMotDePasse(c, nouveauMotDePasse))}
            disabled={enCours}
            className="px-4 rounded-lg border border-line text-muted disabled:opacity-40"
          >
            {enCours ? "…" : "Enregistrer"}
          </button>
        </div>
        <p className="text-xs text-faint leading-relaxed mt-1">{LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum.</p>
      </div>

      {/* ⚠️ Se déconnecter renvoie immédiatement au mur (`EcranConnexionObligatoire.tsx`) : `App.tsx`
          détecte le changement de session via son propre `useSession` et remplace tout le reste du
          rendu. Rien ici n'a besoin de le provoquer explicitement. */}
      <button type="button" onClick={() => lancer(seDeconnecter)} disabled={enCours} className="px-4 py-2 rounded-lg border border-line text-muted disabled:opacity-40">
        {enCours ? "…" : "Se déconnecter"}
      </button>
      {information !== null && (
        <p className="text-muted leading-relaxed" aria-live="polite">
          {information}
        </p>
      )}
      {erreur !== null && (
        <p className="text-red leading-relaxed" role="alert">
          {erreur}
        </p>
      )}
    </Cadre>
  );
}
