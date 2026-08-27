/**
 * The palettes the app can be dressed in.
 *
 * A palette is a second axis, independent of light and dark: each one brings
 * both halves, and nothing but the twenty colour tokens changes with it. The
 * values live in `index.css`, keyed by `data-theme`; this file is only the list
 * of names, kept apart from the provider so the provider stays a component
 * module and hot reload keeps working.
 */
export const PALETTES = ['apple', 'jinsei', 'rosepine', 'catppuccin'] as const

export type Palette = (typeof PALETTES)[number]
