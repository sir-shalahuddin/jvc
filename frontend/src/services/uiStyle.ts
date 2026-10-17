// UI theme switch: Neo-Brutalist (default) or Modern. Light/dark always follows the system.
// index.html applies the stored value to <html data-ui-style> before first paint.
import { useEffect, useState } from 'react';

export type UiStyle = 'brutalist' | 'modern';
const KEY = 'ui_theme_style';
const EVENT = 'retro:ui-style';

export const UI_STYLE_LABEL: Record<UiStyle, string> = { brutalist: 'Brutalist', modern: 'Modern' };

export function getUiStyle(): UiStyle {
  return document.documentElement.getAttribute('data-ui-style') === 'modern' ? 'modern' : 'brutalist';
}

export function setUiStyle(style: UiStyle): void {
  document.documentElement.setAttribute('data-ui-style', style);
  try {
    localStorage.setItem(KEY, style);
  } catch (_) {
    // private mode / storage blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Current style plus a toggle; every component using it stays in sync. */
export function useUiStyle(): [UiStyle, () => void] {
  const [style, setStyle] = useState<UiStyle>(getUiStyle);
  useEffect(() => {
    const on = () => setStyle(getUiStyle());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [style, () => setUiStyle(style === 'brutalist' ? 'modern' : 'brutalist')];
}
