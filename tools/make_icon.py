# -*- coding: utf-8 -*-
"""アイコンを筆跡から描き起こす。
   出来合いの図形ではなく、筆の運びを真似て、太さ・かすれ・にじみを出す。
   筆は「置いたところが濃いほうを採る」ので、重ねても濁らない。"""
import math, random
import numpy as np
from PIL import Image, ImageFilter

大 = 2048                      # 大きく描いて縮める(縁がなめらかになる)
紙 = (243, 238, 227)           # 生成りの紙
墨 = (26, 24, 22)              # 純黒ではない、温かみのある濃墨

# 筆の一点。穂先は丸ではなく、平たく、傾いている。
# 傾きがあるからこそ、起筆と収筆に角が立つ。丸い判子では棒にしかならない。
def 筆玉(半径, 比, 角):
    n = max(3, int(半径 * 2) + 5)
    y, x = np.mgrid[0:n, 0:n]
    c = (n - 1) / 2.0
    co, si = math.cos(角), math.sin(角)
    u = ((x - c) * co + (y - c) * si) / max(半径, 0.5)
    v = (-(x - c) * si + (y - c) * co) / max(半径 * 比, 0.5)
    d = np.sqrt(u * u + v * v)
    a = np.clip((1.0 - d) / 0.14, 0.0, 1.0)
    return a

_玉置場 = {}
def 玉(半径, 比, 角):
    k = (round(半径, 1), round(比, 2), round(角, 2))
    if k not in _玉置場:
        _玉置場[k] = 筆玉(*k)
    return _玉置場[k]

def 置く(面, x, y, 半径, 濃さ, 比=1.0, 角=0.0):
    a = 玉(半径, 比, 角) * 濃さ
    n = a.shape[0]
    左 = int(round(x - (n - 1) / 2.0)); 上 = int(round(y - (n - 1) / 2.0))
    x0, y0 = max(0, 左), max(0, 上)
    x1, y1 = min(大, 左 + n), min(大, 上 + n)
    if x0 >= x1 or y0 >= y1:
        return
    切 = a[y0 - 上: y1 - 上, x0 - 左: x1 - 左]
    面[y0:y1, x0:x1] = np.maximum(面[y0:y1, x0:x1], 切)

def かすれ(t, 種):
    """筆の終わりに、紙の目が出て墨がまだらになる。
       小さく表示したときに線が消えては困るので、薄くしすぎない。"""
    if t < 0.80:
        return 1.0
    u = (t - 0.80) / 0.20
    ゆらぎ = 0.5 + 0.5 * math.sin(t * 61.0 + 種)
    return max(0.40, 1.0 - u * (0.25 + 0.35 * ゆらぎ))

# ---------- 円相 ----------
def 円相(始角=-100, 開き=24, 太始=0.092, 太終=0.038, 半径=0.335, 種=3):
    """一息で引いた輪。入りは太く、抜きへ向かって細り、始めと終わりはわずかに開く。"""
    面 = np.zeros((大, 大), np.float32)
    cx, cy = 大 * 0.5, 大 * 0.505
    R = 大 * 半径
    掃 = 360 - 開き
    r = random.Random(種)
    位相 = [r.uniform(0, 6.28) for _ in range(4)]
    歩 = 3000
    for i in range(歩):
        t = i / (歩 - 1)
        ang = math.radians(始角 + 掃 * t)
        ゆれ = (math.sin(t * 6.1 + 位相[0]) * 0.010 +
                math.sin(t * 13.7 + 位相[1]) * 0.005 +
                math.sin(t * 27.3 + 位相[2]) * 0.0025)
        rr = R * (1.0 + ゆれ)
        x = cx + math.cos(ang) * rr
        y = cy + math.sin(ang) * rr
        幅 = 太始 + (太終 - 太始) * (t ** 0.88)
        # 起筆:判子のような丸い頭にならないよう、細く入って一気に太らせる。
        # 筆は紙に触れた点から沈み込むので、頭は尖る。
        if t < 0.030:
            幅 *= 0.24 + 0.76 * (t / 0.030) ** 0.45
        幅 *= 1.0 + math.sin(t * 9.3 + 位相[3]) * 0.055
        置く(面, x, y, 大 * 幅 * 0.5, かすれ(t, 種))
    return 面

# ---------- 一 ----------
def 一(種=11):
    """楷書の横画。
       起筆は左上から斜めに入って押さえ、送筆で細り、
       収筆は右下へ押さえてから左上へ抜く。この二つの角が字を字にする。"""
    面 = np.zeros((大, 大), np.float32)
    x0, x1 = 大 * 0.200, 大 * 0.808
    y0, y1 = 大 * 0.548, 大 * 0.494      # わずかに右上がり
    角 = math.radians(-38)               # 穂先の傾き
    比 = 0.56
    歩 = 3000
    for i in range(歩):
        t = i / (歩 - 1)
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        if t < 0.020:                     # 起筆:最初から穂を寝かせて置く。
            幅 = 0.104                    # 丸い頭にしないため、細く入らない
        elif t < 0.86:                    # 送筆:わずかに細る
            u = (t - 0.020) / 0.84
            幅 = 0.104 - 0.030 * (u ** 0.9)
        elif t < 0.95:                    # 収筆・按:右下へ軽く押さえる
            u = (t - 0.86) / 0.09
            幅 = 0.074 + 0.030 * math.sin(u * math.pi * 0.5)
            y += 大 * 0.011 * math.sin(u * math.pi * 0.5)
        else:                             # 収筆・収:左上へ抜いて角を立てる
            u = min(1.0, (t - 0.95) / 0.05)
            幅 = 0.104 * max(0.0, 1.0 - u) ** 0.55
            y += 大 * 0.011 * (1.0 - u * 0.55)
            x -= 大 * 0.016 * u
        濃 = 1.0
        if 0.58 < t < 0.80:               # 送筆の途中に、わずかな紙の目
            濃 = 0.86 + 0.14 * abs(math.sin(t * 71.0))
        置く(面, x, y, 大 * 幅 * 0.5, 濃, 比, 角)
    return 面

def 仕上げ(面, 地色=紙, 墨色=墨):
    層 = Image.fromarray((np.clip(面, 0, 1) * 255).astype(np.uint8), "L")
    im = Image.new("RGB", (大, 大), 地色)
    # にじみ(紙に墨が滲む)
    ぼけ = 層.filter(ImageFilter.GaussianBlur(大 * 0.009)).point(lambda v: int(v * 0.20))
    im.paste(Image.new("RGB", (大, 大), 墨色), (0, 0), ぼけ)
    im.paste(Image.new("RGB", (大, 大), 墨色), (0, 0),
             層.filter(ImageFilter.GaussianBlur(大 * 0.0010)))
    # 紙のごく淡い粗さ
    r = np.random.default_rng(7)
    n = r.normal(0, 1.4, (大 // 6, 大 // 6))
    n = np.array(Image.fromarray((n + 128).astype(np.uint8), "L")
                 .resize((大, 大), Image.BICUBIC), np.float32) - 128
    a = np.clip(np.array(im, np.float32) + n[:, :, None], 0, 255)
    return Image.fromarray(a.astype(np.uint8))

if __name__ == "__main__":
    出 = "/private/tmp/claude-501/-Users-ak-Documents-Codex/d44d08f5-12a2-4a00-aabf-bf6071c2bbb7/scratchpad/icon2/"
    for 名, 面 in (("A-円相", 円相()), ("B-一", 一())):
        仕上げ(面).resize((512, 512), Image.LANCZOS).save(出 + 名 + ".png")
    print("描きました")

# ---------- 一(明朝の字形から起こす) ----------
# 筆で一から描くと、どうしても刃物や棒に見えてしまう。
# 明朝体の横画は左右に「鱗(うろこ)」を持ち、字として読める形が保証されている。
# その輪郭を借りたうえで、わずかな揺らぎを与えて印刷物らしさを抜く。
def 一_明朝(占め=0.62):
    from PIL import ImageDraw, ImageFont
    路 = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
    仮 = Image.new("L", (大 * 2, 大 * 2), 0)
    d = ImageDraw.Draw(仮)
    f = ImageFont.truetype(路, int(大 * 1.2), index=1)   # index 1 = W6(太め)
    d.text((大 * 0.4, 大 * 0.3), "一", font=f, fill=255)
    切 = 仮.crop(仮.getbbox())                            # 墨のある所だけ取り出す
    w = int(大 * 占め)
    h = max(2, int(切.height * w / 切.width))
    切 = 切.resize((w, h), Image.LANCZOS)
    層 = Image.new("L", (大, 大), 0)
    層.paste(切, ((大 - w) // 2, (大 - h) // 2))
    return np.array(層, np.float32) / 255.0
