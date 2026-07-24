// Panneau de transparence du calcul : montre comment on arrive au chiffre
// affiché sur le Dashboard, à partir des résultats DÉJÀ calculés par le
// moteur (aucun nouveau calcul ici, uniquement de la mise en forme).
// Replié par défaut (<details> natif, sans attribut `open`) : ouvert
// seulement au clic sur le résumé, jamais affiché en permanence.
import type { AJBruteResultat, AJNetteResultat, DecompteHeuresResultat } from "../types";

interface DetailCalculProps {
  decompte: DecompteHeuresResultat;
  ajBrute: AJBruteResultat;
  ajNette: AJNetteResultat;
  sr: number;
  nht: number;
  sar: number | null;
}

function ligne(label: string, valeur: string, note?: string) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-muted">
        {label}
        {note && <span className="text-faint"> · {note}</span>}
      </span>
      <span className="tabular-nums text-ink shrink-0">{valeur}</span>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs uppercase tracking-[.03em] text-muted mb-1.5">{titre}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function DetailCalcul({ decompte, ajBrute, ajNette, sr, nht, sar }: DetailCalculProps) {
  const r = decompte.repartition;
  const salaireRetenuPourA = sar ?? sr;

  return (
    <details className="bg-surface border border-line rounded-card">
      <summary className="cursor-pointer select-none list-none px-5 py-3 text-sm text-muted hover:text-ink transition-colors flex items-center gap-2">
        <span aria-hidden="true">▸</span>
        Comment ce chiffre est-il calculé ?
      </summary>

      <div className="px-5 pb-5 pt-1 space-y-4">
        <Section titre="Décompte des heures (507 h)">
          {ligne("Cachets", `${Math.round(r.cachets)} h`)}
          {ligne("Heures scène", `${Math.round(r.heuresScene)} h`)}
          {ligne("EEE / Suisse / UK", `${Math.round(r.eee)} h`)}
          {ligne("Heures assimilées", `${Math.round(r.assimilees)} h`)}
          {ligne("PTP", `${Math.round(r.ptp)} h`)}
          {ligne("Enseignement retenu", `${Math.round(r.enseignementRetenu)} h`, `plafond ${decompte.plafondEnseignementApplicable} h`)}
          {ligne("Enseignement écarté (au-delà du plafond)", `${Math.round(r.enseignementExcedentaire)} h`)}
          {ligne("Formation retenue", `${Math.round(r.formationRetenue)} h`)}
          {ligne("Formation écartée (au-delà du plafond cumulé)", `${Math.round(r.formationExcedentaire)} h`)}
          <div className="border-t border-line mt-2 pt-2">{ligne("Total retenu pour les 507 h", `${Math.round(decompte.total)} h`)}</div>
        </Section>

        <Section titre="Salaire et heures retenus pour le montant (hors enseignement/formation)">
          {ligne("SR — salaire de référence brut", `${sr.toFixed(2)} €`)}
          {ligne("NHT — heures retenues pour le montant", `${Math.round(nht)} h`)}
          {sar !== null
            ? ligne("SAR — salaire aménagé", `${sar.toFixed(2)} €`, "remplace le SR ci-dessus car des périodes assimilées sont retenues")
            : ligne("SAR — salaire aménagé", "non applicable", "aucune période assimilée retenue sur cette fenêtre")}
          <div className="border-t border-line mt-2 pt-2">{ligne("Salaire effectivement utilisé pour la partie A", `${salaireRetenuPourA.toFixed(2)} €`)}</div>
        </Section>

        <Section titre="AJ brute = A + B + C">
          {ligne("Partie A (salaire)", `${ajBrute.a.toFixed(2)} €`)}
          {ligne("Partie B (heures)", `${ajBrute.b.toFixed(2)} €`)}
          {ligne("Partie C (fixe)", `${ajBrute.c.toFixed(2)} €`)}
          <div className="border-t border-line mt-2 pt-2">{ligne("A + B + C avant plancher/plafond", `${ajBrute.brutAvantClamp.toFixed(2)} €`)}</div>
          {ligne("Plancher (minimum garanti) appliqué", ajBrute.plancherApplique ? "Oui" : "Non")}
          {ligne("Plafond (maximum) appliqué", ajBrute.plafondApplique ? "Oui" : "Non")}
          <div className="border-t border-line mt-2 pt-2">{ligne("AJ brute retenue", `${ajBrute.brut.toFixed(2)} €`)}</div>
        </Section>

        <Section titre="AJ nette estimée">
          {ligne("AJ brute", `${ajNette.brut.toFixed(2)} €`)}
          {ligne("SJR", `${ajNette.sjr.toFixed(2)} €`)}
          {ajNette.detailCotisations.length === 0 && ligne("Prélèvements", "aucun — AJ brute sous le seuil d'exonération")}
          {ajNette.detailCotisations.map((c, i) => (
            <div key={i}>{ligne(c.libelle, `− ${c.montant.toFixed(2)} €`)}</div>
          ))}
          <div className="border-t border-line mt-2 pt-2">{ligne("AJ nette estimée", `${ajNette.net.toFixed(2)} €`)}</div>
        </Section>
      </div>
    </details>
  );
}
