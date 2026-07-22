import { useState } from "react";
import type { Profil } from "../types";

interface OnboardingProps {
  onTerminer: (profil: Profil) => void;
}

// Premier écran vu par un compte vierge (§11.A). Gère explicitement le cas
// "je ne sais pas" pour la date anniversaire : une première admission n'a
// par construction pas encore de cycle ouvert, et le moteur (periodeReference.ts)
// sait fonctionner avec une date anniversaire vide.
export function Onboarding({ onTerminer }: OnboardingProps) {
  const [dateNaissance, setDateNaissance] = useState("");
  const [situation, setSituation] = useState<Profil["situation"]>("premiere_admission");
  const [dateAnniversaireConnue, setDateAnniversaireConnue] = useState(true);
  const [dateAnniversaire, setDateAnniversaire] = useState("");
  const [alsaceMoselle, setAlsaceMoselle] = useState(false);
  const [regimeDeclare, setRegimeDeclare] = useState<Profil["regimeDeclare"]>("annexe10_pur");

  const peutValider = dateNaissance.length > 0 && (!dateAnniversaireConnue || dateAnniversaire.length > 0);

  function valider() {
    onTerminer({
      dateNaissance,
      dateAnniversaire: dateAnniversaireConnue ? dateAnniversaire : "",
      situation,
      alsaceMoselle,
      baremeCSG: "normal",
      regimeDeclare,
    });
  }

  return (
    <div className="max-w-[560px] mx-auto px-6 py-16">
      <div className="mb-8 text-center">
        <span className="inline-block w-10 h-10 rounded-xl bg-gradient-to-br from-mint to-teal mb-4" aria-hidden />
        <h1 className="font-display text-2xl font-semibold tracking-tight">Bienvenue sur Cadence</h1>
        <p className="text-muted mt-2">Quelques informations pour estimer où tu en es dans tes droits Annexe 10.</p>
      </div>

      <div className="bg-surface border border-line rounded-card p-6 space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="date-naissance">
            Date de naissance
          </label>
          <input
            id="date-naissance"
            type="date"
            value={dateNaissance}
            onChange={(e) => setDateNaissance(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
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
              onClick={() => setSituation("readmission")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${situation === "readmission" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
            >
              Réadmission
            </button>
          </div>
        </div>

        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Date anniversaire (fin de tes derniers droits ouverts)</span>
          <label className="flex items-center gap-2 text-sm text-muted mb-2">
            <input type="checkbox" checked={!dateAnniversaireConnue} onChange={(e) => setDateAnniversaireConnue(!e.target.checked)} />
            Je ne connais pas encore ma date anniversaire
          </label>
          {dateAnniversaireConnue && (
            <input
              type="date"
              value={dateAnniversaire}
              onChange={(e) => setDateAnniversaire(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
            />
          )}
          {!dateAnniversaireConnue && <p className="text-xs text-faint">Cadence utilisera une fenêtre glissante de 365 j se terminant aujourd'hui, en attendant que tu la renseignes.</p>}
        </div>

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
            <p className="text-xs text-amber mt-2">Cadence ne pourra pas t'afficher d'estimation dans ce cas — tu pourras revenir sur cette réponse plus tard, dans « À propos ».</p>
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

      <p className="text-xs text-faint text-center mt-6">Tes données restent uniquement sur cet appareil (localStorage). Pense à utiliser l'export JSON régulièrement pour ne rien perdre.</p>
    </div>
  );
}
