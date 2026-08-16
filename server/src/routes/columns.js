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

async function columnAccess(req, res, columnId) {
  const col = await get(
    "SELECT c.*, b.team_id FROM columns c JOIN boards b ON b.id = c.board_id WHERE c.id = ?",
    [columnId]
  );
  if (!col) {
    res.status(404).json({ error: "Columna no encontrada" });
    return null;
  }
  if (!(await memberOf(req, res, col.team_id))) return null;
  return col;
}

router.post("/boards/:id/columns", async (req, res) => {
  const board = await get("SELECT * FROM boards WHERE id = ?", [Number(req.params.id)]);
  if (!board) return res.status(404).json({ error: "Tablero no encontrado" });
  if (!(await memberOf(req, res, board.team_id))) return;
  const { name, color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre de la columna es obligatorio" });
  const maxPos = (await get("SELECT COALESCE(MAX(position), 0) AS p FROM columns WHERE board_id = ?", [board.id])).p;
  const result = await run(
    "INSERT INTO columns (board_id, name, color, position) VALUES (?, ?, ?, ?) RETURNING id",
    [board.id, name.trim(), color || "#94a3b8", maxPos + 1]
  );
  const col = await get("SELECT * FROM columns WHERE id = ?", [result.lastInsertRowid]);
  res.status(201).json({ column: col });
});

router.patch("/columns/:id", async (req, res) => {
  const col = await columnAccess(req, res, Number(req.params.id));
  if (!col) return;
  const { name, color } = req.body || {};
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: "El nombre no puede estar vacío" });
  await run("UPDATE columns SET name = ?, color = ? WHERE id = ?", [
    name !== undefined ? name.trim() : col.name,
    color || col.color,
    col.id,
  ]);
  res.json({ column: await get("SELECT * FROM columns WHERE id = ?", [col.id]) });
});

router.post("/boards/:id/columns/reorder", async (req, res) => {
  const board = await get("SELECT * FROM boards WHERE id = ?", [Number(req.params.id)]);
  if (!board) return res.status(404).json({ error: "Tablero no encontrado" });
  if (!(await memberOf(req, res, board.team_id))) return;
  const { columnIds } = req.body || {};
  if (!Array.isArray(columnIds)) return res.status(400).json({ error: "columnIds requerido" });
  await transaction(async (q) => {
    for (let i = 0; i < columnIds.length; i++) {
      await q.run("UPDATE columns SET position = ? WHERE id = ? AND board_id = ?", [i, columnIds[i], board.id]);
    }
  });
  res.json({ ok: true });
});

router.delete("/columns/:id", async (req, res) => {
  const col = await columnAccess(req, res, Number(req.params.id));
  if (!col) return;
  await run("DELETE FROM columns WHERE id = ?", [col.id]);
  res.json({ ok: true });
});

export default router;
