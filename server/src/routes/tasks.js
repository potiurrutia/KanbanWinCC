import { Router } from "express";
import { get, all, run } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

async function memberOf(req, res, teamId) {
  const m = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, req.userId]);
  if (!m) {
    res.status(403).json({ error: "No eres miembro de este equipo" });
    return null;
  }
  return m;
}

async function taskAccess(req, res, taskId) {
  const task = await get(
    "SELECT t.*, b.team_id FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = ?",
    [taskId]
  );
  if (!task) {
    res.status(404).json({ error: "Tarea no encontrada" });
    return null;
  }
  if (!(await memberOf(req, res, task.team_id))) return null;
  return task;
}

async function boardAccess(req, res, boardId) {
  const board = await get("SELECT * FROM boards WHERE id = ?", [boardId]);
  if (!board) {
    res.status(404).json({ error: "Tablero no encontrado" });
    return null;
  }
  if (!(await memberOf(req, res, board.team_id))) return null;
  return board;
}

function serialize(task) {
  return {
    id: task.id,
    board_id: task.board_id,
    column_id: task.column_id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    due_date: task.due_date,
    position: task.position,
    assignee_id: task.assignee_id,
    assignee_name: task.assignee_name || null,
    assignee_color: task.assignee_color || null,
    created_by: task.created_by,
    creator_name: task.creator_name || null,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

async function findTask(id) {
  return get(
    `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color, c.name AS creator_name,
      (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS comment_count
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN users c ON c.id = t.created_by
     WHERE t.id = ?`,
    [id]
  );
}

router.get("/boards/:id/tasks", async (req, res) => {
  const board = await boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  const tasks = await all(
    `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color, c.name AS creator_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN users c ON c.id = t.created_by
     WHERE t.board_id = ? ORDER BY t.position, t.id`,
    [board.id]
  );
  res.json({ tasks: tasks.map(serialize) });
});

router.post("/boards/:id/tasks", async (req, res) => {
  const board = await boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  const { title, description, column_id, priority, due_date, assignee_id } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "El título de la tarea es obligatorio" });
  let columnId = column_id;
  if (!columnId) {
    const first = await get("SELECT id FROM columns WHERE board_id = ? ORDER BY position, id LIMIT 1", [board.id]);
    if (!first) return res.status(400).json({ error: "El tablero no tiene columnas" });
    columnId = first.id;
  } else {
    const col = await get("SELECT * FROM columns WHERE id = ? AND board_id = ?", [columnId, board.id]);
    if (!col) return res.status(400).json({ error: "Columna inválida" });
  }
  if (assignee_id) {
    const m = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [
      board.team_id,
      assignee_id,
    ]);
    if (!m) return res.status(400).json({ error: "El asignado no es miembro del equipo" });
  }
  const maxPos = (await get("SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE column_id = ?", [columnId])).p;
  const result = await run(
    `INSERT INTO tasks (board_id, column_id, title, description, priority, due_date, position, assignee_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      board.id,
      columnId,
      title.trim(),
      (description || "").trim(),
      priority || "medium",
      due_date || null,
      maxPos + 1,
      assignee_id || null,
      req.userId,
    ]
  );
  res.status(201).json({ task: serialize(await findTask(result.lastInsertRowid)) });
});

router.patch("/tasks/:id", async (req, res) => {
  const task = await taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const { title, description, priority, due_date, assignee_id, column_id } = req.body || {};
  if (title !== undefined && !title.trim()) return res.status(400).json({ error: "El título no puede estar vacío" });
  if (assignee_id !== undefined && assignee_id !== null) {
    const m = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [
      task.team_id,
      assignee_id,
    ]);
    if (!m) return res.status(400).json({ error: "El asignado no es miembro del equipo" });
  }
  if (column_id !== undefined) {
    const col = await get("SELECT * FROM columns WHERE id = ? AND board_id = ?", [column_id, task.board_id]);
    if (!col) return res.status(400).json({ error: "Columna inválida" });
  }
  const nextDueDate = due_date !== undefined ? due_date : task.due_date;
  await run(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      priority = COALESCE(?, priority),
      due_date = ?,
      assignee_id = ?,
      column_id = COALESCE(?, column_id),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      title !== undefined ? title.trim() : null,
      description !== undefined ? description : null,
      priority || null,
      nextDueDate,
      assignee_id !== undefined ? assignee_id : task.assignee_id,
      column_id ?? null,
      task.id,
    ]
  );
  res.json({ task: serialize(await findTask(task.id)) });
});

router.post("/tasks/:id/move", async (req, res) => {
  const task = await taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const { column_id, position } = req.body || {};
  const col = await get("SELECT * FROM columns WHERE id = ? AND board_id = ?", [column_id, task.board_id]);
  if (!col) return res.status(400).json({ error: "Columna inválida" });
  const target = (
    await get(
      `SELECT COALESCE(MAX(position), 0) AS p FROM tasks
       WHERE column_id = ? AND id != ?`,
      [column_id, task.id]
    )
  ).p;
  const newPos = position !== undefined && position !== null ? position : target + 1;
  await run(
    "UPDATE tasks SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [column_id, newPos, task.id]
  );
  res.json({ task: serialize(await findTask(task.id)) });
});

router.delete("/tasks/:id", async (req, res) => {
  const task = await taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  await run("DELETE FROM tasks WHERE id = ?", [task.id]);
  res.json({ ok: true });
});

router.get("/tasks/:id/comments", async (req, res) => {
  const task = await taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const comments = await all(
    `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
     FROM task_comments c JOIN users u ON u.id = c.user_id
     WHERE c.task_id = ? ORDER BY c.created_at ASC, c.id ASC`,
    [task.id]
  );
  res.json({ comments });
});

router.post("/tasks/:id/comments", async (req, res) => {
  const task = await taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "El comentario no puede estar vacío" });
  const result = await run("INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?) RETURNING id", [
    task.id,
    req.userId,
    body.trim(),
  ]);
  const comment = await get(
    `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
     FROM task_comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [result.lastInsertRowid]
  );
  res.status(201).json({ comment });
});

router.delete("/comments/:id", async (req, res) => {
  const comment = await get("SELECT * FROM task_comments WHERE id = ?", [Number(req.params.id)]);
  if (!comment) return res.status(404).json({ error: "Comentario no encontrado" });
  const teamId = (
    await get("SELECT team_id FROM boards WHERE id = (SELECT board_id FROM tasks WHERE id = ?)", [comment.task_id])
  ).team_id;
  if (!(await memberOf(req, res, teamId))) return;
  const owner = await get("SELECT owner_id FROM teams WHERE id = ?", [teamId]);
  if (comment.user_id !== req.userId && owner.owner_id !== req.userId) {
    return res.status(403).json({ error: "No puedes borrar este comentario" });
  }
  await run("DELETE FROM task_comments WHERE id = ?", [comment.id]);
  res.json({ ok: true });
});

export default router;
