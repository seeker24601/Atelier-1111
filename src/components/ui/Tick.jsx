import { Check } from 'lucide-react'

/** The select box in a tile's top-left corner. Shift-click extends a range. */
export default function Tick({ checked, onToggle }) {
  return (
    <button
      className="tick"
      role="checkbox"
      aria-checked={checked}
      aria-label="Select"
      onClick={(e) => {
        e.stopPropagation()
        onToggle(e.shiftKey)
      }}
    >
      <Check size={14} aria-hidden="true" />
    </button>
  )
}
