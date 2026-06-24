#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
汎用選手ボディ・アトラス組み立てツール

Geminiで生成した「ボディのみ(頭なし・首から下・透過・キット中立)」の素材から、
ゲームが使う 4列×4行のボディ・アトラス(BODY_IMG)を組み立て、首アンカー(BODY_ANCHOR)を
自動算出する。シグネチャーと等身を揃えるために、ボディだけ差し替える用途。

入力(どちらでも可):
  (A) ポジション別シート: src/assets/bodies/body_{fw,mf,df,gk}.png
      各シートに同ポジの複数ポーズ(=バリエーション)が横並び。自動で左から検出・分割。
  (B) 個別ファイル: src/assets/bodies/{fw,mf,df,gk}_{0..3}.png

前提: 各素材は背景透過・頭なし(首の付け根まで)・無地に近いキット。
   アトラスの列=ポジション(FW0/MF1/DF2/GK3)、行=バリエーション0..3 (bi=var*4+poscol)。

出力:
  - src/assets/bodies/_atlas_preview.png  (確認用の組み上がりアトラス)
  - 標準出力に BODY_ANCHOR 配列 / 推奨セルサイズ / BODY_IMG用 base64(webp) を表示
    → data.js の BODY_IMG / BODY_ANCHOR / (必要なら BCW,BCH) を差し替える。

使い方:
  python tools/build_body_atlas.py [--cell 132x120] [--pad 6] [--dry-run]
"""
import sys, argparse, base64, io, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BODY_DIR = ROOT / "src" / "assets" / "bodies"
POS = ["fw", "mf", "df", "gk"]   # 列順(POSCOL={FW:0,MF:1,DF:2,GK:3})


def detect_segments(im, min_width=40, gap_merge=12, sample_step=2):
    """アルファの列ごとの非透明画素数から、横並び figure の x範囲リストを返す(crop_signatureと同方式)。"""
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


def load_bodies(Image):
    """ポジションごとに最大4体のボディ画像(トリム済みRGBA)を返す: {pos:[im,...]}"""
    out = {}
    for pos in POS:
        sheet = BODY_DIR / f"body_{pos}.png"
        ims = []
        if sheet.exists():
            im = Image.open(sheet).convert("RGBA")
            segs = detect_segments(im)
            for s in segs[:4]:
                c = im.crop((s[0], 0, s[1] + 1, im.size[1]))
                ims.append(c.crop(c.getbbox()))
            print(f"  {pos}: シート検出 {len(segs)}体 → {len(ims)}体採用")
        else:
            for v in range(4):
                f = BODY_DIR / f"{pos}_{v}.png"
                if f.exists():
                    c = Image.open(f).convert("RGBA")
                    ims.append(c.crop(c.getbbox()))
            if ims:
                print(f"  {pos}: 個別ファイル {len(ims)}体")
        if not ims:
            sys.exit(f"ERROR: {pos} のボディ素材が見つかりません(body_{pos}.png か {pos}_0.png)")
        while len(ims) < 4:      # 4体に満たなければ最後を複製
            ims.append(ims[-1])
        out[pos] = ims[:4]
    return out


def neck_anchor(cell_im, cw, neck_min=14):
    """セル内ボディの首位置[x,y]を推定。上げた腕(細い run)を無視し、肩幅のある最初の行(=首/肩)の
    最大 run の中心を首とする。"""
    a = cell_im.split()[3].load()
    W, H = cell_im.size
    for y in range(H):
        runs, s = [], None
        for x in range(W):
            if a[x, y] > 24:
                s = x if s is None else s
            elif s is not None:
                runs.append((s, x - 1)); s = None
        if s is not None:
            runs.append((s, W - 1))
        wide = [r for r in runs if r[1] - r[0] + 1 >= neck_min]
        if wide:
            r = max(wide, key=lambda r: r[1] - r[0])
            return [(r[0] + r[1]) // 2, y]
    return [cw // 2, 0]


def main():
    ap = argparse.ArgumentParser(description="汎用ボディatlasの組み立て")
    ap.add_argument("--cell", default="132x120", help="セルサイズ WxH (既定132x120)")
    ap.add_argument("--pad", type=int, default=6, help="セル内の上下左右パディングpx")
    ap.add_argument("--quality", type=int, default=88, help="WebP品質")
    ap.add_argument("--dry-run", action="store_true", help="プレビューPNGのみ。base64は出さない")
    args = ap.parse_args()
    try:
        from PIL import Image
    except ImportError:
        sys.exit("ERROR: Pillow が必要です。`pip install Pillow`")

    cw, ch = (int(v) for v in args.cell.lower().split("x"))
    print(f"セル={cw}x{ch} / 列順={POS}")
    bodies = load_bodies(Image)

    atlas = Image.new("RGBA", (cw * 4, ch * 4), (0, 0, 0, 0))
    anchors = [None] * 16
    for col, pos in enumerate(POS):
        for row, body in enumerate(bodies[pos]):
            # セルに収まるよう縦横比維持で縮小、下端中央に配置
            bw, bh = body.size
            sc = min((cw - args.pad * 2) / bw, (ch - args.pad * 2) / bh)
            nw, nh = max(1, int(bw * sc)), max(1, int(bh * sc))
            r = body.resize((nw, nh), Image.LANCZOS)
            cell = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            ox, oy = (cw - nw) // 2, ch - nh - args.pad
            cell.alpha_composite(r, (ox, oy))
            atlas.alpha_composite(cell, (col * cw, row * ch))
            bi = row * 4 + col            # POSCOL: fw=0..gk=3 が列、varが行
            anchors[bi] = neck_anchor(cell, cw)

    BODY_DIR.mkdir(parents=True, exist_ok=True)
    prev = BODY_DIR / "_atlas_preview.png"
    atlas.save(prev)
    print(f"プレビュー保存 -> {prev.relative_to(ROOT)}")
    print(f"\nBODY_ANCHOR = {anchors}")
    print(f"推奨: const BCW={cw},BCH={ch}; (canvas H は body下端が収まるよう要確認)")
    if not args.dry_run:
        buf = io.BytesIO(); atlas.save(buf, "WEBP", quality=args.quality)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        print(f"\nBODY_IMG.src dataURI(先頭60字): data:image/webp;base64,{b64[:60]}...")
        out = BODY_DIR / "_atlas_b64.txt"
        out.write_text("data:image/webp;base64," + b64, encoding="utf-8")
        print(f"base64全文 -> {out.relative_to(ROOT)} (data.js の BODY_IMG.src に貼り付け)")
    print("\n次: data.js の BODY_IMG/BODY_ANCHOR(必要なら BCW,BCH,HH)を更新 → python build.py → 並べて検証")


if __name__ == "__main__":
    main()
