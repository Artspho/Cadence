import { useState } from "react";
import { validerCoherenceProfil } from "../lib/coherenceProfil";
import { DateNaissanceInput } from "./DateNaissanceInput";
import { ouvrirMesCourriers } from "./OuvrirEspacePersonnelFT";
import type { Profil } from "../types";

interface OnboardingProps {
  onTerminer: (profil: Profil) => void;
  /**
   * Ouvre le sélecteur de fichier pour restaurer une sauvegarde JSON — point 23 de
   * docs/critique_2026-08-03.md. Optionnel pour ne pas casser les appels existants (RevueExtractionDemo,
   * tests) : sans ce callback, l'écran se comporte exactement comme avant.
   */
  onRestaurerSauvegarde?: () => void;
  /** Erreur du dernier import tenté depuis cet écran — sinon un fichier invalide échouerait en silence. */
  erreurImport?: string | null;
  /**
   * `true` quand une session est ouverte et que le serveur fait référence (phase 5).
   *
   * Existe pour une raison précise, trouvée en vérifiant à l'écran le 05/08/2026 : la phrase de bas de
   * page affirmait « tes données restent uniquement sur cet appareil ». C'était vrai avant la bascule,
   * et ça reste vrai sans compte — mais un testeur qui se connecte PUIS remplit ce formulaire lisait
   * une phrase fausse au moment précis où il confie ses données. Défaut invisible aux tests, puisque
   * la phrase était juste dans le seul cas qu'ils exerçaient.
   *
   * Défaut `false` : sans information, on affirme le moins, et les appels existants ne changent pas.
   */
  serveurFaitReference?: boolean;
}

// Premier écran vu par un compte vierge (§11.A). Gère explicitement le cas
// "je ne sais pas" pour la date anniversaire : une première admission n'a
// par construction pas encore de cycle ouvert, et le moteur (periodeReference.ts)
// sait fonctionner avec une date anniversaire vide.
export function Onboarding({ onTerminer, onRestaurerSauvegarde, erreurImport, serveurFaitReference = false }: OnboardingProps) {
  const [dateNaissance, setDateNaissance] = useState("");
  const [situation, setSituation] = useState<Profil["situation"]>("premiere_admission");
  const [dateAnniversaireConnue, setDateAnniversaireConnue] = useState(true);
  const [dateAnniversaire, setDateAnniversaire] = useState("");
  const [alsaceMoselle, setAlsaceMoselle] = useState(false);
  const [regimeDeclare, setRegimeDeclare] = useState<Profil["regimeDeclare"]>("annexe10_pur");
  const [dateAnniversairePrecedente, setDateAnniversairePrecedente] = useState("");

  const dateAnniversaireCandidate = dateAnniversaireConnue ? dateAnniversaire : "";
  const coherence = validerCoherenceProfil({ dateNaissance, situation, dateAnniversaire: dateAnniversaireCandidate });
  const peutValider = coherence.coherent && (!dateAnniversaireConnue || dateAnniversaire.length > 0);

  function valider() {
    onTerminer({
      dateNaissance,
      dateAnniversaire: dateAnniversaireConnue ? dateAnniversaire : "",
      situation,
      alsaceMoselle,
      baremeCSG: "normal",
      regimeDeclare,
      ...(situation === "readmission" && dateAnniversairePrecedente ? { dateAnniversairePrecedente } : {}),
    });
  }

  return (
    <div className="max-w-[560px] mx-auto px-6 py-16">
      <div className="mb-8 text-center">
        <span className="inline-block w-10 h-10 rounded-xl bg-gradient-to-br from-mint to-teal mb-4" aria-hidden />
        <h1 className="font-display text-2xl font-semibold tracking-tight">Bienvenue sur Cadence</h1>
        <p className="text-muted mt-2">
          Pour bien suivre tes heures et savoir où tu en es de tes 507 h, Cadence a besoin de deux repères : ta date anniversaire, et si tu as déjà eu des droits, la date à laquelle ils se sont
          terminés.
        </p>
      </div>

      {/* Chemin de récupération (devoir sacré n°1), point 23 de docs/critique_2026-08-03.md. Placé
          AVANT le formulaire, et non en pied de page : le scénario visé est quelqu'un qui vient de
          tout perdre. Constaté en conditions réelles le 03/08/2026 — il avait fallu ressaisir quatre
          champs que le fichier de sauvegarde contenait déjà, juste pour atteindre le bouton d'import.
          Le vrai risque n'était pas la friction mais l'ordre des gestes : remplir l'onboarding « pour
          voir », commencer à saisir des contrats, et ne penser à l'import qu'après — l'import écrasant
          alors du travail déjà refait. */}
      {onRestaurerSauvegarde && (
        <div className="bg-surface border border-line rounded-card p-5 mb-4">
          <p className="text-sm text-ink font-medium">Tu as déjà une sauvegarde Cadence&nbsp;?</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Restaure-la maintenant, avant de remplir ce formulaire : elle contient déjà ton profil et tes contrats. Inutile de les ressaisir.
          </p>
          <button
            onClick={onRestaurerSauvegarde}
            className="mt-3 w-full rounded-lg border border-mint/40 bg-mint/10 text-mint font-medium py-2.5 text-sm transition-colors hover:bg-mint/15"
          >
            Restaurer une sauvegarde (fichier JSON)
          </button>
          {erreurImport && <p className="text-xs text-red mt-2">{erreurImport}</p>}
        </div>
      )}

      <div className="bg-surface border border-line rounded-card p-6 space-y-6">
        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Date de naissance</span>
          <DateNaissanceInput value={dateNaissance} onChange={setDateNaissance} idPrefix="date-naissance" />
          <p className="text-xs text-faint mt-1">Sert à déterminer ton plafond d'heures d'enseignement (70 h avant 50 ans, 120 h après).</p>
        </div>

        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Ta situation</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSituation("premiere_admission")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${situation === "premiere_admission" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
            >
              Première admission
            </button>
            <button
              onClick={() => {
                setSituation("readmission");
                // Une réadmission SANS date anniversaire connue est bloquée à la validation
                // (validerCoherenceProfil) — la case "je ne sais pas" ci-dessous n'est donc jamais
                // proposée dans ce cas (cf. juste en dessous). Reforcer `true` ici évite l'impasse
                // pour qui l'avait cochée en "Première admission" avant de changer d'avis.
                setDateAnniversaireConnue(true);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${situation === "readmission" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
            >
              Réadmission
            </button>
          </div>
        </div>

        {/* Petit lien de commodité (07/08/2026, demande de Benoît) : pas un import IA en direct — ce
            pipeline a besoin d'un profil et d'une session déjà en place, ni l'un ni l'autre n'existe
            encore à ce stade. Juste de quoi retrouver la notification papier sans quitter l'app avant
            même d'avoir un compte, cf. OuvrirEspacePersonnelFT.tsx pour la même règle FranceConnect
            (jamais d'iframe, un vrai nouvel onglet). */}
        <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
          <p className="text-xs text-faint leading-relaxed">
            Ces dates figurent sur ta notification d'admission France Travail. Si tu ne l'as plus sous la main,{" "}
            <button type="button" onClick={ouvrirMesCourriers} className="text-mint hover:underline">
              retrouve-la dans tes courriers France Travail (nouvel onglet)
            </button>
            . L'import automatique par IA, lui, se fait plus tard, une fois connecté (onglet « Déposer un document »).
          </p>
        </div>

        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Date anniversaire (fin de tes derniers droits ouverts)</span>
          <p className="text-xs text-faint mb-2">C'est la date à laquelle ton compteur de 507 h repart à zéro — le repère dont Cadence a besoin pour suivre tes heures correctement.</p>
          {/* Case masquée en réadmission, pas seulement désactivée : une réadmission sans cette date
              est bloquée à la validation (coherenceProfil.ts) — autant ne jamais montrer un choix qui
              mène droit à une impasse. Reste proposée en première admission, cas sain où l'anniversaire
              n'existe simplement pas encore. */}
          {situation !== "readmission" && (
            <label className="flex items-center gap-2 text-sm text-muted mb-2">
              <input type="checkbox" checked={!dateAnniversaireConnue} onChange={(e) => setDateAnniversaireConnue(!e.target.checked)} />
              Je ne connais pas encore ma date anniversaire
            </label>
          )}
          {dateAnniversaireConnue && (
            <input
              type="date"
              value={dateAnniversaire}
              onChange={(e) => setDateAnniversaire(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
            />
          )}
          {!dateAnniversaireConnue &&
            (coherence.coherent ? (
              <p className="text-xs text-faint">Cadence utilisera une fenêtre glissante de 365 j se terminant aujourd'hui, en attendant que tu la renseignes.</p>
            ) : (
              <p className="text-xs text-red">{coherence.raison}</p>
            ))}
        </div>

        {situation === "readmission" && (
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="date-anniversaire-precedente">
              Date de fin de ta période de droits précédente (optionnel)
            </label>
            <input
              id="date-anniversaire-precedente"
              type="date"
              value={dateAnniversairePrecedente}
              onChange={(e) => setDateAnniversairePrecedente(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
            />
            <p className="text-xs text-faint mt-1">
              Si tu as déjà eu des droits Annexe 10 ouverts avant cette période, indique la date à laquelle ils se sont terminés — elle figure sur ta précédente notification France Travail.
              Cadence s'en sert pour borner correctement la recherche d'heures si tu dois remonter loin. Si tu ne l'as pas sous la main, laisse vide : Cadence te le signalera dans le tableau de
              bord.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={alsaceMoselle} onChange={(e) => setAlsaceMoselle(e.target.checked)} />
          Je relève du régime local Alsace-Moselle
        </label>

        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">
            Cette année, as-tu été payé pour autre chose que des concerts / prestations d'artiste&nbsp;? Par exemple du travail technique sur un spectacle
            (son, lumière, régie…), ou un emploi salarié classique hors spectacle.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setRegimeDeclare("annexe10_pur")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${regimeDeclare === "annexe10_pur" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
            >
              Non
            </button>
            <button
              onClick={() => setRegimeDeclare("mixte")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${regimeDeclare === "mixte" ? "border-amber bg-amber/10" : "border-line bg-surface-2"}`}
            >
              Oui
            </button>
            <button
              onClick={() => setRegimeDeclare("inconnu")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${regimeDeclare === "inconnu" ? "border-amber bg-amber/10" : "border-line bg-surface-2"}`}
            >
              Je ne sais pas
            </button>
          </div>
          {regimeDeclare !== "annexe10_pur" && (
            <p className="text-xs text-amber mt-2">Cadence ne pourra pas t'afficher d'estimation dans ce cas — tu pourras revenir sur cette réponse plus tard, dans « Mon profil ».</p>
          )}
        </div>

        <button
          onClick={valider}
          disabled={!peutValider}
          className="w-full bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Commencer
        </button>
      </div>

      <p className="text-xs text-faint text-center mt-6">
        {serveurFaitReference
          ? "Tu es connecté : ce que tu saisis ici sera enregistré sur le serveur, et relu depuis n'importe quel appareil. L'export JSON reste utile comme copie de secours à toi."
          : "Tes données restent uniquement sur cet appareil (localStorage). Pense à utiliser l'export JSON régulièrement pour ne rien perdre."}
      </p>
    </div>
  );
}
