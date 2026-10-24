import type { BoothTheme } from "@photobooth/shared";
import { BOOTH_THEMES } from "@/lib/themes";

export default function ThemeArtwork({ theme, compact = false }: { theme: BoothTheme; compact?: boolean }) {
  const option = BOOTH_THEMES.find((entry) => entry.id === theme) ?? BOOTH_THEMES[BOOTH_THEMES.length - 1];

  return (
    <span className={`theme-art theme-art--${theme}${compact ? " theme-art--compact" : ""}`} aria-hidden="true">
      <span className="theme-art-orbit" />
      <span className="theme-art-icon">{option.icon}</span>
      <span className="theme-art-glint">✦</span>
    </span>
  );
}
