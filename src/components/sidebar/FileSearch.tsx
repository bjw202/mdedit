// @MX:NOTE: Controlled search input for filtering the file tree by name.
// Parent component owns the value/onChange state to allow tree filtering logic.
// @MX:SPEC: SPEC-UI-002

interface FileSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function FileSearch({ value, onChange }: FileSearchProps): JSX.Element {
  return (
    <div className="relative flex items-center px-2 py-1">
      {/* Search icon */}
      <span className="absolute left-4 text-gray-400 dark:text-gray-500 pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </span>
      <input
        type="search"
        role="searchbox"
        placeholder="Search files..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-7 pr-6 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {/* Clear button - shown only when value is non-empty */}
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
