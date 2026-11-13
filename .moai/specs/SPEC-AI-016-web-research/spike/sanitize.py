# SPEC-AI-016 스파이크 캡처 정리 스크립트 — 실측 스트림에서 개인 경로·플러그인 목록만 걷어 낸다.
# 이벤트 순서·필드 모양은 그대로 둔다(외부 CLI 픽스처는 실측 캡처여야 한다는 교훈).
# 사용: python3 -I sanitize.py <캡처 폴더> <출력 폴더>
import json
import re
import sys

SRC, DST = sys.argv[1], sys.argv[2]
HOME = re.compile(r"/Users/[A-Za-z0-9_.-]+")
SCRATCH = re.compile(r"/private/tmp/claude-501/[^\x22]*")
INIT_KEYS = ("type", "subtype", "tools", "model", "session_id", "mcp_servers")


def clean(src, dst):
    out = []
    with open(f"{SRC}/{src}.jsonl", encoding="utf-8") as fh:
        for line in fh:
            obj = json.loads(line)
            if obj.get("type") == "system" and obj.get("subtype") == "init":
                obj = {k: obj[k] for k in INIT_KEYS if k in obj}
            elif obj.get("type") == "system" and obj.get("subtype") == "commands_changed":
                continue
            text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
            text = SCRATCH.sub("/tmp/SCRATCH", HOME.sub("/Users/USER", text))
            out.append(text)
    with open(f"{DST}/{dst}", "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    print(dst, len(out))


clean("cl-haiku", "claude-research-haiku.jsonl")
clean("cl-narr", "claude-research-narration.jsonl")
clean("cx-research","codex-research-live.jsonl")
clean("cx-off3", "codex-nonresearch-hardened.jsonl")
# 2차(감사 반영): 실제 조립기와 같은 모양의 정본 프롬프트로 다시 잰 캡처 + 실패 모양 캡처
clean("cl-canon", "claude-research-canonical.jsonl")
clean("cx-canon", "codex-research-canonical.jsonl")
clean("cl-local", "claude-webfetch-error.jsonl")
clean("cx-local", "codex-open-page-failed.jsonl")
