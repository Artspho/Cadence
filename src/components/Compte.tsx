/**
 * Section « Compte » de l'onglet Mon profil — phase 2 de la refonte Supabase.
 *
 * CE QUE CETTE SECTION NE FAIT PAS, ET C'EST VOLONTAIRE : elle ne conditionne RIEN. Aucun onglet,
 * aucun bouton, aucun écran de Cadence ne dépend de l'état affiché ici. Se connecter ne déplace
 * aucune donnée : les contrats, les frais réels et le profil restent dans ce navigateur jusqu'à la
 * bascule de la phase 5. C'est écrit à l'écran, parce qu'une section « Compte » laisse
 * spontanément croire le contraire — et laisser croire que les données sont « en sécurité sur le
 * serveur » alors qu'elles n'y sont pas serait exactement le genre de fausse affirmation que ce
 * projet s'interdit.
 */

import { useState } from "react";
import { obtenirClientAuth, type ClientAuth } from "../auth/supabaseClient";
import { useSession } from "../auth/session";
import { INDICE_RETOUR_LIEN, type IndiceRetourLien } from "../auth/retourLienMagique";
import type { EtatMiroir } from "../storage/miroirSupabase";
import { LONGUEUR_MINIMALE_MOT_DE_PASSE, connexionMotDePasse, creerCompte, demanderLienMagique, seDeconnecter } from "../auth/actions";

interface CompteProps {
  /** Injecté par les tests ; par défaut, le client de l'app (`null` si non configuré). */
  client?: ClientAuth | null;
  /** Origine de retour du lien magique. Par défaut celle de la page courante. */
  origine?: string;
  /** Injecté par les tests ; par défaut, l'indice capturé au chargement de la page. */
  indiceRetour?: IndiceRetourLien;
  /** État de la copie vers Supabase (phase 3), calculé dans App. */
  etatMiroir?: EtatMiroir;
}

/**
 * Le témoin de la copie serveur. Discret par construction, et jamais une alerte.
 *
 * POURQUOI IL N'ALARME PAS, MÊME EN CAS D'ÉCHEC : l'écriture locale, elle, a réussi. Rien n'est
 * perdu. Crier au feu ici serait une fausse alerte, et une fausse alerte finit par faire ignorer les
 * vraies.
 * POURQUOI IL EXISTE QUAND MÊME : sans lui, un utilisateur connecté croirait ses données « sur le
 * serveur » alors qu'aucune copie n'a jamais abouti. C'est cette croyance-là qui coûte des données.
 */
function TemoinMiroir({ etat }: { etat: EtatMiroir }) {
  if (etat.statut === "inactif") return null;

  if (etat.statut === "encours") {
    return (
      <p className="text-xs text-faint" aria-live="polite">
        Copie vers le serveur en cours…
      </p>
    );
  }

  if (etat.statut === "copie") {
    // Formulation exacte : on date la CONFIRMATION de la copie, on ne dit pas « tes données sont en
    // sécurité » — la source de vérité reste ce navigateur jusqu'à la phase 5.
    return (
      <p className="text-xs text-faint" aria-live="polite">
        Copie sur le serveur confirmée à {new Date(etat.horodatage).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Ce navigateur reste la référence.
      </p>
    );
  }

  return (
    <div className="text-xs leading-relaxed" aria-live="polite">
      <p className="text-amber">La copie vers le serveur a échoué. Tes données sont enregistrées dans ce navigateur, comme d'habitude — rien n'est perdu.</p>
      <p className="text-faint mt-0.5">Détail : {etat.message}</p>
    </div>
  );
}

type Mode = "lienMagique" | "motDePasse";

const CLASSE_CHAMP = "w-full bg-surface-2 border border-line rounded-lg px-3 py-2";
const CLASSE_ETIQUETTE = "block text-xs uppercase tracking-[.03em] text-muted mb-1";

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h4 className="font-display text-sm font-medium tracking-tight">Compte</h4>
        <p className="text-xs text-faint leading-relaxed mt-1">
          Nouveau, et facultatif. Cadence fonctionne sans compte : se connecter ne déplace aucune donnée pour le moment.
        </p>
      </div>
      <div className="border-t border-line px-4 py-4 space-y-3 text-sm">{children}</div>
    </section>
  );
}

export function Compte({ client = obtenirClientAuth(), origine, indiceRetour = INDICE_RETOUR_LIEN, etatMiroir = { statut: "inactif" } }: CompteProps) {
  const etat = useSession(client);
  const [mode, setMode] = useState<Mode>("lienMagique");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [information, setInformation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const origineEffective = origine ?? (typeof window === "undefined" ? "" : window.location.origin);

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

  if (etat.statut === "nonConfigure") {
    return (
      <Cadre>
        <p className="text-muted leading-relaxed">
          La connexion n'est pas configurée dans cette version de Cadence. Tout le reste fonctionne normalement — tes données sont dans ce navigateur, comme d'habitude.
        </p>
      </Cadre>
    );
  }

  if (etat.statut === "chargement") {
    return (
      <Cadre>
        <p className="text-muted" aria-live="polite">
          Vérification de la connexion…
        </p>
      </Cadre>
    );
  }

  if (etat.statut === "indetermine") {
    return (
      <Cadre>
        {/* On ne dit PAS « non connecté » : on ne le sait pas. Dire l'ignorance plutôt qu'un état faux. */}
        <p className="text-amber leading-relaxed" role="alert">
          Impossible de savoir si tu es connecté : {etat.detail}
        </p>
        <p className="text-xs text-faint leading-relaxed">
          Sans conséquence sur tes données, qui sont dans ce navigateur et ne dépendent pas de la connexion.
        </p>
      </Cadre>
    );
  }

  if (etat.statut === "connecte") {
    return (
      <Cadre>
        <p className="text-ink">
          Connecté en tant que <span className="text-mint">{etat.email ?? etat.utilisateurId}</span>
        </p>
        {/* Énumération volontairement précise : le miroir de la phase 3 ne couvre QUE
            `donnees_utilisateur` (contrats, profil, périodes). Les frais réels et l'identité
            déclarative ont leurs propres stockages, pas encore recopiés. Laisser croire que tout part
            sur le serveur serait une fausse affirmation, et la plus coûteuse de toutes ici. */}
        <p className="text-xs text-faint leading-relaxed">
          Tes contrats et ton profil sont recopiés sur le serveur à chaque enregistrement. Tes frais réels, eux, ne le sont pas encore. Et dans tous les cas, c'est ce navigateur qui reste la
          référence : le basculement viendra plus tard, et il te sera demandé explicitement.
        </p>
        <TemoinMiroir etat={etatMiroir} />
        <button type="button" onClick={() => lancer(seDeconnecter)} disabled={enCours} className="px-4 py-2 rounded-lg border border-line text-muted disabled:opacity-40">
          {enCours ? "…" : "Se déconnecter"}
        </button>
        {erreur !== null && (
          <p className="text-red leading-relaxed" role="alert">
            {erreur}
          </p>
        )}
      </Cadre>
    );
  }

  // Reste le cas `deconnecte` : les deux formulaires.
  //
  // Et, le cas échéant, l'explication de l'échec d'un lien de connexion. On n'arrive ici QUE si la
  // session est fermée : sur un lien réussi, l'état vaut `connecte` et ce message n'existe pas.
  // ⚠️ Cela repose sur un point de comportement de la bibliothèque : `getSession()` attend la fin de
  // son initialisation, échange du code de l'URL compris. Si un jour ce n'était plus vrai, un message
  // d'échec pourrait apparaître une fraction de seconde avant une connexion réussie — c'est le seul
  // faux message possible ici, et c'est ce qu'il faudrait alors corriger.
  return (
    <Cadre>
      {indiceRetour.present && (
        <div className="rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 space-y-1" role="status">
          <p className="text-amber leading-relaxed">
            {indiceRetour.erreurTransmise === null
              ? "Un lien de connexion a été ouvert, mais il n'a pas ouvert de session."
              : `Ce lien de connexion a été refusé : ${indiceRetour.erreurTransmise}`}
          </p>
          {/* DEUX SITUATIONS DISTINCTES, DEUX EXPLICATIONS — ne pas les refondre en une seule.
              Erreur trouvée en conditions réelles le 04/08/2026, juste après le premier correctif :
              l'explication « demandé depuis un autre navigateur » s'affichait AUSSI quand Supabase
              avait transmis « Email link is invalid or has expired ». C'était alors une cause FAUSSE
              affichée sous une erreur exacte — pire que le silence qu'on venait de supprimer.
              · Supabase a transmis un motif => on cite son motif et on ne devine AUCUNE cause ;
              · aucun motif transmis, mais un code était présent => l'échange a échoué côté
                navigateur, et là l'absence de la clé PKCE est bien l'explication la plus probable. */}
          {indiceRetour.erreurTransmise === null ? (
            <p className="text-xs text-faint leading-relaxed">
              La cause la plus probable : le lien a été demandé depuis un autre navigateur que celui-ci, or c'est le navigateur demandeur qui détient la clé de la session. Redemande un lien ci-dessous,
              depuis ce navigateur-ci, et ouvre-le ici.
            </p>
          ) : (
            <p className="text-xs text-faint leading-relaxed">
              Un lien de connexion ne sert qu'une fois et n'est valable qu'un temps limité. Redemande-en un ci-dessous, depuis ce navigateur-ci, et ouvre-le ici.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("lienMagique");
            setErreur(null);
            setInformation(null);
          }}
          className={`px-3 py-1.5 rounded-lg border text-xs ${mode === "lienMagique" ? "border-mint text-mint" : "border-line text-muted"}`}
        >
          Lien par e-mail
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("motDePasse");
            setErreur(null);
            setInformation(null);
          }}
          className={`px-3 py-1.5 rounded-lg border text-xs ${mode === "motDePasse" ? "border-mint text-mint" : "border-line text-muted"}`}
        >
          Mot de passe
        </button>
      </div>

      <div>
        <label className={CLASSE_ETIQUETTE} htmlFor="compte-email">
          Adresse e-mail
        </label>
        <input id="compte-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLASSE_CHAMP} />
      </div>

      {mode === "lienMagique" ? (
        <>
          <button
            type="button"
            onClick={() => lancer((c) => demanderLienMagique(c, email, origineEffective))}
            disabled={enCours}
            className="w-full bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enCours ? "Envoi…" : "Recevoir un lien de connexion"}
          </button>
          <p className="text-xs text-faint leading-relaxed">
            Le lien doit être ouvert depuis ce navigateur : c'est lui qui détient la clé de la session, elle ne voyage pas dans l'e-mail.
          </p>
        </>
      ) : (
        <>
          <div>
            <label className={CLASSE_ETIQUETTE} htmlFor="compte-mot-de-passe">
              Mot de passe
            </label>
            <input
              id="compte-mot-de-passe"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className={CLASSE_CHAMP}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => lancer((c) => connexionMotDePasse(c, email, motDePasse))}
              disabled={enCours}
              className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enCours ? "…" : "Se connecter"}
            </button>
            <button
              type="button"
              onClick={() => lancer((c) => creerCompte(c, email, motDePasse, origineEffective))}
              disabled={enCours}
              className="px-4 rounded-lg border border-line text-muted disabled:opacity-40"
            >
              Créer un compte
            </button>
          </div>
          <p className="text-xs text-faint leading-relaxed">{LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum.</p>
        </>
      )}

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
