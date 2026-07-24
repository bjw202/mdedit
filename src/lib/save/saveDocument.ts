// @MX:ANCHOR: [AUTO] 단일 저장 함수 — 5중 저장 중복 수렴점 (header/Mod-s/Mod-Shift-s/모달)
// @MX:REASON: [AUTO] 모든 저장 진입점이 이 함수를 호출한다 (fan_in >= 5). 단일 진입점이어야
//   가드의 저장 버튼이 비결정적으로 어느 구현을 호출할지 결정되지 않는다.
//   forceDialog 옵션으로 Save(기존 파일 덮어쓰기)와 Save As(항상 다이얼로그)를 이 함수 하나로 구분한다.
// @MX:SPEC: SPEC-FS-003

import { writeFile, saveFileAs } from '@/lib/tauri/ipc';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
import { useUIStore } from '@/store/uiStore';

/**
 * 단일 저장 함수 (REQ-009, REQ-FS-003-041~044).
 * - currentFilePath가 있고 forceDialog가 아니면 writeFile으로 덮어쓴다 (Save).
 * - currentFilePath가 없거나 forceDialog가 true이면 saveFileAs(Save As)로 위임하되
 *   watchedPath를 기본 디렉터리로 전달한다 (REQ-035).
 *
 * 상태 전이 (REQ-010/017):
 * - 진입 시 setSaveStatus('saving')
 * - 성공 시 setDirty(false) + setSaveStatus('saved'), returns true
 * - Save As 취소(null) 시 dirty 유지, returns false
 * - 실패 시 setSaveStatus('unsaved') + dirty true 유지, returns false
 *
 * @param opts.forceDialog Save As 진입점에서 true로 전달 — 기존 파일이 있어도 항상 다이얼로그를 띄운다 (REQ-FS-003-041~044)
 * @returns true = 저장 성공, false = 실패 또는 사용자 취소
 */
export async function saveDocument(opts?: { forceDialog?: boolean }): Promise<boolean> {
  const { content, currentFilePath } = useEditorStore.getState();
  const { watchedPath } = useFileStore.getState();
  useUIStore.getState().setSaveStatus('saving');

  try {
    if (currentFilePath && !opts?.forceDialog) {
      // 기존 파일 덮어쓰기
      await writeFile(currentFilePath, content);
    } else {
      // Save As — watchedPath를 기본 디렉터리로 (REQ-035: 진입 경로와 무관하게 동일)
      const savedPath = await saveFileAs(content, watchedPath ?? undefined);
      if (savedPath === null) {
        // 사용자가 Save As 취소 — dirty 유지 (REQ-017)
        const isDirty = useEditorStore.getState().dirty;
        useUIStore.getState().setSaveStatus(isDirty ? 'unsaved' : 'saved');
        return false;
      }
      useEditorStore.getState().setCurrentFilePath(savedPath);
      useFileStore.getState().setCurrentFile(savedPath);
    }
    // 성공 — dirty 동기화 (REQ-010)
    useEditorStore.getState().setDirty(false);
    useUIStore.getState().setSaveStatus('saved');
    return true;
  } catch (err) {
    console.error('[saveDocument] failed:', err);
    useUIStore.getState().setSaveStatus('unsaved');
    // dirty는 true로 유지된다 (REQ-010/017 — 암묵적 데이터 손실 금지)
    return false;
  }
}
