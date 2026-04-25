import { useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { NodeDetailModal } from "@/components/NodeDetailModal";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { SybilTab } from "@/components/SybilTab";
import { useQuipNodes } from "@/hooks/use-quip-nodes";
import { formatResource, maskIP, maskName, type QuipNode } from "@/lib/quipstats-api";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type Filter = "all" | "active" | "gpu" | "cpu" | "offline";
type Tab = "nodes" | "analytics" | "sybil";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "gpu", label: "GPU" },
  { id: "cpu", label: "CPU" },
  { id: "offline", label: "Offline" },
];

const tabs: { id: Tab; label: string }[] = [
  { id: "nodes", label: "Live Nodes" },
  { id: "analytics", label: "Analytics" },
  { id: "sybil", label: "Sybil Detector" },
];

const PER_PAGE = 50;

export default function Index() {
  const { nodes, fresh, loading, error, updatedAt, fromCache } = useQuipNodes();
  const [tab, setTab] = useState<Tab>("nodes");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<QuipNode | null>(null);

  // Stats derived from full merged set
  const stats = useMemo(() => {
    let active = 0, cpu = 0, gpu = 0, qpu = 0, lost = 0, mismatch = 0;
    nodes.forEach((n) => {
      if (n.status === "active") {
        active++;
        if (n.type === "GPU") gpu++;
        else if (n.type === "QPU") qpu++;
        else cpu++;
      } else if (n.status === "lost") lost++;
      else if (n.status === "version_mismatch") mismatch++;
    });
    return {
      live: fresh.length || nodes.length,
      everSeen: nodes.length,
      activeNow: active,
      cpuActive: cpu,
      gpuActive: gpu,
      qpuActive: qpu,
      versionMismatch: mismatch,
      lost,
    };
  }, [nodes, fresh]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return nodes.filter((n) => {
      if (q && !n.name.toLowerCase().includes(q) && !n.ip.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "active": return n.active;
        case "offline": return !n.active;
        case "gpu": return n.active && n.type === "GPU";
        case "cpu": return n.active && n.type === "CPU";
        default: return true;
      }
    });
  }, [nodes, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PER_PAGE;
  const pageRows = filtered.slice(pageStart, pageStart + PER_PAGE);

  const updatedLabel = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleTimeString("en-GB")}`
    : loading ? "Loading…" : "Idle";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[15px] font-semibold tracking-tight">QuipStats</h1>
            <span className="text-xs text-muted-foreground">Network</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", error ? "bg-destructive" : "animate-ping bg-success")} />
              <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", error ? "bg-destructive" : "bg-success")} />
            </span>
            <span className="font-mono">{error ? "Refresh failed" : updatedLabel}</span>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-6 sm:px-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-[13px] font-medium transition-colors",
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-px bg-foreground" />}
            </button>
          ))}
        </nav>

        {fromCache && loading === false && updatedAt && Date.now() - updatedAt > 60_000 && (
          <div className="mx-auto max-w-[1280px] border-t border-border/50 px-6 py-1.5 text-[11px] text-muted-foreground sm:px-8">
            Showing cached snapshot · refreshing in background
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1280px] px-6 py-8 sm:px-8">
        {tab === "nodes" && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
              <span className="text-muted-foreground">
                Live <span className="font-mono font-medium text-foreground">{stats.live.toLocaleString()}</span> nodes
              </span>
              <span className="hidden h-4 w-px bg-border sm:block" />
              <span className="text-muted-foreground">
                Ever seen <span className="font-mono font-medium text-foreground">{stats.everSeen.toLocaleString()}</span>
              </span>
            </div>

            <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              <StatCard label="Live Nodes" value={stats.live.toLocaleString()} hint="API snapshot" tone="success" />
              <StatCard label="Ever Seen" value={stats.everSeen.toLocaleString()} hint="all-time" />
              <StatCard label="Active Now" value={stats.activeNow.toLocaleString()} hint="from telemetry" />
              <StatCard label="CPU Active" value={stats.cpuActive.toLocaleString()} hint="CPU nodes" tone="info" />
              <StatCard label="GPU Active" value={stats.gpuActive.toLocaleString()} hint="GPU nodes" tone="success" />
              <StatCard label="QPU Active" value={stats.qpuActive.toLocaleString()} hint="quantum" tone="muted" />
              <StatCard label="Ver. Mismatch" value={stats.versionMismatch.toLocaleString()} hint="need update" tone="warning" />
              <StatCard label="Lost" value={stats.lost.toLocaleString()} hint="disconnected" tone="destructive" />
            </section>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search node name or IP"
                  className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none"
                />
              </div>
              <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setFilter(f.id); setPage(1); }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      filter === f.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {filter === "all" ? "All nodes" : `${filters.find((f) => f.id === filter)?.label} nodes`}
                <span className="ml-2 font-mono text-foreground">{filtered.length.toLocaleString()}</span>
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="grid grid-cols-[40px_minmax(0,1fr)_70px_110px_90px_180px] gap-3 border-b border-border px-5 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <div>#</div>
                <div>Node</div>
                <div>Type</div>
                <div>Resources</div>
                <div>Status</div>
                <div className="text-right">IP</div>
              </div>
              {loading && nodes.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading network data…</div>
              ) : pageRows.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">No nodes match your filters.</div>
              ) : (
                pageRows.map((n, i) => (
                  <button
                    key={n.uid}
                    onClick={() => setSelected(n)}
                    className="group grid w-full grid-cols-[40px_minmax(0,1fr)_70px_110px_90px_180px] items-center gap-3 border-b border-border/60 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/40"
                  >
                    <div className="font-mono text-[11px] text-muted-foreground">{pageStart + i + 1}</div>
                    <div className="truncate font-mono text-[12.5px] font-medium text-foreground" title={n.name}>{maskName(n.name)}</div>
                    <div>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                          n.type === "GPU" && "border-success/30 text-success",
                          n.type === "CPU" && "border-info/30 text-info",
                          n.type === "QPU" && "border-foreground/20 text-foreground",
                        )}
                      >
                        {n.type}
                      </span>
                    </div>
                    <div className="font-mono text-[12px] text-muted-foreground">{formatResource(n)}</div>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", n.active ? "bg-success" : "bg-destructive")} />
                      <span className="text-[11px] text-muted-foreground">{n.active ? "online" : "offline"}</span>
                    </div>
                    <div className="truncate text-right font-mono text-[11.5px] text-muted-foreground">{maskIP(n.ip)}</div>
                  </button>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-xs">
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-muted-foreground transition disabled:opacity-30 enabled:hover:text-foreground"
                >
                  ← Prev
                </button>
                <span className="font-mono text-muted-foreground">Page {safePage} / {totalPages}</span>
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-muted-foreground transition disabled:opacity-30 enabled:hover:text-foreground"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {tab === "analytics" && <AnalyticsTab nodes={nodes} />}
        {tab === "sybil" && <SybilTab nodes={nodes} />}
      </main>

      <footer className="mx-auto max-w-[1280px] border-t border-border px-6 py-6 text-center text-[11px] text-muted-foreground sm:px-8">
        QuipStats · Live network telemetry · Auto-refreshes every 30s
      </footer>

      <NodeDetailModal node={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
