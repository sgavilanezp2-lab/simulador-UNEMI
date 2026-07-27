(() => {
  "use strict";

  const STORAGE = {
    theme: "quizlab_theme",
    bank: "quizlab_custom_bank"
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const defaultBank = window.QUIZLAB_BANCO || { version: "1.0.0", materias: [] };

  const state = {
    bank: loadBank(),
    activeSubjectId: null,
    search: "",
    type: "all",
    topic: "all"
  };

  init();

  function init() {
    initTheme();
    state.activeSubjectId = state.bank.materias?.[0]?.id || null;
    bindEvents();
    renderAll();
  }

  function loadBank() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.bank));
      if (saved && Array.isArray(saved.materias)) return saved;
    } catch (error) {
      console.warn("Banco personalizado inválido:", error);
    }
    return clone(defaultBank);
  }

  function saveBank(message = "Cambios guardados") {
    state.bank.actualizado = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE.bank, JSON.stringify(state.bank));
    renderAll();
    showToast(message);
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

  function bindEvents() {
    $("#theme-toggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    $("#subject-select").addEventListener("change", (event) => {
      state.activeSubjectId = event.target.value || null;
      state.topic = "all";
      renderAll();
    });
    $("#new-question").addEventListener("click", () => openQuestionDialog());
    $("#new-subject").addEventListener("click", () => openSubjectDialog());
    $("#edit-subject").addEventListener("click", () => openSubjectDialog(activeSubject()));
    $("#delete-subject").addEventListener("click", deleteSubject);
    $("#search-input").addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      renderQuestions();
    });
    $("#type-filter").addEventListener("change", (event) => {
      state.type = event.target.value;
      renderQuestions();
    });
    $("#topic-filter").addEventListener("change", (event) => {
      state.topic = event.target.value;
      renderQuestions();
    });
    $("#question-type-select").addEventListener("change", () => renderOptionsEditor($("#question-type-select").value));
    $("#question-form").addEventListener("submit", saveQuestionFromForm);
    $("#subject-form").addEventListener("submit", saveSubjectFromForm);
    $$(".dialog-close").forEach((button) => button.addEventListener("click", () => $("#question-dialog").close()));
    $$(".subject-close").forEach((button) => button.addEventListener("click", () => $("#subject-dialog").close()));
    $("#import-bank").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", importBank);
    $("#export-json").addEventListener("click", exportJson);
    $("#export-js").addEventListener("click", exportJs);
    $("#restore-default").addEventListener("click", restoreDefault);
  }

  function renderAll() {
    ensureActiveSubject();
    renderSubjectSelect();
    renderSummary();
    renderTopicFilter();
    renderQuestions();
    const subject = activeSubject();
    $("#active-subject-title").textContent = subject?.nombre || "No hay materias";
    $("#new-question").disabled = !subject;
    $("#edit-subject").disabled = !subject;
    $("#delete-subject").disabled = !subject;
  }

  function ensureActiveSubject() {
    if (!state.bank.materias?.some((subject) => subject.id === state.activeSubjectId)) {
      state.activeSubjectId = state.bank.materias?.[0]?.id || null;
    }
  }

  function activeSubject() {
    return state.bank.materias?.find((subject) => subject.id === state.activeSubjectId) || null;
  }

  function renderSubjectSelect() {
    const select = $("#subject-select");
    const subjects = state.bank.materias || [];
    select.innerHTML = subjects.length
      ? subjects.map((subject) => `<option value="${escapeHtml(subject.id)}" ${subject.id === state.activeSubjectId ? "selected" : ""}>${escapeHtml(subject.icono || "📘")} ${escapeHtml(subject.nombre)} (${subject.preguntas?.length || 0})</option>`).join("")
      : `<option value="">Sin materias</option>`;
    select.disabled = !subjects.length;
  }

  function renderSummary() {
    const subjects = state.bank.materias || [];
    const questions = subjects.reduce((sum, subject) => sum + (subject.preguntas?.length || 0), 0);
    const topics = new Set(subjects.flatMap((subject) => (subject.preguntas || []).map((question) => question.tema).filter(Boolean))).size;
    $("#summary-subjects").textContent = subjects.length;
    $("#summary-questions").textContent = questions;
    $("#summary-topics").textContent = topics;
  }

  function renderTopicFilter() {
    const select = $("#topic-filter");
    const subject = activeSubject();
    const topics = [...new Set((subject?.preguntas || []).map((question) => question.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    if (state.topic !== "all" && !topics.includes(state.topic)) state.topic = "all";
    select.innerHTML = `<option value="all">Todos los temas</option>` + topics.map((topic) => `<option value="${escapeHtml(topic)}" ${topic === state.topic ? "selected" : ""}>${escapeHtml(topic)}</option>`).join("");
  }

  function renderQuestions() {
    const list = $("#questions-list");
    const subject = activeSubject();
    if (!subject) {
      list.innerHTML = `<div class="empty-state"><strong>Crea tu primera materia</strong>Después podrás agregar preguntas desde este mismo panel.</div>`;
      $("#visible-count").textContent = "0 preguntas";
      return;
    }

    const filtered = (subject.preguntas || []).filter((question) => {
      const haystack = `${question.pregunta || ""} ${question.tema || ""} ${question.referencia || ""}`.toLowerCase();
      const matchesSearch = !state.search || haystack.includes(state.search);
      const matchesType = state.type === "all" || normalizeType(question) === state.type;
      const matchesTopic = state.topic === "all" || question.tema === state.topic;
      return matchesSearch && matchesType && matchesTopic;
    });

    $("#visible-count").textContent = `${filtered.length} ${filtered.length === 1 ? "pregunta" : "preguntas"}`;
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><strong>No se encontraron preguntas</strong>Prueba con otros filtros o agrega una nueva pregunta.</div>`;
      return;
    }

    list.innerHTML = filtered.map((question) => {
      const originalIndex = subject.preguntas.indexOf(question);
      return `
        <article class="manager-question-item">
          <span class="question-index">${String(originalIndex + 1).padStart(3, "0")}</span>
          <div class="question-info">
            <h3>${escapeHtml(question.pregunta)}</h3>
            <div class="question-meta">
              <span>${normalizeType(question) === "vf" ? "Verdadero/Falso" : "Selección múltiple"}</span>
              <span>${escapeHtml(question.tema || "Sin tema")}</span>
              ${question.referencia ? `<span>${escapeHtml(question.referencia)}</span>` : ""}
            </div>
          </div>
          <div class="item-actions">
            <button type="button" title="Editar" data-action="edit" data-id="${escapeHtml(question.id)}">✎</button>
            <button type="button" title="Duplicar" data-action="duplicate" data-id="${escapeHtml(question.id)}">⧉</button>
            <button class="delete" type="button" title="Eliminar" data-action="delete" data-id="${escapeHtml(question.id)}">⌫</button>
          </div>
        </article>`;
    }).join("");

    $$('[data-action="edit"]', list).forEach((button) => button.addEventListener("click", () => editQuestion(button.dataset.id)));
    $$('[data-action="duplicate"]', list).forEach((button) => button.addEventListener("click", () => duplicateQuestion(button.dataset.id)));
    $$('[data-action="delete"]', list).forEach((button) => button.addEventListener("click", () => deleteQuestion(button.dataset.id)));
  }

  function openQuestionDialog(question = null) {
    const subject = activeSubject();
    if (!subject) return;
    $("#question-form").reset();
    $("#question-id").value = question?.id || "";
    $("#question-dialog-title").textContent = question ? "Editar pregunta" : "Nueva pregunta";
    $("#question-text").value = question?.pregunta || "";
    $("#question-type-select").value = question ? normalizeType(question) : "multiple";
    $("#question-topic-input").value = question?.tema || "";
    $("#question-explanation").value = question?.explicacion || "";
    $("#question-reference").value = question?.referencia || "";
    renderOptionsEditor($("#question-type-select").value, question?.opciones, question?.correcta);
    $("#question-dialog").showModal();
    window.setTimeout(() => $("#question-text").focus(), 80);
  }

  function renderOptionsEditor(type, options = null, correct = 0) {
    const editor = $("#options-editor");
    const values = type === "vf" ? ["Verdadero", "Falso"] : (options?.length === 4 ? options : ["", "", "", ""]);
    const correctIndex = Number.isInteger(correct) && correct < values.length ? correct : 0;
    editor.innerHTML = values.map((value, index) => `
      <label class="option-editor-row">
        <input type="radio" name="correct-option" value="${index}" ${index === correctIndex ? "checked" : ""} aria-label="Marcar opción ${index + 1} como correcta">
        <input type="text" data-option-index="${index}" value="${escapeHtml(value)}" ${type === "vf" ? "readonly" : "required"} placeholder="Opción ${String.fromCharCode(65 + index)}">
      </label>`).join("");
  }

  function saveQuestionFromForm(event) {
    event.preventDefault();
    const subject = activeSubject();
    if (!subject) return;
    const type = $("#question-type-select").value;
    const optionInputs = $$('[data-option-index]', $("#options-editor"));
    const options = optionInputs.map((input) => input.value.trim());
    const correctInput = $('input[name="correct-option"]:checked', $("#options-editor"));
    if (!$("#question-text").value.trim() || !$("#question-topic-input").value.trim() || options.some((option) => !option) || !correctInput) {
      showToast("Completa los campos obligatorios");
      return;
    }

    const existingId = $("#question-id").value;
    const question = {
      id: existingId || uniqueQuestionId(subject),
      tipo: type,
      tema: $("#question-topic-input").value.trim(),
      pregunta: $("#question-text").value.trim(),
      opciones: options,
      correcta: Number(correctInput.value),
      explicacion: $("#question-explanation").value.trim(),
      referencia: $("#question-reference").value.trim()
    };

    if (existingId) {
      const index = subject.preguntas.findIndex((item) => item.id === existingId);
      if (index >= 0) subject.preguntas[index] = question;
    } else {
      subject.preguntas.push(question);
    }
    $("#question-dialog").close();
    saveBank(existingId ? "Pregunta actualizada" : "Pregunta agregada");
  }

  function editQuestion(id) {
    const question = activeSubject()?.preguntas?.find((item) => item.id === id);
    if (question) openQuestionDialog(question);
  }

  function duplicateQuestion(id) {
    const subject = activeSubject();
    const source = subject?.preguntas?.find((item) => item.id === id);
    if (!source) return;
    const copy = clone(source);
    copy.id = uniqueQuestionId(subject);
    copy.pregunta = `${copy.pregunta} (copia)`;
    subject.preguntas.push(copy);
    saveBank("Pregunta duplicada");
  }

  function deleteQuestion(id) {
    const subject = activeSubject();
    const question = subject?.preguntas?.find((item) => item.id === id);
    if (!question || !window.confirm(`¿Eliminar esta pregunta?\n\n${question.pregunta}`)) return;
    subject.preguntas = subject.preguntas.filter((item) => item.id !== id);
    saveBank("Pregunta eliminada");
  }

  function openSubjectDialog(subject = null) {
    $("#subject-form").reset();
    $("#subject-dialog-title").textContent = subject ? "Editar materia" : "Nueva materia";
    $("#subject-original-id").value = subject?.id || "";
    $("#subject-name").value = subject?.nombre || "";
    $("#subject-id").value = subject?.id || "";
    $("#subject-icon").value = subject?.icono || "📘";
    $("#subject-color").value = subject?.color || "#6d5dfc";
    $("#subject-description").value = subject?.descripcion || "";
    $("#subject-dialog").showModal();
    window.setTimeout(() => $("#subject-name").focus(), 80);
  }

  function saveSubjectFromForm(event) {
    event.preventDefault();
    const originalId = $("#subject-original-id").value;
    const name = $("#subject-name").value.trim();
    const id = slugify($("#subject-id").value.trim() || name);
    if (!name || !id) return showToast("Escribe un nombre e identificador válidos");
    const duplicate = state.bank.materias.some((subject) => subject.id === id && subject.id !== originalId);
    if (duplicate) return showToast("Ya existe una materia con ese identificador");

    if (originalId) {
      const subject = state.bank.materias.find((item) => item.id === originalId);
      if (!subject) return;
      subject.id = id;
      subject.nombre = name;
      subject.icono = $("#subject-icon").value.trim() || "📘";
      subject.color = $("#subject-color").value;
      subject.descripcion = $("#subject-description").value.trim();
      state.activeSubjectId = id;
    } else {
      state.bank.materias.push({
        id,
        nombre: name,
        descripcion: $("#subject-description").value.trim(),
        icono: $("#subject-icon").value.trim() || "📘",
        color: $("#subject-color").value,
        preguntas: []
      });
      state.activeSubjectId = id;
    }
    $("#subject-dialog").close();
    saveBank(originalId ? "Materia actualizada" : "Materia creada");
  }

  function deleteSubject() {
    const subject = activeSubject();
    if (!subject || !window.confirm(`¿Eliminar “${subject.nombre}” y sus ${subject.preguntas?.length || 0} preguntas?`)) return;
    state.bank.materias = state.bank.materias.filter((item) => item.id !== subject.id);
    state.activeSubjectId = state.bank.materias[0]?.id || null;
    saveBank("Materia eliminada");
  }

  async function importBank(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (Array.isArray(parsed)) {
        const subject = activeSubject();
        if (!subject) throw new Error("Crea una materia antes de importar un arreglo de preguntas.");
        const normalized = [];
        parsed.forEach((question, index) => {
          const item = normalizeImportedQuestion(question, subject, index, `${subject.id}-import-${Date.now()}-${index + 1}`);
          normalized.push(item);
          subject.preguntas.push(item);
        });
        saveBank(`${normalized.length} preguntas importadas`);
        return;
      }
      if (!parsed || !Array.isArray(parsed.materias)) throw new Error("El JSON debe contener una propiedad 'materias' o un arreglo de preguntas.");
      parsed.materias.forEach(validateSubject);
      if (!window.confirm("Este archivo reemplazará el banco guardado en este navegador. ¿Continuar?")) return;
      state.bank = parsed;
      state.activeSubjectId = parsed.materias[0]?.id || null;
      saveBank("Banco importado correctamente");
    } catch (error) {
      console.error(error);
      window.alert(`No se pudo importar el archivo:\n${error.message}`);
    }
  }

  function normalizeImportedQuestion(question, subject, index, generatedId = null) {
    if (!question?.pregunta || !Array.isArray(question.opciones) || question.opciones.length < 2) {
      throw new Error(`La pregunta ${index + 1} no tiene el formato requerido.`);
    }
    const correct = Number(question.correcta ?? question.respuesta);
    if (!Number.isInteger(correct) || correct < 0 || correct >= question.opciones.length) {
      throw new Error(`La pregunta ${index + 1} no tiene un índice de respuesta correcto.`);
    }
    return {
      id: question.id || generatedId || `${subject.id}-${String(index + 1).padStart(3, "0")}`,
      tipo: question.tipo || (question.opciones.length === 2 ? "vf" : "multiple"),
      tema: question.tema || "Sin tema",
      pregunta: String(question.pregunta).trim(),
      opciones: question.opciones.map((option) => String(option).trim()),
      correcta: correct,
      explicacion: question.explicacion || "",
      referencia: question.referencia || ""
    };
  }

  function validateSubject(subject, subjectIndex) {
    if (!subject?.id || !subject?.nombre || !Array.isArray(subject.preguntas)) {
      throw new Error(`La materia ${subjectIndex + 1} no tiene el formato requerido.`);
    }
    subject.preguntas = subject.preguntas.map((question, index) => normalizeImportedQuestion(question, subject, index, `${subject.id}-${String(index + 1).padStart(3, "0")}`));
  }

  function exportJson() {
    downloadFile("quizlab-banco-preguntas.json", JSON.stringify(state.bank, null, 2), "application/json");
    showToast("Archivo JSON generado");
  }

  function exportJs() {
    const content = `window.QUIZLAB_BANCO = ${JSON.stringify(state.bank, null, 2)};\n`;
    downloadFile("banco-preguntas.js", content, "text/javascript");
    showToast("Reemplaza el archivo de la carpeta data");
  }

  function restoreDefault() {
    if (!window.confirm("¿Restaurar el banco incluido originalmente? Se perderán los cambios locales no exportados.")) return;
    localStorage.removeItem(STORAGE.bank);
    state.bank = clone(defaultBank);
    state.activeSubjectId = state.bank.materias[0]?.id || null;
    renderAll();
    showToast("Banco original restaurado");
  }

  function uniqueQuestionId(subject) {
    const base = subject.id || "pregunta";
    let number = (subject.preguntas?.length || 0) + 1;
    let id = `${base}-${String(number).padStart(3, "0")}`;
    const ids = new Set((subject.preguntas || []).map((question) => question.id));
    while (ids.has(id)) {
      number += 1;
      id = `${base}-${String(number).padStart(3, "0")}`;
    }
    return id;
  }

  function normalizeType(question) {
    return question.tipo || (question.opciones?.length === 2 ? "vf" : "multiple");
  }

  function slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 1900);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
