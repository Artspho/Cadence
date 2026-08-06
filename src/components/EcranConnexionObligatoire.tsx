/**
 * Le mur — écran affiché à la place de TOUTE l'application tant qu'aucune session n'est ouverte.
 *
 * Décision de Benoît du 05/08/2026 : Cadence exige un compte pour être utilisée. Avant cette
 * décision, `auth/session.ts` documentait et `App.sansCompte.test.tsx` prouvait l'inverse (« l'app
 * s'ouvre sans compte ») — cette garantie est retirée, remplacée par celle-ci.
 *
 * ═══ REFONTE DU 06/08/2026, SUR DEMANDE DE BENOÎT — LIRE AVANT DE TOUCHER À CET ÉCRAN ═══
 *
 * 🔴 **LE DÉFAUT QUI A DÉCLENCHÉ CETTE REFONTE, ET QU'AUCUN TEST N'A VU (cinquième fois).** Benoît ne
 * pouvait pas créer de compte : « Créer un compte reste grisé même avec la case cochée ». Mesuré dans
 * le navigateur, le bouton était ACTIF (`disabled=false`, curseur main, opacité 1). Son seul écart
 * visuel entre inactif et actif était l'opacité (0,4 → 1) sur du texte `text-muted` gris, fond
 * transparent, posé à côté d'un « Se connecter » vert vif. Personne ne pouvait le lire comme
 * cliquable. Un test vérifiait pourtant `not.toBeDisabled()` et passait — un test ne compare un
 * composant qu'à lui-même, jamais à ce qu'un œil humain en conclut. D'où `BOUTON_PRINCIPAL` /
 * `BOUTON_SECONDAIRE` dans `CadrePleinEcran.tsx` : l'action principale d'un écran porte toujours un
 * fond plein. **Ne pas remettre une action essentielle en style secondaire.**
 *
 * ⚠️ **LE LIEN MAGIQUE A ÉTÉ SUPPRIMÉ — NE PAS LE RÉTABLIR SANS DEMANDER.** Motif de Benoît : « je ne
 * comprends pas l'intérêt du lien magique, il me gonfle ». Il avait raison : c'était une connexion
 * SANS mot de passe, donc un doublon du chemin mot de passe, et il portait seul la contrainte du même
 * navigateur (PKCE). `demanderLienMagique` et `signInWithOtp` ont disparu du code ET des types.
 *
 * LE PARCOURS RETENU, dans ses mots : première ouverture → créer un compte (adresse + mot de passe) →
 * un e-mail de confirmation arrive, on clique son lien → se connecter avec adresse + mot de passe →
 * si le mot de passe est oublié, « mot de passe oublié » envoie un lien de réinitialisation.
 *
 * ⚠️ TROIS LIENS PAR E-MAIL EXISTENT DANS CE PROJET, ET ILS N'ONT PAS LES MÊMES CONTRAINTES. Les
 * confondre a déjà coûté une session entière :
 *  · le lien magique — SUPPRIMÉ ;
 *  · le lien de CONFIRMATION d'adresse (émis par `signUp`) : il ne fait que prouver l'adresse, il n'a
 *    pas besoin d'ouvrir de session, donc **il peut être cliqué depuis n'importe quel appareil**
 *    (vérifié en vrai le 04/08/2026 : ouvert depuis un autre navigateur, l'adresse a bien été
 *    confirmée) ;
 *  · le lien de RÉINITIALISATION : il ouvre une session, donc il exige **le même navigateur**. C'est
 *    dit à l'écran, avant l'envoi.
 *
 * ⚠️ CONSENTEMENT : la case ne vit que dans le formulaire de CRÉATION, et cet invariant est plus
 * simple qu'avant (il n'y a plus qu'un seul chemin de création). Se connecter ne demande jamais de
 * cocher quoi que ce soit : qui possède déjà un compte a déjà consenti, et sa preuve est en base
 * (migration 0004). La modale `MentionsLegales` est RÉUTILISÉE telle quelle — aucune seconde copie du
 * texte.
 *
 * ⚠️ CE QUE LA CASE PROUVE, ET CE QU'ELLE NE PROUVE PAS. La preuve est conservée depuis le
 * 06/08/2026 : `creerCompte` transmet la version du texte et l'instant du clic à `signUp`, et
 * `storage/consentementStorage.ts` les recopie dans la table `consentements` à la première session. Les
 * comptes créés AVANT cette date n'ont aucune preuve, et il ne faut surtout pas en fabriquer une :
 * `synchroniserConsentement` rend `aucuneMetadonnee` et n'écrit rien.
 *
 * ⚠️ CAS `nonConfigure` — FRAGILITÉ ASSUMÉE : sans configuration Supabase, plus personne ne peut ouvrir
 * Cadence. C'est la conséquence mécanique de « pas de compte, pas d'usage ». Traité comme une panne à
 * dire clairement, jamais comme un mode dégradé rassurant.
 */
import { useState } from "react";
import { MentionsLegales } from "./MentionsLegales";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CLASSE_CHAMP, CLASSE_ETIQUETTE, CadrePleinEcran } from "./CadrePleinEcran";
import { obtenirClientAuth, type ClientAuth } from "../auth/supabaseClient";
import type { EtatSession } from "../auth/session";
import { INDICE_RETOUR_LIEN, reinitialisationReussieCetteSession, type IndiceRetourLien } from "../auth/retourLienMagique";
import { LONGUEUR_MINIMALE_MOT_DE_PASSE, connexionMotDePasse, creerCompte, demanderReinitialisationMotDePasse } from "../auth/actions";

interface EcranConnexionObligatoireProps {
  /** Calculée par App.tsx (useSession) — pas de second abonnement à onAuthStateChange ici. */
  session: EtatSession;
  /** Injecté par les tests ; par défaut, le client de l'app (`null` si non configuré). */
  client?: ClientAuth | null;
  /** Origine de retour des liens par e-mail. Par défaut celle de la page courante. */
  origine?: string;
  /** Injecté par les tests ; par défaut, l'indice capturé au chargement de la page. */
  indiceRetour?: IndiceRetourLien;
}

/** Les trois formulaires possibles. `connexion` est le départ : c'est le geste le plus fréquent. */
type Mode = "connexion" | "creation" | "oubli";

export function EcranConnexionObligatoire({
  session,
  client = obtenirClientAuth(),
  origine,
  indiceRetour = INDICE_RETOUR_LIEN,
}: EcranConnexionObligatoireProps) {
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [information, setInformation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [consentement, setConsentement] = useState(false);
  const [mentionsOuvertes, setMentionsOuvertes] = useState(false);

  const origineEffective = origine ?? (typeof window === "undefined" ? "" : window.location.origin);

  function allerVers(nouveau: Mode) {
    setMode(nouveau);
    setErreur(null);
    setInformation(null);
  }

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
      <CadrePleinEcran enTete={<p className="text-sm text-red">Connexion indisponible</p>}>
        <p className="text-sm text-ink leading-relaxed" role="alert">
          La connexion n'est pas configurée dans cette version de Cadence — l'application ne peut pas fonctionner sans elle actuellement, un compte étant désormais nécessaire pour l'utiliser.
        </p>
        <p className="text-xs text-faint leading-relaxed">Signale ce message : ce n'est pas un état normal.</p>
      </CadrePleinEcran>
    );
  }

  if (session.statut === "chargement") {
    return (
      <CadrePleinEcran>
        <p className="text-muted text-sm" aria-live="polite">
          Vérification de la connexion…
        </p>
      </CadrePleinEcran>
    );
  }

  if (session.statut === "indetermine") {
    return (
      <CadrePleinEcran enTete={<p className="text-sm text-amber">Connexion incertaine</p>}>
        {/* On ne dit PAS « non connecté » : on ne le sait pas. Dire l'ignorance plutôt qu'un état faux. */}
        <p className="text-sm text-amber leading-relaxed" role="alert">
          Impossible de savoir si tu es connecté : {session.detail}
        </p>
        <button type="button" onClick={() => window.location.reload()} className={BOUTON_PRINCIPAL}>
          Réessayer
        </button>
      </CadrePleinEcran>
    );
  }

  if (session.statut === "connecte") {
    // Ne devrait jamais être rendu : App.tsx bascule vers le reste de l'app dès que la session est
    // connectée. Garde-fou explicite plutôt qu'un écran muet si jamais ce cas était atteint.
    return null;
  }

  const champEmail = (
    <div>
      <label className={CLASSE_ETIQUETTE} htmlFor="connexion-email">
        Adresse e-mail
      </label>
      <input id="connexion-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLASSE_CHAMP} />
    </div>
  );

  const champMotDePasse = (
    <div>
      <label className={CLASSE_ETIQUETTE} htmlFor="connexion-mot-de-passe">
        Mot de passe
      </label>
      <input
        id="connexion-mot-de-passe"
        type="password"
        autoComplete={mode === "creation" ? "new-password" : "current-password"}
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        className={CLASSE_CHAMP}
      />
    </div>
  );

  const messages = (
    <>
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
      {mentionsOuvertes && <MentionsLegales onFermer={() => setMentionsOuvertes(false)} />}
    </>
  );

  /*
   * LE BANDEAU DE RETOUR — un lien par e-mail a été ouvert mais aucune session n'est là.
   *
   * ⚠️ LES DEUX BRANCHES CI-DESSOUS SONT SÉPARÉES EXPRÈS, ET DEUX TESTS LES VERROUILLENT SÉPARÉMENT.
   * NE PAS LES REFONDRE EN UNE. Histoire : le 04/08/2026, sous une erreur exacte transmise par
   * Supabase (« Email link is invalid or has expired »), l'écran ajoutait une cause inventée
   * (« demandé depuis un autre navigateur »). Une cause fausse sous une erreur juste est pire que le
   * silence qu'on venait de supprimer.
   */
  // `!reinitialisationReussieCetteSession()` depuis le 07/08/2026 : sans ce garde-fou, ce bandeau
  // annoncerait un faux échec après une déconnexion qui suit une réinitialisation réussie dans ce
  // même onglet — `indiceRetour.present` reste vrai même quand tout a fonctionné (cf. le commentaire
  // de `marquerReinitialisationReussie` dans `auth/retourLienMagique.ts`).
  const bandeauRetour = indiceRetour.present && !reinitialisationReussieCetteSession() && (
    <div className="rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 space-y-1" role="status">
      <p className="text-amber leading-relaxed text-sm">
        {indiceRetour.erreurTransmise === null ? "Un lien reçu par e-mail a été ouvert, mais il n'a pas ouvert de session." : `Ce lien a été refusé : ${indiceRetour.erreurTransmise}`}
      </p>
      {indiceRetour.erreurTransmise === null ? (
        <p className="text-xs text-faint leading-relaxed">
          Si c'était le lien de <strong className="font-medium">confirmation de ton adresse</strong>, ce n'est pas grave : son travail est fait, ton adresse est confirmée. Connecte-toi
          simplement ci-dessous avec ton mot de passe. Si c'était un lien de réinitialisation, il doit être ouvert depuis le navigateur qui l'a demandé — redemandes-en un.
        </p>
      ) : (
        <p className="text-xs text-faint leading-relaxed">Un lien reçu par e-mail ne sert qu'une fois et n'est valable qu'un temps limité. Redemande-en un si tu en as besoin.</p>
      )}
    </div>
  );

  if (mode === "oubli") {
    return (
      <CadrePleinEcran enTete={<p className="text-sm text-muted leading-relaxed">Mot de passe oublié : on t'envoie un lien pour en choisir un nouveau.</p>}>
        {champEmail}
        <button type="button" onClick={() => lancer((c) => demanderReinitialisationMotDePasse(c, email, origineEffective))} disabled={enCours} className={BOUTON_PRINCIPAL}>
          {enCours ? "Envoi…" : "Recevoir un lien de réinitialisation"}
        </button>
        {/* Dit AVANT l'envoi, pas après le clic : c'est la leçon du 04/08/2026, où l'avertissement
            n'existait qu'à un endroit que l'utilisateur ne lisait pas au bon moment. */}
        <p className="text-xs text-amber leading-relaxed">
          Ce lien-là doit être ouvert <strong className="font-medium">depuis ce navigateur-ci</strong> : il ouvre une session pour te laisser choisir ton nouveau mot de passe, et la clé de
          cette session est ici. Si tu lis tes e-mails sur ton téléphone, reviens quand même terminer sur cet appareil.
        </p>
        <button type="button" onClick={() => allerVers("connexion")} className={BOUTON_SECONDAIRE}>
          Revenir à la connexion
        </button>
        {messages}
      </CadrePleinEcran>
    );
  }

  if (mode === "creation") {
    return (
      <CadrePleinEcran enTete={<p className="text-sm text-muted leading-relaxed">Créer ton compte Cadence. Tes données y sont enregistrées, et retrouvables depuis n'importe quel appareil.</p>}>
        {bandeauRetour}
        {champEmail}
        {champMotDePasse}

        <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 space-y-2">
          <label htmlFor="consentement-confidentialite" className="flex items-start gap-2 text-sm text-ink leading-relaxed cursor-pointer">
            <input
              id="consentement-confidentialite"
              type="checkbox"
              checked={consentement}
              onChange={(e) => setConsentement(e.target.checked)}
              className="mt-0.5 shrink-0 accent-mint"
            />
            <span>J'ai lu et j'accepte la politique de confidentialité de Cadence.</span>
          </label>
          <button type="button" onClick={() => setMentionsOuvertes(true)} className="text-xs text-mint underline">
            Lire la politique de confidentialité
          </button>
        </div>

        <button
          type="button"
          onClick={() => lancer((c) => creerCompte(c, email, motDePasse, origineEffective))}
          disabled={enCours || !consentement}
          className={BOUTON_PRINCIPAL}
        >
          {enCours ? "Création…" : "Créer un compte"}
        </button>
        {/* LE MOTIF DU BLOCAGE EST ÉCRIT, il n'est plus laissé à deviner d'une nuance de gris. C'est
            l'autre moitié du correctif du 06/08/2026 : le style dit QU'il est bloqué, ce texte dit
            POURQUOI. */}
        {!consentement && (
          <p className="text-xs text-amber leading-relaxed" role="status">
            Coche la case ci-dessus pour pouvoir créer ton compte. Une seule fois : la date et la version du texte accepté sont conservées.
          </p>
        )}
        <p className="text-xs text-faint leading-relaxed">{LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum pour le mot de passe.</p>

        <button type="button" onClick={() => allerVers("connexion")} className={BOUTON_SECONDAIRE}>
          J'ai déjà un compte
        </button>
        {messages}
      </CadrePleinEcran>
    );
  }

  // Reste `connexion` — le geste le plus fréquent, donc celui qui s'affiche par défaut.
  return (
    <CadrePleinEcran enTete={<p className="text-sm text-muted leading-relaxed">Un compte est nécessaire pour utiliser Cadence : tes données y sont enregistrées, et retrouvables depuis n'importe quel appareil.</p>}>
      {bandeauRetour}
      {champEmail}
      {champMotDePasse}

      <button type="button" onClick={() => lancer((c) => connexionMotDePasse(c, email, motDePasse))} disabled={enCours} className={BOUTON_PRINCIPAL}>
        {enCours ? "Connexion…" : "Se connecter"}
      </button>

      <button type="button" onClick={() => allerVers("oubli")} className="text-xs text-mint underline">
        Mot de passe oublié ?
      </button>

      <div className="border-t border-line pt-4 space-y-2">
        <p className="text-xs text-faint leading-relaxed">Première visite ? Il faut d'abord créer un compte.</p>
        <button type="button" onClick={() => allerVers("creation")} className={BOUTON_SECONDAIRE}>
          Créer un compte
        </button>
      </div>
      {messages}
    </CadrePleinEcran>
  );
}
