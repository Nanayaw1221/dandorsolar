export default function Table({ columns = [], data = [], loading = false, emptyMessage = 'No data found', className = '' }) {
  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
        <div className="p-8 flex flex-col items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-orange-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left text-xs font-semibold text-white uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">📭</span>
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row._id || rowIdx}
                  className={`border-b border-gray-50 hover:bg-orange-50/50 transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-gray-700 align-middle">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
