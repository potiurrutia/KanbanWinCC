import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskCard from "./TaskCard.jsx";
import { IconPlus, IconTrash, IconX } from "./Icons.jsx";

function SortableTask({ task, commentCount, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick(task);
      }}
      className={isDragging ? "z-10 opacity-40" : ""}
    >
      <TaskCard task={task} commentCount={commentCount} onClick={() => {}} />
    </div>
  );
}

export default function KanbanColumn({ column, tasks, onAddTask, onOpenTask, onRename, onDelete, commentCounts }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  function saveRename() {
    if (draft.trim() && draft.trim() !== column.name) onRename(column, draft.trim());
    setEditing(false);
  }

  function submitTask() {
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    onAddTask(column, newTitle.trim());
    setNewTitle("");
    setAdding(false);
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-2xl bg-slate-800/60 transition ${
        isOver ? "ring-2 ring-indigo-500" : ""
      }`}
    >
      <div className="group flex items-center gap-2 px-3.5 pb-1 pt-3.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: column.color }} />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full rounded-md border border-indigo-500 bg-slate-900 px-1.5 py-0.5 text-sm font-semibold outline-none"
          />
        ) : (
          <h3
            onDoubleClick={() => {
              setDraft(column.name);
              setEditing(true);
            }}
            title="Doble clic para renombrar"
            className="flex-1 truncate text-sm font-semibold text-slate-200"
          >
            {column.name}
          </h3>
        )}
        <span className="text-xs font-medium text-slate-500">{tasks.length}</span>
        {!editing && (
          <button
            onClick={() => {
              if (confirm(`¿Eliminar la columna "${column.name}" y sus tareas?`)) onDelete(column);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-500 group-hover:opacity-100"
            title="Eliminar columna"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-2.5 py-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <SortableTask
                key={task.id}
                task={task}
                onClick={onOpenTask}
                commentCount={commentCounts[task.id] || 0}
              />
            ))}
          </div>
        </SortableContext>

        {adding ? (
          <div className="mt-2 rounded-xl bg-slate-900 p-2.5 shadow-sm ring-1 ring-white/5 animate-fade-in">
            <textarea
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitTask();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewTitle("");
                }
              }}
              placeholder="Título de la tarea"
              rows={2}
              className="w-full resize-none rounded-lg bg-slate-800 px-2.5 py-2 text-sm outline-none ring-1 ring-transparent transition focus:bg-slate-800 focus:ring-indigo-500"
            />
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={submitTask}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600"
              >
                Añadir
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-2 flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-800 hover:text-indigo-400 hover:shadow-sm"
          >
            <IconPlus className="h-4 w-4" />
            Añadir tarea
          </button>
        )}
      </div>
    </div>
  );
}
