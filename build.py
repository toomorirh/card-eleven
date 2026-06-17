#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
カードイレブン ビルドスクリプト

src/jsbundle/game.src.js を正本(Single Source of Truth)として、
index.html の2番目の <script> ブロックへ埋め込み直す。

使い方:
    python3 build.py          # ビルド(再埋め込み)
    python3 build.py --check   # ビルドせず一致チェックのみ

開発フロー:
    1. src/jsbundle/game.src.js を編集
    2. python3 build.py を実行
    3. index.html をブラウザで開いて確認 / git commit
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).parent
HTML = ROOT / "index.html"
SRC = ROOT / "src" / "jsbundle" / "game.src.js"


def main():
    check_only = "--check" in sys.argv
    html = HTML.read_text(encoding="utf-8")
    src = SRC.read_text(encoding="utf-8").strip()

    scripts = list(re.finditer(r"(<script[^>]*>)(.*?)(</script>)", html, re.S))
    if len(scripts) < 2:
        sys.exit("ERROR: index.html に <script> ブロックが2つ見つかりません")
    m = scripts[1]  # 2番目がゲーム本体

    current = m.group(2).strip()
    if check_only:
        ok = current == src
        print("一致:" , ok)
        sys.exit(0 if ok else 1)

    new_html = html[:m.start()] + m.group(1) + "\n" + src + "\n" + m.group(3) + html[m.end():]
    HTML.write_text(new_html, encoding="utf-8")

    # 検証: 再読込して一致とID整合を確認
    after = re.findall(r"<script[^>]*>(.*?)</script>", new_html, re.S)[1].strip()
    used = set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', new_html))
    declared = set(re.findall(r'\bid=["\']([^"\']+)["\']', new_html))
    missing = sorted(used - declared)
    print("再埋め込み一致:", after == src)
    print("MISSING ids:", missing or "なし")
    if after != src or missing:
        sys.exit("ERROR: ビルド検証に失敗しました")
    print("ビルド完了 -> index.html")


if __name__ == "__main__":
    main()
