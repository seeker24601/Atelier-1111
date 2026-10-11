/**
 * Splitting a row of options that would run off panel 04: past ROW options,
 * they go under tabs (Portrait, Square, Landscape for ratios), one group shown
 * at a time. See components/ui/Param.jsx.
 */

/** The most options one row holds before it would run off the panel. */
export const ROW = 7

/** Options in order, gathered under their group's key, groups in first-seen order. */
export function groupOptions(options, groupBy) {
  const groups = []
  for (const opt of options) {
    const { key, label } = groupBy(opt)
    let group = groups.find((g) => g.key === key)
    if (!group) groups.push((group = { key, label, options: [] }))
    group.options.push(opt)
  }
  return groups
}

/** Portrait, square or landscape: the tabs a long ratio row is split under. */
export function ratioGroup(value) {
  const [w, h] = value.split(':').map(Number)
  if (w < h) return { key: 'portrait', label: 'Portrait' }
  if (w > h) return { key: 'landscape', label: 'Landscape' }
  return { key: 'square', label: 'Square' }
}
