// 方針:まずインターネットから最新を取りに行き、取れたらそれを表示しつつ控えを更新する。
// 電波がないときだけ、控え(キャッシュ)から表示する。
// これにより「アップロードしたのに古いままiPhoneに出る」が起きない。
const CACHE_NAME = "keiten-v50";

const ASSETS = [
  "./",
  "./index.html",
  "./yomu.html",
  "./yomu.js",
  "./manifest-yomu.json",
  "./style.css",
  "./app.js",
  "./data.js",
  "./kammatthana.js",
  "./passages.js",
  "./hosshin.js",
  "./elders.js",
  "./speech.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  // すぐには入れ替わらない。利用者が「切り替える」を押したときに入れ替わる。
  // 勝手に入れ替わると、読み直しが繰り返されて操作を受け付けなくなった。
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== AUDIO_CACHE)
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

const AUDIO_CACHE = "keiten-audio-v1";

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // 読み上げの音声は中身が変わらないので、控えがあればそれを使う。
  // 毎回取りに行くと、電波が無いときに読み上げが止まってしまう。
  if (event.request.url.indexOf("/audio/") !== -1) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) return hit;
        return fetch(event.request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(AUDIO_CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 取れた最新を、次に電波がないときのために控えておく
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        // 電波がないとき:控えから出す。控えにもなければ入り口の画面を出す。
        caches
          .match(event.request, { ignoreSearch: true })
          .then((cached) => cached || caches.match("./index.html"))
      )
  );
});
