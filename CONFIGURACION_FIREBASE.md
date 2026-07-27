<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#6d5dfc">
  <meta name="description" content="Panel administrativo de ingresos e intentos de QuizLab.">
  <title>QuizLab | Panel de resultados</title>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="admin.css">
</head>
<body>
  <div class="ambient ambient-one" aria-hidden="true"></div>
  <div class="ambient ambient-two" aria-hidden="true"></div>

  <header class="topbar">
    <a class="brand" href="index.html" aria-label="Volver al simulador">
      <span class="brand-mark">Q</span>
      <span><strong>QuizLab</strong><small>Panel de resultados</small></span>
    </a>
    <nav class="top-actions">
      <a class="icon-button text-button" href="index.html"><span>←</span><span class="hide-mobile">Simulador</span></a>
      <button id="admin-theme-toggle" class="icon-button" type="button" aria-label="Cambiar tema"><span id="admin-theme-icon">☾</span></button>
    </nav>
  </header>

  <main class="admin-shell">
    <section id="admin-login" class="admin-login glass-card">
      <div class="admin-login-icon">🔐</div>
      <span class="eyebrow">Acceso administrativo</span>
      <h1>Consulta ingresos e intentos</h1>
      <p>Solo los correos administradores pueden leer la información almacenada en Firebase.</p>
      <button id="admin-login-button" class="button button-primary button-large" type="button">
        <span class="google-g">G</span> Ingresar con Google
      </button>
      <p id="admin-login-message" class="admin-message" role="alert"></p>
    </section>

    <section id="admin-dashboard" class="hidden">
      <div class="admin-heading">
        <div>
          <span class="eyebrow">Resumen general</span>
          <h1>Actividad del simulador</h1>
          <p id="admin-user-label">Administrador</p>
        </div>
        <div class="admin-heading-actions">
          <button id="admin-refresh" class="button button-secondary" type="button">↻ Actualizar</button>
          <button id="admin-logout" class="button button-ghost" type="button">Cerrar sesión</button>
        </div>
      </div>

      <section class="admin-stats" aria-label="Estadísticas generales">
        <article class="admin-stat glass-card"><span>👥</span><div><strong id="stat-participants">0</strong><small>Participantes</small></div></article>
        <article class="admin-stat glass-card"><span>📝</span><div><strong id="stat-attempts">0</strong><small>Intentos</small></div></article>
        <article class="admin-stat glass-card"><span>✅</span><div><strong id="stat-completed">0</strong><small>Completados</small></div></article>
        <article class="admin-stat glass-card"><span>◎</span><div><strong id="stat-average">0%</strong><small>Promedio</small></div></article>
        <article class="admin-stat glass-card"><span>🚪</span><div><strong id="stat-sessions">0</strong><small>Ingresos</small></div></article>
      </section>

      <section class="admin-controls glass-card">
        <div class="admin-tabs" role="tablist">
          <button class="admin-tab active" data-tab="attempts" type="button">Intentos</button>
          <button class="admin-tab" data-tab="participants" type="button">Participantes</button>
          <button class="admin-tab" data-tab="sessions" type="button">Ingresos</button>
        </div>
        <div class="admin-filters">
          <label><span>Buscar</span><input id="filter-search" type="search" placeholder="Nombre, curso, correo o materia"></label>
          <label><span>Estado</span>
            <select id="filter-status">
              <option value="all">Todos</option>
              <option value="completado">Completado</option>
              <option value="en_curso">En curso</option>
              <option value="descartado">Descartado</option>
              <option value="posible_abandono">Posible abandono</option>
            </select>
          </label>
          <label><span>Desde</span><input id="filter-from" type="date"></label>
          <label><span>Hasta</span><input id="filter-to" type="date"></label>
          <button id="export-csv" class="button button-secondary" type="button">Exportar CSV</button>
        </div>
      </section>

      <section id="panel-attempts" class="admin-panel active">
        <div class="table-card glass-card">
          <div class="table-head"><div><h2>Detalle de intentos</h2><p id="attempts-count-label">0 registros</p></div><span class="live-pill">● En vivo</span></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Participante</th><th>Curso</th><th>Materia</th><th>Modo</th><th>Estado</th><th>Resultado</th><th>Duración</th><th></th></tr></thead>
              <tbody id="attempts-body"></tbody>
            </table>
          </div>
          <div id="attempts-empty" class="empty-state hidden">No hay intentos que coincidan con los filtros.</div>
        </div>
      </section>

      <section id="panel-participants" class="admin-panel">
        <div class="table-card glass-card">
          <div class="table-head"><div><h2>Participantes registrados</h2><p id="participants-count-label">0 registros</p></div></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Primer ingreso</th><th>Nombre</th><th>Curso</th><th>Correo</th><th>Total ingresos</th><th>Último ingreso</th><th>Tipo de sesión</th></tr></thead>
              <tbody id="participants-body"></tbody>
            </table>
          </div>
          <div id="participants-empty" class="empty-state hidden">No hay participantes que coincidan con los filtros.</div>
        </div>
      </section>

      <section id="panel-sessions" class="admin-panel">
        <div class="table-card glass-card">
          <div class="table-head"><div><h2>Historial de ingresos</h2><p id="sessions-count-label">0 registros</p></div></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Participante</th><th>Curso</th><th>Dispositivo</th><th>Pantalla</th><th>Origen</th><th>Última actividad</th></tr></thead>
              <tbody id="sessions-body"></tbody>
            </table>
          </div>
          <div id="sessions-empty" class="empty-state hidden">No hay ingresos que coincidan con los filtros.</div>
        </div>
      </section>
    </section>
  </main>

  <dialog id="attempt-detail-dialog" class="attempt-detail-dialog">
    <div class="dialog-head detail-head">
      <div><span class="eyebrow">Detalle del intento</span><h2 id="detail-title">Resultado</h2></div>
      <button id="detail-close" class="icon-button" type="button" aria-label="Cerrar">×</button>
    </div>
    <div id="detail-summary" class="detail-summary"></div>
    <div id="detail-responses" class="detail-responses"></div>
  </dialog>

  <div id="admin-toast" class="toast" role="status" aria-live="polite"></div>

  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
  <script src="firebase-init.js"></script>
  <script src="admin.js"></script>
</body>
</html>
