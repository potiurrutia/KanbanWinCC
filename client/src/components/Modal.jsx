import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./Icons.jsx";

export default function Modal({ open, onClose, children, width = "max-w-xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${width} mt-10 sm:mt-16 animate-pop-in rounded-2xl bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5`}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <IconX className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
