// ===================================================================
// 読み上げ
//
// iPhone に入っている読み上げ機能をその場で使う。
// 音声ファイルを事前に作らないので、経典の文章を直しても作り直しが要らない。
//
// 読み上げが使えない端末では、文字数から見積もった時間で自動送りする。
// 文字は画面に出ているので、体験は途切れない。
// ===================================================================

const Speech = (function () {
  // ---- 仏教語の読み間違い対策 ----
  // 画面の表示は漢字のまま。読み上げるときだけ仮名に差し替える。
  // 長い語から先に置き換える(「惛沈睡眠蓋」を「蓋」より先に処理するため)。
  const FIXES = [
    ["惛沈睡眠蓋", "こんじんすいみんがい"],
    ["掉挙悪作蓋", "じょうこおさがい"],
    ["貪欲蓋", "とんよくがい"],
    ["瞋恚蓋", "しんにがい"],
    ["疑蓋", "ぎがい"],
    ["五蓋", "ごがい"],
    // 「〜の蓋」のように単独で出てくる場合。上の複合語より後に置く。
    ["瞋恚", "しんに"],
    ["蓋", "ふた"],
    ["苦集滅道", "く、じゅう、めつ、どう"],
    ["四聖諦", "ししょうたい"],
    // 三十七道品などの一覧。長い語から先に置く。
    ["苦蘊大経", "くうんだいきょう"],
    ["一切漏経", "いっさいろきょう"],
    ["慈心解脱", "じしんげだつ"],
    ["四念処", "しねんじょ"],
    ["四正勤", "ししょうごん"],
    ["七覚支", "しちかくし"],
    ["八正道", "はっしょうどう"],
    ["五蘊", "ごうん"],
    ["五根", "ごこん"],
    ["五力", "ごりき"],
    ["発勤界", "ほっきんかい"],
    ["精勤界", "せいきんかい"],
    ["勇猛界", "ゆうもうかい"],
    ["吉祥経", "きちじょうきょう"],
    ["慈経", "じきょう"],
    ["解脱", "げだつ"],
    ["涅槃", "ねはん"],
    ["輪廻", "りんね"],
    ["寂静", "じゃくじょう"],
    ["梵天", "ぼんてん"],
    ["沙羅", "さら"],
    ["一切有情", "いっさいうじょう"],
    ["回向", "えこう"],
    ["功徳", "くどく"],
    ["帰依", "きえ"],
    ["経行", "きんひん"],
    ["数息観", "すそくかん"],
    ["光明想", "こうみょうそう"],
    ["無常随観", "むじょうずいかん"],
    ["不浄観", "ふじょうかん"],
    ["慈悲の観", "じひのかん"],
    ["渇愛", "かつあい"],
    ["執着", "しゅうじゃく"],
    ["潜在煩悩", "せんざいぼんのう"],
    ["煩悩", "ぼんのう"],
    ["如理作意", "にょりさい"],
    ["不如理作意", "ふにょりさい"],
    ["沙門果経", "しゃもんかきょう"],
    ["阿羅漢", "あらかん"],
    ["預流", "よる"],
    ["一来", "いちらい"],
    ["不還", "ふげん"],
    ["袈裟", "けさ"],
    ["念仏", "ねんぶつ"],
    ["厭離", "えんり"],
    ["離貪", "りとん"],
    ["歓喜", "かんぎ"],
    ["軽安", "きょうあん"],
    ["禅定", "ぜんじょう"],
    // 「坐」は語によって読みが変わる。特定の語を先に処理し、
    // そのあと動詞の活用を語幹でまとめて拾う。順序を入れ替えないこと。
    ["坐禅", "ざぜん"],
    ["この坐", "このざ"],
    ["坐に", "ざに"],
    ["坐の", "ざの"],
    ["一坐", "いちざ"],
    ["坐し", "ざし"],
    ["坐ら", "すわら"],
    ["坐り", "すわり"],
    ["坐る", "すわる"],
    ["坐れ", "すわれ"],
    ["坐ろ", "すわろ"],
    ["坐っ", "すわっ"],
    ["三帰依", "さんきえ"],
    ["善き", "よき"],
    ["賢者", "けんじゃ"],
    ["怨み", "うらみ"],
    ["驕らず", "おごらず"],
    ["謗り", "そしり"],
    ["騾馬", "らば"],
    ["葦", "あし"],
    ["蔓", "つる"],
    ["楔", "くさび"],
    ["顎", "あご"],
    ["腿", "もも"],
    ["尾てい骨", "びていこつ"],
    ["脇", "わき"],
    ["薪", "たきぎ"],
    ["苔", "こけ"],
    ["藻", "も"],
    ["兎", "うさぎ"],
    ["象", "ぞう"],
    ["牙", "きば"],
    ["牧夫", "ぼくふ"],
    ["高殿", "たかどの"],
    ["洪水", "こうずい"],
    ["矢柄", "やがら"],
    ["矢作り", "やはぎ"],
    ["銀細工師", "ぎんざいくし"],
    ["錆", "さび"],
    ["枯れ葉", "かれは"],
    ["母胎", "ぼたい"],
    ["泥沼", "どろぬま"],
    ["隷属", "れいぞく"],
    ["荒野", "こうや"],
    ["牢", "ろう"],
    ["貸主", "かしぬし"],
    ["縁ある", "えんある"],
    ["父母", "ふぼ"],
    ["名も知らぬ", "なもしらぬ"],
    ["生きとし生ける", "いきとしいける"]
  ];

  // 出典表記から、読み上げに向かない記号・番号を落とす
  //   例:「SN 46.55 サンガーラヴァ・スッタ」→「サンガーラヴァ・スッタ」
  function spokenSutra(s) {
    if (!s) return "";
    let t = String(s)
      .replace(/^[A-Za-z]+\s*[\d.]+\s*/, "")   // 先頭の SN 46.55 など
      .replace(/\bDhp\s*[\d\-]+/g, "")
      .replace(/[A-Za-z]{2,}\s*[\d.\-]+/g, "") // 途中に残る MN 20 など
      .replace(/ダンマパダ\s*[\d\-]+/g, "ダンマパダ")
      .replace(/イティヴッタカ\s*\d+/g, "イティヴッタカ")
      .replace(/ウダーナ\s*[\d.]+/g, "ウダーナ")
      .replace(/[()（）]/g, " ")
      .replace(/[\/／]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // 番号を落とした結果、先頭に助詞が残ることがある(例:「の如理作意」)
    return t.replace(/^[のはがをにでとや、・]+\s*/, "").trim();
  }

  function applyFixes(text) {
    let t = String(text);
    for (let i = 0; i < FIXES.length; i += 1) {
      t = t.split(FIXES[i][0]).join(FIXES[i][1]);
    }
    // 読点として使っている記号を、間として読ませる
    return t.replace(/──/g, "、").replace(/[—―]/g, "、");
  }

  // ---- 声の準備 ----
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  let voice = null;
  let rate = 0.92;
  let enabled = true;
  // 読み上げを取り消したとき、区切った続きが読まれないようにするための番号
  let gen = 0;

  function pickVoice() {
    if (!supported) return null;
    const vs = window.speechSynthesis.getVoices() || [];
    const ja = vs.filter(function (v) {
      return /^ja(-|_|$)/i.test(v.lang || "");
    });
    if (!ja.length) return null;
    // 「拡張」「Enhanced」「Premium」と名の付く高品質版があれば優先する
    const better = ja.filter(function (v) {
      return /enhanced|premium|拡張|高品質/i.test(v.name || "");
    });
    return (better[0] || ja[0]);
  }

  function refreshVoice() {
    voice = pickVoice();
    return voice;
  }

  if (supported) {
    refreshVoice();
    window.speechSynthesis.onvoiceschanged = refreshVoice;
  }

  // ---- 先に作っておいた音声 ----
  // 読み上げる文章は全部あらかじめ決まっているので、
  // 自然な声(VOICEVOX 青山龍星)で作った音声を用意してある。
  // 音声があればそれを鳴らし、無ければ端末内蔵の声で読む。
  //
  // iPhone は、利用者が画面に触れた流れの中でしか音を出せない。
  // そこで再生機は一つだけ作って使い回し、「始める」に触れた瞬間に
  // 無音を鳴らして許可を取っておく。以後は差し替えるだけで鳴る。
  const SILENT = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAAhmcmVlAAAAI21kYXTcAExhdmM2My4xLjEwMQACMEAOARggBwEYIAcAAAMGbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAABdwAAABLAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAABLAAAAAAAAAAAAAAAAEBAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAASwAAAEAAABAAAAAAGpbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABdwAAACLBVxAAAAAAALWhkbHIAAAAAAAAAAHNvdW4AAAAAAAAAAAAAAABTb3VuZEhhbmRsZXIAAAABVG1pbmYAAAAQc21oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABGHN0YmwAAABqc3RzZAAAAAAAAAABAAAAWm1wNGEAAAAAAAAAAQAAAAAAAAAAAAEAEAAAAABdwAAAAAAANmVzZHMAAAAAA4CAgCUAAQAEgICAF0AVAAAAAAA+gAAACRoFgICABRMIVuUABoCAgAECAAAAIHN0dHMAAAAAAAAAAgAAAAIAAAQAAAAAAQAAALAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAMAAAABAAAAIHN0c3oAAAAAAAAAAAAAAAMAAAATAAAABAAAAAQAAAAUc3RjbwAAAAAAAAABAAAALAAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAADAAAAAQAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDE=";
  const AUDIO_DIR = "audio/";
  const AUDIO_EXT = ".m4a";
  const BUILT_RATE = 0.92;        // 音声を作ったときの速さ
  let player = null;
  // 「始める」で無音を鳴らして許可を取るが、それが済む前に本番を鳴らそうとすると
  // iPhone に弾かれる。最初の読み上げ(三帰依)だけ内蔵の声に落ちていたのはこれが原因。
  let unlockDone = null;
  // 音声を鳴らせず内蔵の声に落ちた回数。設定画面に出して、原因を追えるようにする。
  let fellBack = 0;

  function audioFileFor(text) {
    if (typeof AUDIO_MAP === "undefined" || !AUDIO_MAP) return null;
    // 前後の空白は取り除いてから引く。speak() 側も同じように取り除いている。
    const n = AUDIO_MAP[String(text || "").trim()];
    return n ? AUDIO_DIR + n + AUDIO_EXT : null;
  }

  // 先に取りに行っておく。
  // 一息目だけ声が遅れて聞こえていたのは、その場で取りに行っていたため。
  // 二息目からは控えに入っているので合っていた。最初から合わせる。
  function warm(list) {
    if (!Array.isArray(list)) list = [list];
    list.forEach(function (t) {
      const url = audioFileFor(t);
      if (!url) return;
      try { fetch(url, { cache: "force-cache" }).catch(function () {}); } catch (e) {}
    });
  }

  // 鳴らせたら true、鳴らせなければ false を返す。
  // false のときは、呼んだ側が端末内蔵の声へ切り替える。
  function playFile(url) {
    if (!player) return Promise.resolve(false);
    const gate = unlockDone || Promise.resolve();
    return gate.then(function () { return playFileNow(url); });
  }

  function playFileNow(url) {
    return new Promise(function (resolve) {
      if (!player) { resolve(false); return; }
      let settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        player.removeEventListener("ended", onEnd);
        player.removeEventListener("error", onErr);
        clearTimeout(guard);
        resolve(ok);
      }
      function onEnd() { finish(true); }
      function onErr() { finish(false); }
      player.addEventListener("ended", onEnd);
      player.addEventListener("error", onErr);

      // 何かの拍子に終わりの合図が来ないときのための保険
      const guard = setTimeout(function () { finish(true); }, 90000);

      // 設定した速さを反映する。音声は 0.92 倍で作ってあるので、その比で調整する。
      const speed = Math.max(0.5, Math.min(2, rate / BUILT_RATE));
      let retried = false;

      function 鳴らす() {
        try {
          player.src = url;
          // 速さを変えても声の高さは変えない(下げると別人の声になる)
          try { player.preservesPitch = true; } catch (e) {}
          try { player.mozPreservesPitch = true; } catch (e) {}
          try { player.webkitPreservesPitch = true; } catch (e) {}
          player.playbackRate = speed;
          const p = player.play();
          if (p && p.catch) p.catch(function () {
            // 許可が間に合わなかっただけのことがある。一度だけ置き直して試す。
            if (retried) { onErr(); return; }
            retried = true;
            setTimeout(鳴らす, 150);
          });
        } catch (e) { onErr(); }
      }
      鳴らす();
    });
  }

  function stopFile() {
    if (!player) return;
    try { player.pause(); player.removeAttribute("src"); player.load(); } catch (e) {}
  }

  // ---- 読み上げ ----
  // 読み終わったら解決する Promise を返す。
  // 使えないときは、文字数から見積もった時間で解決する。
  function estimateMs(text) {
    // 日本語をゆっくり読むと、およそ 1 秒あたり 6 文字。
    // 設定した速さに合わせて伸び縮みさせる。
    const 速さ = Math.max(0.3, rate / 0.92);
    return Math.max(1200, Math.round((text.length / 6 / 速さ) * 1000));
  }

  // 一度に長く読ませると、途中で切れてしまう端末がある(十数秒で止まるものが知られている)。
  // 句点で区切って短い塊にし、順に読ませる。区切りの間は、そのまま読みの間になる。
  const MAX_CHARS = 60;

  function splitForSpeech(t) {
    if (t.length <= MAX_CHARS) return [t];
    const pieces = [];
    let buf = "";
    let cur = "";
    for (let i = 0; i < t.length; i += 1) {
      cur += t[i];
      if (t[i] === "。" || t[i] === "\n") {
        if (buf && (buf + cur).length > MAX_CHARS) { pieces.push(buf); buf = cur; }
        else buf += cur;
        cur = "";
      }
    }
    buf += cur;
    if (buf) pieces.push(buf);
    // 句点が無く一塊のままなら、そのまま返す(無理に切ると意味が壊れる)
    return pieces.length ? pieces : [t];
  }

  function speak(text) {
    const raw = String(text || "").trim();
    if (!raw) return Promise.resolve();

    // 先に作ってある音声があれば、そちらを鳴らす
    const file = audioFileFor(raw);
    if (file && enabled) {
      const my = gen;
      return playFile(file).then(function (ok) {
        if (ok || my !== gen) return;
        fellBack += 1;               // 鳴らせなかった回数を控えておく
        return speakByDevice(raw);
      });
    }
    return speakByDevice(raw);
  }

  function speakByDevice(text) {
    const raw = String(text || "").trim();
    if (!raw) return Promise.resolve();

    const pieces = splitForSpeech(raw);
    if (pieces.length > 1) {
      const my = gen;
      return pieces.reduce(function (chain, piece) {
        return chain.then(function () {
          if (my !== gen) return;          // 取り消されたら、続きは読まない
          return speakOne(piece);
        });
      }, Promise.resolve());
    }
    return speakOne(raw);
  }

  function speakOne(text) {
    const raw = String(text || "").trim();
    if (!raw) return Promise.resolve();

    // 声の一覧が空でも、とにかく喋らせてみる。
    // iPhone は getVoices() が空のまま返ることがあり、
    // 「声が見つからない = 何も言わない」では手の打ちようがなくなる。
    // 一覧が取れていれば voice を指定し、取れていなければ言語だけ伝える。
    if (!supported || !enabled) {
      return new Promise(function (resolve) {
        setTimeout(resolve, estimateMs(raw));
      });
    }

    const spoken = applyFixes(raw);

    return new Promise(function (resolve) {
      let done = false;
      const finish = function () {
        if (done) return;
        done = true;
        resolve();
      };

      const u = new SpeechSynthesisUtterance(spoken);
      if (voice) u.voice = voice;
      u.lang = (voice && voice.lang) || "ja-JP";
      u.rate = rate;
      u.pitch = 1;
      u.onend = finish;
      u.onerror = finish;

      // 読み上げが途中で止まる端末があるため、見積もり時間の2倍で打ち切る
      setTimeout(finish, estimateMs(spoken) * 2 + 4000);

      try {
        // 眠らされたまま戻ってこないことがあるので、起こしてから話させる
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch (e) {
        finish();
      }
    });
  }

  function cancel() {
    gen += 1;   // 区切って読んでいる途中なら、続きを打ち切る
    stopFile();
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // ---- 音が出ないときの手がかり ----
  // iPhone の不調はこちらから再現できないので、端末が何を返しているかを
  // 本人の画面に出せるようにしておく。
  function diagnose() {
    const out = {
      読み上げの仕組み: supported ? "あり" : "なし",
      声の総数: 0,
      日本語の声: 0,
      使う声: "(なし)",
      止められている: "いいえ"
    };
    if (supported) {
      const vs = window.speechSynthesis.getVoices() || [];
      out.声の総数 = vs.length;
      out.日本語の声 = vs.filter(function (v) {
        return /^ja(-|_|$)/i.test(v.lang || "");
      }).length;
      out.使う声 = voice ? voice.name : "(一覧に無い)";
      out.止められている = window.speechSynthesis.paused ? "はい" : "いいえ";
    }
    return out;
  }

  // 実際に一言しゃべらせて、「本当に始まったか」を見る。
  // 無音のまま終わるのか、そもそも始まらないのかを切り分けるため。
  function testSpeak(text) {
    return new Promise(function (resolve) {
      if (!supported) {
        resolve({ 始まった: false, 理由: "この端末には読み上げの仕組みがありません" });
        return;
      }
      try { window.speechSynthesis.cancel(); } catch (e) {}
      const u = new SpeechSynthesisUtterance(applyFixes(String(text || "聞こえますか")));
      if (voice) u.voice = voice;
      u.lang = (voice && voice.lang) || "ja-JP";
      u.rate = rate;

      let started = false, ended = false, failed = null;
      u.onstart = function () { started = true; };
      u.onend = function () { ended = true; };
      u.onerror = function (e) { failed = (e && e.error) || "不明"; };

      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch (e) {
        resolve({ 始まった: false, 理由: "呼び出しそのものが失敗しました" });
        return;
      }

      setTimeout(function () {
        resolve({
          始まった: started || window.speechSynthesis.speaking,
          終わった: ended,
          理由: failed ? ("エラー:" + failed) : ""
        });
      }, 2000);
    });
  }

  // iPhone は、利用者が一度画面に触れるまで音を出せない。
  // 「始める」に触れた瞬間に、無音に近い一言を読ませて許可を得ておく。
  function unlock() {
    // 音声ファイル用の再生機に、先に許可を取っておく
    if (!player) {
      try {
        player = new Audio();
        player.preload = "auto";
        unlockDone = new Promise(function (resolve) {
          let settled = false;
          function 済み() { if (!settled) { settled = true; resolve(); } }
          player.addEventListener("ended", 済み, { once: true });
          player.addEventListener("error", 済み, { once: true });
          setTimeout(済み, 500);          // 合図が来なくても先へ進む
          player.src = SILENT;
          const p = player.play();
          if (p && p.catch) p.catch(済み);
        });
      } catch (e) { player = null; unlockDone = null; }
    }
    if (!supported) return;
    refreshVoice();
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  return {
    speak: speak,
    cancel: cancel,
    unlock: unlock,
    spokenSutra: spokenSutra,
    applyFixes: applyFixes,
    splitForSpeech: splitForSpeech,   // 動作確認用
    isSupported: function () { return supported; },
    hasVoiceList: function () { return !!voice; },
    setRate: function (r) { rate = r; },
    getRate: function () { return rate; },
    setEnabled: function (b) { enabled = !!b; },
    isEnabled: function () { return enabled; },
    voiceName: function () { return voice ? voice.name : "(なし)"; },
    refreshVoice: refreshVoice,
    diagnose: diagnose,
    hasAudioFor: function (t) { return !!audioFileFor(t); },
    warm: warm,
    fallbackCount: function () { return fellBack; },
    audioFileFor: audioFileFor,
    testSpeak: testSpeak
  };
})();
