/**
 * L'écran « choisis un nouveau mot de passe », affiché au retour du lien de réinitialisation.
 *
 * POURQUOI CET ÉCRAN EXISTE, ET POURQUOI IL EST BLOQUANT. Le lien de réinitialisation OUVRE UNE
 * SESSION — c'est ce qui autorise `updateUser` sans connaître l'ancien mot de passe. Sans cet écran,
 * `App.tsx` verrait une session parfaitement normale et rendrait le tableau de bord : l'utilisateur
 * aurait cliqué « mot de passe oublié », suivi tout le parcours, et se retrouverait connecté SANS
 * qu'on lui ait jamais demandé de nouveau mot de passe — donc toujours avec celui qu'il a oublié, sans
 * comprendre pourquoi la fois suivante échoue encore. D'où le marqueur `MARQUEUR_REINITIALISATION`
 * (cf. auth/actions.ts) et cet écran placé AVANT le reste de l'app.
 *
 * DEUX CHAMPS ET NON UN, DÉLIBÉRÉMENT. Ailleurs (« Mon profil » → Compte), changer son mot de passe se
 * fait avec un seul champ : on est déjà connecté, une faute de frappe se rattrape en recommençant. Ici
 * non — une faute de frappe enregistrerait un mot de passe que personne ne connaît, et la seule
 * porte de secours restante serait un NOUVEL e-mail de réinitialisation, plafonné à 2 par heure par
 * le service d'envoi. La confirmation est donc une protection réelle, pas une formalité.
 *
 * CE QUE CET ÉCRAN NE FAIT PAS : il ne déconnecte pas et ne recharge pas la page après succès. La
 * session ouverte par le lien est déjà la bonne ; `onTermine` rend simplement la main à `App.tsx`, qui
 * affiche l'app normalement. Forcer une reconnexion obligerait à retaper un mot de passe qui vient
 * d'être choisi, pour rien.
 */
import { useState } from "react";
import { obtenirClientAuth, type ClientAuth } from "../auth/supabaseClient";
import { LONGUEUR_MINIMALE_MOT_DE_PASSE, definirMotDePasse } from "../auth/actions";
import { BOUTON_PRINCIPAL, CLASSE_CHAMP, CLASSE_ETIQUETTE, CadrePleinEcran } from "./CadrePleinEcran";

interface EcranNouveauMotDePasseProps {
  /** Injecté par les tests ; par défaut, le client de l'app. */
  client?: ClientAuth | null;
  /** Appelé après un enregistrement RÉUSSI, et seulement dans ce cas. */
  onTermine: () => void;
}

export function EcranNouveauMotDePasse({ client = obtenirClientAuth(), onTermine }: EcranNouveauMotDePasseProps) {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Vérifié AVANT tout appel réseau, et affiché comme un refus explicite : deux saisies différentes ne
  // doivent pas partir vers Supabase, qui accepterait la première sans rien savoir de la seconde.
  const saisiesDifferentes = confirmation.length > 0 && motDePasse !== confirmation;

  async function enregistrer() {
    if (!client) {
      setErreur("La connexion n'est pas configurée : impossible d'enregistrer un mot de passe.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe saisis ne sont pas identiques.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await definirMotDePasse(client, motDePasse);
      // On ne quitte cet écran QUE sur un succès rendu par Supabase. Sur échec on reste ici, sinon
      // l'utilisateur repartirait en croyant son mot de passe changé alors qu'il ne l'est pas.
      if (resultat.ok) onTermine();
      else setErreur(resultat.message);
    } catch (incident: unknown) {
      setErreur(incident instanceof Error ? incident.message : String(incident));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <CadrePleinEcran enTete={<p className="text-sm text-muted leading-relaxed">Choisis ton nouveau mot de passe. Il remplacera l'ancien immédiatement.</p>}>
      <div>
        <label className={CLASSE_ETIQUETTE} htmlFor="nouveau-mot-de-passe">
          Nouveau mot de passe
        </label>
        <input
          id="nouveau-mot-de-passe"
          type="password"
          autoComplete="new-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className={CLASSE_CHAMP}
        />
      </div>

      <div>
        <label className={CLASSE_ETIQUETTE} htmlFor="nouveau-mot-de-passe-confirmation">
          Retape-le pour confirmer
        </label>
        <input
          id="nouveau-mot-de-passe-confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className={CLASSE_CHAMP}
        />
      </div>

      {saisiesDifferentes && (
        <p className="text-xs text-amber leading-relaxed" role="status">
          Les deux saisies ne sont pas identiques.
        </p>
      )}

      <button type="button" onClick={enregistrer} disabled={enCours} className={BOUTON_PRINCIPAL}>
        {enCours ? "Enregistrement…" : "Enregistrer ce mot de passe"}
      </button>

      <p className="text-xs text-faint leading-relaxed">{LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum.</p>

      {erreur !== null && (
        <p className="text-red leading-relaxed text-sm" role="alert">
          {erreur}
        </p>
      )}
    </CadrePleinEcran>
  );
}
