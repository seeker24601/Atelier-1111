import Plate from '../ui/Plate.jsx'

/** The placeholder says which kind of prompt it is: a description, or an edit. */
export default function PromptPlate({ prompt, onPrompt, hasRefs, onCommit }) {
  return (
    <Plate id="02 / Prompt">
      <textarea
        className="field"
        rows={6}
        autoFocus
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onCommit()
          }
        }}
        placeholder={
          hasRefs
            ? 'make the shirt red, keep everything else'
            : 'a die-cut sticker sheet on raw concrete, hard flash'
        }
      />
    </Plate>
  )
}
