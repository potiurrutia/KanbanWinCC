import { Router } from "express";
import bcrypt from "bcryptjs";
import { run, get } from "../db.js";
import { requireAuth, signToken } from "../auth.js";

const router = Router();

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nombre, email y contraseña son obligatorios" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }
  const existing = await get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (existing) return res.status(409).json({ error: "Ya existe una cuenta con ese email" });

  const hash = bcrypt.hashSync(password, 10);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const result = await run(
    "INSERT INTO users (name, email, password_hash, avatar_color) VALUES (?, ?, ?, ?) RETURNING id",
    [name.trim(), email.toLowerCase().trim(), hash, color]
  );
  const user = await getUser(result.lastInsertRowid);
  res.status(201).json({ token: signToken(user.id), user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await get("SELECT * FROM users WHERE email = ?", [(email || "").toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUser(req.userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ user });
});

async function getUser(id) {
  const user = await get("SELECT * FROM users WHERE id = ?", [id]);
  return user ? publicUser(user) : null;
}

export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar_color: u.avatar_color,
    created_at: u.created_at,
  };
}

export default router;
