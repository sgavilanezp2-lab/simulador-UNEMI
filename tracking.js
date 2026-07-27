# QuizLab - Simulador con registro de ingresos e intentos

Aplicación web para GitHub Pages conectada al proyecto Firebase **simulador-tics**. El acceso del estudiante permanece abierto y sin contraseña; se usa autenticación anónima en segundo plano para guardar los resultados de forma separada y segura.

## Funciones del simulador

- Diseño adaptable a celular y computadora.
- Modo Estudio y modo Examen.
- Banco de 150 preguntas de Gestión del Talento Humano.
- Selección de cantidad de preguntas.
- Temporizador opcional.
- Preguntas y alternativas aleatorias.
- Guardado local del progreso.
- Identificación sencilla por nombre y curso.
- Registro en Firebase de ingresos e intentos.
- Detalle de cada respuesta y tiempo aproximado por pregunta.
- Panel administrativo protegido con Google.
- Filtros por nombre, curso, estado y fecha.
- Exportación de resultados a CSV.
- Gestor visual de preguntas.

## Archivos principales

```text
index.html                 Simulador
app.js                     Lógica del cuestionario
tracking.js                Registro de participantes e intentos
firebase-init.js           Configuración del proyecto Firebase
admin.html                 Panel administrativo
admin.js                   Consultas y reportes
admin.css                  Diseño del panel
firestore.rules            Reglas de seguridad
CONFIGURACION_FIREBASE.md   Instrucciones de activación
```

## Panel administrativo

Abre:

```text
https://sgavilanezp2-lab.github.io/simulador-UNEMI/admin.html
```

Los correos administradores se configuran en `firebase-init.js` y `firestore.rules`.

## Configuración

Sigue el documento `CONFIGURACION_FIREBASE.md` para habilitar autenticación anónima, Google, dominios autorizados y reglas de Firestore.

## Agregar preguntas

Abre `gestor.html`, crea o edita preguntas y exporta `banco-preguntas.js`. Luego reemplaza `data/banco-preguntas.js` en GitHub.
