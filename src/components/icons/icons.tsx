// @MX:NOTE: [AUTO] mdedit 핸드오프 30개 Lucide 아이콘의 로컬 인라인 React 컴포넌트 배럴.
// 런타임 의존성(lucide-react 등) 추가 없이 SVG를 직접 React 컴포넌트로 인라인한다.
// stroke="currentColor"를 상속하므로 텍스트 색 변경 시 아이콘 색도 자동 반전된다(라이트/다크 겸용).
// @MX:SPEC: SPEC-UI-006

import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

function svgProps(props: IconProps): IconProps {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function BoldIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"></path>
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M21.801 10A10 10 0 1 1 17 3.335"></path><path d="m9 11 3 3L22 4"></path>
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="m9 18 6-6-6-6"></path>
    </svg>
  );
}

export function CircleIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10"></circle>
    </svg>
  );
}

export function CodeIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  );
}

export function Columns2Icon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M12 3v18"></path>
    </svg>
  );
}

export function DownloadIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line>
    </svg>
  );
}

export function EyeIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

export function FileOutputIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M4 7V4a2 2 0 0 1 2-2 2 2 0 0 0-2 2"></path><path d="M4.063 20.999a2 2 0 0 0 2 1L18 22a2 2 0 0 0 2-2V7l-5-5H6"></path><path d="m5 11-3 3"></path><path d="m5 17-3-3h10"></path>
    </svg>
  );
}

export function FilePlusIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M9 15h6"></path><path d="M12 18v-6"></path>
    </svg>
  );
}

export function FileTextIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>
    </svg>
  );
}

export function FolderOpenIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"></path>
    </svg>
  );
}

export function FolderIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
    </svg>
  );
}

export function Heading1Icon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="m17 12 3-2v8"></path>
    </svg>
  );
}

export function Heading2Icon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"></path>
    </svg>
  );
}

export function Heading3Icon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"></path><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"></path>
    </svg>
  );
}

export function ImageIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
    </svg>
  );
}

export function ItalicIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <line x1="19" x2="10" y1="4" y2="4"></line><line x1="14" x2="5" y1="20" y2="20"></line><line x1="15" x2="9" y1="4" y2="20"></line>
    </svg>
  );
}

export function Link2Icon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2"></path><path d="M15 7h2a5 5 0 1 1 0 10h-2"></path><line x1="8" x2="16" y1="12" y2="12"></line>
    </svg>
  );
}

export function LinkIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  );
}

export function ListIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 12h.01"></path><path d="M3 18h.01"></path><path d="M3 6h.01"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M8 6h13"></path>
    </svg>
  );
}

export function MinusIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M5 12h14"></path>
    </svg>
  );
}

export function MoonIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
    </svg>
  );
}

export function PanelLeftIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path>
    </svg>
  );
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M5 12h14"></path><path d="M12 5v14"></path>
    </svg>
  );
}

export function SaveIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path>
    </svg>
  );
}

export function SearchIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>
    </svg>
  );
}

export function SunIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>
    </svg>
  );
}

export function TextQuoteIcon(props: IconProps): JSX.Element {
  return (
    <svg {...svgProps(props)}>
      <path d="M17 6H3"></path><path d="M21 12H8"></path><path d="M21 18H8"></path><path d="M3 12v6"></path>
    </svg>
  );
}
