# 音声を作り直す手順

読み上げ音声は VOICEVOX で作り、`audio/` に置いてある。
経典や案内の文章を直したときは、この手順で作り直す。

## 置き場所

VOICEVOX のエンジンは次の場所に置く。

    ~/Library/Application Support/voicevox-engine/

一時置き場(/tmp)には置かないこと。**macOS が再起動や定期整理で消してしまう。**
実際に一度消えて、1.7GB を取り直すことになった。

## 手順

1. エンジンを起動する

       cd ~/Library/Application\ Support/voicevox-engine/macos-arm64
       ./run --host 127.0.0.1 --port 50021

2. 読み上げる文章を洗い出す

       python3 tools/enumerate.py

3. 音声を作る(すでにあるものは飛ばされる)

       python3 tools/generate.py

4. 対応表を作り直す(使われなくなった音声もここで消える)

       python3 tools/make_map.py

5. `index.html` と `yomu.html` の `?v=` と、`service-worker.js` の
   `CACHE_NAME`、`app.js` の `BUILD` を一つ上げる

## 音声ファイルの名前について

名前は**文章そのものから決めている**(内容の指紋)。
通し番号にすると、文章を一つ直しただけで以降が全部ずれ、
別の経典が鳴いてしまう。実際にその危険があり、途中で作りを変えた。

この形なので、直した文だけが新しく作られ、他は一切動かない。
