# test 戦略

実装中に test を書くかどうか, どう書くかの判断指針

## 採用するのは specification test のみ

**specification test**:「これが正しい」「これは絶対起きない」を行動 (= input → output) で固定する。実装変更で壊れない (= 仕様変えなければ壊れない)

property test (= 不変条件 + random input) と integration / e2e test (= 複数 module シナリオ) は specification の特殊形, 同じ判断軸で扱う

## 書いてはいけない: characterization test

「現状実装はこう動く」を再現するもの。実装変更で壊れる、書き換え負債化する。test 自体に spec の規範がないので silent regression を防がない

LLM は default でこの寄りに書く (= 現状実装を見て再現)。これが「test 役立たない、書き換え負債」体感の主因。意識的に specification 寄りに振らないと characterization に流れる

## 書く判断点

- 設計議論で不変条件, 仕様が言語化された時 (= specification として固定する)
- reducer, pure logic の追加・改修時 (= 安全網が効く領域)
- 動作確認に手間がかかる integration シナリオ (= 自動化で確認コスト削減)

## 書かない判断点

- 機械的変更 (rename, 引数追加, 型変更) → typescript の型システムで十分
- UI の見た目調整等 → 手動確認で OK
- 一過性の挙動, once and done な logic → 過剰実装回避と整合

## test の書き方

「現状実装の再現」ではなく「これが起きたら正しい」「これは絶対起きない」を行動レベルで表現する

例 (= reducer):
- 「初期 state で event X を受けたら必ず state B に遷移」
- 「同 events 列を 2 回 fold すると同 state (= 決定性)」
- 「state 遷移は許可された cycle のみ満たす (例: idle → running → idle)」
- 「同一 input が N 連続したら failed state へ遷移し、終了 event を emit する」

## 内部 state を assert するか

原則: spec test は **行動 (= input → output)** で書く。内部 bookkeeping (= 外部から観察されない実装詳細) の assert は debuggability であって spec ではない, 行動 test と混ぜない

ただし state の field でも以下は spec として直接 assert で正当:

- **(a) 出力そのものが spec の核**: 例 build 関数の出力構造を `toEqual` で固定
- **(b) public spec field**: 外部 (= UI / API / 別 module) から read される field、state 自身が spec の一部
- **(c) contract field**: state 全体の不変条件を表現。例 immutability の `not.toBe(state)` (=「reducer は変化があれば new ref を返す」契約)

判別基準: 「この field は外部から観察されるか」「state 全体の契約として宣言されているか」→ どちらかなら直接 assert で OK、どちらでもなければ行動 test に置き換える

例 (= reducer):
- ◯ `expect(nextState.items[i]).toEqual({ ... })` = (a) reducer の build 関数の出力構造 spec
- ◯ `expect(nextState.publicFlags).toEqual([...])` = (b) UI / API / 別 module が直接 read する public spec field
- ◯ `expect(nextState).not.toBe(state)` = (c) immutability 契約
- ✗ `expect(state.internalCounter).toBe(2)` = 内部 bookkeeping、行動 test に置き換え (=「N-1 連続で動作中、N 連続で failed」で spec 表現)

debug 容易性が必要なら test 内に局所 console.log を仕込む。spec を debuggability で薄めるのは順序が逆

## 設計変更時の test 書き直し

旧 test 削除 + 新 test 追加 = **仕様の version up**。負債ではなく「新仕様を test で固定する」価値ある作業

「設計変更すると test も書き直し → 無駄」と感じる時は、元 test が characterization だった可能性が高い

## test の本質的価値

specification test が十分な数あると、対象 module の全面書き換え時の動作確認が:
- test ありなら 1 秒で全パターン通過 → 「思い切って書き換える」が low-cost
- test なしなら全 state 遷移を手動確認で 1-2 時間 → 「最小修正で済ませよう」と日和る

差は **refactor の心理的ハードル**, 速度に直結する

## reducer test の参考パターン

reducer の test は specification として書く:
- 決定性 (= 同 events 列で同 state)
- state 遷移 (= 許可された cycle のみ満たす)
- 副作用境界 (= emit される event の固定)
- 不変条件 (= immutability、変化時に new ref)

このパターンは pure logic を持つ任意 module (parser, validator, state machine 等) の test に応用できる
