# TaskFlow

Gestor de tareas para equipos de trabajo, minimalista y funcional, tipo kanban. Permite crear equipos, invitar compañeros con un código, organizar tareas en tableros y asignarlas con prioridad, fecha límite y comentarios.

## Características

- **Equipos** con código de invitación (tipo "haz join con este código").
- **Tableros kanban** con drag & drop entre columnas y reordenación.
- **Tareas** con descripción, prioridad (baja/media/alta), fecha límite, asignación a miembros y comentarios.
- **Roles**: propietario (borrar equipo), admin y miembro.
- **Sincronización** automática entre navegadores (polling cada 10 s).
- Interfaz en **español**, limpia y responsive.

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + Vite + Tailwind CSS 4 + @dnd-kit |
| Backend | Node.js + Express |
| Base de datos | SQLite (`node:sqlite`) por defecto, **PostgreSQL** si se define `DATABASE_URL` |
| Autenticación | JWT + contraseñas cifradas con bcrypt |

## Estructura

```
taskflow/
├── client/          # Frontend React (Vite)
├── server/          # API Express + SQLite/PostgreSQL
├── Dockerfile       # Build de producción (un solo contenedor)
└── docker-compose.yml
```

## Requisitos

- Node.js **24** o superior (se usa el módulo `node:sqlite`).
- npm.

## Puesta en marcha local

### 1. Instalar dependencias

```bash
cd server && npm install
cd ../client && npm install
```

> En Windows, si npm bloquea los scripts de `esbuild`, ejecuta `npm install-scripts approve esbuild`.

### 2. Arrancar backend (puerto 4000)

```bash
cd server
npm run dev
```

### 3. Arrancar frontend (puerto 5173)

```bash
cd client
npm run dev
```

Abre **http://localhost:5173**, regístrate, crea un equipo y comparte el código de invitación con tu gente.

El `client/vite.config.js` ya tiene configurado un proxy: `/api` → `http://localhost:4000`, así que en desarrollo no necesitas tocar nada más.

## Producción (un solo proceso)

```bash
cd client && npm run build     # genera client/dist
cd ../server && npm start      # sirve la app + API en el puerto 4000
```

Abre **http://localhost:4000**.

## Base de datos

- **Por defecto**: SQLite, el fichero se crea automáticamente en `server/data/taskflow.db` (ignorado por git).
- **PostgreSQL**: si defines la variable `DATABASE_URL`, el servidor usa PostgreSQL en lugar de SQLite. Las tablas se crean automáticamente al arrancar. El esquema y las consultas son compatibles con ambos motores.

## Despliegue en Render (gratis + datos persistentes)

Render no permite disco persistente en el plan gratuito, así que usaremos una base de datos PostgreSQL externa (gratis).

### 1. Sube el proyecto a GitHub

```bash
git init && git add -A && git commit -m "Inicial"
# crea un repositorio en https://github.com/new y luego:
git remote add origin https://github.com/<usuario>/taskflow.git
git push -u origin main
```

### 2. Crea la base de datos Postgres gratis

- En https://dashboard.render.com/new → **PostgreSQL**.
- Elige el plan **Free** (256 MB, suficiente).
- Render te dará una **Internal Database URL** (connection string). Guárdala.

> Nota: el plan gratuito de Postgres de Render puede expirar a los ~30 días. Alternativa gratis sin expiración: **Neon** o **Supabase** (copian el connection string y lo pegas en el paso 4).

### 3. Crea el Web Service

- En https://dashboard.render.com/new → **Web Service** → conecta el repositorio de GitHub.
- Render detectará el `Dockerfile` automáticamente.
- Elegir plan **Free** (la app duerme tras ~15 min sin tráfico y despierta sola; el primer acceso puede tardar ~30 s).
- Puedes reducir el coste de horas al mínimo con **Auto-Suspend** activado.

### 4. Variables de entorno

En el Web Service, añade:

| Variable | Valor |
| --- | --- |
| `JWT_SECRET` | Un valor largo y aleatorio (ej. `openssl rand -hex 32`) |
| `DATABASE_URL` | La Internal Database URL de Render (o de Neon/Supabase) |

### 5. Despliega

Pulsa **Deploy**. La primera vez tarda unos minutos en compilar la imagen de Docker. Después:

- App: `https://<nombre>.onrender.com`
- `https://<nombre>.onrender.com/api/health` debe responder `{"status":"ok"}`.

## Variables de entorno

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `4000` |
| `JWT_SECRET` | Secreto para firmar sesiones. ¡Cambia el valor en producción! | `taskflow-secret-change-me` |
| `DATABASE_URL` | Connection string de PostgreSQL. Si está definida, se usa Postgres. | vacío (usa SQLite) |
| `DATABASE_PATH` | Ruta del fichero SQLite | `server/data/taskflow.db` |

## Seguridad

- Las contraseñas se guardan cifradas (bcrypt).
- Todas las rutas de la API verifican la sesión JWT y la pertenencia al equipo.
- Cambia siempre `JWT_SECRET` en producción.
- Para uso público en internet, usa HTTPS (Render lo da automáticamente).

## Notas

- No se envían emails: la invitación es mediante código (más simple y sin depender de servicios externos). Para añadir un miembro por email, esa persona debe tener ya una cuenta.
- En el plan gratuito de Render la app se apaga por inactividad; los datos no se pierden porque viven en Postgres.
