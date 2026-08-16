import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { publicUser } from "./auth.js";

const router = Router();
router.use(requireAuth);

function memberOf(req, res, teamId) {
  const m = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, req.userId);
  if (!m) {
    res.status(403).json({ error: "No eres miembro de este equipo" });
    return null;
  }
  return m;
}

function taskAccess(req, res, taskId) {
  const task = db
    .prepare(
      "SELECT t.*, b.team_id FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = ?"
    )
    .get(taskId);
  if (!task) {
    res.status(404).json({ error: "Tarea no encontrada" });
    return null;
  }
  if (!memberOf(req, res, task.team_id)) return null;
  return task;
}

function boardAccess(req, res, boardId) {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
  if (!board) {
    res.status(404).json({ error: "Tablero no encontrado" });
    return null;
  }
  if (!memberOf(req, res, board.team_id)) return null;
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

function findTask(id) {
  return db
    .prepare(
      `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color, c.name AS creator_name,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS comment_count
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users c ON c.id = t.created_by
       WHERE t.id = ?`
    )
    .get(id);
}

router.get("/boards/:id/tasks", (req, res) => {
  const board = boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  const tasks = db
    .prepare(
      `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color, c.name AS creator_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users c ON c.id = t.created_by
       WHERE t.board_id = ? ORDER BY t.position, t.id`
    )
    .all(board.id);
  res.json({ tasks: tasks.map(serialize) });
});

router.post("/boards/:id/tasks", (req, res) => {
  const board = boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  const { title, description, column_id, priority, due_date, assignee_id } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "El título de la tarea es obligatorio" });
  let columnId = column_id;
  if (!columnId) {
    const first = db
      .prepare("SELECT id FROM columns WHERE board_id = ? ORDER BY position, id LIMIT 1")
      .get(board.id);
    if (!first) return res.status(400).json({ error: "El tablero no tiene columnas" });
    columnId = first.id;
  } else {
    const col = db.prepare("SELECT * FROM columns WHERE id = ? AND board_id = ?").get(columnId, board.id);
    if (!col) return res.status(400).json({ error: "Columna inválida" });
  }
  if (assignee_id) {
    const m = db
      .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(board.team_id, assignee_id);
    if (!m) return res.status(400).json({ error: "El asignado no es miembro del equipo" });
  }
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE column_id = ?")
    .get(columnId).p;
  const result = db
    .prepare(
      `INSERT INTO tasks (board_id, column_id, title, description, priority, due_date, position, assignee_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      board.id,
      columnId,
      title.trim(),
      (description || "").trim(),
      priority || "medium",
      due_date || null,
      maxPos + 1,
      assignee_id || null,
      req.userId
    );
  res.status(201).json({ task: serialize(findTask(result.lastInsertRowid)) });
});

router.patch("/tasks/:id", (req, res) => {
  const task = taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const { title, description, priority, due_date, assignee_id, column_id } = req.body || {};
  if (title !== undefined && !title.trim()) return res.status(400).json({ error: "El título no puede estar vacío" });
  if (assignee_id !== undefined && assignee_id !== null) {
    const m = db
      .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(task.team_id, assignee_id);
    if (!m) return res.status(400).json({ error: "El asignado no es miembro del equipo" });
  }
  if (column_id !== undefined) {
    const col = db.prepare("SELECT * FROM columns WHERE id = ? AND board_id = ?").get(column_id, task.board_id);
    if (!col) return res.status(400).json({ error: "Columna inválida" });
  }
  db.prepare(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      priority = COALESCE(?, priority),
      due_date = CASE WHEN ? IS NULL AND ? IS NULL THEN due_date ELSE ? END,
      assignee_id = ?,
      column_id = COALESCE(?, column_id),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title !== undefined ? title.trim() : null,
    description !== undefined ? description : null,
    priority || null,
    due_date ?? null,
    due_date !== undefined ? 1 : 0,
    due_date ?? null,
    assignee_id !== undefined ? assignee_id : task.assignee_id,
    column_id ?? null,
    task.id
  );
  res.json({ task: serialize(findTask(task.id)) });
});

router.post("/tasks/:id/move", (req, res) => {
  const task = taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const { column_id, position } = req.body || {};
  const col = db
    .prepare("SELECT * FROM columns WHERE id = ? AND board_id = ?")
    .get(column_id, task.board_id);
  if (!col) return res.status(400).json({ error: "Columna inválida" });
  const target = db
    .prepare(
      `SELECT COALESCE(MAX(position), 0) AS p FROM tasks
       WHERE column_id = ? AND id != ?`
    )
    .get(column_id, task.id).p;
  const newPos = position !== undefined && position !== null ? position : target + 1;
  db.prepare("UPDATE tasks SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?").run(
    column_id,
    newPos,
    task.id
  );
  res.json({ task: serialize(findTask(task.id)) });
});

router.delete("/tasks/:id", (req, res) => {
  const task = taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
  res.json({ ok: true });
});

router.get("/tasks/:id/comments", (req, res) => {
  const task = taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const comments = db
    .prepare(
      `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
       FROM task_comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ? ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(task.id);
  res.json({ comments });
});

router.post("/tasks/:id/comments", (req, res) => {
  const task = taskAccess(req, res, Number(req.params.id));
  if (!task) return;
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "El comentario no puede estar vacío" });
  const result = db
    .prepare("INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)")
    .run(task.id, req.userId, body.trim());
  const comment = db
    .prepare(
      `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
       FROM task_comments c JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .get(result.lastInsertRowid);
  res.status(201).json({ comment });
});

router.delete("/comments/:id", (req, res) => {
  const comment = db.prepare("SELECT * FROM task_comments WHERE id = ?").get(Number(req.params.id));
  if (!comment) return res.status(404).json({ error: "Comentario no encontrado" });
  const teamId = db
    .prepare("SELECT team_id FROM boards WHERE id = (SELECT board_id FROM tasks WHERE id = ?)")
    .get(comment.task_id).team_id;
  if (!memberOf(req, res, teamId)) return;
  const owner = db.prepare("SELECT owner_id FROM teams WHERE id = ?").get(teamId);
  if (comment.user_id !== req.userId && owner.owner_id !== req.userId) {
    return res.status(403).json({ error: "No puedes borrar este comentario" });
  }
  db.prepare("DELETE FROM task_comments WHERE id = ?").run(comment.id);
  res.json({ ok: true });
});

export default router;
