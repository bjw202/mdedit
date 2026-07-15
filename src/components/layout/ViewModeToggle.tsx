// @MX:NOTE: [AUTO] 3-state 세그먼티드 토글 컨트롤 — 편집(editor) / 분할(split) / 미리보기(preview) 모드 전환.
// @MX:NOTE: 키보드 단축키는 SPEC-UI-004 Exclusions에 의해 의도적으로 미지원.
//   모드 전환은 버튼 클릭으로만 수행하며, effectiveViewMode가 아닌 원래 viewMode를 기준으로 활성 강조를 표시한다.
// @MX:SPEC: SPEC-UI-004

import { useUIStore } from '@/store/uiStore';
import type { ViewMode } from '@/store/uiStore';
import { PanelLeftIcon, Columns2Icon, EyeIcon, type IconProps } from '@/components/icons';

// 각 버튼의 설정 목록 — 레이블, 모드 값, 접근성 레이블, 아이콘(SPEC-UI-006: 텍스트 글리프 → Lucide SVG)
const VIEW_MODE_BUTTONS: {
  mode: ViewMode;
  label: string;
  ariaLabel: string;
  Icon: (props: IconProps) => JSX.Element;
}[] = [
  { mode: 'editor', label: '편집', ariaLabel: '편집 모드', Icon: PanelLeftIcon },
  { mode: 'split', label: '분할', ariaLabel: '분할 모드', Icon: Columns2Icon },
  { mode: 'preview', label: '미리보기', ariaLabel: '미리보기 모드', Icon: EyeIcon },
];

/**
 * Editor/Preview 영역 표시 모드를 전환하는 3-버튼 세그먼티드 토글 컴포넌트.
 * useUIStore에서 viewMode / setViewMode를 직접 구독하므로 props 불필요.
 * 활성 강조는 effectiveViewMode가 아닌 원래 viewMode 기준 (SPEC-UI-004 확정 결정 2).
 */
export function ViewModeToggle(): JSX.Element {
  // 원래 viewMode를 직접 구독 — effectiveViewMode가 아님
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);

  return (
    <div className="md-seg" role="group" aria-label="뷰 모드 선택">
      {VIEW_MODE_BUTTONS.map(({ mode, label, ariaLabel, Icon }) => {
        const isActive = viewMode === mode;
        return (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            title={ariaLabel}
            className={`md-seg-opt ${isActive ? 'is-active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
