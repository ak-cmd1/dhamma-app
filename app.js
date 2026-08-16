(function () {
  const screenQuestion = document.getElementById("screen-question");
  const screenStage = document.getElementById("screen-stage");
  const screenClosing = document.getElementById("screen-closing");

  const choicesEl = document.getElementById("choices");
  const progressEl = document.getElementById("progress");
  const stageTitleEl = document.getElementById("stage-title");
  const stageSutraEl = document.getElementById("stage-sutra");
  const stageTextEl = document.getElementById("stage-text");
  const nextBtn = document.getElementById("next-btn");
  const restartFromStageBtn = document.getElementById("restart-from-stage");
  const restartBtn = document.getElementById("restart-btn");
  const closingTextEl = document.getElementById("closing-text");

  let current = null;
  let stageIndex = 0;

  function showScreen(el) {
    [screenQuestion, screenStage, screenClosing].forEach((s) => (s.hidden = s !== el));
  }

  function renderChoices() {
    choicesEl.innerHTML = "";
    HINDRANCES.forEach((h) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.innerHTML =
        '<div class="choice-main">' + h.label + "</div>" +
        '<div class="choice-sub">' + h.subLabel + "</div>";
      btn.addEventListener("click", () => selectHindrance(h));
      choicesEl.appendChild(btn);
    });
  }

  function selectHindrance(h) {
    current = h;
    stageIndex = 0;
    renderStage();
    showScreen(screenStage);
  }

  function renderStage() {
    const stage = current.stages[stageIndex];
    progressEl.innerHTML = "";
    current.stages.forEach((s, i) => {
      const span = document.createElement("span");
      span.textContent = s.title;
      if (i === stageIndex) span.className = "active";
      progressEl.appendChild(span);
    });

    stageTitleEl.textContent = stage.title;
    stageSutraEl.textContent = stage.sutra;
    stageTextEl.textContent = stage.text;
    nextBtn.textContent = stageIndex === current.stages.length - 1 ? "締めくくる" : "次へ";
  }

  function goNext() {
    if (stageIndex < current.stages.length - 1) {
      stageIndex += 1;
      renderStage();
    } else {
      closingTextEl.textContent = current.closing;
      showScreen(screenClosing);
    }
  }

  function restart() {
    current = null;
    stageIndex = 0;
    showScreen(screenQuestion);
  }

  nextBtn.addEventListener("click", goNext);
  restartFromStageBtn.addEventListener("click", restart);
  restartBtn.addEventListener("click", restart);

  renderChoices();
  showScreen(screenQuestion);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
