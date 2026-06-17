#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
カードイレブン ビルドスクリプト

src/js/*.js と src/css/*.css を正本(Single Source of Truth)として、
index.html の <style> ブロックと2番目の <script> ブロックへ埋め込み直す。
複数ファイルへの分割は開発時の編集しやすさのためで、成果物は今までと同じ
単一HTML(オフラインでもコピー1枚で動作)のまま変わらない。

使い方:
    python3 build.py          # ビルド(再埋め込み)
    python3 build.py --check   # ビルドせず一致チェックのみ

開発フロー:
    1. src/js/*.js (または src/css/*.css) を編集
    2. python3 build.py を実行
    3. index.html をブラウザで開いて確認 / git commit
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).parent
HTML = ROOT / "index.html"

# 結合順序。JSはグローバルスコープに連結されるため定義順は基本自由だが、
# boot.js は起動時に load().then(...) を実行する副作用を持つので必ず最後に置く。
# (src/tests/_setup.js も同じ並びを使う。変更したら両方更新すること)
JS_FILES = [
    "data.js", "state.js", "ui-roster.js", "ui-gacha.js",
    "ui-competition.js", "match-engine.js", "match-flow.js", "boot.js",
]
# sfc-skin.css は base.css に対する上書きレイヤーなので後に読む
CSS_FILES = ["base.css", "sfc-skin.css"]


def _join(dirpath, names):
    return "\n\n".join((ROOT / "src" / dirpath / n).read_text(encoding="utf-8").strip() for n in names)


def _replace_block(html, pattern, new_inner, label):
    blocks = list(re.finditer(pattern, html, re.S))
    if not blocks:
        sys.exit(f"ERROR: index.html に{label}ブロックが見つかりません")
    m = blocks[-1] if label == "<script>" else blocks[0]
    current = m.group(2).strip()
    return m, current, html[:m.start()] + m.group(1) + "\n" + new_inner + "\n" + m.group(3) + html[m.end():]


def main():
    check_only = "--check" in sys.argv
    html = HTML.read_text(encoding="utf-8")
    js_src = _join("js", JS_FILES)
    css_src = _join("css", CSS_FILES)

    style_blocks = list(re.finditer(r"(<style>)(.*?)(</style>)", html, re.S))
    script_blocks = list(re.finditer(r"(<script[^>]*>)(.*?)(</script>)", html, re.S))
    if not style_blocks:
        sys.exit("ERROR: index.html に <style> ブロックが見つかりません")
    if len(script_blocks) < 2:
        sys.exit("ERROR: index.html に <script> ブロックが2つ見つかりません")

    style_m = style_blocks[0]
    script_m = script_blocks[1]  # 2番目がゲーム本体

    current_css = style_m.group(2).strip()
    current_js = script_m.group(2).strip()

    if check_only:
        css_ok = current_css == css_src
        js_ok = current_js == js_src
        print("CSS一致:", css_ok)
        print("JS一致:", js_ok)
        sys.exit(0 if (css_ok and js_ok) else 1)

    # script側は元のオフセットがstyle編集でズレるため、後ろ(script)から先に書き換える
    new_html = html[:script_m.start()] + script_m.group(1) + "\n" + js_src + "\n" + script_m.group(3) + html[script_m.end():]
    new_html = new_html[:style_m.start()] + style_m.group(1) + "\n" + css_src + "\n" + style_m.group(3) + new_html[style_m.end():]
    HTML.write_text(new_html, encoding="utf-8")

    # 検証: 再読込して一致とID整合を確認
    after_css = re.findall(r"<style>(.*?)</style>", new_html, re.S)[0].strip()
    after_js = re.findall(r"<script[^>]*>(.*?)</script>", new_html, re.S)[1].strip()
    used = set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', new_html))
    declared = set(re.findall(r'\bid=["\']([^"\']+)["\']', new_html))
    missing = sorted(used - declared)
    print("CSS再埋め込み一致:", after_css == css_src)
    print("JS再埋め込み一致:", after_js == js_src)
    print("MISSING ids:", missing or "なし")
    if after_css != css_src or after_js != js_src or missing:
        sys.exit("ERROR: ビルド検証に失敗しました")
    print("ビルド完了 -> index.html")


if __name__ == "__main__":
    main()
