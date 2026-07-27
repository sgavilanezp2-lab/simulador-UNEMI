rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn()
        && request.auth.token.email != null
        && request.auth.token.email in [
          'sgavilanezp2@unemi.edu.ec',
          'apoyochat.trabajosocial@gmail.com'
        ];
    }

    // Cada participante puede crear y actualizar únicamente su propio perfil.
    // Solo los administradores pueden listar todos los participantes.
    match /participantes/{uid} {
      allow create: if signedIn()
        && request.auth.uid == uid
        && request.resource.data.uid == uid;
      allow get: if signedIn() && request.auth.uid == uid;
      allow update: if signedIn()
        && request.auth.uid == uid
        && resource.data.uid == uid
        && request.resource.data.uid == uid;
      allow list, delete: if isAdmin();
    }

    // Sesiones de ingreso al simulador.
    match /sesiones/{sessionId} {
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid;
      allow update: if signedIn()
        && resource.data.uid == request.auth.uid
        && request.resource.data.uid == request.auth.uid;
      allow read, delete: if isAdmin();
    }

    // Intentos y detalle de respuestas.
    match /intentos/{attemptId} {
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid;
      allow get: if signedIn() && resource.data.uid == request.auth.uid;
      allow update: if signedIn()
        && resource.data.uid == request.auth.uid
        && request.resource.data.uid == request.auth.uid;
      allow list, delete: if isAdmin();
    }

    // Conserva el funcionamiento del simulador anterior.
    match /usuarios_seguros/{email} {
      allow get, create, update: if signedIn()
        && request.auth.token.email != null
        && request.auth.token.email == email;
      allow read, write: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
