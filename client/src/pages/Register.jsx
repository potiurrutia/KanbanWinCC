import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { IconSpinner } from "../components/Icons.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center bg-slate-950 p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M8 11l4 4 7-7" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">Empieza a organizar tu equipo</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl bg-slate-900 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
          <label className="mb-1 block text-sm font-medium text-slate-200">Nombre</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="mb-4 w-full rounded-xl border border-slate-800 bg-slate-800 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20"
          />
          <label className="mb-1 block text-sm font-medium text-slate-200">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="mb-4 w-full rounded-xl border border-slate-800 bg-slate-800 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20"
          />
          <label className="mb-1 block text-sm font-medium text-slate-200">Contraseña</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="mb-5 w-full rounded-xl border border-slate-800 bg-slate-800 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20"
          />

          {error && (
            <div className="mb-4 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-60"
          >
            {busy && <IconSpinner className="h-4 w-4" />}
            Crear cuenta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
