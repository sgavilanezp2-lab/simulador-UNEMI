(() => {
  "use strict";

  const STORAGE = {
    theme: "quizlab_theme",
    bank: "quizlab_custom_bank",
    progress: "quizlab_progress_v1",
    history: "quizlab_history_v1"
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const defaultBank = window.QUIZLAB_BANCO || { version: "1.0.0", materias: [] };
  const bank = loadBank();

  const state = {
    selectedSubjectId: null,
    subject: null,
    config: null,
    questions: [],
    answers: {},
    marked: new Set(),
    current: 0,
    startedAt: null,
    elapsedBeforeResume: 0,
    remainingSeconds: 0,
    timerId: null,
    result: null,
    reviewFilter: "all",
    remoteAttemptId: null,
    remoteAttemptPromise: null,
    questionEnteredAt: null,
    questionDurations: {}
  };

  const screens = {
    home: $("#screen-home"),
    quiz: $("#screen-quiz"),
    results: $("#screen-results")
  };

  init();

  function init() {
    initTheme();
    renderSubjects();
    updateStats();
    updateResumePanel();
    bindEvents();
    registerServiceWorker();
  }

  function loadBank() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.bank));
      if (saved && Array.isArray(saved.materias)) return saved;
    } catch (error) {
      console.warn("No se pudo cargar el banco personalizado:", error);
    }
    return clone(defaultBank);
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE.theme);
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (systemDark ? "dark" : "light"));
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#theme-icon").textContent = theme === "dark" ? "☀" : "☾";
    localStorage.setItem(STORAGE.theme, theme);
  }

  function renderSubjects() {
    const grid = $("#subject-grid");
    grid.innerHTML = "";
    const materias = bank.materias || [];
    $("#subject-count").textContent = `${materias.length} ${materias.length === 1 ? "disponible" : "disponibles"}`;
    $("#stat-questions").textContent = materias.reduce((sum, item) => sum + (item.preguntas?.length || 0), 0);

    if (!materias.length) {
      grid.innerHTML = `
        <div class="subject-card">
          <span class="subject-icon">＋</span>
          <h3>No hay materias todavía</h3>
          <p>Abre el gestor para crear o importar tu primer banco de preguntas.</p>
          <div class="subject-meta"><strong>Gestor</strong><span>gestor.html</span></div>
        </div>`;
      return;
    }

    materias.forEach((subject) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "subject-card";
      card.dataset.subjectId = subject.id;
      card.style.setProperty("--subject-color", subject.color || "#6d5dfc");
      card.innerHTML = `
        <span class="subject-icon">${escapeHtml(subject.icono || "📘")}</span>
        <h3>${escapeHtml(subject.nombre)}</h3>
        <p>${escapeHtml(subject.descripcion || "Banco de preguntas disponible para practicar.")}</p>
        <div class="subject-meta">
          <strong>${subject.preguntas?.length || 0} preguntas</strong>
          <span>${countTopics(subject)} temas</span>
        </div>`;
      card.addEventListener("click", () => selectSubject(subject.id));
      grid.appendChild(card);
    });

    if (materias.length === 1) selectSubject(materias[0].id);
  }

  function countTopics(subject) {
    return new Set((subject.preguntas || []).map((q) => q.tema).filter(Boolean)).size;
  }

  function selectSubject(subjectId) {
    const subject = bank.materias.find((item) => item.id === subjectId);
    if (!subject) return;
    state.selectedSubjectId = subjectId;
    state.subject = subject;
    $$(".subject-card").forEach((card) => card.classList.toggle("selected", card.dataset.subjectId === subjectId));
    $("#selected-subject-label").textContent = subject.nombre;
    $("#start-quiz").disabled = !(subject.preguntas?.length > 0);
    updateStartSummary();
  }

  function updateStartSummary() {
    if (!state.subject) return;
    const mode = $("input[name='mode']:checked").value;
    const limitValue = $("#question-limit").value;
    const available = state.subject.preguntas.length;
    const amount = limitValue === "all" ? available : Math.min(Number(limitValue), available);
    const timer = Number($("#timer-select").value);
    $("#start-summary-icon").textContent = mode === "study" ? "📚" : "🧠";
    $("#start-summary-text").textContent = `${amount} preguntas · ${mode === "study" ? "modo estudio" : "modo examen"} · ${timer ? `${timer} minutos` : "sin límite de tiempo"}.`;
  }

  function bindEvents() {
    $("#theme-toggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
    });

    $$("input[name='mode']").forEach((input) => {
      input.addEventListener("change", () => {
        $$(".choice-card").forEach((card) => card.classList.toggle("selected", card.contains($("input:checked", card))));
        updateStartSummary();
      });
    });

    $("#question-limit").addEventListener("change", updateStartSummary);
    $("#timer-select").addEventListener("change", updateStartSummary);
    $("#start-quiz").addEventListener("click", startConfiguredQuiz);
    $("#previous-question").addEventListener("click", () => goToQuestion(state.current - 1));
    $("#next-question").addEventListener("click", handleNext);
    $("#finish-quiz-side").addEventListener("click", () => requestFinish(false));
    $("#mark-question").addEventListener("click", toggleMarked);
    $("#open-palette").addEventListener("click", openPalette);
    $("#close-palette").addEventListener("click", () => $("#palette-dialog").close());
    $("#back-home").addEventListener("click", () => showScreen("home"));
    $("#retry-quiz").addEventListener("click", retryQuiz);
    $("#retry-wrong").addEventListener("click", retryWrong);
    $("#resume-quiz").addEventListener("click", resumeQuiz);
    $("#discard-progress").addEventListener("click", discardProgress);

    $$(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.reviewFilter = button.dataset.filter;
        $$(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
        renderReview();
      });
    });

    window.addEventListener("beforeunload", () => {
      if (screens.quiz.classList.contains("active")) saveProgress();
    });
  }

  async function startConfiguredQuiz() {
    if (!state.subject?.preguntas?.length) return;
    const startButton = $("#start-quiz");
    startButton.disabled = true;
    const originalText = startButton.innerHTML;
    startButton.textContent = "Preparando intento…";
    try {
      await window.QuizLabTracker?.ensureParticipant();
      const mode = $("input[name='mode']:checked").value;
      const limitValue = $("#question-limit").value;
      const available = state.subject.preguntas.length;
      const amount = limitValue === "all" ? available : Math.min(Number(limitValue), available);
      const timerMinutes = Number($("#timer-select").value);
      const config = {
        mode,
        amount,
        timerMinutes,
        shuffleOptions: $("#shuffle-options").checked,
        subjectId: state.subject.id
      };
      const source = shuffle(clone(state.subject.preguntas)).slice(0, amount);
      beginQuiz(source, config, true);
    } catch (error) {
      console.error(error);
      showToast("No se pudo iniciar el registro del intento");
    } finally {
      startButton.disabled = false;
      startButton.innerHTML = originalText;
    }
  }

  function beginQuiz(sourceQuestions, config, transformOptions = true) {
    clearTimer();
    state.config = { ...config };
    state.questions = sourceQuestions.map((question) => transformOptions ? prepareQuestion(question, config.shuffleOptions) : clone(question));
    state.answers = {};
    state.marked = new Set();
    state.current = 0;
    state.startedAt = Date.now();
    state.elapsedBeforeResume = 0;
    state.remainingSeconds = config.timerMinutes * 60;
    state.result = null;
    state.reviewFilter = "all";
    state.remoteAttemptId = null;
    state.remoteAttemptPromise = null;
    state.questionEnteredAt = Date.now();
    state.questionDurations = {};
    renderQuizHeader();
    showScreen("quiz");
    startTimer();
    renderQuestion();
    createRemoteAttempt();
    saveProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createRemoteAttempt() {
    const subject = bank.materias.find((item) => item.id === state.config.subjectId) || state.subject;
    state.remoteAttemptPromise = Promise.resolve(window.QuizLabTracker?.startAttempt({
      subjectId: state.config.subjectId,
      subjectName: subject?.nombre || "Cuestionario",
      mode: state.config.mode,
      totalQuestions: state.questions.length,
      timerMinutes: state.config.timerMinutes,
      shuffleOptions: state.config.shuffleOptions
    })).then((id) => {
      state.remoteAttemptId = id || null;
      saveProgress();
      return state.remoteAttemptId;
    });
    return state.remoteAttemptPromise;
  }

  function prepareQuestion(question, shouldShuffleOptions) {
    const prepared = clone(question);
    if (!shouldShuffleOptions || !Array.isArray(prepared.opciones)) return prepared;
    const pairs = prepared.opciones.map((text, index) => ({ text, correct: index === prepared.correcta }));
    const shuffled = shuffle(pairs);
    prepared.opciones = shuffled.map((item) => item.text);
    prepared.correcta = shuffled.findIndex((item) => item.correct);
    return prepared;
  }

  function renderQuizHeader() {
    const subject = bank.materias.find((item) => item.id === state.config.subjectId) || state.subject;
    state.subject = subject;
    $("#quiz-subject-icon").textContent = subject?.icono || "📘";
    $("#quiz-subject-name").textContent = subject?.nombre || "Cuestionario";
    $("#quiz-mode-label").textContent = state.config.mode === "study" ? "Modo estudio" : "Modo examen";
    $("#timer-card").classList.toggle("hidden", !state.config.timerMinutes);
  }

  function renderQuestion() {
    const question = state.questions[state.current];
    if (!question) return;
    const answer = state.answers[state.current];
    const isStudyAnswered = state.config.mode === "study" && answer !== undefined;

    $("#question-number").textContent = `Pregunta ${state.current + 1}`;
    $("#quiz-question").textContent = question.pregunta;
    $("#question-topic").textContent = question.tema || "Tema general";
    $("#question-type").textContent = question.tipo === "vf" ? "Verdadero o falso" : "Selección múltiple";
    $("#progress-label").textContent = `${state.current + 1} / ${state.questions.length}`;
    $("#quiz-progress-bar").style.width = `${((state.current + 1) / state.questions.length) * 100}%`;

    const list = $("#options-list");
    list.innerHTML = "";
    question.opciones.forEach((option, index) => {
      const selected = answer === index;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
      button.innerHTML = `
        <span class="option-letter">${String.fromCharCode(65 + index)}</span>
        <span>${escapeHtml(option)}</span>
        <span class="option-status" aria-hidden="true"></span>`;

      if (selected) button.classList.add("selected");
      if (isStudyAnswered) {
        button.disabled = true;
        if (index === question.correcta) {
          button.classList.add("correct");
          $(".option-status", button).textContent = "✓";
        } else if (selected) {
          button.classList.add("incorrect");
          $(".option-status", button).textContent = "×";
        }
      }
      button.addEventListener("click", () => answerQuestion(index));
      list.appendChild(button);
    });

    renderFeedback(question, answer);
    updateMarkButton();
    $("#previous-question").disabled = state.current === 0;
    $("#next-question").textContent = state.current === state.questions.length - 1 ? "Finalizar intento →" : "Siguiente →";
    saveProgress();
  }

  function answerQuestion(optionIndex) {
    if (state.config.mode === "study" && state.answers[state.current] !== undefined) return;
    state.answers[state.current] = optionIndex;
    renderQuestion();
    syncRemoteProgress();
    showToast("Respuesta guardada");
  }

  function syncRemoteProgress() {
    window.QuizLabTracker?.updateAttemptProgress(state.remoteAttemptId, {
      answered: Object.keys(state.answers).length,
      currentQuestion: state.current + 1,
      marked: state.marked.size
    });
  }

  function renderFeedback(question, answer) {
    const box = $("#feedback-box");
    if (state.config.mode !== "study" || answer === undefined) {
      box.className = "feedback-box hidden";
      box.innerHTML = "";
      return;
    }
    const correct = answer === question.correcta;
    box.className = `feedback-box${correct ? "" : " error"}`;
    const explanation = question.explicacion || (question.referencia ? `Consulta: ${question.referencia}.` : "");
    box.innerHTML = `
      <strong>${correct ? "¡Respuesta correcta!" : "Respuesta incorrecta"}</strong>
      <p>${escapeHtml(explanation)}${question.referencia && !explanation.includes(question.referencia) ? ` · ${escapeHtml(question.referencia)}` : ""}</p>`;
  }

  function handleNext() {
    if (state.current === state.questions.length - 1) {
      requestFinish(true);
      return;
    }
    goToQuestion(state.current + 1);
  }

  function goToQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    accumulateQuestionTime();
    state.current = index;
    state.questionEnteredAt = Date.now();
    renderQuestion();
    syncRemoteProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function accumulateQuestionTime() {
    if (!state.questionEnteredAt || !state.questions.length) return;
    const seconds = Math.max(0, Math.round((Date.now() - state.questionEnteredAt) / 1000));
    state.questionDurations[state.current] = (state.questionDurations[state.current] || 0) + seconds;
    state.questionEnteredAt = Date.now();
  }

  function toggleMarked() {
    if (state.marked.has(state.current)) state.marked.delete(state.current);
    else state.marked.add(state.current);
    updateMarkButton();
    syncRemoteProgress();
    saveProgress();
  }

  function updateMarkButton() {
    const button = $("#mark-question");
    const active = state.marked.has(state.current);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.innerHTML = `<span aria-hidden="true">${active ? "★" : "☆"}</span> ${active ? "Marcada" : "Marcar para revisar"}`;
  }

  function openPalette() {
    const palette = $("#question-palette");
    palette.innerHTML = "";
    state.questions.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-button";
      button.textContent = index + 1;
      button.classList.toggle("answered", state.answers[index] !== undefined);
      button.classList.toggle("current", index === state.current);
      button.classList.toggle("marked", state.marked.has(index));
      button.addEventListener("click", () => {
        $("#palette-dialog").close();
        goToQuestion(index);
      });
      palette.appendChild(button);
    });
    $("#palette-dialog").showModal();
  }

  function requestFinish(fromLastQuestion) {
    const unanswered = state.questions.length - Object.keys(state.answers).length;
    const marked = state.marked.size;
    const details = [
      unanswered ? `${unanswered} sin responder` : "todas respondidas",
      marked ? `${marked} marcadas para revisar` : null
    ].filter(Boolean).join(" y ");
    const message = fromLastQuestion && !unanswered && !marked
      ? "¿Finalizar el intento y ver los resultados?"
      : `Tienes ${details}. ¿Deseas finalizar de todos modos?`;
    if (window.confirm(message)) finishQuiz();
  }

  function finishQuiz() {
    clearTimer();
    accumulateQuestionTime();
    const elapsed = getElapsedSeconds();
    const rows = state.questions.map((question, index) => {
      const answer = state.answers[index];
      return {
        question,
        answer,
        status: answer === undefined ? "blank" : answer === question.correcta ? "correct" : "wrong"
      };
    });
    const correct = rows.filter((row) => row.status === "correct").length;
    const wrong = rows.filter((row) => row.status === "wrong").length;
    const blank = rows.filter((row) => row.status === "blank").length;
    const percent = Math.round((correct / rows.length) * 100);
    state.result = { rows, correct, wrong, blank, percent, elapsed };
    saveRemoteResult(rows);
    localStorage.removeItem(STORAGE.progress);
    saveHistory(state.result);
    renderResults();
    updateStats();
    updateResumePanel();
    showScreen("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveRemoteResult(rows) {
    const subject = bank.materias.find((item) => item.id === state.config.subjectId) || state.subject;
    const responses = rows.map((row, index) => ({
      numero: index + 1,
      idPregunta: row.question.id || "",
      tema: row.question.tema || "",
      pregunta: row.question.pregunta,
      seleccionIndice: row.answer === undefined ? null : row.answer,
      seleccionTexto: row.answer === undefined ? "Sin responder" : row.question.opciones[row.answer],
      correctaIndice: row.question.correcta,
      correctaTexto: row.question.opciones[row.question.correcta],
      estado: row.status,
      tiempoSegundos: Number(state.questionDurations[index]) || 0,
      referencia: row.question.referencia || ""
    }));
    Promise.resolve(state.remoteAttemptId || state.remoteAttemptPromise)
      .then((attemptId) => window.QuizLabTracker?.completeAttempt(attemptId || null, {
        subjectId: state.config.subjectId,
        subjectName: subject?.nombre || "Cuestionario",
        mode: state.config.mode,
        timerMinutes: state.config.timerMinutes,
        shuffleOptions: state.config.shuffleOptions,
        total: rows.length,
        elapsed: state.result.elapsed,
        correct: state.result.correct,
        wrong: state.result.wrong,
        blank: state.result.blank,
        percent: state.result.percent,
        responses
      }));
  }

  function renderResults() {
    const result = state.result;
    $("#score-ring").style.setProperty("--score", result.percent);
    $("#score-percent").textContent = `${result.percent}%`;
    $("#result-correct").textContent = result.correct;
    $("#result-wrong").textContent = result.wrong;
    $("#result-blank").textContent = result.blank;
    $("#result-time").textContent = formatTime(result.elapsed);
    $("#results-title").textContent = result.percent >= 90 ? "¡Excelente dominio!" : result.percent >= 70 ? "¡Muy buen trabajo!" : result.percent >= 50 ? "Vas por buen camino" : "Cada intento cuenta";
    $("#results-message").textContent = result.percent >= 70
      ? "Tu resultado muestra un buen manejo del contenido. Revisa los pocos errores para reforzar lo aprendido."
      : "Revisa las respuestas incorrectas y repite el cuestionario para consolidar los temas más difíciles.";
    $("#retry-wrong").disabled = result.wrong + result.blank === 0;
    state.reviewFilter = "all";
    $$(".filter-button").forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
    renderReview();
  }

  function renderReview() {
    const list = $("#review-list");
    if (!state.result) return;
    const rows = state.result.rows.filter((row) => state.reviewFilter === "all" || row.status === state.reviewFilter);
    if (!rows.length) {
      list.innerHTML = `<article class="review-item"><h3>No hay respuestas en este filtro.</h3><p>Selecciona otro filtro para continuar con la revisión.</p></article>`;
      return;
    }
    list.innerHTML = rows.map((row, index) => {
      const question = row.question;
      const originalIndex = state.result.rows.indexOf(row);
      const userAnswer = row.answer === undefined ? "Sin responder" : question.opciones[row.answer];
      const correctAnswer = question.opciones[question.correcta];
      const labels = { correct: "Correcta", wrong: "Incorrecta", blank: "Sin responder" };
      return `
        <article class="review-item" data-status="${row.status}">
          <div class="review-item-head">
            <h3>${originalIndex + 1}. ${escapeHtml(question.pregunta)}</h3>
            <span class="review-state ${row.status}">${labels[row.status]}</span>
          </div>
          <div class="review-answer">
            <span><strong>Tu respuesta:</strong> ${escapeHtml(userAnswer)}</span>
            <span><strong>Respuesta correcta:</strong> ${escapeHtml(correctAnswer)}</span>
          </div>
          ${question.explicacion || question.referencia ? `<p>${escapeHtml(question.explicacion || "")}${question.referencia ? ` · ${escapeHtml(question.referencia)}` : ""}</p>` : ""}
        </article>`;
    }).join("");
  }

  function retryQuiz() {
    const source = state.questions.map((question) => clone(question));
    beginQuiz(source, state.config, false);
  }

  function retryWrong() {
    const source = state.result.rows.filter((row) => row.status !== "correct").map((row) => clone(row.question));
    if (!source.length) return;
    const config = { ...state.config, amount: source.length, timerMinutes: 0 };
    beginQuiz(source, config, false);
  }

  function startTimer() {
    updateTimerDisplay();
    state.timerId = window.setInterval(() => {
      if (state.config.timerMinutes) {
        state.remainingSeconds -= 1;
        if (state.remainingSeconds <= 0) {
          state.remainingSeconds = 0;
          updateTimerDisplay();
          showToast("El tiempo terminó");
          finishQuiz();
          return;
        }
        updateTimerDisplay();
      }
      const currentSecond = Math.floor(Date.now() / 1000);
      if (currentSecond % 10 === 0) saveProgress();
      if (currentSecond % 60 === 0) syncRemoteProgress();
    }, 1000);
  }

  function clearTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function updateTimerDisplay() {
    if (!state.config?.timerMinutes) return;
    $("#timer-display").textContent = formatTime(state.remainingSeconds);
    $("#timer-card").classList.toggle("warning", state.remainingSeconds <= 300);
  }

  function getElapsedSeconds() {
    if (!state.startedAt) return state.elapsedBeforeResume || 0;
    return state.elapsedBeforeResume + Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  }

  function saveProgress() {
    if (!state.config || !state.questions.length || !screens.quiz.classList.contains("active")) return;
    const payload = {
      config: state.config,
      questions: state.questions,
      answers: state.answers,
      marked: [...state.marked],
      current: state.current,
      elapsed: getElapsedSeconds(),
      remainingSeconds: state.remainingSeconds,
      remoteAttemptId: state.remoteAttemptId,
      questionDurations: state.questionDurations,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE.progress, JSON.stringify(payload));
    } catch (error) {
      console.warn("No se pudo guardar el progreso:", error);
    }
  }

  function readProgress() {
    try {
      const progress = JSON.parse(localStorage.getItem(STORAGE.progress));
      return progress?.questions?.length ? progress : null;
    } catch {
      return null;
    }
  }

  function updateResumePanel() {
    const progress = readProgress();
    const panel = $("#resume-panel");
    panel.classList.toggle("hidden", !progress);
    if (!progress) return;
    const subject = bank.materias.find((item) => item.id === progress.config.subjectId);
    const answered = Object.keys(progress.answers || {}).length;
    $("#resume-copy").textContent = `${subject?.nombre || "Cuestionario"}: ${answered} de ${progress.questions.length} preguntas respondidas.`;
  }

  function resumeQuiz() {
    const progress = readProgress();
    if (!progress) return;
    clearTimer();
    state.config = progress.config;
    state.questions = progress.questions;
    state.answers = progress.answers || {};
    state.marked = new Set(progress.marked || []);
    state.current = Math.min(progress.current || 0, state.questions.length - 1);
    state.elapsedBeforeResume = progress.elapsed || 0;
    state.startedAt = Date.now();
    state.remainingSeconds = progress.remainingSeconds || 0;
    state.remoteAttemptId = progress.remoteAttemptId || null;
    state.remoteAttemptPromise = state.remoteAttemptId ? Promise.resolve(state.remoteAttemptId) : null;
    state.questionDurations = progress.questionDurations || {};
    state.questionEnteredAt = Date.now();
    state.result = null;
    if (!state.remoteAttemptId) createRemoteAttempt();
    renderQuizHeader();
    startTimer();
    showScreen("quiz");
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function discardProgress() {
    if (!window.confirm("¿Eliminar el intento guardado?")) return;
    const progress = readProgress();
    window.QuizLabTracker?.discardAttempt(progress?.remoteAttemptId || null);
    localStorage.removeItem(STORAGE.progress);
    updateResumePanel();
    showToast("Intento descartado");
  }

  function saveHistory(result) {
    const history = readHistory();
    history.unshift({
      date: new Date().toISOString(),
      subjectId: state.config.subjectId,
      percent: result.percent,
      correct: result.correct,
      total: result.rows.length,
      elapsed: result.elapsed
    });
    localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 50)));
  }

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE.history));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function updateStats() {
    const history = readHistory();
    const best = history.length ? Math.max(...history.map((item) => item.percent || 0)) : 0;
    $("#stat-completed").textContent = history.length;
    $("#stat-best").textContent = `${best}%`;
    $("#home-progress-bar").style.width = `${best}%`;
    $("#home-progress-copy").textContent = history.length
      ? `Tu mejor resultado hasta ahora es ${best}%.`
      : "Completa tu primer intento para ver estadísticas.";
    $("#welcome-message").textContent = history.length ? "Sigue superando tu marca" : "Listo para practicar";
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, element]) => element.classList.toggle("active", key === name));
    if (name !== "quiz") clearTimer();
    if (name === "home") updateResumePanel();
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return hours
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service Worker:", error));
    }
  }
})();
