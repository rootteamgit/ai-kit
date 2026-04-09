#!/usr/bin/env bash
set -euo pipefail

# ================================================================
# claude-sync.sh
# ai-kit リポジトリからスキル・ツールを同期する
# ================================================================

OWNER_REPO="rootteamgit/ai-kit"
BRANCH="main"
TARGET_DIRS=(".claude/skills" ".claude/tools")

# ----------------------------------------------------------------
# カラー出力
# ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

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
# ファイル一覧取得
# ----------------------------------------------------------------
info "ai-kit からファイル一覧を取得中..."

# trees API でフラットなファイルリストを取得し、対象ディレクトリのみ抽出（path と sha を tab 区切り）
REMOTE_FILES=()
while IFS=$'\t' read -r fpath fsha; do
  REMOTE_FILES+=("${fpath}"$'\t'"${fsha}")
done < <(gh api "repos/${OWNER_REPO}/git/trees/${BRANCH}?recursive=1" \
    --jq '.tree[] | select(.type == "blob") | select(.path | test("^\\.claude/(skills|tools)/")) | [.path, .sha] | @tsv')

# ----------------------------------------------------------------
# カウンタ
# ----------------------------------------------------------------
count_copied=0
count_overwritten=0
count_skipped=0
local_only=()

# ----------------------------------------------------------------
# リモートファイルの集合（ローカル固有ファイル判定用）
# ----------------------------------------------------------------
declare -A remote_path_set
for entry in "${REMOTE_FILES[@]}"; do
  fpath="${entry%%$'\t'*}"
  remote_path_set["$fpath"]=1
done

# ----------------------------------------------------------------
# 各リモートファイルを処理
# ----------------------------------------------------------------
for entry in "${REMOTE_FILES[@]}"; do
  fpath="${entry%%$'\t'*}"
  fsha="${entry##*$'\t'}"

  local_path="./${fpath}"
  parent_dir="$(dirname "$local_path")"

  # ファイル内容を取得（base64）
  remote_content_b64=$(gh api "repos/${OWNER_REPO}/git/blobs/${fsha}" --jq '.content' | tr -d '\n')

  if [ ! -f "$local_path" ]; then
    # ローカルに存在しない → コピー
    mkdir -p "$parent_dir"
    echo "$remote_content_b64" | decode_base64 > "$local_path"
    info "コピー: $fpath"
    ((count_copied++)) || true
  else
    # ローカルに存在する → 差分チェック
    local_content_b64=$(base64 < "$local_path" | tr -d '\n')

    # base64 が完全一致しない場合のみ差分ありとみなす
    # (改行コードの違いを吸収するため内容を直接比較)
    remote_decoded=$(echo "$remote_content_b64" | decode_base64)
    local_decoded=$(cat "$local_path")

    if [ "$remote_decoded" = "$local_decoded" ]; then
      # 差分なし → スキップ（メッセージなし）
      ((count_skipped++)) || true
    else
      # 差分あり → ユーザーに確認
      warn "差分あり: $fpath"
      echo "  ローカルと ai-kit の内容が異なります。"
      if [ -t 0 ]; then
        read -r -p "  上書きしますか? [y/N] " answer
      else
        answer="N"
        warn "  TTY なし。スキップします。"
      fi

      if [[ "$answer" =~ ^[Yy]$ ]]; then
        mkdir -p "$parent_dir"
        echo "$remote_content_b64" | decode_base64 > "$local_path"
        info "上書き: $fpath"
        ((count_overwritten++)) || true
      else
        info "スキップ: $fpath"
        ((count_skipped++)) || true
      fi
    fi
  fi
done

# ----------------------------------------------------------------
# ローカル固有ファイルの検出
# ----------------------------------------------------------------
for target_dir in "${TARGET_DIRS[@]}"; do
  if [ -d "./${target_dir}" ]; then
    while IFS= read -r -d '' local_file; do
      # "./" プレフィックスを除去して相対パスにする
      rel_path="${local_file#./}"
      if [ -z "${remote_path_set[$rel_path]+_}" ]; then
        local_only+=("$rel_path")
      fi
    done < <(find "./${target_dir}" -type f -print0)
  fi
done

# ----------------------------------------------------------------
# サマリー表示
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo " 同期完了"
echo "========================================"
echo "  コピー       : ${count_copied} ファイル"
echo "  上書き       : ${count_overwritten} ファイル"
echo "  スキップ     : ${count_skipped} ファイル"
echo "  ローカル固有 : ${#local_only[@]} ファイル"

if [ ${#local_only[@]} -gt 0 ]; then
  echo ""
  warn "以下のファイルは ai-kit に存在しません (ローカル固有):"
  for f in "${local_only[@]}"; do
    echo "  - $f"
  done
fi
echo "========================================"
