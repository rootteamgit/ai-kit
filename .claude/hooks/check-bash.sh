#!/bin/bash
# Bash ツール呼び出し時に禁止パターンを検出するフック

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

deny() {
  echo "{
    \"hookSpecificOutput\": {
      \"hookEventName\": \"PreToolUse\",
      \"permissionDecision\": \"deny\",
      \"permissionDecisionReason\": \"$1\"
    }
  }"
  exit 0
}

# 禁止: cd ... && git ... / git -C ...
if echo "$COMMAND" | grep -qE '(cd\s+.+&&\s*git\b|git\s+-C\b)'; then
  deny "cd && git / git -C は使わず、git コマンドを直接実行してください"
fi

exit 0
