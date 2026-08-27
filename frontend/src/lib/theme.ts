/**
 * The three appearances, kept apart from the provider for the same reason the
 * palettes are: the provider is a component module, and a constant exported
 * beside a component costs hot reload.
 *
 * 'system' is a choice like the other two, not the absence of one — it is
 * simply the choice that keeps changing. It is stored as the absence of the
 * key, which is also how the script in `index.html` reads it.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]
