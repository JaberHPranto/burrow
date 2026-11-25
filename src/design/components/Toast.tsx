import { cx } from "@/core/utils/cx";
import { AlertCircle, Check } from "lucide-react";
import { create } from "zustand";

interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error";
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, kind?: ToastItem["kind"]) => void;
}

let nextId = 0;

const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (message, kind = "success") => {
    const id = ++nextId;
    set((s) => ({ items: [...s.items.slice(-2), { id, message, kind }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 1800);
  },
}));

/** Show a short toast from anywhere (no hook needed). */
export const toast = {
  success: (message: string) => useToasts.getState().push(message, "success"),
  error: (message: string) => useToasts.getState().push(message, "error"),
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="b-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cx("b-toast", t.kind === "error" && "b-toast--error")}>
          {t.kind === "error" ? <AlertCircle aria-hidden /> : <Check aria-hidden />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
