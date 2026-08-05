/**
 * PHASE 5 — L'ÉCRAN QUI S'INTERPOSE QUAND LE SERVEUR ET LE NAVIGATEUR NE S'ACCORDENT PAS.
 *
 * Affiché À LA PLACE de toute l'application, exactement comme `EcranDonneesIllisibles` : ni
 * navigation, ni tableau de bord, ni onboarding. Personne ne doit pouvoir saisir un contrat pendant
 * qu'une question de cette nature est en suspens — la réponse déterminera quelle version survit.
 *
 * TANT QUE CET ÉCRAN EST AFFICHÉ, CADENCE N'ÉCRIT RIEN. Ni sur le serveur, ni dans le navigateur.
 * C'est la même règle que le correctif du 03/08/2026, appliquée au serveur : une situation qu'on ne
 * sait pas trancher n'autorise aucune écriture.
 *
 * TROIS PRINCIPES D'INTERFACE, hérités de l'écran de données illisibles :
 *  1. la mise à l'abri vient AVANT les choix, et les choix destructeurs sont gâtés par une case à
 *     cocher décochée par défaut — cocher est un geste conscient, pas un réflexe ;
 *  2. chaque bouton dit ce qu'il DÉTRUIT, pas seulement ce qu'il garde. « Garder ce navigateur »
 *     signifie « remplacer le serveur », et l'écran doit l'écrire ;
 *  3. le premier paragraphe désamorce la panique en disant une chose vraie : rien n'a bougé.
 */

import { useState } from "react";
import { exporterJSON, type DonneesApp } from "../storage/localStorageAdapter";
import { decompter, type Decompte } from "../storage/verificationMigration";
import { horodatagePourNomFichier, telechargerTexte } from "../lib/telechargement";
import type { Bascule } from "../storage/bascule";

/** Les seuls genres qui appellent une décision humaine — les autres n'affichent pas cet écran. */
export type BasculeADecider = Extract<Bascule, { genre: "divergence" | "aTeleverser" | "serveurIllisible" | "versionInattendue" }>;

interface DecisionServeurProps {
  bascule: BasculeADecider;
  /** L'état de CE navigateur, tel qu'il a été lu — jamais modifié par cet écran. */
  local: DonneesApp;
  /** Téléverser le navigateur vers le serveur (et donc remplacer ce que le serveur porte). */
  onGarderNavigateur: () => void;
  /** Adopter la version du serveur (et donc remplacer ce que ce navigateur porte). */
  onPrendreServeur: (donnees: DonneesApp) => void;
  /** Réinterroger le serveur, sans rien écrire. */
  onReessayer: () => void;
  /** `true` pendant qu'une écriture décidée est en cours : évite le double clic. */
  enCours: boolean;
  /**
   * Échec de la dernière tentative, s'il y en a eu une. Indispensable : sans lui, un clic sur
   * « garder ce navigateur » qui échoue (réseau) ne produirait RIEN à l'écran, et on cliquerait
   * indéfiniment sur un bouton qu'on croirait cassé.
   */
  erreur: string | null;
}

function Cadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-card p-5 space-y-3">
      <h2 className="font-display text-lg font-medium">{titre}</h2>
      {children}
    </div>
  );
}

function LigneDecompte({ titre, decompte }: { titre: string; decompte: Decompte }) {
  return (
    <p className="text-sm">
      {titre} : <strong className="font-medium">{decompte.contrats}</strong> contrat{decompte.contrats > 1 ? "s" : ""},{" "}
      <strong className="font-medium">{decompte.periodes}</strong> période{decompte.periodes > 1 ? "s" : ""} assimilée{decompte.periodes > 1 ? "s" : ""},{" "}
      <strong className="font-medium">{decompte.exercicesGeles}</strong> exercice{decompte.exercicesGeles > 1 ? "s" : ""} figé{decompte.exercicesGeles > 1 ? "s" : ""}, profil{" "}
      {decompte.profilPresent ? "renseigné" : "absent"}
    </p>
  );
}

function BoutonTelecharger({ libelle, nomFichier, contenu }: { libelle: string; nomFichier: string; contenu: string }) {
  return (
    <button type="button" onClick={() => telechargerTexte(nomFichier, contenu)} className="bg-mint text-bg font-medium rounded-lg px-4 py-2.5 text-sm">
      {libelle}
    </button>
  );
}

function DetailTechnique({ detail }: { detail: string }) {
  return (
    <details className="bg-surface border border-line rounded-card">
      <summary className="cursor-pointer select-none list-none px-5 py-3 text-sm text-muted flex items-center gap-2">
        <span aria-hidden="true">▸</span>
        Détail technique (utile si tu demandes de l'aide)
      </summary>
      <p className="px-5 pb-4 text-xs font-mono text-faint break-words">{detail}</p>
    </details>
  );
}

export function DecisionServeur({ bascule, local, onGarderNavigateur, onPrendreServeur, onReessayer, enCours, erreur }: DecisionServeurProps) {
  const [misALAbri, setMisALAbri] = useState(false);
  const horodatage = horodatagePourNomFichier();
  const exportLocal = exporterJSON(local);

  // Titre et première phrase : la seule chose que Benoît lira peut-être avant d'agir. Ils doivent
  // nommer la situation sans l'aggraver, et affirmer ce qui est vrai — rien n'a été touché.
  const enTete = {
    divergence: {
      titre: "Ce navigateur et le serveur ne disent pas la même chose",
      phrase: "Cadence s'est arrêtée avant de toucher à quoi que ce soit. Les deux versions sont intactes, celle d'ici comme celle du serveur. Rien ne sera modifié tant que tu n'auras pas choisi ci-dessous.",
    },
    aTeleverser: {
      titre: "Tes données ne sont pas encore sur le serveur",
      phrase: "Ce navigateur porte des données, le serveur n'en a aucune pour ton compte. Rien n'est perdu et rien ne sera écrasé : il n'y a rien à écraser. Il reste à envoyer cette version.",
    },
    serveurIllisible: {
      titre: "Le serveur porte un contenu que Cadence ne sait pas lire",
      phrase: "Cadence s'est arrêtée avant de toucher à quoi que ce soit. Ce contenu est souvent récupérable à la main : télécharge-le avant toute autre manipulation. Tes données de ce navigateur sont intactes.",
    },
    versionInattendue: {
      titre: "Le serveur a été écrit dans un autre format",
      phrase: "Cadence s'est arrêtée avant de toucher à quoi que ce soit. Ce n'est pas un écart entre tes données : c'est le format d'enregistrement qui ne correspond pas à celui de cette version de l'app.",
    },
  }[bascule.genre];

  return (
    <div className="min-h-screen bg-bg text-ink px-6 py-10">
      <div className="max-w-[720px] mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium">{enTete.titre}</h1>
          <p className="text-sm text-muted mt-2">
            <strong className="text-ink font-medium">Rien n'a été effacé.</strong> {enTete.phrase}
          </p>
        </div>

        {bascule.genre === "divergence" && (
          <>
            <Cadre titre="1. Mets les deux versions à l'abri">
              <p className="text-sm text-muted">
                Deux fichiers, un par version. C'est le seul geste de cet écran qui n'a <strong className="text-ink font-medium">aucun effet</strong> : fais-le avant de choisir, quel
                que soit ton choix.
              </p>
              <div className="flex flex-wrap gap-2">
                <BoutonTelecharger libelle="Télécharger la version de ce navigateur" nomFichier={`cadence-navigateur-${horodatage}.json`} contenu={exportLocal} />
                <BoutonTelecharger libelle="Télécharger la version du serveur" nomFichier={`cadence-serveur-${horodatage}.json`} contenu={exporterJSON(bascule.serveur)} />
              </div>
              <div className="pt-2 space-y-1 border-t border-line">
                <LigneDecompte titre="Ce navigateur" decompte={decompter(local)} />
                <LigneDecompte titre="Le serveur" decompte={decompter(bascule.serveur)} />
                {/* Le décompte parle à l'œil ; il ne PROUVE pas l'égalité (deux jeux de 62 contrats
                    différents donnent le même compte). C'est l'empreinte qui a tranché en amont, et
                    elle a conclu que ces deux versions diffèrent. */}
                <p className="text-xs text-faint pt-1">
                  Ces nombres aident à reconnaître laquelle est laquelle. Ils peuvent être identiques alors que le contenu diffère — c'est la comparaison octet par octet qui a
                  détecté l'écart.
                </p>
              </div>
            </Cadre>

            <Cadre titre="2. Choisis la version à garder">
              <p className="text-sm text-muted">
                Un seul des deux boutons, et il remplace l'autre version. Il n'y a pas de fusion : Cadence ne sait pas combiner deux historiques sans risquer d'inventer un chiffre.
              </p>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={misALAbri} onChange={(e) => setMisALAbri(e.target.checked)} className="mt-0.5" />
                <span>J'ai téléchargé les deux versions ci-dessus.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onGarderNavigateur}
                  disabled={!misALAbri || enCours}
                  className="bg-surface-2 border border-line-strong text-ink font-medium rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Garder ce navigateur — et remplacer le serveur
                </button>
                <button
                  type="button"
                  onClick={() => onPrendreServeur(bascule.serveur)}
                  disabled={!misALAbri || enCours}
                  className="bg-surface-2 border border-line-strong text-ink font-medium rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prendre le serveur — et remplacer ce navigateur
                </button>
              </div>
            </Cadre>
          </>
        )}

        {bascule.genre === "aTeleverser" && (
          <Cadre titre="Envoyer cette version sur le serveur">
            <p className="text-sm text-muted">Aucune donnée ne sera écrasée : le serveur ne porte rien pour ton compte. Tu peux aussi garder un fichier de côté avant.</p>
            <LigneDecompte titre="À envoyer" decompte={decompter(local)} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGarderNavigateur}
                disabled={enCours}
                className="bg-mint text-bg font-medium rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enCours ? "Envoi…" : "Envoyer mes données sur le serveur"}
              </button>
              <BoutonTelecharger libelle="Télécharger un fichier de sécurité" nomFichier={`cadence-navigateur-${horodatage}.json`} contenu={exportLocal} />
            </div>
          </Cadre>
        )}

        {(bascule.genre === "serveurIllisible" || bascule.genre === "versionInattendue") && (
          <>
            <Cadre titre="1. Mets le contenu du serveur à l'abri">
              <p className="text-sm text-muted">
                Cadence ne sait pas l'interpréter, mais le contenu est là et il est peut-être précieux. Télécharge-le{" "}
                <strong className="text-ink font-medium">avant toute autre manipulation</strong> : une fois remplacé, il n'existera plus nulle part.
              </p>
              <BoutonTelecharger
                libelle="Télécharger le contenu brut du serveur"
                nomFichier={`cadence-serveur-illisible-${horodatage}.json`}
                contenu={JSON.stringify(bascule.brut, null, 2)}
              />
            </Cadre>

            <DetailTechnique
              detail={
                bascule.genre === "serveurIllisible"
                  ? bascule.detail
                  : `Format attendu par cette version de Cadence : ${bascule.attendue}. Format trouvé sur le serveur : ${String(bascule.recue)}.`
              }
            />

            <Cadre titre="2. La version de ce navigateur">
              <p className="text-sm text-muted">Elle est lisible, elle. Voici ce qu'elle contient :</p>
              <LigneDecompte titre="Ce navigateur" decompte={decompter(local)} />
              <BoutonTelecharger libelle="La télécharger aussi" nomFichier={`cadence-navigateur-${horodatage}.json`} contenu={exportLocal} />
            </Cadre>

            <div className="bg-surface border border-red/30 rounded-card p-5 space-y-3">
              <h2 className="font-display text-lg font-medium text-red">3. Remplacer le contenu du serveur</h2>
              <p className="text-sm text-muted">
                Le serveur porterait alors la version de ce navigateur. Le contenu actuel du serveur serait perdu — c'est pour ça que le téléchargement vient avant.
              </p>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={misALAbri} onChange={(e) => setMisALAbri(e.target.checked)} className="mt-0.5" />
                <span>J'ai téléchargé le contenu du serveur.</span>
              </label>
              <button
                type="button"
                onClick={onGarderNavigateur}
                disabled={!misALAbri || enCours}
                className="bg-red/15 text-red font-medium rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Remplacer le contenu du serveur
              </button>
            </div>
          </>
        )}

        {erreur !== null && (
          <div role="alert" className="bg-red/15 text-red rounded-card px-5 py-4 text-sm space-y-1">
            <p>
              <strong className="font-medium">L'opération n'a pas abouti.</strong> Rien n'a changé, ni ici ni sur le serveur : tu peux réessayer, ou t'en tenir aux fichiers
              téléchargés.
            </p>
            <p className="text-xs opacity-80 font-mono break-words">{erreur}</p>
          </div>
        )}

        {/* Toujours disponible, et sans effet de bord : la situation peut venir d'un autre onglet qui
            a écrit entre-temps, auquel cas une simple relecture suffit à la dissiper. */}
        <button type="button" onClick={onReessayer} disabled={enCours} className="text-sm text-muted underline disabled:opacity-40">
          Réinterroger le serveur
        </button>
      </div>
    </div>
  );
}
