import { useState } from "react";
import type { ConfigFraisReels } from "../../types/fraisReels";
import { connecterDrive, deconnecterDrive, estConnecte } from "../../lib/googleDriveAuth";

interface DriveSettingsProps {
  config: ConfigFraisReels;
  onChangerConfig: (config: ConfigFraisReels) => void;
}

export function DriveSettings({ config, onChangerConfig }: DriveSettingsProps) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const connecte = Boolean(config.driveConnecte) && estConnecte();

  async function connecter() {
    setEnCours(true);
    setErreur(null);
    try {
      await connecterDrive();
      onChangerConfig({ ...config, driveConnecte: true, stockageJustificatifs: "drive" });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Connexion à Google Drive impossible.");
    } finally {
      setEnCours(false);
    }
  }

  function deconnecter() {
    deconnecterDrive();
    onChangerConfig({ ...config, driveConnecte: false, stockageJustificatifs: "local" });
  }

  return (
    <div className="border-t border-line pt-5 space-y-3">
      <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Justificatifs</span>

      {connecte ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink">
            Stockés dans <code className="text-xs bg-surface-2 rounded px-1 py-0.5">Cadence/Frais_{config.anneeFiscale}/</code> sur ton Google Drive.
          </p>
          <button type="button" onClick={deconnecter} className="px-3 py-1.5 rounded-lg border border-line text-muted text-sm shrink-0">
            Déconnecter
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted">Par défaut, tes justificatifs restent stockés dans ce navigateur. Tu peux les stocker sur ton Google Drive à la place.</p>
          <button type="button" onClick={connecter} disabled={enCours} className="px-4 py-2 rounded-lg bg-mint text-bg font-medium text-sm disabled:opacity-50">
            {enCours ? "Connexion…" : "Connecter Google Drive"}
          </button>
        </div>
      )}

      {erreur && <p className="text-sm text-red">{erreur}</p>}
    </div>
  );
}
