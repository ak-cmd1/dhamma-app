# ===================================================================
# 読み上げる文章を、漏れなく一覧にする
#
# 鍵は「アプリが Speech.speak() に渡す文字列そのもの」でなければならない。
# 一字でも違うと音声が引き当てられず、端末内蔵の声に落ちる。
#
# 出力: tools/texts.json
# ===================================================================
import re, json, os

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, "tools", "texts.json")
def js(m): return json.loads('"' + m + '"')

def spoken_sutra(s):
    """speech.js の spokenSutra を一字一句そのまま写したもの"""
    if not s: return ""
    t = s
    t = re.sub(r'^[A-Za-z]+\s*[\d.]+\s*', '', t)
    t = re.sub(r'Dhp\s*[\d\-]+', '', t)
    t = re.sub(r'[A-Za-z]{2,}\s*[\d.\-]+', '', t)
    t = re.sub(r'ダンマパダ\s*[\d\-]+', 'ダンマパダ', t)
    t = re.sub(r'イティヴッタカ\s*\d+', 'イティヴッタカ', t)
    t = re.sub(r'ウダーナ\s*[\d.]+', 'ウダーナ', t)
    t = re.sub(r'[()（）]', ' ', t)
    t = re.sub(r'[/／]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return re.sub(r'^[のはがをにでとや、・]+\s*', '', t).strip()

texts = []
def add(t):
    t = (t or "").strip()
    if t: texts.append(t)

def 読む(名): return open(os.path.join(APP, 名), encoding="utf-8").read()

# ---- 経典(passages.js) ----
for sutra, text in re.findall(
        r'sutra:\s*"((?:[^"\\]|\\.)*)"\s*,\s*text:\s*"((?:[^"\\]|\\.)*)"', 読む('passages.js')):
    add(spoken_sutra(js(sutra)))
    for para in js(text).split("\n"): add(para)

# ---- 五蓋(data.js) ----
d = 読む('data.js')
h_src = d[d.index('const HINDRANCES'):d.index('// ---------- 三帰依')]
for b in re.split(r'\n  \{\n', h_src)[1:]:
    add(js(re.search(r'closing:\s*"((?:[^"\\]|\\.)*)"', b).group(1)))
    add(js(re.search(r'afterInquiry:\s*"((?:[^"\\]|\\.)*)"', b).group(1)))
    inq = [js(m) for m in re.findall(r'\{ title: "[^"]*", text: "((?:[^"\\]|\\.)*)" \}', b)]
    if inq: add(inq[-1])                       # 坐後に読むのは「道」の問いだけ
    sit = b[b.index('sitting: {'):]
    mname = js(re.search(r'name:\s*"((?:[^"\\]|\\.)*)"', sit).group(1))
    instr = re.search(r'instruction:\s*"((?:[^"\\]|\\.)*)"', sit)
    shorts = re.findall(r'^\s{8}"((?:[^"\\]|\\.)*)",?$', sit, re.M)
    for c in [js(x) for x in shorts] + ([js(instr.group(1))] if instr else []):
        add(mname + "。" + c)                   # 締めで読むのはこの形

# ---- 三帰依・姿勢・三呼吸・添え文 ----
for m in re.findall(r'ja:\s*"((?:[^"\\]|\\.)*)"', d): add(js(m))
p_src = d[d.index('const POSTURE_STEPS'):d.index('const THREE_BREATHS')]
for m in re.findall(r'(?:text|night|morning):\s*"((?:[^"\\]|\\.)*)"', p_src): add(js(m))
t_src = d[d.index('const THREE_BREATHS'):d.index('const TIME_OF_DAY')]
for m in re.findall(r'text:\s*"((?:[^"\\]|\\.)*)"', t_src): add(js(m))
for m in re.findall(r'note:\s*"((?:[^"\\]|\\.)*)"', d): add(js(m))

# ---- 回向 ----
ded = re.search(r'const DEDICATION =\s*((?:\s*"(?:[^"\\]|\\.)*"\s*\+?)+);', d).group(1)
for line in "".join(js(x) for x in re.findall(r'"((?:[^"\\]|\\.)*)"', ded)).split("\n"): add(line)
m = re.search(r'const DEDICATION_AIM = "((?:[^"\\]|\\.)*)"', d)
if m: add(js(m.group(1)).replace("\n", " "))   # 削除されていれば飛ばす

# ---- 呼吸・その他 ----
for c in ["ひとつ","ふたつ","みっつ","よっつ","いつつ"]: add(c + "。吸って")
add("吐いて"); add("終わりました。"); add("この速さで読み上げます。")

# ---- 四十業処(締めで「名前。説明」の形で読まれる) ----
for name, short in re.findall(
        r'name: "((?:[^"\\]|\\.)*)"[\s\S]*?short: "((?:[^"\\]|\\.)*)"', 読む('kammatthana.js')):
    add(js(name) + "。" + js(short))

# ---- 発心・長老の詩 ----
# ここは順序を気にしなくてよい。音声の名前は文章から決まるため。
for 名 in ('hosshin.js', 'elders.js'):
    for sutra, text in re.findall(
            r'sutra: "((?:[^"\\]|\\.)*)"\s*,\s*\n?\s*text: "((?:[^"\\]|\\.)*)"', 読む(名)):
        add(spoken_sutra(js(sutra)))
        for line in js(text).split("\n"): add(line)

uniq = list(dict.fromkeys(texts))
json.dump(uniq, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("種類:", len(uniq), " 総文字数:", sum(len(t) for t in uniq))
