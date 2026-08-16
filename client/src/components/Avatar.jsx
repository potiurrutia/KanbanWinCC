import { useMemo } from "react";

export default function Avatar({ user, size = 32, className = "" }) {
  const initials = useMemo(() => {
    if (!user || !user.name) return "?";
    return user.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }, [user]);

  return (
    <span
      title={user?.name}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: user?.avatar_color || "#6366f1",
      }}
    >
      {initials}
    </span>
  );
}
