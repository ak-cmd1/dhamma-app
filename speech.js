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

  // ---- 読み上げ ----
  // 読み終わったら解決する Promise を返す。
  // 使えないときは、文字数から見積もった時間で解決する。
  function estimateMs(text) {
    // 日本語をゆっくり読むと、およそ 1 秒あたり 6 文字
    return Math.max(1200, Math.round((text.length / 6) * 1000));
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

    if (!supported || !enabled || !voice) {
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
      u.voice = voice;
      u.lang = voice.lang || "ja-JP";
      u.rate = rate;
      u.pitch = 1;
      u.onend = finish;
      u.onerror = finish;

      // 読み上げが途中で止まる端末があるため、見積もり時間の2倍で打ち切る
      setTimeout(finish, estimateMs(spoken) * 2 + 4000);

      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        finish();
      }
    });
  }

  function cancel() {
    gen += 1;   // 区切って読んでいる途中なら、続きを打ち切る
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // iPhone は、利用者が一度画面に触れるまで音を出せない。
  // 「始める」に触れた瞬間に、無音に近い一言を読ませて許可を得ておく。
  function unlock() {
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
    isSupported: function () { return supported && !!voice; },
    setRate: function (r) { rate = r; },
    getRate: function () { return rate; },
    setEnabled: function (b) { enabled = !!b; },
    isEnabled: function () { return enabled; },
    voiceName: function () { return voice ? voice.name : "(なし)"; },
    refreshVoice: refreshVoice
  };
})();
