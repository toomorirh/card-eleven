#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
固有選手(シグネチャー)のモチーフ画像 切り出しツール

複数ポーズが横並びに入った生ソース画像から、目的の1体だけをアルファチャンネルで
自動検出して切り出し、透明余白をトリムして <id>.png として保存する。
これまで都度書いていた処理を再利用可能なツールとしてコミットしたもの。

前提: Pillow(`pip install Pillow`)

使い方:
    python tools/crop_signature.py <src> <id> [--seg center|left|right|<番号>] [--pad N]

例:
    # ce_py7_ronaldo.png(3体)の中央を切り出して ronaldo.png に保存
    python tools/crop_signature.py ce_py7_ronaldo.png ronaldo
    # 左端の選手を切り出す
    python tools/crop_signature.py ce_py3_mbappe.png mbappe --seg left
    # 検出だけして体数・各セグメントのx範囲を表示(保存しない)
    python tools/crop_signature.py ce_py1_kaka.png kaka --dry-run

<src> は src/assets/signatures/ 配下のファイル名でもフルパスでもよい。
保存先は常に src/assets/signatures/<id>.png。
"""
import sys
import argparse
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIG_DIR = ROOT / "src" / "assets" / "signatures"


def detect_segments(im, min_width=40, gap_merge=12, sample_step=2):
    """アルファの列ごとの非透明画素数から、横に並んだ figure の x範囲リストを返す。"""
    W, H = im.size
    a = im.split()[3].load()
    cols = [sum(1 for y in range(0, H, sample_step) if a[x, y] > 16) for x in range(W)]
    segs, start = [], None
    for x in range(W):
        if cols[x] > 1:
            if start is None:
                start = x
        else:
            if start is not None:
                segs.append([start, x - 1]); start = None
    if start is not None:
        segs.append([start, W - 1])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < gap_merge:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] >= min_width]


def pick_index(n, seg):
    if seg == "center":
        return n // 2
    if seg == "left":
        return 0
    if seg == "right":
        return n - 1
    try:
        i = int(seg)
    except ValueError:
        sys.exit(f"ERROR: --seg は center|left|right|数字 のいずれか (指定: {seg})")
    if not (0 <= i < n):
        sys.exit(f"ERROR: セグメント番号 {i} は範囲外 (検出体数: {n})")
    return i


def main():
    ap = argparse.ArgumentParser(description="固有選手モチーフ画像の切り出し")
    ap.add_argument("src", help="生ソース画像(ファイル名 or パス)")
    ap.add_argument("id", help="保存先のシグネチャーid (src/assets/signatures/<id>.png)")
    ap.add_argument("--seg", default="center", help="切り出す体: center|left|right|番号(0始まり)")
    ap.add_argument("--pad", type=int, default=8, help="左右に付ける余白px(既定8)")
    ap.add_argument("--dry-run", action="store_true", help="検出結果だけ表示して保存しない")
    args = ap.parse_args()

    try:
        from PIL import Image
    except ImportError:
        sys.exit("ERROR: Pillow が必要です。`pip install Pillow` を実行してください。")

    src = pathlib.Path(args.src)
    if not src.exists():
        src = SIG_DIR / args.src
    if not src.exists():
        sys.exit(f"ERROR: ソース画像が見つかりません: {args.src}")

    im = Image.open(src).convert("RGBA")
    segs = detect_segments(im)
    n = len(segs)
    print(f"検出: {n}体  x範囲={[(s[0], s[1]) for s in segs]}")
    if n == 0:
        sys.exit("ERROR: 不透明な領域を検出できませんでした(背景が透過か確認)")

    idx = pick_index(n, args.seg)
    s = segs[idx]
    W, H = im.size
    crop = im.crop((max(0, s[0] - args.pad), 0, min(W, s[1] + 1 + args.pad), H))
    crop = crop.crop(crop.getbbox())  # 上下左右の透明余白をトリム
    print(f"選択: index={idx} ({args.seg})  切り出しサイズ={crop.size}")

    if args.dry_run:
        print("dry-run のため保存しません。")
        return
    out = SIG_DIR / f"{args.id}.png"
    crop.save(out)
    print(f"保存 -> {out.relative_to(ROOT)}")
    print("次: data.js の SIGNATURES に id を登録し、`python build.py` を実行してください。")


if __name__ == "__main__":
    main()
