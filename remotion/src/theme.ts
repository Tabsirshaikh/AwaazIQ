/**
 * Pulled from the live dashboard so overlays read as part of the product,
 * not as titles pasted over a screen recording.
 */

export const COLORS = {
  cream: "#F5F1E8",
  card: "#FFFFFF",
  navy: "#1B2A4A",
  navySoft: "#2C3E63",
  gold: "#C9973F",
  goldSoft: "#E3C38A",
  ink: "#1B2A4A",
  muted: "#6E6B61",
  rule: "rgba(27, 42, 74, 0.12)",
};

export const FONTS = {
  mono: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};

/** Uppercase mono label — matches the dashboard's section headers. */
export const label = (size = 13) =>
  ({
    fontFamily: FONTS.mono,
    fontSize: size,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 500,
  }) as const;

export const SHADOW = "0 18px 50px rgba(27, 42, 74, 0.18)";
