import { useEffect, useRef, useState } from "react";
import { composerDateIso, decouperDateIso } from "../lib/dateJourMoisAnnee";

const MOIS = [
  { valeur: "01", libelle: "janvier" },
  { valeur: "02", libelle: "février" },
  { valeur: "03", libelle: "mars" },
  { valeur: "04", libelle: "avril" },
  { valeur: "05", libelle: "mai" },
  { valeur: "06", libelle: "juin" },
  { valeur: "07", libelle: "juillet" },
  { valeur: "08", libelle: "août" },
  { valeur: "09", libelle: "septembre" },
  { valeur: "10", libelle: "octobre" },
  { valeur: "11", libelle: "novembre" },
  { valeur: "12", libelle: "décembre" },
];

interface DateNaissanceInputProps {
  value: string; // ISO YYYY-MM-DD, ou ""
  onChange: (value: string) => void;
  idPrefix?: string;
}

const CHAMP_CLASSES =
  "w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint";

// Remplace l'<input type="date"> natif pour la date de naissance : sur Android/Chrome, le
// sélecteur natif s'ouvre sur la date du jour et impose de reculer mois par mois (ou une molette
// année) sur des décennies pour atteindre une année de naissance. Trois champs jour/mois/année,
// année en saisie libre plutôt qu'un select à 100 options, évitent ce défilement.
export function DateNaissanceInput({ value, onChange, idPrefix = "date-naissance" }: DateNaissanceInputProps) {
  const [jour, setJour] = useState("");
  const [mois, setMois] = useState("");
  const [annee, setAnnee] = useState("");
  // Retient le dernier ISO qu'on a nous-mêmes remonté au parent, pour ne pas confondre un
  // changement externe de `value` (reset, import IA...) avec l'écho de notre propre `onChange` —
  // sinon un brouillon invalide ou incomplet (`onChange("")`) se ferait effacer par l'effet
  // ci-dessous à chaque frappe, avant même que l'utilisateur ait fini de corriger sa saisie.
  const dernierEmis = useRef<string | null>(null);

  useEffect(() => {
    if (value === dernierEmis.current) return;
    const decoupe = decouperDateIso(value);
    setJour(decoupe.jour);
    setMois(decoupe.mois);
    setAnnee(decoupe.annee);
  }, [value]);

  function emettre(prochain: { jour: string; mois: string; annee: string }) {
    const iso = composerDateIso(prochain) ?? "";
    dernierEmis.current = iso;
    onChange(iso);
  }

  const tousRemplis = jour.length > 0 && mois.length > 0 && annee.length === 4;
  const dateInvalide = tousRemplis && composerDateIso({ jour, mois, annee }) === null;

  return (
    <div>
      <div className="grid grid-cols-[64px_1fr_88px] gap-2">
        <input
          id={`${idPrefix}-jour`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          placeholder="JJ"
          aria-label="Jour de naissance"
          value={jour}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
            setJour(v);
            emettre({ jour: v, mois, annee });
          }}
          className={CHAMP_CLASSES}
        />
        <select
          id={`${idPrefix}-mois`}
          aria-label="Mois de naissance"
          value={mois}
          onChange={(e) => {
            const v = e.target.value;
            setMois(v);
            emettre({ jour, mois: v, annee });
          }}
          className={CHAMP_CLASSES}
        >
          <option value="">Mois</option>
          {MOIS.map((m) => (
            <option key={m.valeur} value={m.valeur}>
              {m.libelle}
            </option>
          ))}
        </select>
        <input
          id={`${idPrefix}-annee`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="AAAA"
          aria-label="Année de naissance"
          value={annee}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setAnnee(v);
            emettre({ jour, mois, annee: v });
          }}
          className={CHAMP_CLASSES}
        />
      </div>
      {dateInvalide && <p className="text-xs text-red mt-1">Cette date n'existe pas — vérifie le jour et le mois.</p>}
    </div>
  );
}
