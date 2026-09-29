/**
 * Categorical palette for boundary outlines.
 *
 * Each district in a state, and each sub-district in a district, gets its own
 * colour so adjacent polygons are told apart by outline as well as by fill.
 * Hues are spread by the golden angle (137.508 deg), which keeps successive
 * colours far apart instead of walking through neighbouring hues; saturation
 * and lightness are jittered too, so close indices differ by more than hue.
 */
const GOLDEN_ANGLE = 137.508

export function colorFor(index) {
  const hue = (index * GOLDEN_ANGLE) % 360
  const sat = 62 + ((index * 17) % 14)     // 62-75
  const light = 44 + ((index * 11) % 12)   // 44-55
  return `hsl(${hue.toFixed(1)}, ${sat}%, ${light}%)`
}

/** Same hue, lighter and translucent — for the fill behind an outline. */
export function fillFor(index, alpha = 0.3) {
  const hue = (index * GOLDEN_ANGLE) % 360
  return `hsla(${hue.toFixed(1)}, 72%, 60%, ${alpha})`
}
