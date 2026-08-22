// ===================================================================
// 経典を読むだけのアプリ
//
// 画面のどこに触れても、次の一節へ進む。ボタンを探す必要はない。
// 経典も音声も、坐禅アプリのものをそのまま使う(同じ場所に置いてあるため
// 57MB の音声をもう一度取り込む必要がない)。
//
// 記録も、連続日数も、褒め言葉も置かない。探すのではなく、出会うための道具。
// ===================================================================
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);
  const STORE = "keiten-yomu-v1";

  let 履歴 = [];      // いままで見た本(戻るために覚えておく)
  let 位置 = -1;      // 履歴のどこを見ているか
  let 読上中 = 0;     // 途中で触られたら、前の読み上げを捨てるための番号

  // ---------- 出した本を覚えておく ----------
  // 386本すべて出るまで、同じ本は出さない。
  function 記録を読む() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "{}");
      return { 出した: Array.isArray(s.出した) ? s.出した : [],
               発心: Array.isArray(s.発心) ? s.発心 : [],
               日: s.日 || "", 今日の: s.今日の };
    } catch (e) { return { 出した: [], 発心: [], 日: "", 今日の: undefined }; }
  }
  function 記録を書く(v) {
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {}
  }

  function 札(p) { return p.sutra + "|" + p.text.slice(0, 24); }

  // 五回に一回ほど、発心の一節を混ぜる。
  // 毎回突きつけられると疲れるが、まったく無いと穏やかなだけで終わる。
  // 時々不意に来るのがちょうどよい。
  function 発心を混ぜるか() {
    return typeof HOSSHIN !== "undefined" && HOSSHIN.length && Math.random() < 0.2;
  }

  function 発心の一節() {
    const s = 記録を読む();
    const 見た = s.発心 || [];
    let 残り = HOSSHIN.filter((p) => 見た.indexOf(札(p)) === -1);
    if (!残り.length) { s.発心 = []; 残り = HOSSHIN.slice(); }
    const p = 残り[Math.floor(Math.random() * 残り.length)];
    s.発心 = (s.発心 || []).concat([札(p)]);
    記録を書く(s);
    return p;
  }

  function 次の一節() {
    if (発心を混ぜるか()) return 発心の一節();
    const s = 記録を読む();
    let 残り = PASSAGES.filter((p) => s.出した.indexOf(札(p)) === -1);
    if (!残り.length) {                       // 一巡したので、また最初から
      s.出した = [];
      残り = PASSAGES.slice();
    }
    const p = 残り[Math.floor(Math.random() * 残り.length)];
    s.出した.push(札(p));
    記録を書く(s);
    return p;
  }

  // 開いた日は、その日ぶんの一節から始める。日付が変われば変わる。
  function 今日の一節() {
    const d = new Date();
    const 今日 = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    const s = 記録を読む();
    if (s.日 === 今日 && typeof s.今日の === "number" && PASSAGES[s.今日の]) {
      return PASSAGES[s.今日の];
    }
    const 通日 = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const i = (通日 * 2654435761) % PASSAGES.length;
    const n = (i + PASSAGES.length) % PASSAGES.length;
    s.日 = 今日;
    s.今日の = n;
    if (s.出した.indexOf(札(PASSAGES[n])) === -1) s.出した.push(札(PASSAGES[n]));
    記録を書く(s);
    return PASSAGES[n];
  }

  // ---------- 画面に出す ----------
  function 出す(p) {
    el("sutra").textContent = p.sutra;
    const box = el("body");
    box.innerHTML = "";
    // 発心は説明ではなく一撃なので、字を大きくして行を空ける
    const 発心か = typeof HOSSHIN !== "undefined" &&
      HOSSHIN.some(function (h) { return 札(h) === 札(p); });
    box.classList.toggle("hosshin", 発心か);
    const 段落 = p.text.split("\n").filter((t) => t.trim());
    const nodes = 段落.map(function (t) {
      const e = document.createElement("p");
      e.className = "para";
      e.textContent = t;
      box.appendChild(e);
      return e;
    });
    box.classList.remove("fresh");
    void box.offsetWidth;
    box.classList.add("fresh");
    window.scrollTo(0, 0);
    return { 段落: 段落, nodes: nodes };
  }

  // ---------- 読み上げる ----------
  async function 読む(p, view) {
    const my = ++読上中;
    Speech.cancel();
    if (!Speech.isEnabled()) return;

    const 名 = Speech.spokenSutra(p.sutra);
    if (名) {
      await Speech.speak(名);
      if (my !== 読上中) return;
      await 待つ(500);
      if (my !== 読上中) return;
    }
    for (let i = 0; i < view.段落.length; i += 1) {
      if (my !== 読上中) return;
      view.nodes.forEach((n, j) => n.classList.toggle("reading", j === i));
      el("hint").textContent = "読んでいます";
      if (view.nodes[i].getBoundingClientRect().bottom > window.innerHeight - 30) {
        view.nodes[i].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (window.Keshiki) Keshiki.進み((i + 1) / view.段落.length);
      await Speech.speak(view.段落[i]);
      if (my !== 読上中) return;
      await 待つ(500);
    }
    view.nodes.forEach((n) => n.classList.remove("reading"));
    if (window.Keshiki) Keshiki.進み(1);
    // 読み終わってすぐ次を促さない。少し静けさを置く。
    if (my === 読上中) {
      await 待つ(1200);
      if (my === 読上中) el("hint").textContent = "触れると次の一節へ";
    }
  }

  function 待つ(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---------- 進む・戻る ----------
  let いまの = null;   // いま画面に出ている段落たち

  function 見せる(p, 読み上げる) {
    いまの = 出す(p);
    el("back").disabled = 位置 <= 0;
    el("hint").textContent = "触れると次の一節へ";
    // その一節が語っている場面を、背景に薄く引く
    if (window.Keshiki) {
      Keshiki.始める(p.sutra + "\n" + p.text);
      Keshiki.進み(0.15);
    }
    if (読み上げる) 読む(p, いまの);
  }

  function 進む() {
    const p = (位置 < 履歴.length - 1) ? 履歴[++位置] : (履歴.push(次の一節()), 履歴[++位置]);
    見せる(p, true);
  }

  function 戻る() {
    if (位置 <= 0) return;
    位置 -= 1;
    見せる(履歴[位置], true);
  }

  // ---------- 触れたときの動き ----------
  let 起動済み = false;

  el("stage").addEventListener("click", function (ev) {
    if (ev.target.closest(".tool")) return;     // 下の小さなボタンは別扱い
    if (!起動済み) {
      // iPhone は、触れた流れの中でしか音を出せない。最初の一触りで許可を取る。
      起動済み = true;
      Speech.unlock();
      見せる(履歴[位置], true);
      return;
    }
    進む();
  });

  el("back").addEventListener("click", function (ev) { ev.stopPropagation(); 戻る(); });

  el("mute").addEventListener("click", function (ev) {
    ev.stopPropagation();
    const 使う = !Speech.isEnabled();
    Speech.setEnabled(使う);
    document.body.classList.toggle("no-voice", !使う);
    el("mute").textContent = 使う ? "声を止める" : "声を出す";
    if (!使う) { 読上中 += 1; Speech.cancel(); }
    else if (いまの) 読む(履歴[位置], いまの);
  });

  // ---------- 起動 ----------
  // 読むだけのアプリは通常の速さ。坐禅の前と違い、ここは急いでいない場面ではなく、
  // 次々に触れて読んでいく場面なので、遅いとかえって進まない。
  Speech.setRate(0.92);
  履歴 = [今日の一節()];
  位置 = 0;
  いまの = 出す(履歴[0]);
  el("back").disabled = true;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
