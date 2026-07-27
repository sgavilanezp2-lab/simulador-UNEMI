// Firebase reutilizado del proyecto anterior: simulador-tics.
// La configuración web identifica el proyecto; la seguridad real depende de
// Firebase Authentication y las reglas de Cloud Firestore.
const firebaseConfig = {
  apiKey: "AIzaSyBU1oaDdq6qD4fTiLN41SAeQg6Kp06gDXk",
  authDomain: "simulador-tics.firebaseapp.com",
  projectId: "simulador-tics",
  storageBucket: "simulador-tics.firebasestorage.app",
  messagingSenderId: "501091859008",
  appId: "1:501091859008:web:80e4596d2adcb5adbf7da5",
  measurementId: "G-5LFLE4MBPH"
};

// Correos que podrán abrir admin.html y consultar todos los resultados.
// Puedes quitar o agregar correos, pero recuerda hacer el mismo cambio en firestore.rules.
const QUIZLAB_ADMIN_EMAILS = [
  "sgavilanezp2@unemi.edu.ec",
  "apoyochat.trabajosocial@gmail.com"
];

let auth = null;
let db = null;

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();
  db = firebase.firestore();
}

window.auth = auth;
window.db = db;
window.QUIZLAB_ADMIN_EMAILS = QUIZLAB_ADMIN_EMAILS;
window.QUIZLAB_FIREBASE_AVAILABLE = Boolean(auth && db);
