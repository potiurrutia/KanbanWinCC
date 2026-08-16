import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { CreateTeamModal, JoinTeamModal } from "../components/TeamModals.jsx";
import { IconChevronRight, IconKey, IconLayers, IconPlus, IconUsers } from "../components/Icons.jsx";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get("/teams")
      .then(({ teams }) => setTeams(teams))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const first = user?.name?.split(" ")[0] || "";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Hola, {first}</h1>
          <p className="mt-1 text-sm text-slate-500">Aquí tienes tus equipos y proyectos.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/t/${team.id}`}
              className="group animate-fade-in rounded-2xl bg-slate-900 p-5 shadow-sm ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-sm font-bold text-indigo-400">
                  {team.name.slice(0, 2).toUpperCase()}
                </span>
                <IconChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
              <h3 className="mt-3 font-semibold text-slate-100">{team.name}</h3>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                {team.description || "Sin descripción"}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <IconUsers className="h-3.5 w-3.5" />
                  {team.member_count} miembro{team.member_count !== 1 ? "s" : ""}
                </span>
              </div>
            </Link>
          ))}

          {loaded && teams.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-500">
                <IconLayers className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-100">Empieza aquí</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Crea un equipo para invitar a tus compañeros, o únete con el código que te hayan compartido.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:bg-indigo-600"
                >
                  <IconPlus className="h-4 w-4" />
                  Crear equipo
                </button>
                <button
                  onClick={() => setJoinOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  <IconKey className="h-4 w-4" />
                  Unirme con código
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateTeamModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(team) => navigate(`/t/${team.id}`)}
      />
      <JoinTeamModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoin={(team) => navigate(`/t/${team.id}`)}
      />
    </div>
  );
}
