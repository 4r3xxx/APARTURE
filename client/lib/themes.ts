import type { BoothTheme } from "@photobooth/shared";

export interface BoothThemeOption {
  id: BoothTheme;
  name: string;
  description: string;
  icon: string;
}

export const DEFAULT_BOOTH_THEME: BoothTheme = "love";

export const BOOTH_THEMES: BoothThemeOption[] = [
  { id: "halloween", name: "Halloween", description: "Moonlit mischief", icon: "☾" },
  { id: "christmas", name: "Christmas", description: "A winter postcard", icon: "✳" },
  { id: "summer", name: "Summer", description: "Golden hour forever", icon: "☼" },
  { id: "valentines", name: "Valentine’s", description: "Sweetheart season", icon: "♡" },
  { id: "aesthetic", name: "Aesthetic", description: "Soft, quiet tones", icon: "✿" },
  { id: "modern", name: "Modern", description: "Clean studio light", icon: "◫" },
  { id: "love", name: "Love", description: "Romantic editorial", icon: "♥" },
];
