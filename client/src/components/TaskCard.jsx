import Avatar from "./Avatar.jsx";
import { IconCalendar, IconFlag, IconMessage } from "./Icons.jsx";

const PRIORITY = {
  low: { label: "Baja", color: "#94a3b8" },
  medium: { label: "Media", color: "#f59e0b" },
  high: { label: "Alta", color: "#ef4444" },
};

export default function TaskCard({ task, onClick, commentCount }) {
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const overdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl bg-slate-900 p-3.5 shadow-sm ring-1 ring-white/5 transition hover:shadow-md hover:ring-white/10"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: priority.color }} />
        <h4 className="flex-1 text-sm font-medium leading-snug text-slate-100">{task.title}</h4>
        {commentCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500">
            <IconMessage className="h-3.5 w-3.5" />
            {commentCount}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {task.due_date ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
              overdue ? "bg-red-500/15 text-red-400" : "bg-slate-800 text-slate-500"
            }`}
          >
            <IconCalendar className="h-3 w-3" />
            {new Date(task.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </span>
        ) : (
          <span />
        )}
        {task.assignee_id ? (
          <Avatar user={{ name: task.assignee_name, avatar_color: task.assignee_color }} size={22} />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-700 text-slate-600 opacity-0 transition group-hover:opacity-100">
            <IconFlag className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
