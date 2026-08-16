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
| Base de datos | SQLite (módulo nativo `node:sqlite`, sin dependencias externas) |
| Autenticación | JWT + contraseñas cifradas con bcrypt |

## Estructura

```
taskflow/
├─ client/          # Frontend React (Vite)
├─ server/          # API Express + SQLite
├─ Dockerfile       # Build de producción (un solo contenedor)
└─ docker-compose.yml
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

## Despliegue

### Opción A: VPS con Docker (recomendada)

Con un VPS de ~5 €/mes (Hetzner, DigitalOcean…):

```bash
git clone <tu-repo> && cd taskflow
docker compose up -d --build
```

La app quedará en el puerto **4000**. Pon delante un proxy (Caddy, Nginx o Traefik) para HTTPS.

### Opción B: Railway

1. Sube el repositorio a GitHub.
2. En Railway, crea un servicio **"Deploy from GitHub repo"**.
3. Railway detectará el `Dockerfile` automáticamente.
4. Añade la variable `JWT_SECRET` con un valor aleatorio.
5. Añade un volumen persistente en `/data` para que la base de datos no se pierda al redeployar.

### Opción C: Vercel + Postgres

Vercel no sirve bien con una base de datos en fichero (su filesystem es efímero). Si quieres Vercel de todas formas, habría que migrar SQLite a Postgres (p. ej. Neon o Supabase, gratis). Es un cambio acotado al módulo `server/src/db.js`, pero yo recomendaría Docker + VPS para un uso diario de trabajo.

## Variables de entorno

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `4000` |
| `JWT_SECRET` | Secreto para firmar sesiones. ¡Cambia el valor en producción! | `taskflow-secret-change-me` |
| `DATABASE_PATH` | Ruta del fichero de la base de datos | `server/data/taskflow.db` |

## Seguridad

- Las contraseñas se guardan cifradas (bcrypt).
- Todas las rutas de la API verifican la sesión JWT y la pertenencia al equipo.
- Cambia siempre `JWT_SECRET` en producción.
- Para uso público en internet, usa HTTPS (proxy tipo Caddy/Nginx).

## Notas

- La base de datos se crea automáticamente en `server/data/taskflow.db` (ignorada por git).
- No se envían emails: la invitación es mediante código (más simple y sin depender de servicios externos). Para añadir un miembro por email, esa persona debe tener ya una cuenta.
