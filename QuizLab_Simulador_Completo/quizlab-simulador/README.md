# QuizLab - Simulador moderno de preguntas

Aplicación web estática, sin inicio de sesión y lista para publicar en GitHub Pages. Incluye el banco de **150 preguntas de Gestión del Talento Humano**.

## Funciones principales

- Diseño moderno, adaptable a celular y computadora.
- Modo **Estudio** con respuesta y explicación inmediata.
- Modo **Examen** con resultados al finalizar.
- Selección de 10, 20, 30, 50 o todas las preguntas.
- Temporizador opcional.
- Preguntas y alternativas aleatorias.
- Marcado de preguntas para revisar.
- Mapa de navegación.
- Guardado automático del intento en el navegador.
- Resultados, estadísticas y revisión de errores.
- Tema claro y oscuro.
- Gestor visual para agregar, editar, duplicar, eliminar, importar y exportar preguntas.
- Funciona como aplicación instalable y puede trabajar sin conexión después de la primera carga.

## Estructura

```text
quizlab-simulador/
├── index.html                  # Simulador
├── gestor.html                 # Gestor visual de preguntas
├── app.js                      # Lógica del simulador
├── gestor.js                   # Lógica del gestor
├── styles.css                  # Diseño principal
├── gestor.css                  # Diseño del gestor
├── sw.js                       # Funcionamiento sin conexión
├── manifest.webmanifest        # Instalación como aplicación
├── data/
│   └── banco-preguntas.js      # Banco que se publica para todos
├── assets/
│   └── favicon.svg
└── plantillas/
    └── plantilla-banco.json
```

## Cómo probarlo

La forma más sencilla es abrir la carpeta con **Visual Studio Code** y usar la extensión **Live Server**. También puedes ejecutar:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Cómo agregar preguntas sin escribir código

1. Abre `gestor.html`.
2. Selecciona una materia o crea una nueva.
3. Pulsa **Agregar pregunta**.
4. Escribe la pregunta, alternativas y marca la correcta.
5. Guarda. El cambio aparecerá inmediatamente en el simulador del mismo navegador.

### Publicar los cambios para todos

Los cambios del gestor se guardan primero en `localStorage`, por lo que solo existen en ese navegador. Para hacerlos permanentes:

1. En el gestor, pulsa **Exportar archivo JS**.
2. Se descargará `banco-preguntas.js`.
3. Reemplaza el archivo `data/banco-preguntas.js` del proyecto.
4. Sube el cambio a GitHub.

## Importar preguntas en lote

El gestor acepta:

- Un banco completo con la propiedad `materias`.
- Un arreglo de preguntas para añadirlo a la materia activa.

Ejemplo de selección múltiple:

```json
{
  "id": "materia-001",
  "tipo": "multiple",
  "tema": "Unidad 1",
  "pregunta": "¿Cuál es la respuesta correcta?",
  "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
  "correcta": 1,
  "explicacion": "La opción B es la correcta.",
  "referencia": "Página 10"
}
```

El valor de `correcta` empieza en cero:

- `0` = primera opción.
- `1` = segunda opción.
- `2` = tercera opción.
- `3` = cuarta opción.

Ejemplo de verdadero y falso:

```json
{
  "id": "materia-002",
  "tipo": "vf",
  "tema": "Unidad 1",
  "pregunta": "La afirmación presentada es correcta.",
  "opciones": ["Verdadero", "Falso"],
  "correcta": 0,
  "explicacion": "Explicación opcional.",
  "referencia": "Página 11"
}
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube todos los archivos de esta carpeta a la rama `main`.
3. Ve a **Settings > Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/root`.
6. Guarda y espera a que GitHub genere el enlace.

## Restablecer datos locales

En `gestor.html`, pulsa **Restaurar banco original**. Esto elimina el banco personalizado guardado en el navegador y vuelve a cargar `data/banco-preguntas.js`.
