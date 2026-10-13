import { ChevronDown } from 'lucide-react'
import Plate from '../ui/Plate.jsx'
import Logo from '../ui/Logo.jsx'
import { makerOf, modelName } from '../../makers.js'

/** Just the choice: the maker's mark and the model's name. The picker does the rest. */
export default function ModelPlate({ models, model, onOpen }) {
  const active = models.find((m) => m.id === model)
  return (
    <Plate id="01 / Model" right={models.length ? `${models.length} available` : null}>
      <button className="model-btn" type="button" aria-haspopup="dialog" onClick={onOpen} disabled={!models.length}>
        <Logo id={makerOf(model)} size="md" />
        <span className="model-btn__name">{active ? modelName(active) : models.length ? 'Choose a model' : 'Loading models'}</span>
        <span className="model-btn__caret" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </button>
    </Plate>
  )
}
