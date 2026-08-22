# ===================================================================
# 読み上げ音声を VOICEVOX で作る
#   声   : 青山龍星 ノーマル (speaker 13)
#   速さ : 0.92 / 句点の間 1.15倍
#
# 名前は文章そのものから決める(内容の指紋)。
# 通し番号にすると、文章を一つ直しただけで以降が全部ずれ、
# 別の経典が鳴いてしまう。
#
# 表示は漢字のまま。読み上げだけ仮名に置き換える(speech.js の FIXES を使う)。
# ===================================================================
import hashlib, json, os, re, subprocess, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

APP    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(APP, "audio")
BASE   = "http://127.0.0.1:50021"
SPEAKER = 13
os.makedirs(OUTDIR, exist_ok=True)

texts = json.load(open(os.path.join(APP, "tools", "texts.json"), encoding="utf-8"))

# 読み替えの規則は speech.js から直接読む(二重管理を避ける)
_s = open(os.path.join(APP, "speech.js"), encoding="utf-8").read()
_block = _s[_s.index('const FIXES = ['):_s.index('];', _s.index('const FIXES = ['))]
FIXES = [(json.loads('"'+a+'"'), json.loads('"'+b+'"'))
         for a, b in re.findall(r'\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\]', _block)]

def apply_fixes(t):
    for a, b in FIXES: t = t.replace(a, b)
    return t

def 名(t):
    return hashlib.sha1(t.encode("utf-8")).hexdigest()[:12]

def post(path, data=None, params=None):
    url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    body = json.dumps(data).encode() if data is not None else b""
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=300).read()

def one(text):
    name = 名(text)
    m4a  = os.path.join(OUTDIR, name + ".m4a")
    if os.path.exists(m4a) and os.path.getsize(m4a) > 800:
        return os.path.getsize(m4a), True          # すでにある
    q = json.loads(post("/audio_query", params={"text": apply_fixes(text), "speaker": SPEAKER}))
    q["speedScale"] = 0.92
    q["pauseLengthScale"] = 1.15
    wav = post("/synthesis", data=q, params={"speaker": SPEAKER})
    tmp = os.path.join(OUTDIR, name + ".wav")
    open(tmp, "wb").write(wav)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",tmp,
                    "-c:a","aac","-b:a","40k","-ar","24000","-ac","1", m4a], check=True)
    os.remove(tmp)
    return os.path.getsize(m4a), False

要作成 = [t for t in texts if not os.path.exists(os.path.join(OUTDIR, 名(t) + ".m4a"))]
print("全体:", len(texts), "本 / 新しく作る:", len(要作成), "本", flush=True)

done = 0
with ThreadPoolExecutor(max_workers=3) as ex:
    for size, cached in ex.map(one, texts):
        done += 1
        if done % 100 == 0 or done == len(texts):
            print("  %4d / %d" % (done, len(texts)), flush=True)
print("完了", flush=True)
