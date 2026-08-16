import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Avatar from "./Avatar.jsx";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { IconCalendar, IconFlag, IconMessage, IconSend, IconSpinner, IconTrash, IconUserPlus } from "./Icons.jsx";

const PRIORITIES = [
  { value: "low", label: "Baja", color: "#94a3b8" },
  { value: "medium", label: "Media", color: "#f59e0b" },
  { value: "high", label: "Alta", color: "#ef4444" },
];

function Label({ icon, children }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {icon}
      {children}
    </span>
  );
}

export default function TaskModal({ task, members, columns, onClose, onUpdated, onDeleted }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [columnId, setColumnId] = useState(task.column_id);
  const [comments, setComments] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);

  const currentColumn = columns.find((c) => c.id === columnId);
  const currentPriority = PRIORITIES.find((p) => p.value === priority) || PRIORITIES[1];

  useEffect(() => {
    api
      .get(`/tasks/${task.id}/comments`)
      .then(({ comments }) => setComments(comments))
      .catch(() => setComments([]));
  }, [task.id]);

  async function save(patch) {
    setSaving(true);
    try {
      const { task: updated } = await api.patch(`/tasks/${task.id}`, patch);
      onUpdated(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  function saveTitle() {
    if (title.trim() && title.trim() !== task.title) save({ title: title.trim() });
  }

  function saveDescription() {
    if (description !== task.description) save({ description });
  }

  async function addComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { comment } = await api.post(`/tasks/${task.id}/comments`, { body: newComment.trim() });
    setComments((c) => [...c, comment]);
    setNewComment("");
  }

  async function deleteComment(comment) {
    if (!confirm("¿Eliminar este comentario?")) return;
    await api.delete(`/comments/${comment.id}`);
    setComments((c) => c.filter((x) => x.id !== comment.id));
  }

  async function removeTask() {
    if (!confirm("¿Eliminar esta tarea?")) return;
    await api.delete(`/tasks/${task.id}`);
    onDeleted(task);
  }

  return (
    <Modal open onClose={onClose} width="max-w-2xl">
      <div className="max-h-[85vh] overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: currentColumn?.color || "#94a3b8" }} />
            {currentColumn?.name}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <IconFlag className="h-3 w-3" style={{ color: currentPriority.color }} />
            Prioridad {currentPriority.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Creada por {task.creator_name} · {new Date(task.created_at).toLocaleDateString("es-ES")}
          </span>
        </div>

        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          rows={1}
          className="w-full resize-none text-xl font-bold leading-snug tracking-tight text-slate-900 outline-none focus:decoration-slate-200 focus:underline focus:underline-offset-4"
        />

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-5">
            <div>
              <Label icon={<IconFlag className="h-3 w-3" />}>Prioridad</Label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setPriority(p.value);
                      save({ priority: p.value });
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      priority === p.value
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: priority === p.value ? "white" : p.color }}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label icon={<IconUserPlus className="h-3 w-3" />}>Asignado a</Label>
              <select
                value={assigneeId}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : null;
                  setAssigneeId(e.target.value);
                  save({ assignee_id: value });
                }}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label icon={<IconCalendar className="h-3 w-3" />}>Fecha límite</Label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  save({ due_date: e.target.value || null });
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <Label icon={<IconSend className="h-3 w-3 rotate-180" />}>Mover a columna</Label>
              <select
                value={columnId}
                onChange={async (e) => {
                  const next = Number(e.target.value);
                  setColumnId(next);
                  const { task: updated } = await api.post(`/tasks/${task.id}/move`, { column_id: next });
                  onUpdated(updated);
                }}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:border-l sm:border-slate-100 sm:pl-6">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Descripción</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="Añade una descripción más detallada…"
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="mt-8">
          <span className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <IconMessage className="h-3 w-3" />
            Comentarios ({comments ? comments.length : 0})
          </span>

          {comments === null ? (
            <div className="flex justify-center py-6">
              <IconSpinner className="h-5 w-5 text-slate-300" />
            </div>
          ) : comments.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400">
              Sin comentarios todavía. Deja el primero.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="group flex gap-3">
                  <Avatar user={{ name: c.user_name, avatar_color: c.user_color }} size={30} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{c.user_name}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(c.created_at).toLocaleString("es-ES", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {c.user_id === user?.id && (
                        <button
                          onClick={() => deleteComment(c)}
                          className="flex h-5 w-5 items-center justify-center rounded text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addComment} className="mt-4 flex gap-2">
            <Avatar user={user} size={32} />
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario…"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-40"
            >
              <IconSend className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="mt-8 flex justify-between border-t border-slate-100 pt-4">
          <button
            onClick={removeTask}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
          >
            <IconTrash className="h-4 w-4" />
            Eliminar tarea
          </button>
          <div className="text-xs text-slate-300">{saving ? "Guardando…" : "Cambios guardados automáticamente"}</div>
        </div>
      </div>
    </Modal>
  );
}
