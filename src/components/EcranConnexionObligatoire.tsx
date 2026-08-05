/**
 * Le mur — écran affiché à la place de TOUTE l'application tant qu'aucune session n'est ouverte.
 *
 * Décision de Benoît du 05/08/2026, prise en dehors du plan de la phase 6 : Cadence exige désormais
 * un compte pour être utilisée. Avant cette décision, `auth/session.ts` documentait et
 * `App.sansCompte.test.tsx` prouvait l'inverse (« l'app s'ouvre sans compte ») — cette garantie est
 * retirée, remplacée par celle-ci.
 *
 * Ce composant ne réinvente aucune logique d'authentification : `connexionMotDePasse`, `creerCompte`
 * et `demanderLienMagique` (auth/actions.ts) sont exactement celles déjà éprouvées par `Compte.tsx`.
 * Seul le JSX est nouveau — plein écran, bloquant, au lieu d'une section imbriquée dans « Mon
 * profil ».
 *
 * ⚠️ CAS `nonConfigure` — FRAGILITÉ NOUVELLE, ASSUMÉE : avant cette décision, l'absence de
 * configuration Supabase faisait retomber Cadence sur le localStorage (utilisable quand même). Ce
 * repli n'existe plus : sans configuration, plus personne ne peut ouvrir Cadence. C'est la
 * conséquence mécanique de « pas de compte, pas d'usage » — il n'y a pas de compte possible sans
 * connexion configurée. Ce cas est donc traité comme une panne à dire clairement, jamais comme un
 * mode dégradé rassurant.
 */
import { useState } from "react";
import { obtenirClientAuth, type ClientAuth } from "../auth/supabaseClient";
import type { EtatSession } from "../auth/session";
import { INDICE_RETOUR_LIEN, type IndiceRetourLien } from "../auth/retourLienMagique";
import { LONGUEUR_MINIMALE_MOT_DE_PASSE, connexionMotDePasse, creerCompte, demanderLienMagique } from "../auth/actions";

interface EcranConnexionObligatoireProps {
  /** Calculée par App.tsx (useSession) — pas de second abonnement à onAuthStateChange ici. */
  session: EtatSession;
  /** Injecté par les tests ; par défaut, le client de l'app (`null` si non configuré). */
  client?: ClientAuth | null;
  /** Origine de retour du lien magique. Par défaut celle de la page courante. */
  origine?: string;
  /** Injecté par les tests ; par défaut, l'indice capturé au chargement de la page. */
  indiceRetour?: IndiceRetourLien;
}

const CLASSE_CHAMP = "w-full bg-surface-2 border border-line rounded-lg px-3 py-2";
const CLASSE_ETIQUETTE = "block text-xs uppercase tracking-[.03em] text-muted mb-1";

function Cadre({ enTete, children }: { enTete?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6 py-10">
      <div className="max-w-[420px] w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-medium">Cadence</h1>
          {enTete}
        </div>
        <div className="bg-surface border border-line rounded-card p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

type Mode = "lienMagique" | "motDePasse";

export function EcranConnexionObligatoire({
  session,
  client = obtenirClientAuth(),
  origine,
  indiceRetour = INDICE_RETOUR_LIEN,
}: EcranConnexionObligatoireProps) {
  const [mode, setMode] = useState<Mode>("lienMagique");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [information, setInformation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const origineEffective = origine ?? (typeof window === "undefined" ? "" : window.location.origin);

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

  if (session.statut === "nonConfigure") {
    return (
      <Cadre enTete={<p className="text-sm text-red">Connexion indisponible</p>}>
        <p className="text-sm text-ink leading-relaxed" role="alert">
          La connexion n'est pas configurée dans cette version de Cadence — l'application ne peut pas fonctionner sans elle actuellement, un compte étant désormais nécessaire pour l'utiliser.
        </p>
        <p className="text-xs text-faint leading-relaxed">Signale ce message : ce n'est pas un état normal.</p>
      </Cadre>
    );
  }

  if (session.statut === "chargement") {
    return (
      <Cadre>
        <p className="text-muted text-sm" aria-live="polite">
          Vérification de la connexion…
        </p>
      </Cadre>
    );
  }

  if (session.statut === "indetermine") {
    return (
      <Cadre enTete={<p className="text-sm text-amber">Connexion incertaine</p>}>
        {/* On ne dit PAS « non connecté » : on ne le sait pas. Dire l'ignorance plutôt qu'un état faux. */}
        <p className="text-sm text-amber leading-relaxed" role="alert">
          Impossible de savoir si tu es connecté : {session.detail}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="w-full bg-mint text-bg font-medium rounded-lg py-2.5">
          Réessayer
        </button>
      </Cadre>
    );
  }

  if (session.statut === "connecte") {
    // Ne devrait jamais être rendu : App.tsx bascule vers le reste de l'app dès que la session est
    // connectée. Garde-fou explicite plutôt qu'un écran muet si jamais ce cas était atteint.
    return null;
  }

  // Reste le cas `deconnecte` : les deux formulaires — connexion ET création de compte, la même
  // porte sert le premier lancement et les suivants (cf. `creerCompte`/`connexionMotDePasse`).
  return (
    <Cadre enTete={<p className="text-sm text-muted leading-relaxed">Un compte est nécessaire pour utiliser Cadence : tes données y sont enregistrées, et retrouvables depuis n'importe quel appareil.</p>}>
      {indiceRetour.present && (
        <div className="rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 space-y-1" role="status">
          <p className="text-amber leading-relaxed text-sm">
            {indiceRetour.erreurTransmise === null
              ? "Un lien de connexion a été ouvert, mais il n'a pas ouvert de session."
              : `Ce lien de connexion a été refusé : ${indiceRetour.erreurTransmise}`}
          </p>
          {/* Même distinction que Compte.tsx (04/08/2026) : ne pas remplacer le motif transmis par
              Supabase par une supposition, et inversement ne pas rester muet quand aucun motif n'est
              transmis. */}
          {indiceRetour.erreurTransmise === null ? (
            <p className="text-xs text-faint leading-relaxed">
              La cause la plus probable : le lien a été demandé depuis un autre navigateur que celui-ci, or c'est le navigateur demandeur qui détient la clé de la session. Redemande un lien
              ci-dessous, depuis ce navigateur-ci, et ouvre-le ici.
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
        <label className={CLASSE_ETIQUETTE} htmlFor="connexion-email">
          Adresse e-mail
        </label>
        <input id="connexion-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLASSE_CHAMP} />
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
          <p className="text-xs text-amber leading-relaxed">
            Le lien doit être ouvert depuis ce navigateur-ci : c'est lui qui détient la clé de la session, elle ne voyage pas dans l'e-mail. Si tu lis tes e-mails sur ton téléphone mais que tu as
            demandé le lien depuis un ordinateur (ou l'inverse), ouvre-le quand même depuis l'appareil qui a fait la demande — sinon la connexion échouera.
          </p>
        </>
      ) : (
        <>
          <div>
            <label className={CLASSE_ETIQUETTE} htmlFor="connexion-mot-de-passe">
              Mot de passe
            </label>
            <input
              id="connexion-mot-de-passe"
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
        <p className="text-muted leading-relaxed text-sm" aria-live="polite">
          {information}
        </p>
      )}
      {erreur !== null && (
        <p className="text-red leading-relaxed text-sm" role="alert">
          {erreur}
        </p>
      )}
    </Cadre>
  );
}
