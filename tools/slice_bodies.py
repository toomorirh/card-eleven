#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
汎用選手・全身図シートの分割ツール(全身プール方式 / アプローチB)

Geminiで生成した「ポジション別シート」(body_{fw,mf,df,gk}.png, 各シートに完成選手が
横並び・透過)を、1体ずつに分割して src/assets/bodies/figs/<pos>_<i>.png として保存する。
build.py がこの figs/ を読んで window.GEN_IMG(汎用選手の全身図プール)を埋め込む。

前提: 各シートは背景透過で、選手同士が(できれば)離れていること。接触/重なりがあると
   分割が統合される。きれいに4体取りたい場合は生成時に間隔を空ける。

使い方:
  python tools/slice_bodies.py            # 全シートを分割
  python tools/slice_bodies.py --dry-run  # 検出体数だけ表示
"""
import sys, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BODY_DIR = ROOT / "src" / "assets" / "bodies"
FIG_DIR = BODY_DIR / "figs"
POS = ["fw", "mf", "df", "gk"]


def detect_segments(im, min_width=40, gap_merge=12, sample_step=2):
    W, H = im.size
    a = im.split()[3].load()
    cols = [sum(1 for y in range(0, H, sample_step) if a[x, y] > 16) for x in range(W)]
    segs, start = [], None
    for x in range(W):
        if cols[x] > 1:
            start = x if start is None else start
        elif start is not None:
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


def main():
    ap = argparse.ArgumentParser(description="全身図シートの分割")
    ap.add_argument("--pad", type=int, default=6, help="左右に付ける余白px")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    try:
        from PIL import Image
    except ImportError:
        sys.exit("ERROR: Pillow が必要です。`pip install Pillow`")

    if not args.dry_run:
        FIG_DIR.mkdir(parents=True, exist_ok=True)
        for old in FIG_DIR.glob("*.png"):  # 再スライス時に古い断片を残さない
            old.unlink()

    total = 0
    for pos in POS:
        sheet = BODY_DIR / f"body_{pos}.png"
        if not sheet.exists():
            print(f"  {pos}: body_{pos}.png なし(スキップ)")
            continue
        im = Image.open(sheet).convert("RGBA")
        segs = detect_segments(im)
        W, H = im.size
        print(f"  {pos}: {len(segs)}体検出 x範囲={[(s[0], s[1]) for s in segs]}")
        if args.dry_run:
            continue
        for i, s in enumerate(segs):
            c = im.crop((max(0, s[0] - args.pad), 0, min(W, s[1] + 1 + args.pad), H))
            c = c.crop(c.getbbox())
            c.save(FIG_DIR / f"{pos}_{i}.png")
            total += 1
    if not args.dry_run:
        print(f"\n保存 -> {FIG_DIR.relative_to(ROOT)}/  計{total}体")
        print("次: python build.py で window.GEN_IMG に埋め込み → 汎用選手が全身図で描画される")


if __name__ == "__main__":
    main()
