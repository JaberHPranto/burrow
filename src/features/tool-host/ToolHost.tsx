import { useApp } from "@/app/store";
import { registry } from "@/core/tools/registry";
import { EmptyState, IconButton, Tile } from "@/design";
import { ArrowLeft } from "lucide-react";
import { Component, type ReactNode, Suspense, useEffect } from "react";
import styles from "./ToolHost.module.css";

interface ToolHostProps {
  id: string;
  input?: string;
}

/** Frame around every tool: draggable header with back button, then the lazy tool body. */
export function ToolHost({ id, input }: ToolHostProps) {
  const goHome = useApp((s) => s.goHome);
  const tool = registry.get(id);

  useEffect(() => {
    // Esc goes back to the launcher unless a tool handled it first (e.preventDefault()).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) goHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goHome]);

  if (!tool) {
    return (
      <EmptyState title="That tool wandered off" mood="oops">
        No tool with id “{id}”. Check the name in your hotkey command.
      </EmptyState>
    );
  }

  const Body = tool.component;
  return (
    <div className={styles.host}>
      <header className={styles.header} data-tauri-drag-region>
        <IconButton icon={ArrowLeft} label="Back (Esc)" onClick={goHome} />
        <Tile icon={tool.icon} tone={tool.tone} round />
        <div className={styles.titles} data-tauri-drag-region>
          <h1 className={styles.title}>{tool.name}</h1>
          <p className={styles.desc}>{tool.description}</p>
        </div>
      </header>
      <main className={styles.body}>
        <ToolErrorBoundary key={id}>
          <Suspense fallback={null}>
            <Body initialInput={input} />
          </Suspense>
        </ToolErrorBoundary>
      </main>
    </div>
  );
}

class ToolErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <EmptyState title="This tool tripped over a carrot" mood="oops">
          {this.state.error.message}
        </EmptyState>
      );
    }
    return this.props.children;
  }
}
