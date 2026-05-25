export default function Select({
  label,
  error,
  hint,
  className = '',
  required = false,
  options = [],
  placeholder = 'Select...',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={`
          w-full border rounded-lg text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent
          disabled:bg-gray-50 disabled:cursor-not-allowed
          transition-colors duration-150 px-3 py-2.5 appearance-none bg-white
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'}
        `}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) =>
          typeof opt === 'string' ? (
            <option key={opt} value={opt}>{opt}</option>
          ) : (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          )
        )}
      </select>
      {error && <p className="text-xs text-red-500">⚠ {error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
