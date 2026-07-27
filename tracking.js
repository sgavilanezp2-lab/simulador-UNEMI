(() => {
  "use strict";

  const PROFILE_KEY = "quizlab_participant_profile_v1";
  const SESSION_KEY = "quizlab_session_id_v1";
  const SESSION_UID_KEY = "quizlab_session_uid_v1";
  const SERVER_TIMESTAMP = () => firebase.firestore.FieldValue.serverTimestamp();
  const INCREMENT = (value) => firebase.firestore.FieldValue.increment(value);

  let currentUser = null;
  let currentProfile = readLocalProfile();
  let sessionId = sessionStorage.getItem(SESSION_KEY) || null;
  let participantWaiter = null;
  let participantResolver = null;
  let initialized = false;

  const readyPromise = initializeFirebaseUser();

  window.QuizLabTracker = {
    ready: () => readyPromise,
    getProfile: () => currentProfile,
    ensureParticipant,
    openParticipantForm,
    startAttempt,
    updateAttemptProgress,
    completeAttempt,
    discardAttempt,
    touchSession,
    getUser: () => currentUser
  };

  bindParticipantInterface();
  readyPromise
    .then(async () => {
      initialized = true;
      updateParticipantButton();
      if (currentProfile) {
        await saveParticipant(currentProfile);
        await registerSession();
      } else {
        openParticipantForm();
      }
    })
    .catch((error) => {
      console.error("Firebase no pudo iniciar:", error);
      showTrackingMessage("No se pudo conectar con el registro de resultados. El simulador seguirá funcionando localmente.", true);
    });

  async function initializeFirebaseUser() {
    if (!window.firebase || !window.auth || !window.db) {
      console.warn("Firebase no está disponible. Se usará únicamente el guardado local.");
      return null;
    }

    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    return new Promise((resolve, reject) => {
      let resolved = false;
      auth.onAuthStateChanged(async (user) => {
        try {
          if (!user) {
            const credential = await auth.signInAnonymously();
            user = credential.user;
          }
          currentUser = user;
          if (!resolved) {
            resolved = true;
            resolve(user);
          }
        } catch (error) {
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        }
      }, reject);
    });
  }

  function bindParticipantInterface() {
    const dialog = document.getElementById("participant-dialog");
    const form = document.getElementById("participant-form");
    const button = document.getElementById("participant-button");

    if (dialog) {
      dialog.addEventListener("cancel", (event) => event.preventDefault());
    }

    if (button) {
      button.addEventListener("click", openParticipantForm);
    }

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = document.getElementById("participant-submit");
        const message = document.getElementById("participant-message");
        const profile = {
          nombre: document.getElementById("participant-name").value.trim(),
          curso: document.getElementById("participant-course").value.trim(),
          correo: document.getElementById("participant-email").value.trim().toLowerCase()
        };

        if (!profile.nombre || !profile.curso) {
          message.textContent = "Escribe tu nombre y curso o paralelo.";
          return;
        }

        submit.disabled = true;
        submit.textContent = "Guardando…";
        message.textContent = "";

        try {
          currentProfile = profile;
          localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
          await readyPromise;
          await saveParticipant(profile);
          await registerSession();
          updateParticipantButton();
          if (dialog?.open) dialog.close();
          if (participantResolver) participantResolver(profile);
          participantWaiter = null;
          participantResolver = null;
          showTrackingMessage("Datos registrados correctamente.");
        } catch (error) {
          console.error(error);
          message.textContent = "No se pudo registrar en Firebase. Revisa la conexión o las reglas de Firestore.";
        } finally {
          submit.disabled = false;
          submit.textContent = "Entrar al simulador";
        }
      });
    }
  }

  function openParticipantForm() {
    const dialog = document.getElementById("participant-dialog");
    if (!dialog) return;
    document.getElementById("participant-name").value = currentProfile?.nombre || "";
    document.getElementById("participant-course").value = currentProfile?.curso || "";
    document.getElementById("participant-email").value = currentProfile?.correo || "";
    document.getElementById("participant-message").textContent = "";
    if (!dialog.open) dialog.showModal();
  }

  async function ensureParticipant() {
    await readyPromise;
    if (currentProfile?.nombre && currentProfile?.curso) return currentProfile;
    openParticipantForm();
    if (!participantWaiter) {
      participantWaiter = new Promise((resolve) => {
        participantResolver = resolve;
      });
    }
    return participantWaiter;
  }

  async function saveParticipant(profile) {
    if (!currentUser || !profile) return;
    const ref = db.collection("participantes").doc(currentUser.uid);
    const snapshot = await ref.get();
    const payload = {
      uid: currentUser.uid,
      nombre: profile.nombre,
      curso: profile.curso,
      correo: profile.correo || "",
      correoFirebase: currentUser.email || "",
      anonimoFirebase: Boolean(currentUser.isAnonymous),
      ultimoIngreso: SERVER_TIMESTAMP(),
      ultimoIngresoCliente: new Date().toISOString(),
      totalIngresos: snapshot.exists ? INCREMENT(1) : 1,
      navegador: navigator.userAgent,
      idioma: navigator.language || "",
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    };
    if (!snapshot.exists) payload.primerIngreso = SERVER_TIMESTAMP();
    await ref.set(payload, { merge: true });
  }

  async function registerSession() {
    if (!currentUser || !currentProfile) return null;
    const sessions = db.collection("sesiones");

    const storedSessionUid = sessionStorage.getItem(SESSION_UID_KEY);
    if (sessionId && storedSessionUid && storedSessionUid !== currentUser.uid) {
      sessionId = null;
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_UID_KEY);
    }

    if (!sessionId) {
      const ref = sessions.doc();
      sessionId = ref.id;
      sessionStorage.setItem(SESSION_KEY, sessionId);
      sessionStorage.setItem(SESSION_UID_KEY, currentUser.uid);
      await ref.set({
        id: sessionId,
        uid: currentUser.uid,
        nombre: currentProfile.nombre,
        curso: currentProfile.curso,
        correo: currentProfile.correo || "",
        fechaIngreso: SERVER_TIMESTAMP(),
        fechaIngresoCliente: new Date().toISOString(),
        ultimaActividad: SERVER_TIMESTAMP(),
        pagina: location.href,
        referencia: document.referrer || "Acceso directo",
        navegador: navigator.userAgent,
        plataforma: navigator.userAgentData?.platform || navigator.platform || "",
        idioma: navigator.language || "",
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        pantalla: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        recargas: 0
      });
    } else {
      await sessions.doc(sessionId).set({
        uid: currentUser.uid,
        nombre: currentProfile.nombre,
        curso: currentProfile.curso,
        correo: currentProfile.correo || "",
        ultimaActividad: SERVER_TIMESTAMP(),
        pagina: location.href,
        recargas: INCREMENT(1)
      }, { merge: true });
    }
    return sessionId;
  }

  async function touchSession(extra = {}) {
    try {
      await readyPromise;
      if (!sessionId || !currentProfile) await registerSession();
      if (!sessionId) return;
      await db.collection("sesiones").doc(sessionId).set({
        uid: currentUser.uid,
        nombre: currentProfile.nombre,
        curso: currentProfile.curso,
        correo: currentProfile.correo || "",
        ultimaActividad: SERVER_TIMESTAMP(),
        ...extra
      }, { merge: true });
    } catch (error) {
      console.warn("No se pudo actualizar la sesión:", error);
    }
  }

  async function startAttempt(metadata) {
    try {
      await ensureParticipant();
      const ref = db.collection("intentos").doc();
      const payload = {
        id: ref.id,
        uid: currentUser.uid,
        sessionId: sessionId || "",
        nombre: currentProfile.nombre,
        curso: currentProfile.curso,
        correo: currentProfile.correo || "",
        materiaId: metadata.subjectId || "",
        materiaNombre: metadata.subjectName || "Cuestionario",
        modo: metadata.mode || "study",
        totalPreguntas: Number(metadata.totalQuestions) || 0,
        limiteMinutos: Number(metadata.timerMinutes) || 0,
        mezclarAlternativas: Boolean(metadata.shuffleOptions),
        estado: "en_curso",
        respondidas: 0,
        preguntaActual: 1,
        porcentaje: null,
        fechaInicio: SERVER_TIMESTAMP(),
        fechaInicioCliente: new Date().toISOString(),
        ultimaActividad: SERVER_TIMESTAMP(),
        dispositivo: {
          navegador: navigator.userAgent,
          plataforma: navigator.userAgentData?.platform || navigator.platform || "",
          idioma: navigator.language || "",
          pantalla: `${window.screen?.width || 0}x${window.screen?.height || 0}`
        }
      };
      await ref.set(payload);
      await touchSession({ intentoActual: ref.id, materiaActual: payload.materiaNombre });
      return ref.id;
    } catch (error) {
      console.warn("No se pudo crear el intento remoto:", error);
      return null;
    }
  }

  async function updateAttemptProgress(attemptId, progress) {
    if (!attemptId) return;
    try {
      await readyPromise;
      await db.collection("intentos").doc(attemptId).set({
        uid: currentUser.uid,
        nombre: currentProfile?.nombre || "",
        curso: currentProfile?.curso || "",
        correo: currentProfile?.correo || "",
        respondidas: Number(progress.answered) || 0,
        preguntaActual: Number(progress.currentQuestion) || 1,
        marcadas: Number(progress.marked) || 0,
        ultimaActividad: SERVER_TIMESTAMP()
      }, { merge: true });
    } catch (error) {
      console.warn("No se pudo actualizar el intento:", error);
    }
  }

  async function completeAttempt(attemptId, result) {
    try {
      await readyPromise;
      let id = attemptId;
      if (!id) {
        id = await startAttempt({
          subjectId: result.subjectId,
          subjectName: result.subjectName,
          mode: result.mode,
          totalQuestions: result.total,
          timerMinutes: result.timerMinutes,
          shuffleOptions: result.shuffleOptions
        });
      }
      if (!id) return;

      await db.collection("intentos").doc(id).set({
        uid: currentUser.uid,
        nombre: currentProfile?.nombre || "",
        curso: currentProfile?.curso || "",
        correo: currentProfile?.correo || "",
        estado: "completado",
        fechaFin: SERVER_TIMESTAMP(),
        fechaFinCliente: new Date().toISOString(),
        ultimaActividad: SERVER_TIMESTAMP(),
        duracionSegundos: Number(result.elapsed) || 0,
        correctas: Number(result.correct) || 0,
        incorrectas: Number(result.wrong) || 0,
        sinResponder: Number(result.blank) || 0,
        respondidas: (Number(result.correct) || 0) + (Number(result.wrong) || 0),
        totalPreguntas: Number(result.total) || 0,
        porcentaje: Number(result.percent) || 0,
        materiaId: result.subjectId || "",
        materiaNombre: result.subjectName || "Cuestionario",
        modo: result.mode || "study",
        limiteMinutos: Number(result.timerMinutes) || 0,
        mezclarAlternativas: Boolean(result.shuffleOptions),
        respuestas: Array.isArray(result.responses) ? result.responses : []
      }, { merge: true });
      await touchSession({ ultimoIntento: id, intentoActual: "", ultimoResultado: Number(result.percent) || 0 });
    } catch (error) {
      console.warn("No se pudo guardar el resultado remoto:", error);
    }
  }

  async function discardAttempt(attemptId) {
    if (!attemptId) return;
    try {
      await readyPromise;
      await db.collection("intentos").doc(attemptId).set({
        uid: currentUser.uid,
        estado: "descartado",
        fechaFin: SERVER_TIMESTAMP(),
        fechaFinCliente: new Date().toISOString(),
        ultimaActividad: SERVER_TIMESTAMP()
      }, { merge: true });
      await touchSession({ intentoActual: "" });
    } catch (error) {
      console.warn("No se pudo marcar el intento como descartado:", error);
    }
  }

  function readLocalProfile() {
    try {
      const value = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (value?.nombre && value?.curso) return value;
    } catch (error) {
      console.warn("Perfil local inválido:", error);
    }
    return null;
  }

  function updateParticipantButton() {
    const label = document.getElementById("participant-label");
    if (label) label.textContent = currentProfile?.nombre || "Identificarme";
    const welcome = document.getElementById("welcome-message");
    if (welcome && currentProfile?.nombre) welcome.textContent = `Hola, ${currentProfile.nombre.split(" ")[0]}`;
  }

  function showTrackingMessage(message, isError = false) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("tracking-error", isError);
    toast.classList.add("show");
    window.setTimeout(() => {
      toast.classList.remove("show", "tracking-error");
    }, 2600);
  }
})();
