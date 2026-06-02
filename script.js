const state = {
  data: null,
  groups: [],
  allQuestions: [],
  closedQuestions: [],
  openQuestions: [],
  mediaQuestions: [],
  nonMediaQuestions: [],
  currentTestQuestions: [],
  testActive: false,
  testTimer: null,
  testTimeLeft: 20 * 60,
  biathlonQuestionsPool: [],
  biathlonIndex: 0,
  biathlonScore: 0,
  biathlonTimer: null,
  biathlonTimeLeft: 20
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  setupTabs();
  setupActions();

  try {
    const response = await fetch("tests.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.data = await response.json();
    state.groups = state.data.tests || [];
    state.allQuestions = getUniqueQuestions(state.groups.flatMap((group) => group.questions || []));
    state.closedQuestions = state.allQuestions.filter(isClosedQuestion);
    state.openQuestions = state.allQuestions.filter((question) => question.type === "open");
    state.mediaQuestions = state.allQuestions.filter(isMediaQuestion);
    state.nonMediaQuestions = state.allQuestions.filter((question) => !isMediaQuestion(question));

    renderInfo();
    renderFaces();
    renderQuestionGroups();
  } catch (error) {
    showLoadError(error);
  }
}

function cacheElements() {
  els.tabs = {
    info: document.getElementById("tab-info"),
    faces: document.getElementById("tab-faces"),
    questions: document.getElementById("tab-questions"),
    test: document.getElementById("tab-test"),
    biathlon: document.getElementById("tab-biathlon")
  };
  els.navIcons = document.querySelectorAll(".nav-icon");
  els.projectDescription = document.getElementById("projectDescription");
  els.loadStatus = document.getElementById("loadStatus");
  els.facesContainer = document.getElementById("facesContainer");
  els.questionsCount = document.getElementById("questionsCount");
  els.questionGroups = document.getElementById("questionGroups");
  els.startTestBtn = document.getElementById("start-test-btn");
  els.testQuestionsArea = document.getElementById("test-questions-area");
  els.testResultArea = document.getElementById("test-result-area");
  els.testActions = document.getElementById("test-actions");
  els.submitTestBtn = document.getElementById("submit-test-btn");
  els.resetTestBtn = document.getElementById("reset-test-btn");
  els.exportWordBtn = document.getElementById("export-word-btn");
  els.startCard = document.getElementById("start-card");
  els.timerContainer = document.getElementById("timer-container");
  els.timerDisplay = document.getElementById("timer-display");
  els.biathlonStartCard = document.getElementById("biathlon-start-card");
  els.biathlonGameArea = document.getElementById("biathlon-game-area");
  els.biathlonResultArea = document.getElementById("biathlon-result-area");
  els.startBiathlonBtn = document.getElementById("start-biathlon-btn");
  els.biathlonTimerEl = document.getElementById("biathlon-timer");
  els.biathlonQuestionText = document.getElementById("biathlon-question-text");
  els.biathlonAnswerInput = document.getElementById("biathlon-answer-input");
  els.biathlonSubmitBtn = document.getElementById("biathlon-submit-btn");
  els.scrollToTopBtn = document.getElementById("scrollToTopBtn");
}

function setupTabs() {
  els.navIcons.forEach((icon) => {
    icon.addEventListener("click", () => switchTab(icon.dataset.tab));
  });
}

function setupActions() {
  els.startTestBtn.addEventListener("click", startNewTest);
  els.submitTestBtn.addEventListener("click", submitTest);
  els.resetTestBtn.addEventListener("click", () => {
    resetTest();
    startNewTest();
  });
  els.exportWordBtn.addEventListener("click", exportToWord);
  els.startBiathlonBtn.addEventListener("click", startBiathlon);
  els.biathlonSubmitBtn.addEventListener("click", submitBiathlonAnswer);
  els.biathlonAnswerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitBiathlonAnswer();
    }
  });
  els.scrollToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function switchTab(tabId) {
  Object.values(els.tabs).forEach((tab) => tab.classList.remove("active"));
  if (els.tabs[tabId]) {
    els.tabs[tabId].classList.add("active");
  }
  els.navIcons.forEach((icon) => icon.classList.toggle("active", icon.dataset.tab === tabId));

  if (tabId !== "biathlon") {
    resetBiathlon();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderInfo() {
  const totalGroups = state.groups.length;
  const totalQuestions = state.allQuestions.length;
  const mediaCount = state.mediaQuestions.length;

  els.projectDescription.textContent = state.data.project?.description || "Тренажер профтеста.";
  els.loadStatus.textContent = `Загружено групп: ${totalGroups}. Уникальных вопросов: ${totalQuestions}. Медиавопросов: ${mediaCount}.`;
}

function renderFaces() {
  const faces = state.data?.faces || [];
  els.facesContainer.innerHTML = faces.map((face) => `
    <article class="face-card">
      <div class="face-photo-circle">
        ${face.photo ? `<img class="face-img" src="${escapeHtml(face.photo)}" alt="${escapeHtml(face.name)}">` : ""}
      </div>
      <div class="face-name">${escapeHtml(face.name)}</div>
      <div class="face-position">${escapeHtml(face.position)}</div>
    </article>
  `).join("");
}

function renderQuestionGroups() {
  els.questionsCount.textContent = `Всего уникальных вопросов в банке: ${state.allQuestions.length}`;
  els.questionGroups.innerHTML = state.groups.map((group) => {
    const groupId = `group-${group.id}`;
    return `
      <button class="accordion-header" type="button" data-target="${groupId}">
        <span>${escapeHtml(group.title)} (${group.questions.length})</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div id="${groupId}" class="accordion-content">
        ${group.source ? `<p class="section-note">${escapeHtml(group.source)}</p>` : ""}
        ${group.questions.map(renderQuestionReadOnly).join("")}
      </div>
    `;
  }).join("");

  els.questionGroups.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const content = document.getElementById(header.dataset.target);
      const marker = header.querySelector("span:last-child");
      const isOpen = content.classList.toggle("open");
      marker.textContent = isOpen ? "▴" : "▾";
    });
  });
}

function renderQuestionReadOnly(question) {
  let answers = "";

  if (question.type === "open") {
    answers = `<div class="option-item correct">✓ ${escapeHtml(question.correctAnswer)}</div>`;
  } else if (question.type === "multiple") {
    answers = question.options.map((option, index) => {
      const isCorrect = (question.corrects || []).includes(index);
      return `<div class="option-item ${isCorrect ? "correct" : ""}">${escapeHtml(option)} ${isCorrect ? "✓" : ""}</div>`;
    }).join("");
  } else {
    answers = question.options.map((option, index) => {
      const isCorrect = index === question.correct;
      return `<div class="option-item ${isCorrect ? "correct" : ""}">${escapeHtml(option)} ${isCorrect ? "✓" : ""}</div>`;
    }).join("");
  }

  return `
    <article class="question-block">
      <strong class="question-title">
        ${escapeHtml(question.question)}
        <span class="question-type-badge">${getTypeLabel(question)}</span>
        ${question.generated ? '<span class="question-type-badge generated-badge">сгенерировано</span>' : ""}
      </strong>
      ${renderMedia(question.media)}
      <div class="options">${answers}</div>
    </article>
  `;
}

function renderTest(questions) {
  els.testQuestionsArea.innerHTML = questions.map((question, index) => {
    let inputs = "";

    if (question.type === "single") {
      inputs = question.shuffledOptions.map((option, optionIndex) => `
        <label class="option-item">
          <input type="radio" name="q${index}" value="${optionIndex}">
          <span>${escapeHtml(option)}</span>
        </label>
      `).join("");
    } else if (question.type === "multiple") {
      inputs = question.shuffledOptions.map((option, optionIndex) => `
        <label class="option-item">
          <input type="checkbox" name="q${index}" value="${optionIndex}">
          <span>${escapeHtml(option)}</span>
        </label>
      `).join("");
    } else {
      inputs = `<input class="open-answer-input" name="q${index}" placeholder="Ваш ответ">`;
    }

    return `
      <article class="question-block">
        <strong class="question-title">
          ${index + 1}. ${escapeHtml(question.question)}
          <span class="question-type-badge">${getTypeLabel(question)}</span>
          ${question.generated ? '<span class="question-type-badge generated-badge">сгенерировано</span>' : ""}
        </strong>
        ${renderMedia(question.media)}
        <div class="options">${inputs}</div>
      </article>
    `;
  }).join("");

  els.testQuestionsArea.hidden = false;
  els.testResultArea.hidden = true;
}

function renderMedia(media) {
  if (!media) {
    return "";
  }

  if (media.type === "text") {
    return `
      <div class="media-card">
        <strong>${escapeHtml(media.title || "Медиафрагмент")}</strong>
        <p>${escapeHtml(media.body || "")}</p>
      </div>
    `;
  }

  if (media.type === "image" && media.src) {
    return `
      <figure class="media-card">
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt || media.title || "Медиа")}" loading="lazy">
        ${media.title ? `<figcaption>${escapeHtml(media.title)}</figcaption>` : ""}
      </figure>
    `;
  }

  return "";
}

function startNewTest() {
  if (!state.allQuestions.length) {
    alert("Банк вопросов еще не загружен.");
    return;
  }

  stopTestTimer();
  resetBiathlon();

  const mode = getSelectedValue("testMode", "mixed");
  const count = Number(getSelectedValue("questionCount", "20"));
  const includeMedia = getCheckedValue("includeMedia");
  state.currentTestQuestions = generateTestByMode(mode, count, includeMedia);

  if (!state.currentTestQuestions.length) {
    alert("В выбранном режиме нет вопросов. Выберите другой режим.");
    return;
  }

  state.testActive = true;
  renderTest(state.currentTestQuestions);
  els.testActions.hidden = false;
  els.startCard.hidden = true;
  startTestTimer();
}

function submitTest() {
  if (!state.testActive) {
    return;
  }

  stopTestTimer();
  els.timerContainer.style.display = "none";

  let score = 0;
  const errors = [];

  state.currentTestQuestions.forEach((question, index) => {
    if (question.type === "single") {
      const selected = document.querySelector(`input[name="q${index}"]:checked`);
      const selectedIndex = selected ? Number(selected.value) : null;

      if (selectedIndex === question.newCorrect) {
        score += 1;
      } else {
        errors.push({
          question: question.question,
          userAnswer: selected ? question.shuffledOptions[selectedIndex] : "(нет ответа)",
          correctAnswer: question.shuffledOptions[question.newCorrect]
        });
      }
      return;
    }

    if (question.type === "multiple") {
      const selected = Array.from(document.querySelectorAll(`input[name="q${index}"]:checked`)).map((input) => Number(input.value));
      const selectedSet = new Set(selected);
      const correctSet = new Set(question.newCorrects);
      const isCorrect = selectedSet.size === correctSet.size && [...selectedSet].every((value) => correctSet.has(value));

      if (isCorrect) {
        score += 1;
      } else {
        errors.push({
          question: question.question,
          userAnswer: selected.map((value) => question.shuffledOptions[value]).join(", ") || "(нет ответа)",
          correctAnswer: question.newCorrects.map((value) => question.shuffledOptions[value]).join(", ")
        });
      }
      return;
    }

    const input = document.querySelector(`input[name="q${index}"]`);
    const answer = input ? input.value.trim() : "";

    if (isOpenAnswerCorrect(question, answer)) {
      score += 1;
    } else {
      errors.push({
        question: question.question,
        userAnswer: answer || "(пусто)",
        correctAnswer: getOpenAnswerText(question)
      });
    }
  });

  els.testResultArea.innerHTML = `
    <div class="result-box">
      <h3>${score}/${state.currentTestQuestions.length}</h3>
      <p>Правильно: ${score} из ${state.currentTestQuestions.length}</p>
    </div>
    ${renderErrors(errors)}
  `;
  els.testResultArea.hidden = false;
  state.testActive = false;
}

function renderErrors(errors) {
  if (!errors.length) {
    return '<div class="result-box success">Идеально, ошибок нет.</div>';
  }

  return `
    <div class="error-list">
      <h4>Ошибки (${errors.length})</h4>
      ${errors.map((error, index) => `
        <div class="error-item">
          <strong>${index + 1}. ${escapeHtml(error.question)}</strong><br>
          <span class="wrong">Ваш ответ: ${escapeHtml(error.userAnswer)}</span><br>
          <span class="right">Правильный ответ: ${escapeHtml(error.correctAnswer)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function resetTest() {
  stopTestTimer();
  els.timerContainer.style.display = "none";
  state.currentTestQuestions = [];
  state.testActive = false;
  els.testQuestionsArea.hidden = true;
  els.testResultArea.hidden = true;
  els.testActions.hidden = true;
  els.startCard.hidden = false;
}

function startTestTimer() {
  state.testTimeLeft = 20 * 60;
  updateTestTimerDisplay();
  els.timerContainer.style.display = "flex";
  state.testTimer = setInterval(() => {
    state.testTimeLeft -= 1;
    updateTestTimerDisplay();

    if (state.testTimeLeft <= 0) {
      stopTestTimer();
      alert("Время вышло!");
      submitTest();
    }
  }, 1000);
}

function stopTestTimer() {
  if (state.testTimer) {
    clearInterval(state.testTimer);
    state.testTimer = null;
  }
}

function updateTestTimerDisplay() {
  const minutes = Math.floor(state.testTimeLeft / 60);
  const seconds = state.testTimeLeft % 60;
  els.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  els.timerContainer.classList.toggle("warning", state.testTimeLeft <= 60);
}

function exportToWord() {
  if (!state.currentTestQuestions.length) {
    alert("Нет активного теста для экспорта. Сначала сгенерируйте тест.");
    return;
  }

  let docHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Сгенерированный тест</title>
      <style>
        body { font-family: "Times New Roman", Times, serif; margin: 40px; }
        h1 { color: #003bb3; }
        .q-item { margin-bottom: 24px; }
        .q-text { font-weight: bold; }
        .options { margin: 8px 0 0 20px; }
        .option-row { margin: 4px 0; }
      </style>
    </head>
    <body>
      <h1>proftest</h1>
      <p>Дата: ${new Date().toLocaleDateString("ru-RU")}</p>
      <hr>
  `;

  state.currentTestQuestions.forEach((question, index) => {
    docHtml += `<div class="q-item"><div class="q-text">${index + 1}. ${escapeHtml(question.question)}</div>`;
    if (question.media?.body) {
      docHtml += `<p><em>${escapeHtml(question.media.title || "Медиафрагмент")}: ${escapeHtml(question.media.body)}</em></p>`;
    }
    docHtml += '<div class="options">';

    if (question.type === "single" || question.type === "multiple") {
      question.shuffledOptions.forEach((option) => {
        docHtml += `<div class="option-row">☐ ${escapeHtml(option)}</div>`;
      });
      docHtml += "<div><em>Ответ: __________</em></div>";
    } else {
      docHtml += "<div><em>Ответ: _________________________________</em></div>";
    }

    docHtml += "</div></div>";
  });

  docHtml += "</body></html>";

  const blob = new Blob([docHtml], { type: "application/msword" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `proftest_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function startBiathlon() {
  if (!state.openQuestions.length) {
    alert("В банке нет открытых вопросов для биатлона.");
    return;
  }

  resetBiathlon();
  state.biathlonQuestionsPool = shuffle(state.openQuestions);
  state.biathlonIndex = 0;
  state.biathlonScore = 0;
  els.biathlonStartCard.hidden = true;
  els.biathlonGameArea.hidden = false;
  showBiathlonQuestion();
}

function showBiathlonQuestion() {
  if (state.biathlonIndex >= state.biathlonQuestionsPool.length) {
    els.biathlonGameArea.hidden = true;
    els.biathlonResultArea.hidden = false;
    els.biathlonResultArea.innerHTML = `
      <div class="result-box success">
        <h3>Результат: ${state.biathlonScore} правильных</h3>
        <p>Вы ответили правильно на все доступные открытые вопросы.</p>
        <button id="retry-biathlon-btn" type="button" class="secondary">Попробовать снова</button>
      </div>
    `;
    document.getElementById("retry-biathlon-btn").addEventListener("click", startBiathlon);
    return;
  }

  const question = state.biathlonQuestionsPool[state.biathlonIndex];
  els.biathlonQuestionText.innerHTML = `
    <strong class="question-title">${escapeHtml(question.question)}</strong>
    ${renderMedia(question.media)}
  `;
  els.biathlonAnswerInput.value = "";
  els.biathlonAnswerInput.focus();
  state.biathlonTimeLeft = 20;
  els.biathlonTimerEl.textContent = state.biathlonTimeLeft;
  els.biathlonTimerEl.style.color = "var(--blue-dark)";

  if (state.biathlonTimer) {
    clearInterval(state.biathlonTimer);
  }

  state.biathlonTimer = setInterval(() => {
    state.biathlonTimeLeft -= 1;
    els.biathlonTimerEl.textContent = state.biathlonTimeLeft;

    if (state.biathlonTimeLeft <= 5) {
      els.biathlonTimerEl.style.color = "var(--danger)";
    }

    if (state.biathlonTimeLeft <= 0) {
      clearInterval(state.biathlonTimer);
      handleBiathlonAnswer(false, true);
    }
  }, 1000);
}

function submitBiathlonAnswer() {
  if (els.biathlonGameArea.hidden) {
    return;
  }

  const question = state.biathlonQuestionsPool[state.biathlonIndex];
  const answer = els.biathlonAnswerInput.value.trim();
  handleBiathlonAnswer(isOpenAnswerCorrect(question, answer));
}

function handleBiathlonAnswer(isCorrect, timeOut = false) {
  if (state.biathlonTimer) {
    clearInterval(state.biathlonTimer);
    state.biathlonTimer = null;
  }

  const question = state.biathlonQuestionsPool[state.biathlonIndex];
  const userAnswer = els.biathlonAnswerInput.value.trim();

  if (isCorrect) {
    state.biathlonScore += 1;
    state.biathlonIndex += 1;
    showBiathlonQuestion();
    return;
  }

  els.biathlonGameArea.hidden = true;
  els.biathlonResultArea.hidden = false;
  els.biathlonResultArea.innerHTML = `
    <div class="result-box">
      <h3>Результат: ${state.biathlonScore} правильных</h3>
      <div class="error-list">
        <p><strong>Ошибка на вопросе:</strong> ${escapeHtml(question.question)}</p>
        <p class="wrong">Ваш ответ: ${timeOut ? "(время вышло)" : escapeHtml(userAnswer || "(пусто)")}</p>
        <p class="right">Правильный ответ: ${escapeHtml(getOpenAnswerText(question))}</p>
      </div>
      <button id="retry-biathlon-btn" type="button" class="secondary">Попробовать снова</button>
    </div>
  `;
  document.getElementById("retry-biathlon-btn").addEventListener("click", startBiathlon);
}

function resetBiathlon() {
  if (state.biathlonTimer) {
    clearInterval(state.biathlonTimer);
    state.biathlonTimer = null;
  }

  els.biathlonGameArea.hidden = true;
  els.biathlonResultArea.hidden = true;
  els.biathlonStartCard.hidden = false;
}

function generateTestByMode(mode, count, includeMedia) {
  const regularPool = filterQuestionsByMode(state.nonMediaQuestions, mode);

  if (includeMedia) {
    const mediaCount = Math.floor(count / 2);
    const regularCount = count - mediaCount;

    if (state.mediaQuestions.length < mediaCount || regularPool.length < regularCount) {
      alert(`Недостаточно вопросов для теста с медиа. Нужно ${mediaCount} медиавопросов и ${regularCount} обычных вопросов.`);
      return [];
    }

    return shuffle([
      ...shuffle(state.mediaQuestions).slice(0, mediaCount),
      ...shuffle(regularPool).slice(0, regularCount)
    ]).map(shuffleQuestionOptions);
  }

  const shuffledPool = shuffle(regularPool);
  const actualCount = Math.min(count, shuffledPool.length);

  if (actualCount < count) {
    alert(`В выбранном режиме только ${shuffledPool.length} вопросов. Будет сгенерирован тест из ${actualCount} вопросов.`);
  }

  return shuffledPool.slice(0, actualCount).map(shuffleQuestionOptions);
}

function filterQuestionsByMode(questions, mode) {
  if (mode === "closed") {
    return questions.filter(isClosedQuestion);
  }
  if (mode === "open") {
    return questions.filter((question) => question.type === "open");
  }
  return questions;
}

function shuffleQuestionOptions(question) {
  if (question.type === "open") {
    return { ...question };
  }

  const indexes = question.options.map((_, index) => index);
  const shuffledIndexes = shuffle(indexes);
  const shuffledOptions = shuffledIndexes.map((index) => question.options[index]);

  if (question.type === "single") {
    return {
      ...question,
      shuffledOptions,
      newCorrect: shuffledIndexes.indexOf(question.correct)
    };
  }

  return {
    ...question,
    shuffledOptions,
    newCorrects: (question.corrects || []).map((correctIndex) => shuffledIndexes.indexOf(correctIndex))
  };
}

function getUniqueQuestions(questions) {
  const seen = new Set();
  return questions.filter((question) => {
    const key = normalizeAnswer(question.question);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isClosedQuestion(question) {
  return question.type === "single" || question.type === "multiple";
}

function isMediaQuestion(question) {
  return Boolean(question.media || question.generated);
}

function isOpenAnswerCorrect(question, answer) {
  const normalizedAnswer = normalizeAnswer(answer);
  const variants = [question.correctAnswer, ...(question.accept || [])].filter(Boolean).map(normalizeAnswer);
  return variants.includes(normalizedAnswer);
}

function getOpenAnswerText(question) {
  return question.accept?.length ? `${question.correctAnswer} (${question.accept.join(", ")})` : question.correctAnswer;
}

function normalizeAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function getTypeLabel(question) {
  if (question.type === "single") {
    return "один ответ";
  }
  if (question.type === "multiple") {
    return "несколько ответов";
  }
  return "открытый ответ";
}

function getSelectedValue(name, fallback) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function getCheckedValue(name) {
  return Boolean(document.querySelector(`input[name="${name}"]`)?.checked);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function showLoadError(error) {
  els.projectDescription.textContent = "Не удалось загрузить tests.json.";
  els.loadStatus.textContent = `Ошибка: ${error.message}. Запустите проект через локальный сервер, например: python -m http.server 8000`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
