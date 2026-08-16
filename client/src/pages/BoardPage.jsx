import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { api } from "../api.js";
import KanbanColumn from "../components/KanbanColumn.jsx";
import TaskCard from "../components/TaskCard.jsx";
import TaskModal from "../components/TaskModal.jsx";
import { IconPlus, IconSpinner, IconTrash } from "../components/Icons.jsx";

export default function BoardPage() {
  const { teamId, boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumn, setNewColumn] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [boardName, setBoardName] = useState("");
  const firstLoad = useRef(true);

  const loadBoard = useCallback(() => {
    api
      .get(`/boards/${boardId}`)
      .then(({ board }) => {
        setBoard(board);
        setError("");
      })
      .catch(() => {
        setError("No se pudo cargar el tablero.");
      });
  }, [boardId]);

  useEffect(() => {
    setBoard(null);
    setError("");
    setSelectedTask(null);
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!board?.team_id) return;
    api
      .get(`/teams/${board.team_id}`)
      .then(({ team }) => setMembers(team.members))
      .catch(() => {});
  }, [board?.team_id]);

  useEffect(() => {
    firstLoad.current = true;
    const timer = setInterval(() => {
      if (firstLoad.current) {
        firstLoad.current = false;
        return;
      }
      api
        .get(`/boards/${boardId}`)
        .then(({ board }) => setBoard((prev) => (prev && JSON.stringify(prev) === JSON.stringify(board) ? prev : board)))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [boardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const tasksByColumn = useMemo(() => {
    const map = {};
    if (!board) return map;
    board.columns.forEach((c) => (map[c.id] = []));
    board.tasks.forEach((t) => {
      if (map[t.column_id]) map[t.column_id].push(t);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.position === b.position ? a.id - b.id : a.position - b.position))
    );
    return map;
  }, [board]);

  function applyMove(taskId, destColumnId, overId) {
    if (!board) return;
    const moved = board.tasks.find((t) => t.id === taskId);
    if (!moved) return;
    const rest = board.tasks.filter((t) => t.id !== taskId);
    const destTasks = rest.filter((t) => t.column_id === destColumnId).sort((a, b) => a.position - b.position);

    let index = destTasks.length;
    if (overId && overId !== destColumnId && typeof overId === "number") {
      const overIndex = destTasks.findIndex((t) => t.id === overId);
      if (overIndex !== -1) index = overIndex;
    }

    const before = index > 0 ? destTasks[index - 1].position : null;
    const after = index < destTasks.length ? destTasks[index].position : null;
    let newPos;
    if (before == null && after == null) newPos = 1;
    else if (before == null) newPos = after / 2;
    else if (after == null) newPos = before + 1;
    else newPos = (before + after) / 2;

    const nextTasks = [...rest, { ...moved, column_id: destColumnId, position: newPos }];
    setBoard((prev) => ({ ...prev, tasks: nextTasks }));

    api
      .post(`/tasks/${taskId}/move`, { column_id: destColumnId, position: newPos })
      .then(({ task }) => {
        setBoard((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)) }));
      })
      .catch(() => loadBoard());
  }

  function onDragStart(event) {
    const task = event.active.data.current?.task;
    if (event.active.data.current?.type === "task") setActiveTask(task);
  }

  function onDragEnd(event) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    if (active.data.current?.type !== "task") return;
    if (active.id === over.id) return;

    const overData = over.data.current;
    let destColumnId;
    let overId = over.id;
    if (overData?.type === "column") {
      destColumnId = over.id;
      overId = null;
    } else {
      destColumnId = overData?.column_id;
    }
    if (!destColumnId) return;
    applyMove(active.id, destColumnId, overId);
  }

  async function addTask(column, title) {
    const { task } = await api.post(`/boards/${boardId}/tasks`, { title, column_id: column.id });
    setBoard((prev) => ({ ...prev, tasks: [...prev.tasks, task] }));
  }

  async function addColumn() {
    if (!newColumn.trim()) {
      setAddingColumn(false);
      return;
    }
    const { column } = await api.post(`/boards/${boardId}/columns`, { name: newColumn.trim() });
    setBoard((prev) => ({ ...prev, columns: [...prev.columns, column] }));
    setNewColumn("");
    setAddingColumn(false);
  }

  async function renameColumn(column, name) {
    const { column: updated } = await api.patch(`/columns/${column.id}`, { name });
    setBoard((prev) => ({ ...prev, columns: prev.columns.map((c) => (c.id === updated.id ? updated : c)) }));
  }

  async function deleteColumn(column) {
    await api.delete(`/columns/${column.id}`);
    loadBoard();
  }

  async function saveBoardName() {
    if (boardName.trim() && boardName.trim() !== board.name) {
      const { board: updated } = await api.patch(`/boards/${boardId}`, { name: boardName.trim() });
      setBoard((prev) => ({ ...prev, name: updated.name }));
    }
    setEditingName(false);
  }

  function updateTask(updated) {
    setBoard((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) }));
    setSelectedTask((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  function deleteTask(task) {
    setBoard((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== task.id) }));
    setSelectedTask(null);
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-slate-600">{error}</p>
        <button
          onClick={() => navigate(`/t/${teamId}`)}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Volver al equipo
        </button>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconSpinner className="h-6 w-6 text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-3.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: board.color }} />
          {editingName ? (
            <input
              autoFocus
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onBlur={saveBoardName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveBoardName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="rounded-lg border border-indigo-300 bg-white px-2 py-1 text-lg font-bold outline-none"
            />
          ) : (
            <h1
              onDoubleClick={() => {
                setBoardName(board.name);
                setEditingName(true);
              }}
              title="Doble clic para renombrar"
              className="truncate text-lg font-bold tracking-tight text-slate-900"
            >
              {board.name}
            </h1>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {board.tasks.length} tareas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm(`¿Eliminar el tablero "${board.name}" y todas sus tareas?`)) return;
              await api.delete(`/boards/${boardId}`);
              navigate(`/t/${teamId}`);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
            title="Eliminar tablero"
          >
            <IconTrash className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAddingColumn(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            <IconPlus className="h-4 w-4" />
            Columna
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full items-stretch gap-4 px-6 py-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByColumn[column.id] || []}
                onAddTask={addTask}
                onOpenTask={(task) => setSelectedTask(task)}
                onRename={renameColumn}
                onDelete={deleteColumn}
                commentCounts={Object.fromEntries(
                  (tasksByColumn[column.id] || []).map((t) => [t.id, t.comment_count || 0])
                )}
              />
            ))}

            <div className="w-72 shrink-0">
              {addingColumn ? (
                <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5 animate-fade-in">
                  <input
                    autoFocus
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addColumn();
                      if (e.key === "Escape") {
                        setAddingColumn(false);
                        setNewColumn("");
                      }
                    }}
                    placeholder="Nombre de la columna"
                    className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-indigo-300"
                  />
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={addColumn}
                      className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600"
                    >
                      Añadir
                    </button>
                    <button
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumn("");
                      }}
                      className="px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/50 px-4 py-3 text-sm font-medium text-slate-500 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
                >
                  <IconPlus className="h-4 w-4" />
                  Añadir columna
                </button>
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rotate-1 cursor-grabbing opacity-90">
              <TaskCard task={activeTask} onClick={() => {}} commentCount={0} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          members={members}
          columns={board.columns}
          onClose={() => setSelectedTask(null)}
          onUpdated={updateTask}
          onDeleted={deleteTask}
        />
      )}
    </div>
  );
}
