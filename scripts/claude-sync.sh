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
# base64 デコード関数（Linux: -d / macOS: -D 両対応）
# ----------------------------------------------------------------
decode_base64() {
  if base64 --version 2>&1 | grep -q GNU; then
    base64 -d
  else
    base64 -D
  fi
}

# ----------------------------------------------------------------
# リモートファイル一覧取得
# ----------------------------------------------------------------
info "ai-kit からファイル一覧を取得中..."

declare -A remote_files  # remote_files[path] = sha
while IFS=$'\t' read -r fpath fsha; do
  remote_files["$fpath"]="$fsha"
done < <(gh api "repos/${OWNER_REPO}/git/trees/${BRANCH}?recursive=1" \
    --jq '.tree[] | select(.type == "blob") | select(.path | test("^\\.claude/(skills|tools)/")) | [.path, .sha] | @tsv')

# ----------------------------------------------------------------
# スキル単位でグルーピング（.claude/skills/{name}/ ごと）
# ----------------------------------------------------------------
declare -A remote_skills       # remote_skills[skill_name] = "path1\tsha1\npath2\tsha2\n..."
declare -A remote_tools_files  # remote_tools_files[path] = sha

for fpath in "${!remote_files[@]}"; do
  fsha="${remote_files[$fpath]}"
  if [[ "$fpath" == .claude/skills/* ]]; then
    # .claude/skills/{name}/... から name を抽出
    skill_name=$(echo "$fpath" | cut -d'/' -f3)
    remote_skills["$skill_name"]+="${fpath}"$'\t'"${fsha}"$'\n'
  elif [[ "$fpath" == .claude/tools/* ]]; then
    remote_tools_files["$fpath"]="$fsha"
  fi
done

# ----------------------------------------------------------------
# ローカルスキル一覧
# ----------------------------------------------------------------
declare -A local_skills  # local_skills[skill_name] = 1
if [ -d ".claude/skills" ]; then
  for dir in .claude/skills/*/; do
    [ -d "$dir" ] || continue
    skill_name=$(basename "$dir")
    local_skills["$skill_name"]=1
  done
fi

# ----------------------------------------------------------------
# スキル同期
# ----------------------------------------------------------------
section "skills"

count_new=0
count_changed=0
count_skipped=0
local_only_skills=()

# リモートにあるスキルを処理
for skill_name in $(echo "${!remote_skills[@]}" | tr ' ' '\n' | sort); do
  entries="${remote_skills[$skill_name]}"

  if [ -z "${local_skills[$skill_name]+_}" ]; then
    # 新規スキル
    warn "[${skill_name}] 新規"
    if [ -t 0 ]; then
      read -r -p "  同期しますか? [y/N] " answer
    else
      answer="y"
    fi

    if [[ "$answer" =~ ^[Yy]$ ]]; then
      while IFS=$'\t' read -r fpath fsha; do
        [ -z "$fpath" ] && continue
        mkdir -p "$(dirname "./${fpath}")"
        gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64 > "./${fpath}"
      done <<< "$entries"
      info "  → コピー完了"
      ((count_new++)) || true
    else
      info "  → スキップ"
      ((count_skipped++)) || true
    fi
  else
    # 既存スキル — 差分チェック
    has_diff=false
    diff_count=0

    while IFS=$'\t' read -r fpath fsha; do
      [ -z "$fpath" ] && continue
      if [ ! -f "./${fpath}" ]; then
        has_diff=true
        ((diff_count++)) || true
      else
        remote_content=$(gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64)
        local_content=$(cat "./${fpath}")
        if [ "$remote_content" != "$local_content" ]; then
          has_diff=true
          ((diff_count++)) || true
        fi
      fi
    done <<< "$entries"

    if $has_diff; then
      warn "[${skill_name}] 変更あり (${diff_count}ファイル)"
      if [ -t 0 ]; then
        read -r -p "  同期しますか? [y/N] " answer
      else
        answer="y"
      fi

      if [[ "$answer" =~ ^[Yy]$ ]]; then
        # フォルダ丸ごと置き換え
        rm -rf "./.claude/skills/${skill_name}"
        while IFS=$'\t' read -r fpath fsha; do
          [ -z "$fpath" ] && continue
          mkdir -p "$(dirname "./${fpath}")"
          gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64 > "./${fpath}"
        done <<< "$entries"
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
done

# ローカル固有スキルの検出
for skill_name in "${!local_skills[@]}"; do
  if [ -z "${remote_skills[$skill_name]+_}" ]; then
    local_only_skills+=("$skill_name")
  fi
done

# ----------------------------------------------------------------
# ツール同期（.claude/tools/ 全体で1つ）
# ----------------------------------------------------------------
section "tools"

tools_changed=false
tools_synced=false

if [ ${#remote_tools_files[@]} -gt 0 ]; then
  # 差分チェック
  tools_diff_count=0
  for fpath in "${!remote_tools_files[@]}"; do
    fsha="${remote_tools_files[$fpath]}"
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
  done

  if $tools_changed; then
    warn "[tools] 変更あり (${tools_diff_count}ファイル)"
    if [ -t 0 ]; then
      read -r -p "  同期しますか? [y/N] " answer
    else
      answer="y"
    fi

    if [[ "$answer" =~ ^[Yy]$ ]]; then
      rm -rf ./.claude/tools
      for fpath in "${!remote_tools_files[@]}"; do
        fsha="${remote_tools_files[$fpath]}"
        mkdir -p "$(dirname "./${fpath}")"
        gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n' | decode_base64 > "./${fpath}"
      done
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
