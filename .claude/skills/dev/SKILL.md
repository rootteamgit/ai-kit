---
name: dev
description: 何らかの作業を始める前に最初に読む skill。知識収集、設計議論、実装の手法まとめ
---

## 段階0: アプリの設計を理解する

まずこの３つのソースからアプリの設計を把握する

- **knowledge.jsonl**: 全体を把握していなければ `node .claude/tools/knowledge.mjs read -limit 0` で全件 read、概要を既に knowing なら `-tags 'X'` で深掘り
- **直近 commit**: `git log --oneline -20` で最近の構造変化を把握。直前の session で見ていれば省略可
- **コード**: user 依頼から該当 file, 周辺 file を推測して Read。推測できなければ user に確認

## ルール

- knowledge と現実が食い違った場合、code を信じろ。古い knowledge を盲信するな

## 1 ターン 1 判断点

user と話す時、1 ターンで扱う判断点は 1 つに絞る。複合判断を一括で扱うな
複数論点を 1 ターンに詰めると user が個別に判断できなくなる

(例) user の意見を否定する時、否定 → 修正案 → 複数案 を 1 ターンに並べない
1. まず「否定とその理由」だけで return
2. 次ターンで修正方針の合意を取る
3. 合意後、元の話の流れに戻る

## 段階構成 (段階 0 完了後)

段階 0 を実行した後、作業内容に応じて以下の段階を進む
詳細は当該段階に入った時に該当 md を Read tool で取得する

- 段階 1 (設計議論): `.claude/skills/dev/stage-1-design.md`、設計議論入る前に Read
- 段階 2 (実装): `.claude/skills/dev/stage-2-implement.md`、実装に入る前に Read

質問への回答, 1 file 修正等の小さい作業なら段階 1-2 は省略して良い
