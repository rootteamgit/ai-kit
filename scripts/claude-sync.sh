#!/usr/bin/env bash
set -euo pipefail

# ================================================================
# claude-sync.sh
# ai-kit リポジトリからスキル・ツールを同期する
# ================================================================

OWNER_REPO="rootteamgit/ai-kit"
BRANCH="main"

# ----------------------------------------------------------------
# カラー出力
# ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
section() { echo -e "\n${CYAN}=== $* ===${NC}"; }

# ----------------------------------------------------------------
# 前提条件チェック
# ----------------------------------------------------------------
if ! command -v gh &>/dev/null; then
  error "gh コマンドが見つかりません。GitHub CLI をインストールしてください。"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  error "gh コマンドで認証されていません。'gh auth login' を実行してください。"
  exit 1
fi

if ! command -v base64 &>/dev/null; then
  error "base64 コマンドが見つかりません。"
  exit 1
fi

# ----------------------------------------------------------------
# base64 デコード（GNU: -d / macOS: -D）
# ----------------------------------------------------------------
decode_base64() {
  if base64 --version 2>&1 | grep -q GNU; then
    base64 -d
  else
    base64 -D
  fi
}

# ----------------------------------------------------------------
# 一時ディレクトリ
# ----------------------------------------------------------------
TMPDIR_SYNC=$(mktemp -d)
trap 'rm -rf "$TMPDIR_SYNC"' EXIT

# ----------------------------------------------------------------
# リモートファイル一覧取得
# ----------------------------------------------------------------
info "ai-kit からファイル一覧を取得中..."

gh api "repos/${OWNER_REPO}/git/trees/${BRANCH}?recursive=1" \
    --jq '.tree[] | select(.type == "blob") | select(.path | test("^\\.claude/(skills|tools)/")) | [.path, .sha] | @tsv' \
    > "$TMPDIR_SYNC/remote_files.tsv"

# ----------------------------------------------------------------
# スキル名一覧を抽出
# ----------------------------------------------------------------
# .claude/skills/{name}/... → name を抽出（重複排除）
grep '^\.claude/skills/' "$TMPDIR_SYNC/remote_files.tsv" | cut -d'/' -f3 | sort -u > "$TMPDIR_SYNC/remote_skills.txt"

# ローカルスキル一覧
if [ -d ".claude/skills" ]; then
  ls -1 .claude/skills/ 2>/dev/null | while read -r d; do
    [ -d ".claude/skills/$d" ] && echo "$d"
  done | sort -u > "$TMPDIR_SYNC/local_skills.txt"
else
  touch "$TMPDIR_SYNC/local_skills.txt"
fi

# ----------------------------------------------------------------
# ファイル取得関数
# ----------------------------------------------------------------
fetch_file() {
  local fpath="$1" fsha="$2"
  mkdir -p "$(dirname "./${fpath}")"
  gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64 > "./${fpath}"
}

# ----------------------------------------------------------------
# スキル同期
# ----------------------------------------------------------------
section "skills"

count_new=0
count_changed=0
count_skipped=0

while IFS= read -r skill_name; do
  # このスキルのリモートファイル一覧
  grep "^\.claude/skills/${skill_name}/" "$TMPDIR_SYNC/remote_files.tsv" > "$TMPDIR_SYNC/current_skill.tsv"

  if [ ! -d ".claude/skills/${skill_name}" ]; then
    # 新規スキル → 質問せずコピー
    while IFS=$'\t' read -r fpath fsha; do
      fetch_file "$fpath" "$fsha"
    done < "$TMPDIR_SYNC/current_skill.tsv"
    info "[${skill_name}] 新規 → コピー完了"
    ((count_new++)) || true
  else
    # 既存スキル — 差分チェック
    has_diff=false

    # リモートのファイルをチェック（新規ファイル・変更ファイル）
    while IFS=$'\t' read -r fpath fsha; do
      if [ ! -f "./${fpath}" ]; then
        has_diff=true
        break
      else
        remote_content=$(gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64)
        local_content=$(cat "./${fpath}")
        if [ "$remote_content" != "$local_content" ]; then
          has_diff=true
          break
        fi
      fi
    done < "$TMPDIR_SYNC/current_skill.tsv"

    # ローカルにしかないファイル（リモートから削除されたファイル）
    if ! $has_diff; then
      while IFS= read -r -d '' local_file; do
        rel_path="${local_file#./}"
        if ! grep -q "^${rel_path}"$'\t' "$TMPDIR_SYNC/current_skill.tsv"; then
          has_diff=true
          break
        fi
      done < <(find "./.claude/skills/${skill_name}" -type f -print0)
    fi

    if $has_diff; then
      warn "[${skill_name}] 変更あり"
      read -r -p "  同期しますか? [y/N] " answer </dev/tty || answer="N"

      if [[ "$answer" =~ ^[Yy]$ ]]; then
        rm -rf "./.claude/skills/${skill_name}"
        while IFS=$'\t' read -r fpath fsha; do
          fetch_file "$fpath" "$fsha"
        done < "$TMPDIR_SYNC/current_skill.tsv"
        info "  → 置き換え完了"
        ((count_changed++)) || true
      else
        info "  → スキップ"
        ((count_skipped++)) || true
      fi
    else
      ((count_skipped++)) || true
    fi
  fi
done < "$TMPDIR_SYNC/remote_skills.txt"

# ローカル固有スキルの検出
local_only_skills=()
while IFS= read -r skill_name; do
  if ! grep -q "^${skill_name}$" "$TMPDIR_SYNC/remote_skills.txt"; then
    local_only_skills+=("$skill_name")
  fi
done < "$TMPDIR_SYNC/local_skills.txt"

# ----------------------------------------------------------------
# ツール同期（.claude/tools/ 全体で1つ）
# ----------------------------------------------------------------
section "tools"

tools_changed=false
tools_synced=false

if grep -q '^\.claude/tools/' "$TMPDIR_SYNC/remote_files.tsv"; then
  grep '^\.claude/tools/' "$TMPDIR_SYNC/remote_files.tsv" > "$TMPDIR_SYNC/remote_tools.tsv"

  tools_diff_count=0
  while IFS=$'\t' read -r fpath fsha; do
    if [ ! -f "./${fpath}" ]; then
      tools_changed=true
      ((tools_diff_count++)) || true
    else
      remote_content=$(gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64)
      local_content=$(cat "./${fpath}")
      if [ "$remote_content" != "$local_content" ]; then
        tools_changed=true
        ((tools_diff_count++)) || true
      fi
    fi
  done < "$TMPDIR_SYNC/remote_tools.tsv"

  if $tools_changed; then
    warn "[tools] 変更あり (${tools_diff_count}ファイル)"
    read -r -p "  同期しますか? [y/N] " answer </dev/tty || answer="N"

    if [[ "$answer" =~ ^[Yy]$ ]]; then
      rm -rf ./.claude/tools
      while IFS=$'\t' read -r fpath fsha; do
        fetch_file "$fpath" "$fsha"
      done < "$TMPDIR_SYNC/remote_tools.tsv"
      info "  → 置き換え完了"
      tools_synced=true
    else
      info "  → スキップ"
    fi
  else
    info "変更なし"
  fi
else
  info "リモートにツールなし"
fi

# ----------------------------------------------------------------
# サマリー
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo " 同期完了"
echo "========================================"
echo "  skills - 新規: ${count_new}  変更: ${count_changed}  スキップ: ${count_skipped}"
if $tools_changed; then
  if $tools_synced; then
    echo "  tools  - 変更あり (同期済み)"
  else
    echo "  tools  - 変更あり (スキップ)"
  fi
else
  echo "  tools  - 変更なし"
fi
if [ ${#local_only_skills[@]} -gt 0 ]; then
  local_names=$(IFS=', '; echo "${local_only_skills[*]}")
  echo "  ローカル固有: ${#local_only_skills[@]}スキル (${local_names})"
fi
echo "========================================"

# --keep が指定されていなければスクリプト自身を削除
if [[ ! " $* " =~ " --keep " ]]; then
  rm -f "$0"
fi
