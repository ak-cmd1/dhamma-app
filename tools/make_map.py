# ===================================================================
# 文章 → 音声ファイル名 の対応表(audio-map.js)を作る
# 使われなくなった音声も、ここで削除する
# ===================================================================
import hashlib, json, os

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUD = os.path.join(APP, "audio")
texts = json.load(open(os.path.join(APP, "tools", "texts.json"), encoding="utf-8"))

def 名(t): return hashlib.sha1(t.encode("utf-8")).hexdigest()[:12]

pairs, missing, total = [], [], 0
for t in texts:
    n = 名(t)
    p = os.path.join(AUD, n + ".m4a")
    if os.path.exists(p) and os.path.getsize(p) > 800:
        pairs.append((t, n)); total += os.path.getsize(p)
    else:
        missing.append(t[:24])

# 使われなくなった音声を掃除する
要る = {n + ".m4a" for _, n in pairs}
余分 = [f for f in os.listdir(AUD) if f.endswith(".m4a") and f not in 要る]
for f in 余分: os.remove(os.path.join(AUD, f))

body = ",\n".join('%s:"%s"' % (json.dumps(t, ensure_ascii=False), n) for t, n in pairs)
mb = round(total / 1048576)
out = ("// 文章 → 音声ファイルの対応表(tools/make_map.py が自動生成)\n"
       "// 声:VOICEVOX 青山龍星 ノーマル / 速さ 0.92\n"
       "// ここに無い文章は、端末に内蔵された声で読み上げられる。\n"
       "const AUDIO_MB = %d;   // まとめて入れるときの実際の大きさ\n" % mb +
       "const AUDIO_MAP = {\n" + body + "\n};\n")
open(os.path.join(APP, "audio-map.js"), "w", encoding="utf-8").write(out)

print("対応づけ: %d 件 / 足りない: %d 件" % (len(pairs), len(missing)))
print("音声の合計: %.1f MB / 掃除した古い音声: %d 件" % (total / 1048576, len(余分)))
if missing[:3]: print("足りない例:", missing[:3])
