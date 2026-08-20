(function () {
  // ===================================================================
  // 流れ全体が、読み上げの終わりを待って自動で進む。
  // 「始める」に一度触れたあとは、最後まで操作が要らない。
  //
  // 読み上げが使えない端末では、文字数から見積もった時間で進む。
  // 文字は画面に出るので、体験は途切れない。
  // ===================================================================

  // ---- 間(ま)の長さ。読み上げが終わったあと、次へ進むまで ----
  // 坐るまでを短くする。観る時間は坐禅そのものが持っているので、
  // 坐る前に長い間を置かない。間を長く取るのは坐ったあとだけ。
  const PAUSE = {
    refuge: 700,      // 三帰依:一行ごと
    afterRefuge: 800,
    passage: 1800,    // 経典を読み終えたあと
    closing: 1200,    // 締めのあと
    method: 1500,     // 坐り方のあと(このあとすぐ鐘)
    after: 8000,      // 坐後の問い ── ここは急がない
    carry: 8000,      // 坐から持ち出す一句
    aim: 6000,        // 回向の向き先
    dedication: 4000
  };

  const OPEN_INHALE_MS = 4000;
  const OPEN_EXHALE_MS = 5000;
  const OPEN_BREATHS = 3;

  const screens = {
    start: document.getElementById("screen-start"),
    settings: document.getElementById("screen-settings"),
    choose: document.getElementById("screen-choose"),
    refuge: document.getElementById("screen-refuge"),
    open: document.getElementById("screen-open"),
    posture: document.getElementById("screen-posture"),
    passage: document.getElementById("screen-passage"),
    closing: document.getElementById("screen-closing"),
    sitting: document.getElementById("screen-sitting"),
    after: document.getElementById("screen-after"),
    aim: document.getElementById("screen-aim"),
    dedication: document.getElementById("screen-dedication"),
    done: document.getElementById("screen-done")
  };

  const el = (id) => document.getElementById(id);

  let current = null;   // 今日の蓋
  let passage = null;   // 今日の一節
  let isWalking = false;
  let skipPassage = false;
  let sitTimer = null;
  let sitEndAt = null;    // 坐り終える時刻(待ち時間ではなく時刻で持つ)
  let sitResolve = null;
  let wakeLock = null;
  let runId = 0;        // 途中で中断したとき、古い流れを止めるための番号

  function showScreen(key) {
    Object.keys(screens).forEach((k) => (screens[k].hidden = k !== key));
    window.scrollTo(0, 0);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 読み上げてから、間を置く。中断されていたら止める。
  function say(text, pauseMs, myRun) {
    if (myRun !== runId) return Promise.reject("stopped");
    return Speech.speak(text).then(function () {
      if (myRun !== runId) throw "stopped";
      return wait(pauseMs || 0);
    }).then(function () {
      if (myRun !== runId) throw "stopped";
    });
  }

  function stopRun() {
    runId += 1;
    Speech.cancel();
    stopBreathTone();
  }

  // ---------- 設定(端末に保存) ----------
  const SETTINGS_KEY = "keiten-settings-v1";

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        minutes: s.minutes || DEFAULT_MINUTES,
        voice: s.voice === undefined ? true : !!s.voice,
        rate: s.rate || 0.92
      };
    } catch (e) {
      return { minutes: DEFAULT_MINUTES, voice: true, rate: 0.92 };
    }
  }

  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  let settings = loadSettings();

  // 端末側の「動きを減らす」設定
  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ---------- 日めくり ----------
  function dayNumber() {
    const d = window.__forceDate ? new Date(window.__forceDate) : new Date();
    const epoch = Date.UTC(2026, 0, 1);
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((today - epoch) / 86400000);
  }

  function todayDate() {
    return window.__forceDate ? new Date(window.__forceDate) : new Date();
  }

  function formatDate(d) {
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function hash32(x) {
    x = x >>> 0;
    x = (x ^ 61) ^ (x >>> 16);
    x = (x + (x << 3)) >>> 0;
    x = x ^ (x >>> 4);
    x = Math.imul(x, 0x27d4eb2d) >>> 0;
    x = x ^ (x >>> 15);
    return x >>> 0;
  }

  function hashText(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // ---------- 出した本の記録(出しきるまで同じ本を出さない) ----------
  const STORE_KEY = "keiten-state-v1";

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (!s.used) s.used = {};
      if (!s.picks) s.picks = {};
      return s;
    } catch (e) {
      return { used: {}, picks: {} };
    }
  }

  function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function stateForToday() {
    const s = loadState();
    const day = dayNumber();
    if (s.day !== day) {
      s.day = day;
      s.picks = {};
      saveState(s);
    }
    return s;
  }

  function pickFromPool(key, size) {
    if (size <= 1) return 0;
    const s = stateForToday();
    if (s.picks[key] !== undefined && s.picks[key] < size) return s.picks[key];

    let used = (s.used[key] || []).filter((n) => n < size);
    let remaining = [];
    for (let i = 0; i < size; i += 1) if (used.indexOf(i) === -1) remaining.push(i);

    if (remaining.length === 0) {
      const last = used.length ? used[used.length - 1] : -1;
      used = [];
      for (let i = 0; i < size; i += 1) if (i !== last) remaining.push(i);
      if (remaining.length === 0) remaining = [last];
    }

    const seed = hash32(hashText(key) + s.day * 7919);
    const pick = remaining[seed % remaining.length];

    used.push(pick);
    s.used[key] = used;
    s.picks[key] = pick;
    saveState(s);
    return pick;
  }

  // 今日の蓋。日付で決まる。
  function todaysHindrance() {
    const day = dayNumber();
    const i = ((day % HINDRANCES.length) + HINDRANCES.length) % HINDRANCES.length;
    return HINDRANCES[i];
  }

  // 今日の一節。その蓋で使える本の中から、まだ出していないものを選ぶ。
  const poolCache = {};
  function poolFor(hid) {
    if (!poolCache[hid]) {
      poolCache[hid] = PASSAGES.filter((p) => p.for.indexOf(hid) !== -1);
    }
    return poolCache[hid];
  }

  // 本の見分け札。並び順を変えても、内容が同じなら同じ札になる。
  const idCache = new WeakMap();
  function passageId(p) {
    if (!idCache.has(p)) {
      idCache.set(p, hashText(p.sutra + "|" + p.text.slice(0, 40)).toString(36));
    }
    return idCache.get(p);
  }

  // 今日の一節。
  // 蓋ごとではなく、**全体で**出した本を覚えておく。
  // そうしないと、五蓋すべてで使える本が、蓋が変わるたびに再登場してしまう。
  function todaysPassage(hid) {
    const s = stateForToday();

    // 同じ日に開き直したときは、同じ本を返す
    if (s.picks.passage) {
      const found = PASSAGES.filter((p) => passageId(p) === s.picks.passage)[0];
      if (found) return found;
    }

    const pool = poolFor(hid);
    let used = s.usedAll || [];
    let cand = pool.filter((p) => used.indexOf(passageId(p)) === -1);

    if (!cand.length) {
      // 全部出しきった。記録を空にして、直前の一本だけ避けてもう一巡する。
      const last = used.length ? used[used.length - 1] : null;
      used = [];
      cand = pool.filter((p) => passageId(p) !== last);
      if (!cand.length) cand = pool;
    }

    const seed = hash32(hashText("passage") + s.day * 7919);
    const pick = cand[seed % cand.length];

    used = used.concat([passageId(pick)]);
    s.usedAll = used;
    s.picks.passage = passageId(pick);
    saveState(s);
    return pick;
  }

  function timeOfDay() {
    const h = window.__forceHour !== undefined ? window.__forceHour : todayDate().getHours();
    if (h >= 4 && h < 11) return TIME_OF_DAY.morning;
    if (h >= 11 && h < 17) return TIME_OF_DAY.day;
    return TIME_OF_DAY.night;
  }

  // ---------- 鐘 ----------
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  // 鐘の音は、その場で合成する(音声ファイル不要)。
  // 実際の鈴に近づけるため、次の三つを重ねている。
  //   ・撞いた瞬間の打撃音(短いノイズ)
  //   ・わずかに音程をずらした倍音の対 → うなり(音が揺れて聞こえる元)
  //   ・長く尾を引く残響
  // 響きは一度だけ作り、鐘も呼吸の音も同じものを通す。
  // (以前は鐘を撞くたびに出口を作り足していたので、
  //  三回続けて撞くと響きだけが三倍に膨らんでいた)
  let reverbIn = null;

  function getReverb(ctx) {
    if (reverbIn) return reverbIn;
    const sec = 3.2;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i += 1) {
        // 減衰していく雑音。堂内で響いて返ってくる音の代わり。
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;

    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    conv.connect(wet);
    wet.connect(ctx.destination);

    reverbIn = conv;
    return conv;
  }

  function playBell(delaySeconds) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + (delaySeconds || 0);
    const base = 210;

    // 鈴の倍音は整数倍にならない(だから金属らしく聞こえる)
    const partials = [
      { ratio: 1,    gain: 0.50, decay: 11 },
      { ratio: 2.76, gain: 0.26, decay: 7 },
      { ratio: 5.40, gain: 0.13, decay: 4.5 },
      { ratio: 8.93, gain: 0.07, decay: 2.8 },
      { ratio: 13.3, gain: 0.03, decay: 1.6 }
    ];

    const master = ctx.createGain();
    master.gain.value = 0.8;

    const dry = ctx.createGain();
    dry.gain.value = 0.75;
    dry.connect(ctx.destination);

    master.connect(dry);
    try { master.connect(getReverb(ctx)); } catch (e) { /* 残響なしでも鳴る */ }

    partials.forEach(function (p) {
      // 同じ倍音を、ほんの少しだけ音程をずらして二本鳴らす。
      // 二本の差が「うなり」になり、音が生きて揺れる。
      [-1, 1].forEach(function (side) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = base * p.ratio * (1 + side * 0.0015);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(p.gain / 2, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + p.decay + 0.1);
      });
    });

    // 撞いた瞬間の音。ごく短い雑音を高い側だけ通す。
    const nlen = Math.floor(ctx.sampleRate * 0.06);
    const nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nlen; i += 1) {
      nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nlen, 4);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nbuf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.10, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);

    noise.connect(hp).connect(ng).connect(master);
    noise.start(t0);
    noise.stop(t0 + 0.12);
  }

  // 始めは一つ、終わりは三つ。音の数だけで今どこにいるか分かる。
  function strikeBell(times) {
    const n = times || 1;
    for (let i = 0; i < n; i += 1) playBell(i * 2.8);
  }

  // ---------- 呼吸に添える音 ----------
  // 目を閉じたままでも「いま息のどのあたりか」が分かるように、
  // 息に沿って高さがゆっくり変わる音を鳴らす。吸うと上がり、吐くと下がる。
  // 折り返しだけを知らせる鈴と違い、息の途中もずっと分かるのが利点。
  const BREATH_LOW = 174.6;    // 吐ききったところ
  const BREATH_HIGH = 261.6;   // 吸いきったところ(五度上)
  let breathTone = null;

  function startBreathTone() {
    const ctx = getAudioCtx();
    if (!ctx || breathTone) return;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = BREATH_LOW;

    // 高い倍音を落として、耳に刺さらない柔らかい音にする
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1100;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);

    // 鐘と同じ堂の中で鳴っているように、控えめに響かせる
    try {
      const send = ctx.createGain();
      send.gain.value = 0.35;
      gain.connect(send);
      send.connect(getReverb(ctx));
    } catch (e) {}

    osc.start();
    breathTone = { osc: osc, gain: gain };
  }

  // 一息ぶん、音の高さと大きさを動かす。吐くほうは少し小さくする。
  function breathTonePhase(inhale, ms) {
    if (!breathTone || !audioCtx) return;
    const t = audioCtx.currentTime;
    const dur = Math.max(0.2, (ms || 4000) / 1000);
    const f = breathTone.osc.frequency;
    const g = breathTone.gain.gain;
    try {
      f.cancelScheduledValues(t);
      f.setValueAtTime(Math.max(1, f.value), t);
      f.exponentialRampToValueAtTime(inhale ? BREATH_HIGH : BREATH_LOW, t + dur * 0.95);

      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(inhale ? 0.075 : 0.055, t + dur * 0.30);
      g.linearRampToValueAtTime(inhale ? 0.070 : 0.018, t + dur * 0.92);
    } catch (e) {}
  }

  function stopBreathTone() {
    if (!breathTone) return;
    const tone = breathTone;
    breathTone = null;
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    try {
      tone.gain.gain.cancelScheduledValues(t);
      tone.gain.gain.setValueAtTime(Math.max(0.0001, tone.gain.gain.value), t);
      tone.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      tone.osc.stop(t + 1.1);
    } catch (e) {}
  }

  // ---------- 画面が消えないようにする ----------
  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  // 画面を伏せたり他のアプリに移ったりすると、iPhone は待ち時間を止めてしまう。
  // そのため「何分待つ」ではなく「何時に終わる」を覚えておき、
  // 戻ってきたときに時計と突き合わせて残りを計算し直す。
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (screens.sitting.hidden) return;
    requestWakeLock();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    recheckSitting();
  });

  // ===================================================================
  // 流れ本体
  // ===================================================================
  async function run(forced) {
    stopRun();
    Speech.refreshVoice();
    applyVoiceSetting();     // 声の有無を、始める直前にもう一度確かめる
    const my = runId;
    isWalking = false;
    skipPassage = false;

    current = forced || todaysHindrance();
    passage = todaysPassage(current.id);
    if (!current || !passage) return;   // データが読めていないときは何もしない

    try {
      await runRefuge(my);
      await runBreath(my);
      await runPosture(my);   // 経典より先に姿勢を作る。聴き終えたら動かずに坐へ入れる
      await runPassage(my);
      await runClosing(my);   // 締め + 今日の坐り方をまとめて
      await runSitting(my);
    } catch (e) {
      /* 中断された。何もしない。 */
    }
  }

  // ---- 三帰依 ----
  async function runRefuge(my) {
    showScreen("refuge");
    const list = el("refuge-list");
    list.innerHTML = "";

    for (let i = 0; i < REFUGES.length; i += 1) {
      if (my !== runId) throw "stopped";
      const r = REFUGES[i];
      const row = document.createElement("div");
      row.className = "refuge-row";
      row.innerHTML =
        '<p class="refuge-ja">' + r.ja + "</p>" +
        '<p class="refuge-pali">' + r.pali + "</p>" +
        '<p class="refuge-yomi">' + r.yomi + "</p>";
      list.appendChild(row);
      await say(r.ja, PAUSE.refuge, my);
    }
    await wait(PAUSE.afterRefuge);
  }

  // ---- 呼吸 ----
  async function runBreath(my) {
    showScreen("open");
    const stage = el("breath-circle");
    const petals = el("breath-petals");
    const guide = el("breath-guide");
    const count = el("breath-count");
    const counters = ["ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ"];

    startBreathTone();
    let turn = 0;   // 花が開くたび、同じ向きへ少しずつ回していく

    // 一息の片道ぶん。見た目・音・声を、同じ長さで揃える。
    // 花びらは放射状に固定しておき、動かすのは花全体の拡大と回転だけ。
    // 六枚それぞれを動かしても同じ絵になるが、動かす対象が一つで済み、
    // 端末への負担も軽い。
    const halo = stage.querySelector(".breath-halo");
    const gentle = reduceMotion();
    const openScale = gentle ? 0.86 : 1;      // 吸いきったときの大きさ
    const closeScale = gentle ? 0.66 : 0.42;  // 吐ききったときの大きさ

    function phase(inhale, ms) {
      // 動きの長さを、吸う・吐くそれぞれに合わせて先に効かせる
      stage.style.setProperty("--breath-dur", ms + "ms");
      void stage.offsetWidth;

      if (!gentle) turn += 60;   // 息のたび、同じ向きへ少しずつ回す
      petals.style.transform =
        "rotate(" + turn + "deg) scale(" + (inhale ? openScale : closeScale) + ")";
      petals.style.opacity = inhale ? "1" : "0.72";
      if (halo) {
        halo.style.transform = "scale(" + (inhale ? 1.1 : 0.55) + ")";
        halo.style.opacity = inhale ? "0.16" : "0.06";
      }
      breathTonePhase(inhale, ms);
    }

    try {
      for (let i = 0; i < OPEN_BREATHS; i += 1) {
        if (my !== runId) throw "stopped";
        count.textContent = counters[i] || "";

        guide.textContent = "吸って";
        phase(true, OPEN_INHALE_MS);
        // 目を閉じている人にも何息目か分かるよう、数も声に出す
        Speech.speak((counters[i] || "") + "。吸って");
        await wait(OPEN_INHALE_MS);
        if (my !== runId) throw "stopped";

        guide.textContent = "吐いて";
        phase(false, OPEN_EXHALE_MS);
        Speech.speak("吐いて");
        await wait(OPEN_EXHALE_MS);
      }
    } finally {
      stopBreathTone();
    }
  }

  // ---- 今日の一節 ----
  async function runPassage(my) {
    el("passage-sutra").textContent = passage.sutra;

    // 段落を一つずつの要素にする。読まれている段落だけを濃く見せ、
    // 目を開けている人が、今どこを読まれているか追えるようにする。
    const paras = passage.text.split("\n").filter((p) => p.trim());
    const box = el("passage-text");
    box.innerHTML = "";
    const nodes = paras.map(function (t) {
      const p = document.createElement("p");
      p.className = "para";
      p.textContent = t;
      box.appendChild(p);
      return p;
    });

    el("skip-btn").hidden = false;
    el("reread-close").hidden = true;
    showScreen("passage");

    const name = Speech.spokenSutra(passage.sutra);
    if (name) await say(name, 800, my);

    for (let i = 0; i < paras.length && !skipPassage; i += 1) {
      nodes.forEach((n, j) => n.classList.toggle("reading", j === i));
      // 画面からはみ出していれば、読まれている段落まで静かに送る
      if (nodes[i].getBoundingClientRect().bottom > window.innerHeight - 40) {
        // 端末で「動きを減らす」を選んでいる人には、滑らせずに送る
        nodes[i].scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
      }
      await say(paras[i], 1200, my);
    }

    nodes.forEach((n) => n.classList.remove("reading"));
    el("skip-btn").hidden = true;
    await wait(skipPassage ? 300 : PAUSE.passage);
  }

  // ---- 締め + 今日の坐り方(このあとすぐ鐘が鳴る) ----
  // 坐り方の言い回しは複数用意してあり、日付で選ぶ。
  // 技法は同じでも、毎回まったく同じ文だと耳が素通りするため。
  // 五回に一度だけ、短い一言ではなく技法そのものの説明(instruction)を返す。
  // 短い一言だけを繰り返していると、やり方の全体を思い出す機会がなくなるため。
  // その蓋が出るのは年に七十回ほどなので、全文を聴くのは年十数回になる。
  function sittingShort(guide, hid) {
    if (!guide) return "";
    const id = hid || (current && current.id) || "x";
    const list = (guide.shorts && guide.shorts.length)
      ? guide.shorts
      : (guide.short ? [guide.short] : []);
    if (!list.length) return guide.instruction || "";
    const key = "short:" + id + (guide.name ? "" : ":walk");
    const i = pickFromPool(key, list.length + 1);   // +1 が「全文の番」
    return i === list.length ? (guide.instruction || list[0]) : list[i];
  }

  async function runClosing(my) {
    const m = current.sitting;
    el("closing-text").textContent = current.closing;
    el("closing-note").textContent = timeOfDay().note;   // 朝・昼・夜で変わる添え文
    el("method-name").textContent = m.name;
    el("method-short").textContent = sittingShort(m);
    el("walk-btn").hidden = !current.walking;
    showScreen("closing");

    await say(current.closing, 600, my);
    await say(timeOfDay().note, PAUSE.closing, my);
    await say(m.name + "。" + sittingShort(m), PAUSE.method, my);
  }

  // ---- 身体を整える ----
  async function runPosture(my) {
    showScreen("posture");
    const target = el("posture-text");
    const tod = timeOfDay().key;

    for (let i = 0; i < POSTURE_STEPS.length; i += 1) {
      if (my !== runId) throw "stopped";
      const s = POSTURE_STEPS[i];
      const t = s[tod] || s.text;
      target.textContent = t;
      target.classList.remove("fade-step");
      void target.offsetWidth;
      target.classList.add("fade-step");
      await say(t, s.ms, my);
    }
  }

  // ---- 坐る ----
  // 終わる時刻を覚えておき、待ち時間ではなく時計で判定する。
  // iPhone は画面を伏せると待ち時間を止めてしまうため、
  // 単純に「何分後」で待つと、鐘が鳴らないまま止まることがある。
  async function runSitting(my) {
    const guide = isWalking && current.walking ? current.walking : current.sitting;
    el("sitting-short").textContent = sittingShort(guide);
    showScreen("sitting");
    requestWakeLock();
    strikeBell(1);

    sitEndAt = Date.now() + settings.minutes * 60 * 1000;
    saveSit({ endAt: sitEndAt, hid: current.id, walking: isWalking });

    await new Promise(function (resolve) {
      sitResolve = resolve;
      armSitTimer();
    });

    if (my !== runId) throw "stopped";
    await endSitting(my);
  }

  // 残り時間を計算し直して、待ち直す
  function armSitTimer() {
    if (sitTimer) { clearTimeout(sitTimer); sitTimer = null; }
    if (!sitEndAt || !sitResolve) return;
    const left = sitEndAt - Date.now();
    if (left <= 0) {
      const r = sitResolve;
      sitResolve = null;
      sitEndAt = null;
      r();
      return;
    }
    // 一度に長く待たせず、こまめに起き直して時計を確かめる
    sitTimer = setTimeout(armSitTimer, Math.min(left, 20000));
  }

  // 画面が戻ったときに呼ばれる。眠っている間に時刻が過ぎていれば、すぐ終える。
  function recheckSitting() {
    if (sitEndAt && sitResolve) armSitTimer();
  }

  function clearSitTimer() {
    if (sitTimer) { clearTimeout(sitTimer); sitTimer = null; }
    sitEndAt = null;
    sitResolve = null;
    saveSit(null);
  }

  // ---------- 坐りかけの記録 ----------
  // 電話が来てアプリを閉じても、残り時間から続けられるようにする。
  // 15分坐ったところで最初からやり直しになるのは、続ける気力を削ぐ。
  const SIT_KEY = "keiten-sit-v1";

  function saveSit(v) {
    try {
      if (v) localStorage.setItem(SIT_KEY, JSON.stringify(v));
      else localStorage.removeItem(SIT_KEY);
    } catch (e) {}
  }

  function loadSit() {
    try { return JSON.parse(localStorage.getItem(SIT_KEY) || "null"); }
    catch (e) { return null; }
  }

  // 坐りかけがあれば、その残り分数を返す。なければ 0。
  function pendingSitMinutes() {
    const v = loadSit();
    if (!v || !v.endAt) return 0;
    const left = v.endAt - Date.now();
    // 半日以上前のものは、坐りかけとして扱わない
    if (left <= 0 || left > 12 * 60 * 60 * 1000) { saveSit(null); return 0; }
    return left / 60000;
  }

  // 坐りかけの続きから始める
  async function resumeSit() {
    const v = loadSit();
    if (!v) return;
    stopRun();
    const my = runId;
    current = HINDRANCES.filter((h) => h.id === v.hid)[0] || todaysHindrance();
    passage = todaysPassage(current.id);
    isWalking = !!v.walking;

    const guide = isWalking && current.walking ? current.walking : current.sitting;
    el("sitting-short").textContent = sittingShort(guide);
    showScreen("sitting");
    requestWakeLock();

    sitEndAt = v.endAt;
    try {
      await new Promise(function (resolve) { sitResolve = resolve; armSitTimer(); });
      if (my !== runId) throw "stopped";
      await endSitting(my);
    } catch (e) {}
  }

  async function endSitting(my) {
    clearSitTimer();
    releaseWakeLock();
    // 眠っていた場合、音が止められていることがあるので起こしてから鳴らす
    if (audioCtx && audioCtx.state === "suspended") {
      try { await audioCtx.resume(); } catch (e) {}
    }
    strikeBell(3);
    await wait(3000);
    await runAfter(my);
  }

  // ---- 坐後の問い → 持ち出す一句 → 向き先 → 回向 ----
  // 四つの問いは坐る前ではなく、ここで使う。
  // 効いたかを確かめる問いと、坐から日常へ持ち出す一句(道の問い)の二段。
  async function runAfter(my) {
    el("after-inquiry").textContent = current.afterInquiry;
    el("sit-again-btn").hidden = false;
    showScreen("after");
    await say(current.afterInquiry, PAUSE.after, my);

    const carry = current.inquiries[current.inquiries.length - 1]; // 道の問い
    el("after-inquiry").textContent = carry.text;
    el("sit-again-btn").hidden = true;
    await say(carry.text, PAUSE.carry, my);

    await runAim(my);
  }

  async function runAim(my) {
    el("aim-text").textContent = DEDICATION_AIM;
    showScreen("aim");
    await say(DEDICATION_AIM.replace(/\n/g, " "), PAUSE.aim, my);
    await runDedication(my);
  }

  async function runDedication(my) {
    el("dedication-text").textContent = DEDICATION;

    const paliEl = el("dedication-pali");
    paliEl.innerHTML = "";
    DEDICATION_PALI.forEach(function (p) {
      const row = document.createElement("div");
      row.className = "pali-row";
      row.innerHTML =
        '<p class="pali-line">' + p.pali + "</p>" +
        '<p class="pali-yomi">' + p.yomi + "</p>";
      paliEl.appendChild(row);
    });

    showScreen("dedication");
    strikeBell(1);
    await wait(2500);

    const lines = DEDICATION.split("\n").filter((l) => l.trim());
    for (let i = 0; i < lines.length; i += 1) await say(lines[i], 400, my);
    await wait(PAUSE.dedication);

    showScreen("done");
    await say("終わりました。", 0, my);
  }

  // ---- 坐れない日の道 ----
  async function runThreeBreaths() {
    stopRun();
    const my = runId;
    showScreen("posture");
    const target = el("posture-text");
    try {
      for (let i = 0; i < THREE_BREATHS.length; i += 1) {
        const s = THREE_BREATHS[i];
        target.textContent = s.text;
        target.classList.remove("fade-step");
        void target.offsetWidth;
        target.classList.add("fade-step");
        await say(s.text, s.ms, my);
      }
      await runAim(my);
    } catch (e) {}
  }

  // ---------- 設定画面 ----------
  function renderSettings() {
    const dur = el("duration-choices");
    dur.innerHTML = "";
    DURATIONS.forEach(function (m) {
      const b = document.createElement("button");
      b.className = "chip" + (settings.minutes === m ? " on" : "");
      b.textContent = m + "分";
      b.addEventListener("click", function () {
        settings.minutes = m;
        saveSettings(settings);
        renderSettings();
      });
      dur.appendChild(b);
    });

    const vc = el("voice-choices");
    vc.innerHTML = "";
    [["使う", true], ["使わない", false]].forEach(function (pair) {
      const b = document.createElement("button");
      b.className = "chip" + (settings.voice === pair[1] ? " on" : "");
      b.textContent = pair[0];
      b.addEventListener("click", function () {
        settings.voice = pair[1];
        saveSettings(settings);
        applyVoiceSetting();
        renderSettings();
      });
      vc.appendChild(b);
    });

    el("voice-note").textContent = Speech.isSupported()
      ? "この端末の声:" + Speech.voiceName()
      : "この端末では声が使えません。文字だけで進みます。";

    const rc = el("rate-choices");
    rc.innerHTML = "";
    [["ゆっくり", 0.8], ["ふつう", 0.92], ["はやめ", 1.05]].forEach(function (pair) {
      const b = document.createElement("button");
      b.className = "chip" + (Math.abs(settings.rate - pair[1]) < 0.01 ? " on" : "");
      b.textContent = pair[0] === "speedy" ? "速め" : pair[0];
      b.addEventListener("click", function () {
        settings.rate = pair[1];
        Speech.setRate(pair[1]);
        saveSettings(settings);
        renderSettings();
        Speech.speak("この速さで読み上げます。");
      });
      rc.appendChild(b);
    });
  }

  // ---------- 配線 ----------
  // iPhone は、利用者が一度触れるまで音を出せない。
  // 始める・気分から選ぶ・続きから、いずれもここで音の許可を取る。
  function unlockAudio() {
    Speech.unlock();
    getAudioCtx();
  }

  el("start-btn").addEventListener("click", function () {
    unlockAudio();
    run();
  });

  // 今日の蓋が実感と合わない日のための入口。
  // 目を閉じる前の段階で分岐するので、以後のタップ不要は保たれる。
  el("choose-btn").addEventListener("click", function () {
    unlockAudio();
    renderChoices();
    showScreen("choose");
  });

  el("choose-back-btn").addEventListener("click", function () {
    showScreen("start");
  });

  el("reread-close").addEventListener("click", function () {
    el("reread-close").hidden = true;
    applyVoiceSetting();   // 段落の濃さの設定を元に戻す
    showScreen("done");
  });

  el("resume-btn").addEventListener("click", function () {
    unlockAudio();
    resumeSit();
  });

  // 終わったあと、今日の一節をもう一度読む
  el("reread-btn").addEventListener("click", function () {
    stopRun();
    if (!passage) passage = todaysPassage((current || todaysHindrance()).id);
    el("passage-sutra").textContent = passage.sutra;
    const box = el("passage-text");
    box.innerHTML = "";
    passage.text.split("\n").filter((t) => t.trim()).forEach(function (t) {
      const p = document.createElement("p");
      p.className = "para";
      p.textContent = t;
      box.appendChild(p);
    });
    document.body.classList.add("no-voice");   // 全段落を同じ濃さで見せる
    el("skip-btn").hidden = true;
    el("reread-close").hidden = false;
    showScreen("passage");
  });

  // 気分から選ぶ画面の、五つのボタン
  function renderChoices() {
    const box = el("choices");
    box.innerHTML = "";
    HINDRANCES.forEach(function (h) {
      const b = document.createElement("button");
      b.className = "choice-btn";
      // 伝統的な名前(貪欲蓋など)も小さく添える。
      // 毎回目にするうちに、自分の状態を経典の言葉で呼べるようになる。
      b.innerHTML =
        '<div class="choice-main">' + h.label +
        '<span class="choice-term">' + h.name + "</span></div>" +
        '<div class="choice-sub">' + h.subLabel + "</div>";
      b.setAttribute("aria-label", h.label + " " + h.reading + " " + h.subLabel);
      b.addEventListener("click", function () { run(h); });
      box.appendChild(b);
    });
  }

  el("settings-btn").addEventListener("click", function () {
    Speech.refreshVoice();
    renderSettings();
    showScreen("settings");
  });

  el("settings-done-btn").addEventListener("click", function () {
    Speech.cancel();
    showScreen("start");
  });

  el("cannot-sit-btn").addEventListener("click", runThreeBreaths);

  // 今日はすぐ坐りたい日のために、経典を飛ばせるようにする
  el("skip-btn").addEventListener("click", function () {
    skipPassage = true;
    Speech.cancel();   // 読み上げ中なら打ち切る。say() が次へ進む
  });

  el("walk-btn").addEventListener("click", function () {
    isWalking = true;
    el("walk-btn").hidden = true;
    // 画面に出ている「今日の坐り方」も、歩く案内に差し替える。
    // 選んだのに坐る方法が出たままだと、どちらに従うのか分からなくなる。
    if (current && current.walking) {
      el("method-name").textContent = "経行(歩く)";
      el("method-short").textContent = sittingShort(current.walking);
    }
  });

  // 途中でやめるときは、待っている処理を解いて、通常の終わり方へ合流させる。
  // (以前は待ち処理を置き去りにしたまま別経路で終えていた)
  el("stop-btn").addEventListener("click", function () {
    if (!sitResolve) return;
    const r = sitResolve;
    sitResolve = null;
    sitEndAt = null;
    saveSit(null);
    if (sitTimer) { clearTimeout(sitTimer); sitTimer = null; }
    r();   // runSitting の待ちが解け、そのまま endSitting へ進む
  });

  el("sit-again-btn").addEventListener("click", function () {
    stopRun();
    const my = runId;
    runSitting(my).catch(function () {});
  });

  el("done-btn").addEventListener("click", function () {
    stopRun();
    showScreen("start");
  });

  // ---------- 起動 ----------
  function applyVoiceSetting() {
    Speech.setEnabled(settings.voice);
    // 声を使わないときは、段落を薄くしない(読む順を追えなくなるため)
    document.body.classList.toggle("no-voice", !settings.voice || !Speech.isSupported());
  }

  Speech.setRate(settings.rate);
  applyVoiceSetting();

  // 声の一覧は、端末によっては読み込みの少しあとに届く。
  // 起動時だけの判定だと「声が使えない」と誤って決めつけ、
  // 段落の濃淡がずっと効かないままになるため、届いたら判定し直す。
  if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener("voiceschanged", function () {
      applyVoiceSetting();
    });
  }
  el("start-date").textContent = formatDate(todayDate());

  // 坐りかけがあれば、続きから坐れるように案内する
  (function () {
    const left = pendingSitMinutes();
    const btn = el("resume-btn");
    if (left >= 0.5) {
      btn.textContent = "坐りかけです ── 残り" + Math.ceil(left) + "分から続ける";
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  })();

  showScreen("start");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  // 動作確認用
  window.__app = {
    run: run,
    showScreen: showScreen,
    stopRun: stopRun,
    dayNumber: dayNumber,
    todaysHindrance: todaysHindrance,
    todaysPassage: todaysPassage,
    poolFor: poolFor,
    pickFromPool: pickFromPool,
    strikeBell: strikeBell,
    pendingSitMinutes: pendingSitMinutes,
    sittingShort: sittingShort,
    settings: function () { return settings; },
    resetStore: function () { try { localStorage.removeItem(STORE_KEY); } catch (e) {} },
    screens: screens
  };
})();
