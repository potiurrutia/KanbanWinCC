import { Router } from "express";
import { db, transaction } from "../db.js";
import { requireAuth } from "../auth.js";

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

function boardAccess(req, res, boardId) {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
  if (!board) {
    res.status(404).json({ error: "Tablero no encontrado" });
    return null;
  }
  if (!memberOf(req, res, board.team_id)) return null;
  return board;
}

router.get("/teams/:teamId/boards", (req, res) => {
  if (!memberOf(req, res, Number(req.params.teamId))) return;
  const boards = db
    .prepare(
      `SELECT b.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) AS task_count
       FROM boards b WHERE b.team_id = ? ORDER BY b.position, b.created_at`
    )
    .all(Number(req.params.teamId));
  res.json({ boards });
});

router.post("/teams/:teamId/boards", (req, res) => {
  const m = memberOf(req, res, Number(req.params.teamId));
  if (!m) return;
  const { name, color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre del tablero es obligatorio" });
  const maxPos = db.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM boards WHERE team_id = ?").get(Number(req.params.teamId)).p;
  const id = transaction(() => {
    const board = db
      .prepare("INSERT INTO boards (team_id, name, color, position) VALUES (?, ?, ?, ?)")
      .run(Number(req.params.teamId), name.trim(), color || "#6366f1", maxPos + 1);
    const defaults = [
      ["Por hacer", "#94a3b8"],
      ["En progreso", "#f59e0b"],
      ["Hecho", "#10b981"],
    ];
    defaults.forEach(([colName, colColor], i) => {
      db.prepare("INSERT INTO columns (board_id, name, color, position) VALUES (?, ?, ?, ?)").run(
        board.lastInsertRowid,
        colName,
        colColor,
        i
      );
    });
    return board.lastInsertRowid;
  });
  res.status(201).json({ board: getBoard(id) });
});

function getBoard(id) {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(id);
  if (!board) return null;
  const columns = db
    .prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position, id")
    .all(id);
  const tasks = db
    .prepare(
      `SELECT t.*, 
        u.name AS assignee_name, u.avatar_color AS assignee_color,
        c.name AS creator_name,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS comment_count
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users c ON c.id = t.created_by
       WHERE t.board_id = ? ORDER BY t.position, t.id`
    )
    .all(id);
  return { ...board, columns, tasks };
}

router.get("/boards/:id", (req, res) => {
  const board = boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  res.json({ board: getBoard(board.id) });
});

router.patch("/boards/:id", (req, res) => {
  const board = boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  const { name, color } = req.body || {};
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: "El nombre no puede estar vacío" });
  db.prepare("UPDATE boards SET name = ?, color = ? WHERE id = ?").run(
    name !== undefined ? name.trim() : board.name,
    color || board.color,
    board.id
  );
  res.json({ board: getBoard(board.id) });
});

router.delete("/boards/:id", (req, res) => {
  const board = boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  db.prepare("DELETE FROM boards WHERE id = ?").run(board.id);
  res.json({ ok: true });
});

export default router;
