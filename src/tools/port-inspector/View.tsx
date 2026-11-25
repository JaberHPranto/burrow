import { type ListeningPort, commands } from "@/core/platform/commands";
import { Button, EmptyState, ErrorNote, IconButton, Input, Row, Stack, Tag, toast } from "@/design";
import { Globe, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filterPorts, isPublic, portHint } from "./logic";
import styles from "./styles.module.css";

const REFRESH_MS = 4000;

export default function PortInspector() {
  const [ports, setPorts] = useState<ListeningPort[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** pid awaiting a second click to confirm the kill */
  const [confirmPid, setConfirmPid] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPorts(await commands.listListeningPorts());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (confirmPid == null) return;
    const t = setTimeout(() => setConfirmPid(null), 3000);
    return () => clearTimeout(t);
  }, [confirmPid]);

  async function kill(p: ListeningPort) {
    if (p.pid == null) return;
    if (confirmPid !== p.pid) {
      setConfirmPid(p.pid);
      return;
    }
    try {
      await commands.killProcess(p.pid);
      toast.success(`Stopped ${p.process ?? "process"} on :${p.port}`);
    } catch (e) {
      toast.error(String(e));
    }
    setConfirmPid(null);
    void refresh();
  }

  const rows = useMemo(() => filterPorts(ports ?? [], query), [ports, query]);

  return (
    <Stack gap={3} grow>
      <Row gap={2}>
        <div className="b-grow">
          <Input
            icon={Search}
            placeholder="Filter by port, process or command"
            aria-label="Filter ports"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <Button icon={RefreshCw} onClick={refresh}>
          Refresh
        </Button>
      </Row>

      {error && <ErrorNote>{error}</ErrorNote>}

      {ports && rows.length === 0 ? (
        <EmptyState title={query ? "Nothing matches" : "All quiet"} mood="sleepy">
          {query ? "Try another port or name." : "No TCP ports are listening right now."}
        </EmptyState>
      ) : (
        <div className={styles.tableWrap}>
          <table className="b-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Process</th>
                <th>Address</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const hint = portHint(p.port);
                return (
                  <tr key={`${p.protocol}-${p.address}-${p.port}`}>
                    <td>
                      <span className={styles.port}>:{p.port}</span>
                      {hint && <span className={styles.hint}>{hint}</span>}
                    </td>
                    <td className={styles.process}>
                      {p.pid != null ? (
                        <>
                          <strong>{p.process}</strong>{" "}
                          <span className={styles.pid}>pid {p.pid}</span>
                          {p.command && (
                            <div className={styles.command} title={p.command}>
                              {p.command}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className={styles.muted}>another user's process</span>
                      )}
                    </td>
                    <td>
                      <Row gap={1}>
                        <code className={styles.addr}>{p.address}</code>
                        {isPublic(p.address) && (
                          <Tag tone="butter" icon={Globe}>
                            LAN
                          </Tag>
                        )}
                      </Row>
                    </td>
                    <td className={styles.actions}>
                      {p.pid != null &&
                        (confirmPid === p.pid ? (
                          <Button size="sm" variant="danger" onClick={() => kill(p)}>
                            Confirm stop
                          </Button>
                        ) : (
                          <IconButton
                            icon={X}
                            label={`Stop ${p.process ?? "process"}`}
                            onClick={() => kill(p)}
                          />
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Stack>
  );
}
