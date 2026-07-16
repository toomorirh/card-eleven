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
import base64
import pathlib

ROOT = pathlib.Path(__file__).parent
HTML = ROOT / "index.html"
SIG_DIR = ROOT / "src" / "assets" / "signatures"  # 固有選手のモチーフ画像 <id>.png
EMO_DIR = ROOT / "src" / "assets" / "emotionals"  # エモーショナル(最上位)のモーメント画像 <id>.png

# 結合順序。JSはグローバルスコープに連結されるため定義順は基本自由だが、
# boot.js は起動時に load().then(...) を実行する副作用を持つので必ず最後に置く。
# (src/tests/_setup.js も同じ並びを使う。変更したら両方更新すること)
JS_FILES = [
    "data.js", "qr.js", "state.js", "ui-roster.js", "ui-gacha.js", "ui-competition.js",
    "match-core.js", "match-render.js", "match-flow.js", "boot.js",
]
# sfc-skin.css は base.css に対する上書きレイヤーなので後に読む
CSS_FILES = ["base.css", "sfc-skin.css"]


def _join(dirpath, names):
    return "\n\n".join((ROOT / "src" / dirpath / n).read_text(encoding="utf-8").strip() for n in names)


_MIME = {".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def _registered_sig_ids():
    """src/js/data.js の SIGNATURES 配列に登録済みの id を抽出。
    各エントリは `{id:"messi", ...}` の形(idが文字列)。data.js内で id:"..." は
    SIGNATURES だけ(カードは id:uid++ で数値)なので、この正規表現で過不足なく拾える。"""
    data_js = (ROOT / "src" / "js" / "data.js").read_text(encoding="utf-8")
    ids = set()
    for name in ("SIGNATURES", "EMOTIONALS"):  # 固有選手 + エモーショナルの両方を登録
        block = re.search(r"const %s\s*=\s*\[(.*?)\];" % name, data_js, re.S)
        if block:
            ids |= set(re.findall(r'\{\s*id:"([^"]+)"', block.group(1)))
    return ids


def _sig_block():
    """src/assets/signatures/<id>.(png|webp|jpg) を base64 データURI化し
    `window.SIG_IMG={id:dataURI,...};` を生成。**SIGNATURESに登録済みのidだけ**を埋め込む
    (生ソース等の未登録画像でバンドルが肥大化しないように)。id順で決定的に出力(--check安定)。"""
    ids = _registered_sig_ids()
    entries = {}
    for d in (SIG_DIR, EMO_DIR):  # signatures + emotionals を同じ SIG_IMG マップへ
        if d.is_dir():
            for f in sorted(d.iterdir()):
                if f.suffix.lower() in _MIME and f.stem in ids:
                    b64 = base64.b64encode(f.read_bytes()).decode("ascii")
                    entries[f.stem] = "data:%s;base64,%s" % (_MIME[f.suffix.lower()], b64)
    items = ",".join('"%s":"%s"' % (k, entries[k]) for k in sorted(entries))
    return "window.SIG_IMG={%s};" % items


def _check_signature_assets():
    """登録済み signature id に対応する画像ファイルの有無を点検し、未配置を警告する
    (未配置でも★プレースホルダで動くためビルドは止めない)。"""
    ids = _registered_sig_ids()
    have = set()
    for d in (SIG_DIR, EMO_DIR):
        if d.is_dir():
            have |= {f.stem for f in d.iterdir() if f.suffix.lower() in _MIME}
    missing = sorted(ids - have)
    if missing:
        print("⚠ 画像未配置のシグネチャー(★プレースホルダ表示):", ", ".join(missing))
        print("  → tools/crop_signature.py で <id>.png を作成してください。")


BODY_FIG_DIR = ROOT / "src" / "assets" / "bodies" / "figs"


def _gen_block():
    """src/assets/bodies/figs/<pos>_<i>.(png|webp) を base64 データURI化し、汎用選手の
    全身図プール `window.GEN_IMG={"fw":[uri,...],"mf":[...],"df":[...],"gk":[...]};` を生成。
    pos は接頭辞(fw/mf/df/gk)で振り分け。ファイル名順で決定的に出力(--check安定)。"""
    pools = {"fw": [], "mf": [], "df": [], "gk": []}
    if BODY_FIG_DIR.is_dir():
        for f in sorted(BODY_FIG_DIR.iterdir()):
            if f.suffix.lower() in _MIME:
                pos = f.stem.split("_")[0].lower()
                if pos in pools:
                    b64 = base64.b64encode(f.read_bytes()).decode("ascii")
                    pools[pos].append("data:%s;base64,%s" % (_MIME[f.suffix.lower()], b64))
    body = ",".join('"%s":[%s]' % (p, ",".join('"%s"' % u for u in pools[p])) for p in ("fw", "mf", "df", "gk"))
    return "window.GEN_IMG={%s};" % body


def _mgr_block():
    """監督シートを base64 データURI化。第1シート ce_mg_managers.png(4x2=8名)を `window.MGR_SHEET`、
    第2シート ce_mg2_managers.png(4x2=追加8名・sheet:2)を `window.MGR_SHEET2` に。無ければ空文字。"""
    out = []
    for var, name in (("MGR_SHEET", "ce_mg_managers.png"), ("MGR_SHEET2", "ce_mg2_managers.png")):
        f = ROOT / "src" / "assets" / "manager" / name
        if f.is_file():
            b64 = base64.b64encode(f.read_bytes()).decode("ascii")
            out.append('window.%s="data:image/png;base64,%s";' % (var, b64))
        else:
            out.append('window.%s="";' % var)
    return "".join(out)


def _sec_block():
    """src/assets/secretary/ce_secretaries_01.png(4x2グリッド・5キャラ)を base64 データURI化し
    `window.SEC_SHEET="data:..."` を生成。無ければ空文字。"""
    f = ROOT / "src" / "assets" / "secretary" / "ce_secretaries_01.png"
    if not f.is_file():
        return 'window.SEC_SHEET="";'
    b64 = base64.b64encode(f.read_bytes()).decode("ascii")
    return 'window.SEC_SHEET="data:image/png;base64,%s";' % b64


def _cardbg_block():
    """src/assets/carddesign/ce_bg_<tier>.png を 58:95 中央クロップ+縮小(高さ570)して JPEG データURI化し
    window.CARD_BG={"<tier>":"data:..."} を生成。PILが無い場合は生PNGのまま埋め込む(比率はCSS coverで吸収)。"""
    d = ROOT / "src" / "assets" / "carddesign"
    if not d.is_dir():
        return "window.CARD_BG={};"
    try:
        from PIL import Image
        import io
        pil = True
    except Exception:
        pil = False
    TR = 58 / 95
    parts = []
    for f in sorted(d.glob("ce_bg_*.png")):
        tier = f.stem[len("ce_bg_"):]
        if not tier:
            continue
        if pil:
            im = Image.open(f).convert("RGB")
            W, H = im.size
            if W / H > TR:                       # 横広 → 幅を中央クロップ
                cw = max(1, round(H * TR)); x = (W - cw) // 2; im = im.crop((x, 0, x + cw, H))
            else:                                # 縦長 → 高さを中央クロップ
                ch = max(1, round(W / TR)); y = (H - ch) // 2; im = im.crop((0, y, W, y + ch))
            if im.height > 570:                  # 表示用に縮小(高解像の原本は拡大/キャプチャ用に温存)
                im = im.resize((round(570 * TR), 570))
            buf = io.BytesIO(); im.save(buf, "JPEG", quality=82); raw = buf.getvalue(); mime = "jpeg"
        else:
            raw = f.read_bytes(); mime = "png"
        b64 = base64.b64encode(raw).decode("ascii")
        parts.append('"%s":"data:image/%s;base64,%s"' % (tier, mime, b64))
    return "window.CARD_BG={%s};" % ",".join(parts)


def _topbg_block():
    """src/assets/materials/ce_toppage_title.png(ロゴ入りトップ画像)を紙色でフラット化・縮小・JPEG化して
    window.TOP_BG に埋め込む(タイトル画面の背景。PILが無ければ生PNG)。"""
    f = ROOT / "src" / "assets" / "materials" / "ce_toppage_title.png"
    if not f.is_file():
        return 'window.TOP_BG="";'
    try:
        from PIL import Image
        import io
        im = Image.open(f).convert("RGBA")
        bg = Image.new("RGB", im.size, (243, 240, 234))  # 紙色でフラット化(透過→紙色)
        bg.paste(im, mask=im.split()[3])
        if bg.width > 680:
            bg = bg.resize((680, round(680 * bg.height / bg.width)))
        buf = io.BytesIO(); bg.save(buf, "JPEG", quality=88)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return 'window.TOP_BG="data:image/jpeg;base64,%s";' % b64
    except Exception:
        b64 = base64.b64encode(f.read_bytes()).decode("ascii")
        return 'window.TOP_BG="data:image/png;base64,%s";' % b64


DEV_JS = ROOT / "src" / "js" / "_dev.js"  # ローカル検証専用(gitignore)。--dev の時だけ末尾に連結。


def _assemble_js(dev=False):
    """JS本体を結合し、先頭の "use strict"; 直後に SIG_IMG / GEN_IMG / MGR_SHEET ブロックを差し込む
    (strictモードを保ちつつ、data.js のプリロードより前に画像プールを定義する)。
    dev=True かつ src/js/_dev.js があれば、それを boot.js の後ろに連結(ローカル検証専用)。"""
    body = _join("js", JS_FILES)
    if dev and DEV_JS.is_file():
        body += "\n\n" + DEV_JS.read_text(encoding="utf-8").strip()
    inject = _sig_block() + "\n" + _gen_block() + "\n" + _mgr_block() + "\n" + _sec_block() + "\n" + _cardbg_block() + "\n" + _topbg_block()
    first_nl = body.find("\n")
    if first_nl == -1:
        return body + "\n" + inject
    return body[:first_nl] + "\n" + inject + body[first_nl:]


def _replace_block(html, pattern, new_inner, label):
    blocks = list(re.finditer(pattern, html, re.S))
    if not blocks:
        sys.exit(f"ERROR: index.html に{label}ブロックが見つかりません")
    m = blocks[-1] if label == "<script>" else blocks[0]
    current = m.group(2).strip()
    return m, current, html[:m.start()] + m.group(1) + "\n" + new_inner + "\n" + m.group(3) + html[m.end():]


def main():
    check_only = "--check" in sys.argv
    dev = "--dev" in sys.argv  # ローカル検証ビルド: _dev.js を含め index.dev.html へ出力(index.html は不変)
    out = (ROOT / "index.dev.html") if dev else HTML
    _check_signature_assets()
    html = HTML.read_text(encoding="utf-8")  # テンプレートは常に index.html
    js_src = _assemble_js(dev)
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
    out.write_text(new_html, encoding="utf-8")

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
    print("ビルド完了 ->", out.name + (" (ローカル検証専用・Git管理外)" if dev else ""))


if __name__ == "__main__":
    main()
