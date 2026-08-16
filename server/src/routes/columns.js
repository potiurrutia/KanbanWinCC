import { Router } from "express";
import { db } from "../db.js";
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

function columnAccess(req, res, columnId) {
  const col = db
    .prepare(
      "SELECT c.*, b.team_id FROM columns c JOIN boards b ON b.id = c.board_id WHERE c.id = ?"
    )
    .get(columnId);
  if (!col) {
    res.status(404).json({ error: "Columna no encontrada" });
    return null;
  }
  if (!memberOf(req, res, col.team_id)) return null;
  return col;
}

router.post("/boards/:id/columns", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(Number(req.params.id));
  if (!board) return res.status(404).json({ error: "Tablero no encontrado" });
  if (!memberOf(req, res, board.team_id)) return;
  const { name, color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre de la columna es obligatorio" });
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS p FROM columns WHERE board_id = ?")
    .get(board.id).p;
  const result = db
    .prepare("INSERT INTO columns (board_id, name, color, position) VALUES (?, ?, ?, ?)")
    .run(board.id, name.trim(), color || "#94a3b8", maxPos + 1);
  const col = db.prepare("SELECT * FROM columns WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ column: col });
});

router.patch("/columns/:id", (req, res) => {
  const col = columnAccess(req, res, Number(req.params.id));
  if (!col) return;
  const { name, color } = req.body || {};
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: "El nombre no puede estar vacío" });
  db.prepare("UPDATE columns SET name = ?, color = ? WHERE id = ?").run(
    name !== undefined ? name.trim() : col.name,
    color || col.color,
    col.id
  );
  res.json({ column: db.prepare("SELECT * FROM columns WHERE id = ?").get(col.id) });
});

router.post("/boards/:id/columns/reorder", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(Number(req.params.id));
  if (!board) return res.status(404).json({ error: "Tablero no encontrado" });
  if (!memberOf(req, res, board.team_id)) return;
  const { columnIds } = req.body || {};
  if (!Array.isArray(columnIds)) return res.status(400).json({ error: "columnIds requerido" });
  const set = db.prepare("UPDATE columns SET position = ? WHERE id = ? AND board_id = ?");
  const tx = db.transaction(() => {
    columnIds.forEach((id, i) => set.run(i, id, board.id));
  });
  tx();
  res.json({ ok: true });
});

router.delete("/columns/:id", (req, res) => {
  const col = columnAccess(req, res, Number(req.params.id));
  if (!col) return;
  db.prepare("DELETE FROM columns WHERE id = ?").run(col.id);
  res.json({ ok: true });
});

export default router;
