import { Router } from "express";
import { get, all, run, transaction, generateInviteCode } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const teams = await all(
    `SELECT t.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     JOIN users u ON u.id = t.owner_id
     WHERE tm.user_id = ?
     ORDER BY t.created_at DESC`,
    [req.userId]
  );
  res.json({ teams: teams.map((t) => ({ ...t, member_count: Number(t.member_count) })) });
});

router.post("/", async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre del equipo es obligatorio" });
  const code = generateInviteCode();
  const id = await transaction(async (q) => {
    const team = await q.run(
      "INSERT INTO teams (name, description, owner_id, invite_code) VALUES (?, ?, ?, ?) RETURNING id",
      [name.trim(), (description || "").trim(), req.userId, code]
    );
    await q.run("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)", [
      team.lastInsertRowid,
      req.userId,
      "owner",
    ]);
    const board = await q.run(
      "INSERT INTO boards (team_id, name, color, position) VALUES (?, ?, ?, 0) RETURNING id",
      [team.lastInsertRowid, "General", "#6366f1"]
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
    return team.lastInsertRowid;
  });
  res.status(201).json({ team: await getTeam(id) });
});

async function membership(req, res, teamId, roles = ["owner", "admin"]) {
  const m = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, req.userId]);
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

async function getTeam(id) {
  const team = await get("SELECT * FROM teams WHERE id = ?", [id]);
  if (!team) return null;
  const members = await all(
    `SELECT tm.role, u.id, u.name, u.email, u.avatar_color
     FROM team_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? ORDER BY tm.role DESC, u.name`,
    [id]
  );
  return { ...team, members };
}

router.get("/:id", async (req, res) => {
  const m = await membership(req, res, Number(req.params.id));
  if (!m) return;
  res.json({ team: await getTeam(Number(req.params.id)) });
});

router.patch("/:id", async (req, res) => {
  const m = await membership(req, res, Number(req.params.id));
  if (!m) return;
  const { name, description } = req.body || {};
  const team = await get("SELECT * FROM teams WHERE id = ?", [Number(req.params.id)]);
  const nextName = name !== undefined ? name.trim() : team.name;
  if (!nextName) return res.status(400).json({ error: "El nombre no puede estar vacío" });
  await run("UPDATE teams SET name = ?, description = ? WHERE id = ?", [
    nextName,
    description !== undefined ? description : team.description,
    team.id,
  ]);
  res.json({ team: await getTeam(team.id) });
});

router.delete("/:id", async (req, res) => {
  const m = await membership(req, res, Number(req.params.id), ["owner"]);
  if (!m) return;
  await run("DELETE FROM teams WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
});

router.post("/join", async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Introduce el código de invitación" });
  const team = await get("SELECT * FROM teams WHERE UPPER(invite_code) = ?", [String(code).trim().toUpperCase()]);
  if (!team) return res.status(404).json({ error: "Código de invitación no válido" });
  const existing = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [
    team.id,
    req.userId,
  ]);
  if (existing) return res.json({ team: await getTeam(team.id), already: true });
  await run("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')", [team.id, req.userId]);
  res.status(201).json({ team: await getTeam(team.id) });
});

router.post("/:id/join", async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Introduce el código de invitación" });
  const team = await get("SELECT * FROM teams WHERE UPPER(invite_code) = ?", [String(code).trim().toUpperCase()]);
  if (!team) return res.status(404).json({ error: "Código de invitación no válido" });
  const existing = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [
    team.id,
    req.userId,
  ]);
  if (existing) return res.json({ team: await getTeam(team.id), already: true });
  await run("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')", [team.id, req.userId]);
  res.status(201).json({ team: await getTeam(team.id) });
});

router.post("/:id/members", async (req, res) => {
  const m = await membership(req, res, Number(req.params.id), ["owner", "admin"]);
  if (!m) return;
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "El email es obligatorio" });
  const user = await get("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  if (!user) return res.status(404).json({ error: "No existe ningún usuario con ese email" });
  const existing = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [
    Number(req.params.id),
    user.id,
  ]);
  if (existing) return res.status(409).json({ error: "Ese usuario ya es miembro" });
  await run("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')", [
    Number(req.params.id),
    user.id,
  ]);
  res.status(201).json({ team: await getTeam(Number(req.params.id)) });
});

router.delete("/:id/members/:userId", async (req, res) => {
  const m = await membership(req, res, Number(req.params.id), ["owner", "admin"]);
  if (!m) return;
  const teamId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (userId === req.userId) return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
  const target = await get("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);
  if (!target) return res.status(404).json({ error: "El usuario no es miembro" });
  if (target.role === "owner") return res.status(403).json({ error: "No puedes eliminar al propietario" });
  await run("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);
  res.json({ team: await getTeam(teamId) });
});

export default router;
