export type IconPalette = {
  primary: string;
  secondary: string;
};

export const ICON_PALETTES = {
  habitly: {
    primary: "#2f4c35",
    secondary: "#9fd39b",
  },
  forest: {
    primary: "#29452f",
    secondary: "#b8ddb0",
  },
  charcoal: {
    primary: "#2c2c2c",
    secondary: "#d4ead0",
  },
  gold: {
    primary: "#3b3428",
    secondary: "#f2d68b",
  },
} satisfies Record<string, IconPalette>;

export const ACTIVE_ICON_PALETTE_NAME = "habitly";

export const ACTIVE_ICON_PALETTE = ICON_PALETTES[ACTIVE_ICON_PALETTE_NAME];
