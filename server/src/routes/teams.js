import { Router } from "express";
import { db, generateInviteCode, transaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { publicUser } from "./auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const teams = db
    .prepare(
      `SELECT t.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       JOIN users u ON u.id = t.owner_id
       WHERE tm.user_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.userId);
  res.json({ teams });
});

router.post("/", (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre del equipo es obligatorio" });
  const code = generateInviteCode();
  const id = transaction(() => {
    const team = db
      .prepare("INSERT INTO teams (name, description, owner_id, invite_code) VALUES (?, ?, ?, ?)")
      .run(name.trim(), (description || "").trim(), req.userId, code);
    db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)").run(
      team.lastInsertRowid,
      req.userId,
      "owner"
    );
    const board = db
      .prepare("INSERT INTO boards (team_id, name, color, position) VALUES (?, ?, ?, 0)")
      .run(team.lastInsertRowid, "General", "#6366f1");
    const defaults = [
      ["Por hacer", "#94a3b8"],
      ["En progreso", "#f59e0b"],
      ["Hecho", "#10b981"],
    ];
    defaults.forEach(([colName, color], i) => {
      db.prepare("INSERT INTO columns (board_id, name, color, position) VALUES (?, ?, ?, ?)").run(
        board.lastInsertRowid,
        colName,
        color,
        i
      );
    });
    return team.lastInsertRowid;
  });
  res.status(201).json({ team: getTeam(id) });
});

function membership(req, res, teamId, roles = ["owner", "admin"]) {
  const m = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, req.userId);
  if (!m) {
    res.status(403).json({ error: "No eres miembro de este equipo" });
    return null;
  }
  if (!roles.includes(m.role)) {
    res.status(403).json({ error: "No tienes permisos para esta acción" });
    return null;
  }
  return m;
}

function getTeam(id) {
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(id);
  if (!team) return null;
  const members = db
    .prepare(
      `SELECT tm.role, u.id, u.name, u.email, u.avatar_color
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ? ORDER BY tm.role DESC, u.name`
    )
    .all(id);
  return { ...team, members };
}

router.get("/:id", (req, res) => {
  const m = membership(req, res, Number(req.params.id));
  if (!m) return;
  res.json({ team: getTeam(Number(req.params.id)) });
});

router.patch("/:id", (req, res) => {
  const m = membership(req, res, Number(req.params.id));
  if (!m) return;
  const { name, description } = req.body || {};
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(Number(req.params.id));
  const nextName = name !== undefined ? name.trim() : team.name;
  if (!nextName) return res.status(400).json({ error: "El nombre no puede estar vacío" });
  db.prepare("UPDATE teams SET name = ?, description = ? WHERE id = ?").run(
    nextName,
    description !== undefined ? description : team.description,
    team.id
  );
  res.json({ team: getTeam(team.id) });
});

router.delete("/:id", (req, res) => {
  const m = membership(req, res, Number(req.params.id), ["owner"]);
  if (!m) return;
  db.prepare("DELETE FROM teams WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

router.post("/join", (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Introduce el código de invitación" });
  const team = db
    .prepare("SELECT * FROM teams WHERE UPPER(invite_code) = ?")
    .get(String(code).trim().toUpperCase());
  if (!team) return res.status(404).json({ error: "Código de invitación no válido" });
  const existing = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(team.id, req.userId);
  if (existing) return res.json({ team: getTeam(team.id), already: true });
  db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')").run(
    team.id,
    req.userId
  );
  res.status(201).json({ team: getTeam(team.id) });
});

router.post("/:id/join", (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Introduce el código de invitación" });
  const team = db
    .prepare("SELECT * FROM teams WHERE UPPER(invite_code) = ?")
    .get(String(code).trim().toUpperCase());
  if (!team) return res.status(404).json({ error: "Código de invitación no válido" });
  const existing = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(team.id, req.userId);
  if (existing) return res.json({ team: getTeam(team.id), already: true });
  db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')").run(
    team.id,
    req.userId
  );
  res.status(201).json({ team: getTeam(team.id) });
});

router.post("/:id/members", (req, res) => {
  const m = membership(req, res, Number(req.params.id), ["owner", "admin"]);
  if (!m) return;
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "El email es obligatorio" });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!user) return res.status(404).json({ error: "No existe ningún usuario con ese email" });
  const existing = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(Number(req.params.id), user.id);
  if (existing) return res.status(409).json({ error: "Ese usuario ya es miembro" });
  db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')").run(
    Number(req.params.id),
    user.id
  );
  res.status(201).json({ team: getTeam(Number(req.params.id)) });
});

router.delete("/:id/members/:userId", (req, res) => {
  const m = membership(req, res, Number(req.params.id), ["owner", "admin"]);
  if (!m) return;
  const teamId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (userId === req.userId) return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
  const target = db.prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?").get(teamId, userId);
  if (!target) return res.status(404).json({ error: "El usuario no es miembro" });
  if (target.role === "owner") return res.status(403).json({ error: "No puedes eliminar al propietario" });
  db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(teamId, userId);
  res.json({ team: getTeam(teamId) });
});

export default router;
