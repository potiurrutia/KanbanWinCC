import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { CreateTeamModal, JoinTeamModal } from "./TeamModals.jsx";
import { IconBoard, IconLogout, IconPlus, IconUserPlus } from "./Icons.jsx";

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [teams, setTeams] = useState([]);
  const [boards, setBoards] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const matchTeam = location.pathname.match(/^\/t\/(\d+)/);
  const activeTeamId = matchTeam ? Number(matchTeam[1]) : null;

  useEffect(() => {
    api
      .get("/teams")
      .then(({ teams }) => setTeams(teams))
      .catch(() => {});
  }, [createOpen, joinOpen, location.pathname]);

  useEffect(() => {
    if (!activeTeamId) {
      setBoards([]);
      return;
    }
    api
      .get(`/teams/${activeTeamId}/boards`)
      .then(({ boards }) => setBoards(boards))
      .catch(() => {});
  }, [activeTeamId, location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 px-4 py-4 text-left hover:opacity-90"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-sm shadow-indigo-500/30">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <path d="M8 11l4 4 7-7" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-base font-bold tracking-tight text-slate-100">TaskFlow</span>
        </button>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 flex items-center justify-between px-1.5 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Equipos</span>
            <button
              onClick={() => setCreateOpen(true)}
              title="Nuevo equipo"
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            >
              <IconPlus className="h-4 w-4" />
            </button>
          </div>

          <nav className="space-y-0.5">
            {teams.length === 0 && (
              <p className="px-1.5 py-2 text-xs text-slate-500">Aún no perteneces a ningún equipo.</p>
            )}
            {teams.map((team) => {
              const isActive = team.id === activeTeamId;
              return (
                <div key={team.id}>
                  <NavLink
                    to={`/t/${team.id}`}
                    className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                      isActive ? "bg-indigo-500/15 font-medium text-indigo-400" : "text-slate-600 hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] font-bold text-slate-500">
                      {team.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate">{team.name}</span>
                  </NavLink>

                  {isActive && boards.length > 0 && (
                    <div className="mb-1 mt-0.5 space-y-0.5 pl-4">
                      {boards.map((board) => {
                        const isBoardActive = location.pathname === `/t/${team.id}/b/${board.id}`;
                        return (
                          <NavLink
                            key={board.id}
                            to={`/t/${team.id}/b/${board.id}`}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition ${
                              isBoardActive
                                ? "bg-slate-800 font-medium text-slate-100"
                                : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                            }`}
                          >
                            <IconBoard className="h-3.5 w-3.5 shrink-0" style={{ color: board.color }} />
                            <span className="truncate">{board.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <button
            onClick={() => setJoinOpen(true)}
            className="mt-4 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-700 px-2.5 py-2 text-sm text-slate-500 transition hover:border-indigo-500 hover:bg-indigo-500/15 hover:text-indigo-400"
          >
            <IconUserPlus className="h-4 w-4 shrink-0" />
            Unirme con código
          </button>
        </div>

        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Avatar user={user} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/15 hover:text-red-500"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>

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
