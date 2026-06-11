import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/* ============================================================================
   @troop10rwc/ui · Icon.tsx
   The one icon primitive for the back office. A thin wrapper over Font Awesome's
   SVG/React renderer (free packs only) so every icon in the system comes from
   one vocabulary and obeys the design tokens automatically:

     - It renders inline SVG (no webfont, no global stylesheet, nothing from
       "someone else's CSS"), so it fits the hand-written-CSS rule in STYLE.md.
     - It paints with `currentColor` and sizes to `1em`, so it inherits the
       surrounding text's --t10 color and font-size for free — pass tones via the
       parent's color, never a hard-coded hex.
     - `fixedWidth` is on by default so icons align in lists, nav, and buttons.

   Import the icon definitions from the kit's namespaced packs and render them:

     import { Icon } from "@troop10rwc/ui";
     import { faTent, faPlus } from "@troop10rwc/ui/icons/solid";

     <Icon icon={faTent} />
     <Button variant="primary"><Icon icon={faPlus} /> New item</Button>

   Reach for FA icons "whenever possible" — prefer them over emoji or unicode
   glyphs (⛺ ◧ ⌕ …), which render inconsistently across platforms and ignore the
   tokens. See STYLE.md §"Icons".
   ========================================================================== */

export type IconProps = FontAwesomeIconProps;

export function Icon(props: IconProps) {
  // fixedWidth first so it stays the default but a caller can still override it.
  return <FontAwesomeIcon fixedWidth {...props} />;
}

// Re-exported so consumers can drop to the full renderer (layers, transforms,
// per-icon animation) without taking a second dependency on react-fontawesome.
export { FontAwesomeIcon };
export type { FontAwesomeIconProps, IconDefinition };
