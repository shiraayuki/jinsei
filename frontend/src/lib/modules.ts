/**
 * One colour per module, held in one place.
 *
 * The colour is the module's identity: it carries the icon in the section
 * head, the chart series, the summary line and the goal bar. That is what
 * makes a graph placeable before its label is read — and it is why the accent
 * is not in this list. Indigo is the brand and the navigation; a value that
 * means everything means nothing.
 *
 * These are CSS variables rather than hex strings so the dark theme swaps them
 * with everything else. SVG attributes cannot parse `var()`, so charts have to
 * pass them through `style`, never through `stroke=` or `fill=`.
 */
export type ModuleKey = 'sleep' | 'food' | 'move' | 'body' | 'train' | 'mind'

export const moduleColor: Record<ModuleKey, string> = {
  sleep: 'var(--c-sleep)',
  food: 'var(--c-food)',
  move: 'var(--c-move)',
  body: 'var(--c-body)',
  train: 'var(--c-train)',
  mind: 'var(--c-mind)',
}

/** Background for an icon plate or a chart area: the module colour, held back. */
export function moduleTint(module: ModuleKey, percent = 12): string {
  return `color-mix(in srgb, ${moduleColor[module]} ${percent}%, transparent)`
}
