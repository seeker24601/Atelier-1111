export default function Segmented({ options, value, onChange, format = String }) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          key={opt}
          className="seg__opt"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
        >
          {format(opt)}
        </button>
      ))}
    </div>
  )
}
