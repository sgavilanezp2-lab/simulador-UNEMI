(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const state = {
    attempts: [],
    participants: [],
    sessions: [],
    activeTab: "attempts",
    listeners: []
  };

  initTheme();
  bindEvents();
  if (window.auth && window.db) {
    observeAuth();
  } else {
    showLogin("No se pudo cargar Firebase. Revisa la conexión a internet.");
    $("#admin-login-button").disabled = true;
  }

  function initTheme() {
    const saved = localStorage.getItem("quizlab_theme");
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (systemDark ? "dark" : "light"));
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#admin-theme-icon").textContent = theme === "dark" ? "☀" : "☾";
    localStorage.setItem("quizlab_theme", theme);
  }

  function bindEvents() {
    $("#admin-theme-toggle").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    $("#admin-login-button").addEventListener("click", loginWithGoogle);
    $("#admin-logout").addEventListener("click", () => auth.signOut());
    $("#admin-refresh").addEventListener("click", loadRealtimeData);
    $("#export-csv").addEventListener("click", exportCurrentView);
    $("#detail-close").addEventListener("click", () => $("#attempt-detail-dialog").close());

    ["#filter-search", "#filter-status", "#filter-from", "#filter-to"].forEach((selector) => {
      $(selector).addEventListener("input", renderActivePanel);
      $(selector).addEventListener("change", renderActivePanel);
    });

    $$(".admin-tab").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
  }

  function observeAuth() {
    auth.onAuthStateChanged(async (user) => {
      stopListeners();
      if (!user || user.isAnonymous) {
        showLogin();
        return;
      }

      const email = (user.email || "").toLowerCase();
      if (!isAdminEmail(email)) {
        showLogin(`El correo ${email || "seleccionado"} no tiene permiso de administrador.`);
        await auth.signOut();
        return;
      }

      $("#admin-user-label").textContent = email;
      $("#admin-login").classList.add("hidden");
      $("#admin-dashboard").classList.remove("hidden");
      loadRealtimeData();
    });
  }

  async function loginWithGoogle() {
    const button = $("#admin-login-button");
    const message = $("#admin-login-message");
    button.disabled = true;
    message.textContent = "";
    try {
      if (auth.currentUser?.isAnonymous) await auth.signOut();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await auth.signInWithPopup(provider);
    } catch (error) {
      console.error(error);
      message.textContent = friendlyAuthError(error);
    } finally {
      button.disabled = false;
    }
  }

  function showLogin(message = "") {
    $("#admin-login").classList.remove("hidden");
    $("#admin-dashboard").classList.add("hidden");
    $("#admin-login-message").textContent = message;
  }

  function isAdminEmail(email) {
    return (window.QUIZLAB_ADMIN_EMAILS || []).map((item) => item.toLowerCase()).includes(email);
  }

  function loadRealtimeData() {
    stopListeners();
    showToast("Actualizando datos…");

    state.listeners.push(
      db.collection("intentos").orderBy("fechaInicio", "desc").limit(1000).onSnapshot((snapshot) => {
        state.attempts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        updateStats();
        renderAttempts();
      }, handleFirestoreError),
      db.collection("participantes").orderBy("ultimoIngreso", "desc").limit(1000).onSnapshot((snapshot) => {
        state.participants = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        updateStats();
        renderParticipants();
      }, handleFirestoreError),
      db.collection("sesiones").orderBy("fechaIngreso", "desc").limit(1500).onSnapshot((snapshot) => {
        state.sessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        updateStats();
        renderSessions();
      }, handleFirestoreError)
    );
  }

  function stopListeners() {
    state.listeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") unsubscribe();
    });
    state.listeners = [];
  }

  function handleFirestoreError(error) {
    console.error(error);
    const message = error.code === "permission-denied"
      ? "Firestore rechazó la lectura. Publica las reglas incluidas en firestore.rules."
      : `Error al leer Firebase: ${error.message}`;
    showToast(message, true);
  }

  function updateStats() {
    const completed = state.attempts.filter((item) => item.estado === "completado");
    const average = completed.length
      ? Math.round(completed.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0) / completed.length)
      : 0;
    $("#stat-participants").textContent = state.participants.length;
    $("#stat-attempts").textContent = state.attempts.length;
    $("#stat-completed").textContent = completed.length;
    $("#stat-average").textContent = `${average}%`;
    $("#stat-sessions").textContent = state.sessions.length;
  }

  function switchTab(tab) {
    state.activeTab = tab;
    $$(".admin-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    $$(".admin-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${tab}`));
    $("#filter-status").disabled = tab !== "attempts";
    renderActivePanel();
  }

  function renderActivePanel() {
    if (state.activeTab === "attempts") renderAttempts();
    if (state.activeTab === "participants") renderParticipants();
    if (state.activeTab === "sessions") renderSessions();
  }

  function getFilters() {
    return {
      search: $("#filter-search").value.trim().toLowerCase(),
      status: $("#filter-status").value,
      from: $("#filter-from").value ? new Date(`${$("#filter-from").value}T00:00:00`) : null,
      to: $("#filter-to").value ? new Date(`${$("#filter-to").value}T23:59:59`) : null
    };
  }

  function matchesCommon(item, date) {
    const filters = getFilters();
    const haystack = [item.nombre, item.curso, item.correo, item.materiaNombre, item.navegador, item.referencia]
      .filter(Boolean).join(" ").toLowerCase();
    if (filters.search && !haystack.includes(filters.search)) return false;
    if (filters.from && (!date || date < filters.from)) return false;
    if (filters.to && (!date || date > filters.to)) return false;
    return true;
  }

  function getAttemptStatus(item) {
    if (item.estado !== "en_curso") return item.estado || "en_curso";
    const last = toDate(item.ultimaActividad) || toDate(item.fechaInicio);
    if (last && Date.now() - last.getTime() > 30 * 60 * 1000) return "posible_abandono";
    return "en_curso";
  }

  function filteredAttempts() {
    const filters = getFilters();
    return state.attempts.filter((item) => {
      const status = getAttemptStatus(item);
      const date = toDate(item.fechaInicio) || parseClientDate(item.fechaInicioCliente);
      return matchesCommon(item, date) && (filters.status === "all" || status === filters.status);
    });
  }

  function filteredParticipants() {
    return state.participants.filter((item) => {
      const date = toDate(item.primerIngreso) || toDate(item.ultimoIngreso) || parseClientDate(item.ultimoIngresoCliente);
      return matchesCommon(item, date);
    });
  }

  function filteredSessions() {
    return state.sessions.filter((item) => {
      const date = toDate(item.fechaIngreso) || parseClientDate(item.fechaIngresoCliente);
      return matchesCommon(item, date);
    });
  }

  function renderAttempts() {
    const items = filteredAttempts();
    const body = $("#attempts-body");
    $("#attempts-count-label").textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;
    $("#attempts-empty").classList.toggle("hidden", items.length > 0);
    body.innerHTML = items.map((item) => {
      const status = getAttemptStatus(item);
      return `
        <tr>
          <td>${formatDate(item.fechaInicio, item.fechaInicioCliente)}</td>
          <td class="person-cell"><strong>${escapeHtml(item.nombre || "Sin nombre")}</strong><small>${escapeHtml(item.correo || "Sin correo")}</small></td>
          <td>${escapeHtml(item.curso || "—")}</td>
          <td>${escapeHtml(item.materiaNombre || "Cuestionario")}</td>
          <td>${item.modo === "exam" ? "Examen" : "Estudio"}</td>
          <td><span class="status-pill status-${status}">${statusLabel(status)}</span></td>
          <td class="score-cell">${item.porcentaje === null || item.porcentaje === undefined ? "—" : `${Number(item.porcentaje)}%`}</td>
          <td>${formatDuration(item.duracionSegundos)}</td>
          <td><button class="detail-button" type="button" data-attempt-id="${item.id}">Ver detalle</button></td>
        </tr>`;
    }).join("");

    $$("[data-attempt-id]", body).forEach((button) => {
      button.addEventListener("click", () => openAttemptDetail(button.dataset.attemptId));
    });
  }

  function renderParticipants() {
    const items = filteredParticipants();
    const body = $("#participants-body");
    $("#participants-count-label").textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;
    $("#participants-empty").classList.toggle("hidden", items.length > 0);
    body.innerHTML = items.map((item) => `
      <tr>
        <td>${formatDate(item.primerIngreso)}</td>
        <td class="person-cell"><strong>${escapeHtml(item.nombre || "Sin nombre")}</strong><small>${shortUid(item.uid)}</small></td>
        <td>${escapeHtml(item.curso || "—")}</td>
        <td>${escapeHtml(item.correo || item.correoFirebase || "—")}</td>
        <td>${Number(item.totalIngresos || 1)}</td>
        <td>${formatDate(item.ultimoIngreso, item.ultimoIngresoCliente)}</td>
        <td>${item.anonimoFirebase ? "Anónima" : "Google"}</td>
      </tr>`).join("");
  }

  function renderSessions() {
    const items = filteredSessions();
    const body = $("#sessions-body");
    $("#sessions-count-label").textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;
    $("#sessions-empty").classList.toggle("hidden", items.length > 0);
    body.innerHTML = items.map((item) => `
      <tr>
        <td>${formatDate(item.fechaIngreso, item.fechaIngresoCliente)}</td>
        <td class="person-cell"><strong>${escapeHtml(item.nombre || "Sin nombre")}</strong><small>${escapeHtml(item.correo || "")}</small></td>
        <td>${escapeHtml(item.curso || "—")}</td>
        <td title="${escapeHtml(item.navegador || "")}">${escapeHtml(deviceSummary(item.navegador, item.plataforma))}</td>
        <td>${escapeHtml(item.pantalla || "—")}</td>
        <td>${escapeHtml(item.referencia || "Acceso directo")}</td>
        <td>${formatDate(item.ultimaActividad)}</td>
      </tr>`).join("");
  }

  function openAttemptDetail(id) {
    const item = state.attempts.find((attempt) => attempt.id === id);
    if (!item) return;
    const status = getAttemptStatus(item);
    $("#detail-title").textContent = `${item.nombre || "Participante"} · ${item.materiaNombre || "Cuestionario"}`;
    $("#detail-summary").innerHTML = [
      ["Resultado", item.porcentaje === null || item.porcentaje === undefined ? "—" : `${item.porcentaje}%`],
      ["Correctas", item.correctas ?? "—"],
      ["Incorrectas", item.incorrectas ?? "—"],
      ["Sin responder", item.sinResponder ?? "—"],
      ["Duración", formatDuration(item.duracionSegundos)],
      ["Estado", statusLabel(status)]
    ].map(([label, value]) => `<article><strong>${escapeHtml(value)}</strong><small>${label}</small></article>`).join("");

    const responses = Array.isArray(item.respuestas) ? item.respuestas : [];
    $("#detail-responses").innerHTML = responses.length
      ? responses.map((response) => `
        <article class="detail-response ${response.estado || "blank"}">
          <h3>${Number(response.numero) || ""}. ${escapeHtml(response.pregunta || "Pregunta")}</h3>
          <div class="detail-answer-grid">
            <span><strong>Respuesta:</strong> ${escapeHtml(response.seleccionTexto || "Sin responder")}</span>
            <span><strong>Correcta:</strong> ${escapeHtml(response.correctaTexto || "—")}</span>
            <span><strong>Tiempo:</strong> ${formatDuration(response.tiempoSegundos)}</span>
          </div>
        </article>`).join("")
      : `<div class="empty-state">Este intento todavía no tiene detalle de respuestas. Puede estar en curso o haber sido registrado antes de activar el seguimiento.</div>`;

    $("#attempt-detail-dialog").showModal();
  }

  function exportCurrentView() {
    let rows;
    let filename;
    if (state.activeTab === "attempts") {
      filename = "quizlab-intentos.csv";
      rows = filteredAttempts().map((item) => ({
        fecha: formatDate(item.fechaInicio, item.fechaInicioCliente),
        nombre: item.nombre || "",
        curso: item.curso || "",
        correo: item.correo || "",
        materia: item.materiaNombre || "",
        modo: item.modo || "",
        estado: statusLabel(getAttemptStatus(item)),
        total_preguntas: item.totalPreguntas ?? "",
        correctas: item.correctas ?? "",
        incorrectas: item.incorrectas ?? "",
        sin_responder: item.sinResponder ?? "",
        porcentaje: item.porcentaje ?? "",
        duracion_segundos: item.duracionSegundos ?? ""
      }));
    } else if (state.activeTab === "participants") {
      filename = "quizlab-participantes.csv";
      rows = filteredParticipants().map((item) => ({
        primer_ingreso: formatDate(item.primerIngreso),
        nombre: item.nombre || "",
        curso: item.curso || "",
        correo: item.correo || item.correoFirebase || "",
        total_ingresos: item.totalIngresos || 1,
        ultimo_ingreso: formatDate(item.ultimoIngreso, item.ultimoIngresoCliente),
        tipo_sesion: item.anonimoFirebase ? "Anónima" : "Google"
      }));
    } else {
      filename = "quizlab-ingresos.csv";
      rows = filteredSessions().map((item) => ({
        fecha_ingreso: formatDate(item.fechaIngreso, item.fechaIngresoCliente),
        nombre: item.nombre || "",
        curso: item.curso || "",
        correo: item.correo || "",
        dispositivo: deviceSummary(item.navegador, item.plataforma),
        pantalla: item.pantalla || "",
        origen: item.referencia || "",
        ultima_actividad: formatDate(item.ultimaActividad)
      }));
    }

    if (!rows.length) {
      showToast("No hay registros para exportar", true);
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Archivo CSV descargado");
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseClientDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value, fallback) {
    const date = toDate(value) || parseClientDate(fallback);
    if (!date) return "—";
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function formatDuration(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined || totalSeconds === "") return "—";
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return hours
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function statusLabel(status) {
    return {
      completado: "Completado",
      en_curso: "En curso",
      descartado: "Descartado",
      posible_abandono: "Posible abandono"
    }[status] || status;
  }

  function deviceSummary(userAgent = "", platform = "") {
    let browser = "Navegador";
    if (/Edg\//.test(userAgent)) browser = "Edge";
    else if (/OPR\//.test(userAgent)) browser = "Opera";
    else if (/Chrome\//.test(userAgent)) browser = "Chrome";
    else if (/Firefox\//.test(userAgent)) browser = "Firefox";
    else if (/Safari\//.test(userAgent)) browser = "Safari";
    let device = platform || "";
    if (/Android/i.test(userAgent)) device = "Android";
    else if (/iPhone|iPad/i.test(userAgent)) device = "iOS";
    else if (/Windows/i.test(userAgent)) device = "Windows";
    return [browser, device].filter(Boolean).join(" · ");
  }

  function shortUid(uid = "") {
    return uid ? `ID ${uid.slice(0, 8)}…` : "";
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function friendlyAuthError(error) {
    if (error.code === "auth/unauthorized-domain") return "Agrega este dominio de GitHub Pages en Authentication > Settings > Authorized domains.";
    if (error.code === "auth/popup-closed-by-user") return "Se cerró la ventana antes de completar el ingreso.";
    if (error.code === "auth/popup-blocked") return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.";
    return error.message || "No se pudo iniciar sesión.";
  }

  function showToast(message, error = false) {
    const toast = $("#admin-toast");
    toast.textContent = message;
    toast.style.background = error ? "var(--danger)" : "";
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
      toast.style.background = "";
    }, 3200);
  }
})();
