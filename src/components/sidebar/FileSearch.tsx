// @MX:NOTE: Controlled search input for filtering the file tree by name.
// Parent component owns the value/onChange state to allow tree filtering logic.
// @MX:SPEC: SPEC-UI-002

import { SearchIcon } from '@/components/icons';

interface FileSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function FileSearch({ value, onChange }: FileSearchProps): JSX.Element {
  return (
    <div className="md-search">
      <SearchIcon width={14} height={14} />
      <input
        type="search"
        role="searchbox"
        placeholder="Search files..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* Clear button - shown only when value is non-empty */}
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--md-text-faint)' }}
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
