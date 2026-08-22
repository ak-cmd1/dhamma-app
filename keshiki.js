/* 景色 ── 経典を読んでいるあいだ、その経典が語っている場面を背景に墨で引く。
   絵を持ってくるのではなく、その場で線を引く。だから通信も容量も要らない。

   考え方:
   ・経典の言葉から型を選ぶ。当てはまる型が無ければ、無理に当てず「にじみ」を置く。
   ・読み進みに合わせて線が増え、読み終える頃に絵が仕上がる。
   ・墨はごく薄い。文字を読む邪魔をしてはならない。
   ・坐っているあいだは何も動かさない。目を閉じている人の邪魔になる。 */
const Keshiki = (function () {
  "use strict";

  let 板 = null, 筆 = null, 判 = null;      // 画面 / 描く道具 / 筆の一点の型
  let W = 0, H = 0, 比 = 1;
  let 型 = null, 目標 = 0, 進 = 0, 起点 = 0, 齣 = 0;
  let 濃 = 0.16, 墨 = "31,29,27";
  let 使用 = true, 消えかけ = 0;

  // ---------- 筆の一点 ----------
  // 毎回にじみを作り直すと端末が重くなるので、型を一つだけ作って使い回す。
  function 判を作る() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.00, "rgba(" + 墨 + ",1)");
    g.addColorStop(0.58, "rgba(" + 墨 + ",0.72)");
    g.addColorStop(1.00, "rgba(" + 墨 + ",0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  }

  function 点(x, y, r, a) {
    if (a <= 0.002 || r <= 0) return;
    筆.globalAlpha = Math.min(1, a);
    筆.drawImage(判, x - r, y - r, r * 2, r * 2);
  }

  // 点の並びを、進み具合のぶんだけ引く。
  // 点の間が空くと線が点々に見えるので、間が筆より広ければその間も埋める。
  function 線(pts, p, 太, a, 細り) {
    const n = Math.floor(pts.length * Math.max(0, Math.min(1, p)));
    const 落 = (細り === undefined) ? 0.3 : 細り;
    for (let i = 0; i < n; i += 1) {
      const u = i / Math.max(1, pts.length - 1);
      const r = 太 * (1 - 落 * u);
      点(pts[i][0], pts[i][1], r, a);
      if (i + 1 < n) {
        const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
        const 間 = Math.sqrt(dx * dx + dy * dy);
        const 補 = Math.floor(間 / Math.max(1, r * 0.55));
        for (let k = 1; k < 補; k += 1) {
          点(pts[i][0] + dx * k / 補, pts[i][1] + dy * k / 補, r, a);
        }
      }
    }
  }

  // 二点を結ぶ点の並び。ゆらぎを少し与えると、定規で引いた線に見えない
  function 引(x0, y0, x1, y1, 数, ゆれ) {
    const p = [];
    for (let i = 0; i < 数; i += 1) {
      const u = i / (数 - 1);
      const w = ゆれ ? Math.sin(u * 7.3 + x0) * ゆれ : 0;
      p.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + w]);
    }
    return p;
  }

  function 弧(cx, cy, r, a0, a1, 数, ゆれ) {
    const p = [];
    for (let i = 0; i < 数; i += 1) {
      const u = i / (数 - 1);
      const A = a0 + (a1 - a0) * u;
      const R = r * (1 + (ゆれ ? Math.sin(u * 9.1) * ゆれ : 0));
      p.push([cx + Math.cos(A) * R, cy + Math.sin(A) * R]);
    }
    return p;
  }

  // 決まった種から同じ乱れを作る。毎回ちらつかないようにするため
  function 乱(i) { return ((i * 2654435761) % 100003) / 100003; }

  function 地(y, a) { 線(引(W * 0.05, y, W * 0.95, y, 90, 2.5), 1, W * 0.005, a); }

  // ---------- 型 ----------
  // p は読み進み(0〜1)、t は経った時間(ミリ秒)
  const 型たち = {

    道: {                       // 果てへ続く一本の道。歩いた跡が残る
      語: { 道: 3, 径: 4, 旅: 4, 足跡: 5, 歩: 2, 彼岸: 4, 涅槃: 2, 八正道: 4, 向かう: 2, 進む: 2, 辿: 3, 遠く: 2 },
      描く: function (p, t) {
        const 消点 = H * 0.34, 幅 = W * 0.30;
        線(引(W * 0.5 - 幅, H * 0.92, W * 0.5 - W * 0.02, 消点, 60, 3), p, W * 0.006, 濃 * 1.1, 0.75);
        線(引(W * 0.5 + 幅, H * 0.92, W * 0.5 + W * 0.02, 消点, 60, 3), p, W * 0.006, 濃 * 1.1, 0.75);
        const 数 = Math.floor(p * 9);
        for (let i = 0; i < 数; i += 1) {
          const u = i / 9, y = H * 0.92 - (H * 0.92 - 消点) * u;
          const s = 1 - u * 0.8;
          点(W * (0.5 + (i % 2 ? 0.045 : -0.045) * s), y, W * 0.010 * s, 濃 * 0.8);
        }
      }
    },

    樹: {                       // 一本の樹。読み進むほど枝が伸びる
      語: { 樹: 4, 森: 3, 林: 3, 枝: 3, 幹: 4, 根: 3, 葉: 2, 木: 2, 茂: 3, 影: 2 },
      描く: function (p) {
        const 枝 = function (x, y, ang, len, 深, q) {
          if (深 > 4 || len < H * 0.020 || q <= 0) return;
          線(引(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, 16, len * 0.05),
             Math.min(1, q * 1.6), W * (0.011 - 深 * 0.0018), 濃 * (1.05 - 深 * 0.10), 0.4);
          if (q < 0.5) return;
          const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
          枝(nx, ny, ang - 0.44, len * 0.70, 深 + 1, (q - 0.5) / 0.5);
          枝(nx, ny, ang + 0.41, len * 0.72, 深 + 1, (q - 0.5) / 0.5);
        };
        地(H * 0.88, 濃 * 0.7);
        枝(W * 0.5, H * 0.88, -Math.PI / 2 + 0.04, H * 0.20, 0, p);
      }
    },

    家: {                       // 庵の屋根。ここに帰る場所がある
      語: { 庵: 5, 屋根: 5, 家: 3, 門: 3, 戸: 3, 壁: 3, 城: 3, 住: 2, 部屋: 3, 帰: 2, 在家: 2 },
      描く: function (p) {
        const y = H * 0.66;
        地(y, 濃 * 0.9);
        const cx = W * 0.5, w = W * 0.20, h = H * 0.11;
        線(引(cx - w, y, cx, y - h, 30, 0).concat(引(cx, y - h, cx + w, y, 30, 0)),
           Math.min(1, p * 1.6), W * 0.009, 濃 * 1.25, 0.15);
        if (p > 0.5) {
          const q = (p - 0.5) / 0.5;
          線(引(cx - w * 0.72, y, cx - w * 0.72, y - h * 0.55, 20, 0), q, W * 0.006, 濃, 0.2);
          線(引(cx + w * 0.72, y, cx + w * 0.72, y - h * 0.55, 20, 0), q, W * 0.006, 濃, 0.2);
        }
      }
    },

    川: {                       // 流れ。止まらず、同じ水は二度と来ない
      語: { 川: 4, 河: 4, 流れ: 3, 渡: 3, 岸: 3, 洪水: 4, 水: 2, 波: 2, 沈: 3, 溺: 4, 湧: 3, 淵: 4 },
      描く: function (p, t) {
        const 本 = 5;
        for (let i = 0; i < 本; i += 1) {
          const y = H * (0.40 + i * 0.055), 位 = t * 0.00013 + i * 0.7;
          const pts = [];
          for (let k = 0; k < 80; k += 1) {
            const u = k / 79;
            pts.push([W * (0.04 + u * 0.92),
                      y + Math.sin(u * 6.5 + 位) * H * 0.017 + Math.sin(u * 15 + 位 * 1.7) * H * 0.006]);
          }
          線(pts, Math.min(1, p * 1.3 - i * 0.10), W * 0.0055, 濃 * (1 - i * 0.10), 0.15);
        }
      }
    },

    網: {                       // 一点から枝分かれして広がる。渇愛の網
      語: { 網: 5, 糸: 4, 縄: 4, 綱: 4, 縛: 4, 絡: 4, 結: 3, 渇愛: 3, 束縛: 4, 罠: 5, 檻: 5, 鎖: 5, 繋: 3 },
      描く: function (p) {
        const ox = W * 0.5, oy = H * 0.26;
        const 枝 = function (x, y, ang, len, 深, q) {
          if (深 > 4 || len < H * 0.018 || q <= 0) return;
          線(引(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, 14, len * 0.06),
             Math.min(1, q * 1.7), W * (0.0085 - 深 * 0.0013), 濃 * (1 - 深 * 0.08), 0.3);
          if (q < 0.52) return;
          const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
          枝(nx, ny, ang - 0.42, len * 0.73, 深 + 1, (q - 0.52) / 0.48);
          枝(nx, ny, ang + 0.40, len * 0.70, 深 + 1, (q - 0.52) / 0.48);
        };
        点(ox, oy, W * 0.012, 濃 * 1.8);
        for (let i = 0; i < 3; i += 1) 枝(ox, oy, 1.05 + (i - 1) * 0.54, H * 0.15, 0, Math.min(1, p * 1.2));
      }
    },

    火: {                       // 燃えている。燃えているものは、いつか尽きる
      語: { 火: 4, 炎: 5, 焔: 5, 焼: 4, 燃: 4, 灯: 3, 燈: 4, 熾: 4, 熱: 2, 薪: 5 },
      描く: function (p, t) {
        const bx = W * 0.5, by = H * 0.66;
        地(by, 濃 * 0.7);
        const 揺 = Math.sin(t * 0.0016) * W * 0.012;
        const 高 = H * 0.16 * (0.6 + 0.4 * Math.sin(t * 0.0021));
        線(弧(bx, by, W * 0.055, Math.PI * 0.98, Math.PI * 1.55, 40, 0.06), 1, W * 0.007, 濃 * 1.2, 0.4);
        const pts = [];
        for (let k = 0; k < 40; k += 1) {
          const u = k / 39;
          pts.push([bx + Math.sin(u * 3.4) * W * 0.035 * (1 - u) + 揺 * u, by - 高 * u]);
        }
        線(pts, 1, W * 0.010, 濃 * 1.1, 0.75);
        const 数 = Math.floor(4 + p * 14);
        for (let i = 0; i < 数; i += 1) {
          const s = 乱(i + 7);
          const u = ((t * 0.00028 + s) % 1);
          点(bx + Math.sin(s * 9 + u * 3) * W * 0.09 * u, by - 高 * 0.7 - u * H * 0.28,
             W * 0.004, 濃 * 0.9 * (1 - u));
        }
      }
    },

    雨: {                       // 雨よ、降りたいなら降れ
      語: { 雨: 5, 驟雨: 5, 雨季: 5, 濡: 3, 傘: 3, 漏: 3, 滴: 4 },
      描く: function (p, t) {
        const y = H * 0.70;
        地(y, 濃 * 0.9);
        const cx = W * 0.32, w = W * 0.17, h = H * 0.085;
        線(引(cx - w, y, cx, y - h, 26, 0).concat(引(cx, y - h, cx + w, y, 26, 0)),
           1, W * 0.008, 濃 * 1.2, 0.15);
        const 数 = Math.floor(10 + p * 46);
        for (let i = 0; i < 数; i += 1) {
          const s = 乱(i);
          const x = W * (-0.05 + s * 1.10);
          const y0 = -H * 0.05 + ((t * 0.00026 + s) % 1) * (y + H * 0.06);
          const 長 = H * (0.030 + s * 0.032);
          for (let k = 0; k < 26; k += 1) 点(x + 長 * 0.34 * k / 25, y0 + 長 * k / 25, W * 0.0042, 濃 * 0.55);
        }
      }
    },

    山: {                       // 動かないもの。しかし動かないだけである
      語: { 山: 4, 峰: 5, 巌: 5, 岩: 3, 崖: 4, 頂: 4, 石: 2 },
      描く: function (p) {
        const 稜 = function (cx, cy, w, h, a, q) {
          線(引(cx - w, cy, cx, cy - h, 30, h * 0.05).concat(引(cx, cy - h, cx + w, cy, 30, h * 0.05)),
             q, W * 0.007, a, 0.25);
        };
        稜(W * 0.36, H * 0.62, W * 0.30, H * 0.20, 濃 * 1.2, Math.min(1, p * 1.5));
        稜(W * 0.68, H * 0.62, W * 0.26, H * 0.14, 濃 * 0.8, Math.max(0, (p - 0.35) / 0.65));
        地(H * 0.62, 濃 * 0.6);
      }
    },

    月: {                       // 指ではなく、月を見よ
      語: { 月: 5, 月光: 5, 満月: 5, 夜空: 4, 星: 3, 闇: 2 },
      描く: function (p, t) {
        線(弧(W * 0.5, H * 0.36, Math.min(W, H) * 0.15, 0, Math.PI * 2, 120, 0.012),
           Math.min(1, p * 1.8), W * 0.0075, 濃 * 1.15, 0.1);
        if (p > 0.35) {                       // 雲が渡っていく
          const q = (p - 0.35) / 0.65;
          const dx = (t * 0.000035 % 1) * W * 1.4 - W * 0.2;
          for (let i = 0; i < 3; i += 1) {
            const y = H * (0.40 + i * 0.030);
            線(引(dx - W * 0.2 + i * W * 0.04, y, dx + W * 0.24 - i * W * 0.03, y, 40, H * 0.006),
               q, W * 0.008, 濃 * 0.55, 0.4);
          }
        }
      }
    },

    舟: {                       // 筏は、渡り終えれば置いていく
      語: { 舟: 5, 筏: 5, 船: 4, 渡し: 5, 彼岸: 3, 此岸: 5 },
      描く: function (p, t) {
        const y = H * 0.60;
        for (let i = 0; i < 3; i += 1)
          線(引(W * 0.04, y + i * H * 0.035, W * 0.96, y + i * H * 0.035, 70, H * 0.008), 1,
             W * 0.005, 濃 * (0.85 - i * 0.2), 0.15);
        const x = W * (0.20 + p * 0.50), h = H * 0.030;
        線(弧(x, y - h * 0.6, W * 0.085, Math.PI * 0.08, Math.PI * 0.92, 40, 0.05), 1, W * 0.008, 濃 * 1.25, 0.2);
        線(引(x - W * 0.085, y - h * 0.6, x + W * 0.085, y - h * 0.6, 30, 0), 1, W * 0.006, 濃, 0.1);
        線(引(x, y - h * 0.6, x, y - H * 0.10, 22, 0), Math.min(1, p * 2), W * 0.005, 濃 * 0.9, 0.4);
      }
    },

    蓮: {                       // 泥の中から出て、泥に汚れない
      語: { 蓮: 5, 華: 4, 花: 3, 蕾: 4, 泥: 3, 咲: 4, 香: 3 },
      描く: function (p) {
        const cx = W * 0.5, cy = H * 0.46, R = Math.min(W, H) * 0.14;
        const 枚 = 6;
        for (let i = 0; i < 枚; i += 1) {
          const q = Math.max(0, Math.min(1, (p - i * 0.055) * 1.8));
          if (q <= 0) continue;
          const a = -Math.PI / 2 + (i - (枚 - 1) / 2) * 0.42;
          const 開 = 0.35 + q * 0.65;
          const pts = [];
          for (let k = 0; k < 40; k += 1) {
            const u = k / 39, w = Math.sin(u * Math.PI) * R * 0.34 * 開;
            const d = u * R * (0.7 + 0.5 * 開);
            pts.push([cx + Math.cos(a) * d + Math.cos(a + Math.PI / 2) * w,
                      cy + Math.sin(a) * d + Math.sin(a + Math.PI / 2) * w]);
          }
          線(pts, 1, W * 0.006, 濃 * 1.05, 0.5);
          const pts2 = pts.map(function (q2, k) {
            const u = k / 39, w = Math.sin(u * Math.PI) * R * 0.34 * 開;
            const d = u * R * (0.7 + 0.5 * 開);
            return [cx + Math.cos(a) * d - Math.cos(a + Math.PI / 2) * w,
                    cy + Math.sin(a) * d - Math.sin(a + Math.PI / 2) * w];
          });
          線(pts2, 1, W * 0.006, 濃 * 1.05, 0.5);
        }
        点(cx, cy, W * 0.012, 濃 * 1.4);
      }
    },

    種: {                       // 蒔いたものが、そのまま実る
      語: { 種: 5, 芽: 5, 実: 2, 稲: 4, 田: 4, 畑: 4, 収穫: 4, 蒔: 5, 育: 3, 熟: 3, 業: 2 },
      描く: function (p) {
        地(H * 0.74, 濃 * 0.9);
        点(W * 0.5, H * 0.755, W * 0.014, 濃 * 1.5);
        if (p > 0.25) {
          const q = (p - 0.25) / 0.75, 丈 = H * 0.26 * q;
          const pts = [];
          for (let k = 0; k < 40; k += 1) {
            const u = k / 39;
            pts.push([W * 0.5 + Math.sin(u * 2.2) * W * 0.02, H * 0.74 - 丈 * u]);
          }
          線(pts, 1, W * 0.007, 濃 * 1.1, 0.55);
          if (q > 0.45) {
            const r = (q - 0.45) / 0.55;
            線(弧(W * 0.5, H * 0.74 - 丈 * 0.75, W * 0.055, Math.PI * 1.05, Math.PI * 1.75, 24, 0.05),
               r, W * 0.005, 濃, 0.5);
            線(弧(W * 0.5, H * 0.74 - 丈 * 0.92, W * 0.048, Math.PI * 1.28, Math.PI * 1.98, 24, 0.05),
               r, W * 0.005, 濃, 0.5);
          }
        }
      }
    },

    骨: {                       // これも、そうなる
      語: { 骨: 5, 屍: 5, 塚: 5, 墓: 4, 死体: 5, 灰: 4, 朽: 4, 老い: 3, 死: 2, 無常: 2 },
      描く: function (p, t) {
        地(H * 0.72, 濃 * 0.8);
        線(弧(W * 0.5, H * 0.72, W * 0.20, Math.PI, Math.PI * 2, 60, 0.05),
           Math.min(1, p * 1.6), W * 0.008, 濃 * 1.1 * (1 - p * 0.45), 0.2);
        const 数 = Math.floor(p * 30);
        for (let i = 0; i < 数; i += 1) {
          const s = 乱(i + 3);
          const u = ((t * 0.00012 + s) % 1);
          点(W * (0.30 + s * 0.40) + Math.sin(u * 4 + s * 9) * W * 0.10,
             H * 0.72 - u * H * 0.34, W * 0.0035, 濃 * 0.8 * (1 - u));
        }
      }
    },

    器: {                       // 空の器だから、受け取れる
      語: { 器: 4, 鉢: 5, 瓶: 4, 壺: 4, 甕: 5, 托鉢: 5, 満ち: 3, 食: 2 },
      描く: function (p) {
        const cx = W * 0.5, cy = H * 0.50, r = Math.min(W, H) * 0.15;
        線(弧(cx, cy, r, 0, Math.PI, 60, 0.02), Math.min(1, p * 1.7), W * 0.008, 濃 * 1.2, 0.15);
        線(引(cx - r, cy, cx + r, cy, 40, 0), Math.min(1, p * 1.9), W * 0.006, 濃, 0.1);
        if (p > 0.45) {                        // 満ちて、また空になる
          const q = (p - 0.45) / 0.55;
          const 水 = Math.sin(q * Math.PI);
          const y = cy + r * 0.9 * (1 - 水 * 0.85);
          const 半 = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
          線(引(cx - 半, y, cx + 半, y, 30, H * 0.004), 1, W * 0.005, 濃 * 0.8, 0.2);
        }
      }
    },

    砂: {                       // 掴んでも、掌に残らない
      語: { 砂: 4, 塵: 5, 埃: 5, 泡: 4, 陽炎: 5, 幻: 3, 露: 4, 儚: 4 },
      描く: function (p, t) {
        const 数 = Math.floor(26 + p * 66);
        for (let i = 0; i < 数; i += 1) {
          const s = 乱(i), s2 = 乱(i + 51);
          const u = ((t * 0.00006 + s) % 1);
          点(W * (0.05 + s * 0.90) + Math.sin(u * 6.283 + s2 * 9) * W * 0.06,
             H * (0.18 + s2 * 0.62) + Math.sin(u * 4 + s * 5) * H * 0.05,
             W * (0.005 + s * 0.007), 濃 * 1.5 * Math.sin(u * Math.PI));
        }
      }
    },

    鳥: {                       // 空に跡は残らない
      語: { 鳥: 4, 翼: 5, 飛: 3, 白鳥: 5, 鶴: 5, 空を: 4, 跡: 2 },
      描く: function (p, t) {
        for (let i = 0; i < 4; i += 1) {
          const s = 乱(i + 11);
          const q = Math.max(0, Math.min(1, (p - i * 0.12) * 1.6));
          if (q <= 0) continue;
          const x = W * (0.10 + ((t * 0.000045 + s) % 1) * 0.85);
          const y = H * (0.24 + s * 0.26) + Math.sin(t * 0.0009 + s * 6) * H * 0.012;
          const r = W * (0.030 + s * 0.018);
          線(弧(x - r * 0.8, y, r, Math.PI * 1.12, Math.PI * 1.92, 18, 0), q, W * 0.0045, 濃 * 1.0, 0.4);
          線(弧(x + r * 0.8, y, r, Math.PI * 1.08, Math.PI * 1.88, 18, 0), q, W * 0.0045, 濃 * 1.0, 0.4);
        }
      }
    },

    獣: {                       // 心は牛のようなもの。追わず、離さず
      語: { 牛: 5, 象: 5, 馬: 4, 獣: 4, 蛇: 4, 猿: 5, 魚: 3, 家畜: 4, 手綱: 5, 御者: 5 },
      描く: function (p, t) {
        地(H * 0.74, 濃 * 0.8);
        const x = W * (0.30 + p * 0.30), y = H * 0.74;
        線(弧(x, y - H * 0.075, W * 0.12, Math.PI * 0.10, Math.PI * 0.90, 44, 0.05), 1, W * 0.009, 濃 * 1.2, 0.2);
        [-0.085, -0.03, 0.03, 0.085].forEach(function (d) {
          線(引(x + W * d, y - H * 0.062, x + W * d, y, 16, 0),
             Math.min(1, p * 1.6), W * 0.005, 濃 * 1.0, 0.3);
        });
        線(弧(x - W * 0.135, y - H * 0.10, W * 0.035, Math.PI * 1.5, Math.PI * 2.4, 20, 0), 1, W * 0.007, 濃 * 1.1, 0.3);
        if (p > 0.4) 線(引(x - W * 0.16, y - H * 0.115, x - W * 0.30, y - H * 0.19, 26, H * 0.006),
                       (p - 0.4) / 0.6, W * 0.004, 濃 * 0.8, 0.3);
      }
    },

    刃: {                       // 抜いた刃は、まず抜いた手を切る
      語: { 矢: 5, 刃: 5, 剣: 5, 刀: 5, 斧: 5, 棒: 3, 鎌: 5, 鋤: 5, 刺: 3, 武器: 4, 傷: 3 },
      描く: function (p) {
        const cx = W * 0.5, cy = H * 0.52, L = H * 0.20, a = -Math.PI * 0.30;
        線(引(cx - Math.cos(a) * L, cy - Math.sin(a) * L,
              cx + Math.cos(a) * L * 0.55, cy + Math.sin(a) * L * 0.55, 50, 0),
           Math.min(1, p * 1.5), W * 0.008, 濃 * 1.2, 0.55);
        線(引(cx + Math.cos(a) * L * 0.55 - W * 0.03, cy + Math.sin(a) * L * 0.55 + H * 0.014,
              cx + Math.cos(a) * L * 0.55 + W * 0.03, cy + Math.sin(a) * L * 0.55 - H * 0.014, 20, 0),
           Math.min(1, p * 1.9), W * 0.006, 濃, 0.1);
        if (p > 0.5) {          // 抜けていく
          const q = (p - 0.5) / 0.5;
          for (let i = 0; i < 3; i += 1)
            点(cx - Math.cos(a) * L * (1 + q * 0.5) - i * W * 0.02,
               cy - Math.sin(a) * L * (1 + q * 0.5) + i * H * 0.012, W * 0.005, 濃 * 0.6 * (1 - q));
        }
      }
    },

    円: {                       // 「私」という一点。閉じきらない輪
      語: { 自分: 2, 自己: 3, 我: 3, 無我: 4, 五蘊: 4, 自分自身: 3, 一点: 3, 私: 1 },
      描く: function (p) {
        const r = Math.min(W, H) * 0.19;
        線(弧(W * 0.5, H * 0.44, r, -Math.PI * 0.55, Math.PI * 1.32, 160, 0.014),
           Math.min(1, p * 1.15), W * 0.010, 濃 * 1.15, 0.62);
      }
    },

    波: {                       // 言葉は出ていき、戻らない
      語: { 言葉: 3, 声: 3, 話: 2, 沈黙: 3, 一言: 4, 伝: 2, 響: 4, 音: 2, 語る: 3 },
      描く: function (p, t) {
        const cx = W * 0.5, cy = H * 0.44;
        点(cx, cy, W * 0.010, 濃 * 1.4);
        for (let i = 0; i < 5; i += 1) {
          const 周 = 7000;
          const u = (((t + i * 1400) % 周) / 周);
          const r = Math.min(W, H) * (0.05 + u * 0.42);
          線(弧(cx, cy, r, 0, Math.PI * 2, 110, 0.010), Math.min(1, p * 1.6),
             W * 0.0055, 濃 * 0.85 * Math.sin(u * Math.PI), 0.1);
        }
      }
    },

    点: {                       // 気づきは、動かずにそこに在る
      語: { 注意: 3, 気づ: 3, 念: 3, 見張: 4, 観察: 3, 四念処: 4, 集中: 3, サティ: 5, 目を離: 4 },
      描く: function (p, t) {
        const cx = W * 0.5, cy = H * 0.44;
        線(弧(cx, cy, Math.min(W, H) * 0.045, 0, Math.PI * 2, 60, 0), Math.min(1, p * 2), W * 0.007, 濃 * 1.4, 0.05);
        const 数 = Math.floor(10 + p * 26);
        for (let i = 0; i < 数; i += 1) {         // 周りは流れていく
          const s = 乱(i), s2 = 乱(i + 71);
          const u = ((t * 0.00009 + s) % 1);
          const R = Math.min(W, H) * (0.13 + s2 * 0.34);
          const A = s * 6.283 + u * 0.9;
          点(cx + Math.cos(A) * R, cy + Math.sin(A) * R * 0.95,
             W * 0.0035, 濃 * 0.6 * Math.sin(u * Math.PI));
        }
      }
    },

    層: {                       // 覆いが一枚ずつ剥がれ、下が見えてくる
      語: { 智慧: 3, 明ら: 3, 洞察: 4, 無明: 4, 覆: 4, 曇: 4, 霧: 4, 雲: 3, 靄: 5, 見える: 2, 理解: 2 },
      描く: function (p) {
        const 枚 = 6;
        for (let i = 0; i < 枚; i += 1) {
          const 剥 = Math.max(0, Math.min(1, (p - i * 0.12) * 2.2));
          const y = H * (0.34 + i * 0.055) - 剥 * H * 0.16;
          線(引(W * 0.08, y, W * 0.92, y, 60, H * 0.005), 1, W * 0.007,
             濃 * (1.05 - i * 0.10) * (1 - 剥 * 0.85), 0.2);
        }
      }
    },

    握: {                       // 掴んでいる手を、ひらく
      語: { 執着: 4, 掴: 4, 握: 4, 手放: 5, 捨て: 3, 欲し: 3, 惜し: 4, 離さ: 4, 取著: 5 },
      描く: function (p) {
        const cx = W * 0.5, cy = H * 0.46, r = Math.min(W, H) * 0.15;
        const 開 = Math.max(0, (p - 0.45) / 0.55);       // 後半でひらく
        const d = 0.30 + 開 * 0.62;
        線(弧(cx, cy, r, Math.PI * (0.5 + d), Math.PI * (1.5 - d * 0.15), 60, 0.03),
           Math.min(1, p * 1.8), W * 0.009, 濃 * 1.15, 0.35);
        線(弧(cx, cy, r, Math.PI * (1.5 + d * 0.15), Math.PI * (2.5 - d), 60, 0.03),
           Math.min(1, p * 1.8), W * 0.009, 濃 * 1.15, 0.35);
      }
    },

    階: {                       // 順に、一段ずつ。飛び越えられない
      語: { 順序: 4, 段階: 4, 次第: 4, 積み: 3, 手順: 4, 過程: 3, 順に: 4, 条件: 2, 縁起: 4, 一つずつ: 4 },
      描く: function (p) {
        const 段 = 5, x0 = W * 0.24, y0 = H * 0.70, w = W * 0.11, h = H * 0.055;
        for (let i = 0; i < 段; i += 1) {
          const q = Math.max(0, Math.min(1, (p - i * 0.16) * 2.4));
          if (q <= 0) continue;
          線(引(x0 + i * w, y0 - i * h, x0 + (i + 1) * w, y0 - i * h, 22, 0), q, W * 0.006, 濃 * 1.1, 0.15);
          線(引(x0 + (i + 1) * w, y0 - i * h, x0 + (i + 1) * w, y0 - (i + 1) * h, 14, 0),
             Math.max(0, (q - 0.5) * 2), W * 0.006, 濃 * 1.1, 0.15);
        }
      }
    },

    // 型が当てはまらない経典に置く地。物語は語らず、墨がにじんで消えるだけ。
    にじみ: {
      語: {},
      描く: function (p, t) {
        for (let i = 0; i < 5; i += 1) {
          const 周 = 11000 + i * 3100;
          const u = ((t + i * 3700) % 周) / 周;
          点(W * (0.22 + 0.56 * 乱(i + 5)), H * (0.22 + 0.56 * 乱(i + 29)),
             Math.min(W, H) * (0.10 + u * 0.34), 濃 * 0.55 * Math.sin(u * Math.PI));
        }
      }
    }
  };

  // ---------- 型を選ぶ ----------
  // 語の重みを足し合わせ、いちばん強い型を採る。
  // どれも弱ければ無理に当てず「にじみ」にする。当て損なうより、空けるほうがよい。
  function 選ぶ(文) {
    if (!文) return "にじみ";
    let 最良 = "にじみ", 最点 = 0;
    Object.keys(型たち).forEach(function (名) {
      const 語 = 型たち[名].語;
      let 点数 = 0;
      Object.keys(語).forEach(function (k) {
        let i = 0, n = 0;
        while ((i = 文.indexOf(k, i)) !== -1) { n += 1; i += k.length; }
        if (n) 点数 += 語[k] * (1 + Math.min(n - 1, 3) * 0.5);
      });
      if (点数 > 最点) { 最点 = 点数; 最良 = 名; }
    });
    return 最点 >= 3 ? 最良 : "にじみ";
  }

  // ---------- 画面まわり ----------
  function 大きさを合わせる() {
    if (!板) return;
    比 = Math.min(2, window.devicePixelRatio || 1);
    W = board_w(); H = board_h();
    板.width = Math.round(W * 比); 板.height = Math.round(H * 比);
    筆.setTransform(比, 0, 0, 比, 0, 0);
  }
  function board_w() { return 板.clientWidth || window.innerWidth; }
  function board_h() { return 板.clientHeight || window.innerHeight; }

  function 墨の色を取る() {
    try {
      const v = getComputedStyle(document.body).getPropertyValue("--ink").trim();
      const m = v.match(/^#([0-9a-f]{6})$/i);
      if (m) {
        const n = parseInt(m[1], 16);
        return (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255);
      }
    } catch (e) {}
    return "31,29,27";
  }

  let 前回 = 0;
  function 一齣(now) {
    齣 = requestAnimationFrame(一齣);
    if (!型 || !板) return;
    // 毎秒30枚に抑える。墨がゆっくり広がるだけなので、これで十分に滑らかで、
    // 端末の負担と電池の減りが半分になる。
    if (now - 前回 < 32) return;
    前回 = now;
    const t = now - 起点;
    進 += (目標 - 進) * 0.045;                  // 目標へゆっくり寄せる。段落が変わっても跳ねない
    筆.setTransform(比, 0, 0, 比, 0, 0);
    筆.clearRect(0, 0, W, H);
    if (消えかけ) {
      const 残 = 1 - Math.min(1, (now - 消えかけ) / 1600);
      if (残 <= 0) { 止める(); return; }
      板.style.opacity = String(残);
    }
    型たち[型].描く(Math.max(0, Math.min(1, 進)), t);
    筆.globalAlpha = 1;
  }

  function 止める() {
    if (齣) cancelAnimationFrame(齣);
    齣 = 0; 型 = null; 消えかけ = 0;
    if (板) { 板.style.opacity = "0"; 筆.clearRect(0, 0, W, H); }
  }

  return {
    // 背景の板を用意する。#app より後ろに置き、指の操作は一切受け取らない。
    用意: function () {
      if (板) return;
      // 本編アプリで「出さない」を選んでいれば、読むだけのアプリでも出さない。
      // 設定は一つで、二つのアプリに効くようにする。
      try {
        const 設定 = JSON.parse(localStorage.getItem("keiten-settings-v1") || "{}");
        if (設定.keshiki === false) 使用 = false;
      } catch (e) {}
      板 = document.createElement("canvas");
      板.id = "keshiki";
      board_attach(板);
      筆 = 板.getContext("2d");
      墨 = 墨の色を取る();
      判 = 判を作る();
      大きさを合わせる();
      window.addEventListener("resize", 大きさを合わせる);
      if (window.matchMedia) {
        const q = window.matchMedia("(prefers-color-scheme: dark)");
        const 直す = function () { 墨 = 墨の色を取る(); 判 = 判を作る(); };
        if (q.addEventListener) q.addEventListener("change", 直す);
      }
    },

    使う: function (b) { 使用 = !!b; if (!b) 止める(); },
    使うか: function () { return 使用; },
    選ぶ: 選ぶ,
    型の名前: function () { return 型; },
    型一覧: function () { return Object.keys(型たち); },

    // 経典の文から型を選び、描き始める
    始める: function (文) {
      this.用意();
      if (!使用) { 止める(); return null; }
      // 端末で「動きを減らす」を選んでいる人には出さない
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
      止める();
      型 = 選ぶ(文);
      進 = 0; 目標 = 0.06; 起点 = performance.now(); 消えかけ = 0;
      大きさを合わせる();
      板.style.opacity = "1";
      齣 = requestAnimationFrame(一齣);
      return 型;
    },

    進み: function (p) { 目標 = Math.max(0, Math.min(1, p)); },

    // 読み終えたら、静かに消す
    終える: function () {
      if (!型) return;
      目標 = 1;
      消えかけ = performance.now();
    },

    直ちに止める: 止める
  };

  function board_attach(c) {
    document.body.insertBefore(c, document.body.firstChild);
  }
})();

// const で作った名前は window に載らないので、明示的に渡す。
// アプリ側は window.Keshiki の有無で「景色を使えるか」を判断している。
window.Keshiki = Keshiki;
