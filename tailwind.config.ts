import type { Config } from "tailwindcss";

// Charte graphique "Cadence" — cf. §8 du prompt produit.
// Tous les tokens de couleur/typo vivent ici : les composants ne doivent
// jamais coder une couleur en dur, seulement référencer ces classes.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0A0C10",
        surface: "#12161D",
        "surface-2": "#161C24",
        line: "rgba(255,255,255,.06)",
        "line-strong": "rgba(255,255,255,.10)",
        ink: "#E8EDF4",
        muted: "#8B96A6",
        faint: "#657084",
        mint: "#3FD69B",
        amber: "#F5C46B",
        red: "#F2726B",
        teal: "#57A9F0",
        violet: "#9B8CFF",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        hero: "24px",
      },
      backgroundImage: {
        halo: "radial-gradient(1200px 600px at 78% -8%, rgba(63,214,155,.06), transparent 60%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
