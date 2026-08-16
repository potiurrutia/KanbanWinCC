import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Modal from "../components/Modal.jsx";
import {
  IconBoard,
  IconCheck,
  IconCopy,
  IconKey,
  IconPencil,
  IconPlus,
  IconSpinner,
  IconTrash,
  IconUserPlus,
  IconUsers,
} from "../components/Icons.jsx";

const BOARD_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function TeamPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [boards, setBoards] = useState([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/teams/${teamId}`)
      .then(({ team }) => setTeam(team))
      .catch(() => setError("El equipo no existe o no tienes acceso."));
    api
      .get(`/teams/${teamId}/boards`)
      .then(({ boards }) => setBoards(boards))
      .catch(() => {});
  }, [teamId]);

  useEffect(() => {
    setTeam(null);
    setError("");
    load();
  }, [load]);

  const myRole = team?.members?.find((m) => m.id === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  async function copyCode() {
    await navigator.clipboard.writeText(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-slate-600">{error}</p>
        <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconSpinner className="h-6 w-6 text-slate-300" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="animate-fade-in">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
              >
                {team.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{team.name}</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {team.description || "Sin descripción"}
                </p>
              </div>
            </div>

            {canManage && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <IconPencil className="h-4 w-4" />
                Editar
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={copyCode}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-indigo-200 hover:shadow"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <IconKey className="h-4.5 w-4.5" />
              </span>
              <span className="text-left">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Código de invitación
                </span>
                <span className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-800">
                  {team.invite_code}
                  {copied ? (
                    <IconCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <IconCopy className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                  )}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
                <IconUsers className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">Miembros</span>
                <span className="flex items-center text-sm font-semibold text-slate-800">
                  {team.members.length}
                  <span className="-space-x-1.5 ml-2">
                    {team.members.slice(0, 4).map((m) => (
                      <span key={m.id} className="inline-block rounded-full ring-2 ring-white">
                        <Avatar user={m} size={22} />
                      </span>
                    ))}
                  </span>
                </span>
              </span>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Tableros</h2>
            {canManage && (
              <button
                onClick={() => setCreateBoardOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
              >
                <IconPlus className="h-4 w-4" />
                Nuevo tablero
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/t/${team.id}/b/${board.id}`}
                className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${board.color}1a`, color: board.color }}
                >
                  <IconBoard className="h-4.5 w-4.5" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-indigo-600">{board.name}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {board.task_count} tarea{board.task_count !== 1 ? "s" : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Miembros</h2>
            {canManage && (
              <button
                onClick={() => setAddMemberOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
              >
                <IconUserPlus className="h-4 w-4" />
                Añadir miembro
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
            <ul className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar user={m} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {m.name}
                      {m.id === user.id && <span className="ml-1.5 text-slate-400">(tú)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-400">{m.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      m.role === "owner"
                        ? "bg-indigo-50 text-indigo-600"
                        : m.role === "admin"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.role === "owner" ? "Propietario" : m.role === "admin" ? "Admin" : "Miembro"}
                  </span>
                  {canManage && m.role !== "owner" && m.id !== user.id && (
                    <button
                      onClick={async () => {
                        if (!confirm(`¿Eliminar a ${m.name} del equipo?`)) return;
                        await api.delete(`/teams/${team.id}/members/${m.id}`);
                        load();
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      title="Eliminar miembro"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {team.members[0]?.id === user.id && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={async () => {
                  if (!confirm("¿Seguro que quieres eliminar el equipo? Se borrarán todos sus tableros y tareas."))
                    return;
                  await api.delete(`/teams/${team.id}`);
                  navigate("/");
                }}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
              >
                <IconTrash className="h-4 w-4" />
                Eliminar equipo
              </button>
            </div>
          )}
        </section>
      </div>

      <AddMemberModal open={addMemberOpen} team={team} onClose={() => setAddMemberOpen(false)} onAdded={load} />
      <CreateBoardModal
        open={createBoardOpen}
        teamId={team.id}
        onClose={() => setCreateBoardOpen(false)}
        onCreated={(board) => navigate(`/t/${team.id}/b/${board.id}`)}
      />
      {editOpen && (
        <EditTeamModal open={editOpen} team={team} onClose={() => setEditOpen(false)} onSaved={load} />
      )}
    </div>
  );
}

function AddMemberModal({ open, team, onClose, onAdded }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post(`/teams/${team.id}/members`, { email });
      setEmail("");
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Añadir miembro</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Introduce el email de la persona. Debe tener una cuenta en TaskFlow.
        </p>
        <form onSubmit={submit} className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            autoFocus
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="compa@empresa.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {busy && <IconSpinner className="h-4 w-4" />}
              Añadir
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function CreateBoardModal({ open, teamId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { board } = await api.post(`/teams/${teamId}/boards`, { name, color });
      onCreated(board);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Nuevo tablero</h2>
        <p className="mt-0.5 text-sm text-slate-500">Se creará con las columnas: Por hacer, En progreso y Hecho.</p>
        <form onSubmit={submit} className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre del tablero</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Lanzamiento Q3"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <label className="mt-4 mb-1.5 block text-sm font-medium text-slate-700">Color</label>
          <div className="flex gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-lg transition ${
                  color === c ? "scale-110 ring-2 ring-slate-400 ring-offset-2" : "opacity-80 hover:opacity-100"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {busy && <IconSpinner className="h-4 w-4" />}
              Crear tablero
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function EditTeamModal({ open, team, onClose, onSaved }) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const didInit = useRef(false);

  if (!didInit.current) {
    didInit.current = true;
    setName(team.name);
    setDescription(team.description || "");
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.patch(`/teams/${team.id}`, { name, description });
      didInit.current = false;
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Editar equipo</h2>
        <form onSubmit={submit} className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mb-5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {busy && <IconSpinner className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
