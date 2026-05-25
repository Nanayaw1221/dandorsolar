export default function Card({ children, className = '', accent = false, padding = true }) {
  return (
    <div
      className={`
        bg-white rounded-xl shadow-sm border border-gray-100
        ${accent ? 'border-l-4 border-l-orange-500' : ''}
        ${padding ? 'p-5' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
