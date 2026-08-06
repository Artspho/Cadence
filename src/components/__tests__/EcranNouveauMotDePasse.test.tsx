// @vitest-environment jsdom
//
// L'écran de retour du lien de réinitialisation (06/08/2026).
//
// CE QUE CES TESTS PROTÈGENT AVANT TOUT : que le parcours « mot de passe oublié » réinitialise
// vraiment quelque chose. Le lien de réinitialisation OUVRE UNE SESSION — sans cet écran, l'utilisateur
// atterrirait connecté sur son tableau de bord, sans qu'on lui ait jamais demandé de nouveau mot de
// passe, donc toujours avec celui qu'il a oublié. Le parcours aurait l'air de fonctionner et ne
// réinitialiserait rien.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EcranNouveauMotDePasse } from "../EcranNouveauMotDePasse";
import type { ClientAuth } from "../../auth/supabaseClient";

function fauxClient(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    ...reponses,
  };
}

function saisir(motDePasse: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText(/nouveau mot de passe/i), { target: { value: motDePasse } });
  fireEvent.change(screen.getByLabelText(/retape-le pour confirmer/i), { target: { value: confirmation } });
}

describe("EcranNouveauMotDePasse — enregistrement", () => {
  it("enregistre le mot de passe sur la session ouverte par le lien", async () => {
    const client = fauxClient();
    const onTermine = vi.fn();
    render(<EcranNouveauMotDePasse client={client} onTermine={onTermine} />);
    saisir("motdepasse-solide", "motdepasse-solide");
    fireEvent.click(screen.getByRole("button", { name: /enregistrer ce mot de passe/i }));
    await waitFor(() => expect(client.updateUser).toHaveBeenCalledWith({ password: "motdepasse-solide" }));
    await waitFor(() => expect(onTermine).toHaveBeenCalled());
  });

  it("NE QUITTE PAS L'ÉCRAN quand Supabase refuse — sinon on repart en croyant le mot de passe changé", async () => {
    const client = fauxClient({ updateUser: vi.fn(async () => ({ error: { message: "New password should be different from the old password" } })) });
    const onTermine = vi.fn();
    render(<EcranNouveauMotDePasse client={client} onTermine={onTermine} />);
    saisir("motdepasse-solide", "motdepasse-solide");
    fireEvent.click(screen.getByRole("button", { name: /enregistrer ce mot de passe/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("New password should be different from the old password");
    expect(onTermine).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe trop court sans appeler Supabase", async () => {
    const client = fauxClient();
    render(<EcranNouveauMotDePasse client={client} onTermine={vi.fn()} />);
    saisir("court12", "court12");
    fireEvent.click(screen.getByRole("button", { name: /enregistrer ce mot de passe/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caractères au minimum/);
    expect(client.updateUser).not.toHaveBeenCalled();
  });
});

describe("EcranNouveauMotDePasse — la confirmation, et pourquoi elle n'est pas une formalité", () => {
  it("N'ENVOIE RIEN quand les deux saisies diffèrent", async () => {
    // Une faute de frappe ici enregistrerait un mot de passe que PERSONNE ne connaît, et la seule
    // porte de secours restante serait un nouvel e-mail de réinitialisation — plafonné à 2 par heure.
    const client = fauxClient();
    const onTermine = vi.fn();
    render(<EcranNouveauMotDePasse client={client} onTermine={onTermine} />);
    saisir("motdepasse-solide", "motdepasse-solidr");
    fireEvent.click(screen.getByRole("button", { name: /enregistrer ce mot de passe/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/ne sont pas identiques/i);
    expect(client.updateUser).not.toHaveBeenCalled();
    expect(onTermine).not.toHaveBeenCalled();
  });

  it("signale l'écart AVANT le clic, dès la frappe", () => {
    render(<EcranNouveauMotDePasse client={fauxClient()} onTermine={vi.fn()} />);
    saisir("motdepasse-solide", "mot");
    expect(screen.getByRole("status")).toHaveTextContent(/ne sont pas identiques/i);
  });

  it("ne crie pas à l'écart tant que la confirmation est vide", () => {
    // Sinon l'avertissement s'affiche pendant qu'on tape le premier champ : une fausse alerte.
    render(<EcranNouveauMotDePasse client={fauxClient()} onTermine={vi.fn()} />);
    saisir("motdepasse-solide", "");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("EcranNouveauMotDePasse — configuration absente", () => {
  it("le dit au lieu de faire semblant d'enregistrer", async () => {
    const onTermine = vi.fn();
    render(<EcranNouveauMotDePasse client={null} onTermine={onTermine} />);
    saisir("motdepasse-solide", "motdepasse-solide");
    fireEvent.click(screen.getByRole("button", { name: /enregistrer ce mot de passe/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/n'est pas configurée/i);
    expect(onTermine).not.toHaveBeenCalled();
  });
});
