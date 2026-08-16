import { useState } from "react";
import { api } from "../api.js";
import Modal from "./Modal.jsx";
import { IconSpinner } from "./Icons.jsx";

export function CreateTeamModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { team } = await api.post("/teams", { name, description });
      onCreate(team);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-100">Nuevo equipo</h2>
        <p className="mt-0.5 text-sm text-slate-500">Crea un espacio para organizar proyectos.</p>
        <form onSubmit={submit} className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-200">Nombre del equipo</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Equipo de desarrollo"
            className="mb-4 w-full rounded-xl border border-slate-800 bg-slate-800 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20"
          />
          <label className="mb-1 block text-sm font-medium text-slate-200">Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿En qué trabaja el equipo?"
            rows={2}
            className="mb-5 w-full resize-none rounded-xl border border-slate-800 bg-slate-800 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20"
          />
          {error && (
            <div className="mb-4 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {busy && <IconSpinner className="h-4 w-4" />}
              Crear equipo
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function JoinTeamModal({ open, onClose, onJoin }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { team } = await api.post("/teams/join", { code });
      onJoin(team);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-100">Unirse a un equipo</h2>
        <p className="mt-0.5 text-sm text-slate-500">Introduce el código de invitación que te han compartido.</p>
        <form onSubmit={submit} className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-200">Código de invitación</label>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EJ: A1B2C3D4"
            className="w-full rounded-xl border border-slate-800 bg-slate-800 px-3.5 py-2.5 font-mono text-sm uppercase tracking-widest outline-none transition focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20"
          />
          {error && (
            <div className="mt-4 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || code.trim().length < 4}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {busy && <IconSpinner className="h-4 w-4" />}
              Unirme
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
