import { Router } from "express";
import { get, all, run, transaction } from "../db.js";
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

async function boardAccess(req, res, boardId) {
  const board = await get("SELECT * FROM boards WHERE id = ?", [boardId]);
  if (!board) {
    res.status(404).json({ error: "Tablero no encontrado" });
    return null;
  }
  if (!(await memberOf(req, res, board.team_id))) return null;
  return board;
}

router.get("/teams/:teamId/boards", async (req, res) => {
  if (!(await memberOf(req, res, Number(req.params.teamId)))) return;
  const boards = await all(
    `SELECT b.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) AS task_count
     FROM boards b WHERE b.team_id = ? ORDER BY b.position, b.created_at`,
    [Number(req.params.teamId)]
  );
  res.json({ boards: boards.map((b) => ({ ...b, task_count: Number(b.task_count) })) });
});

router.post("/teams/:teamId/boards", async (req, res) => {
  const m = await memberOf(req, res, Number(req.params.teamId));
  if (!m) return;
  const { name, color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre del tablero es obligatorio" });
  const maxPos = (await get("SELECT COALESCE(MAX(position), 0) AS p FROM boards WHERE team_id = ?", [Number(req.params.teamId)])).p;
  const id = await transaction(async (q) => {
    const board = await q.run(
      "INSERT INTO boards (team_id, name, color, position) VALUES (?, ?, ?, ?) RETURNING id",
      [Number(req.params.teamId), name.trim(), color || "#6366f1", maxPos + 1]
    );
    const defaults = [
      ["Por hacer", "#94a3b8"],
      ["En progreso", "#f59e0b"],
      ["Hecho", "#10b981"],
    ];
    for (let i = 0; i < defaults.length; i++) {
      const [colName, colColor] = defaults[i];
      await q.run("INSERT INTO columns (board_id, name, color, position) VALUES (?, ?, ?, ?)", [
        board.lastInsertRowid,
        colName,
        colColor,
        i,
      ]);
    }
    return board.lastInsertRowid;
  });
  res.status(201).json({ board: await getBoard(id) });
});

async function getBoard(id) {
  const board = await get("SELECT * FROM boards WHERE id = ?", [id]);
  if (!board) return null;
  const columns = await all("SELECT * FROM columns WHERE board_id = ? ORDER BY position, id", [id]);
  const tasks = await all(
    `SELECT t.*, 
      u.name AS assignee_name, u.avatar_color AS assignee_color,
      c.name AS creator_name,
      (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS comment_count
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN users c ON c.id = t.created_by
     WHERE t.board_id = ? ORDER BY t.position, t.id`,
    [id]
  );
  return { ...board, columns, tasks: tasks.map((t) => ({ ...t, comment_count: Number(t.comment_count) })) };
}

router.get("/boards/:id", async (req, res) => {
  const board = await boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  res.json({ board: await getBoard(board.id) });
});

router.patch("/boards/:id", async (req, res) => {
  const board = await boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  const { name, color } = req.body || {};
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: "El nombre no puede estar vacío" });
  await run("UPDATE boards SET name = ?, color = ? WHERE id = ?", [
    name !== undefined ? name.trim() : board.name,
    color || board.color,
    board.id,
  ]);
  res.json({ board: await getBoard(board.id) });
});

router.delete("/boards/:id", async (req, res) => {
  const board = await boardAccess(req, res, Number(req.params.id));
  if (!board) return;
  await run("DELETE FROM boards WHERE id = ?", [board.id]);
  res.json({ ok: true });
});

export default router;
