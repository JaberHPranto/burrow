import type { ReactNode } from "react";
import { Bunny, type BunnyMood } from "../mascot/Bunny";

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  mood?: BunnyMood;
  action?: ReactNode;
}

export function EmptyState({ title, children, mood = "curious", action }: EmptyStateProps) {
  return (
    <div className="b-empty">
      <Bunny mood={mood} size={84} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
