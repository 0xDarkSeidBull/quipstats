import { useMemo, useState } from "react";
import { TiltRow } from "@/components/TiltRow";
import type { QuipNode } from "@/lib/quipstats-api";
import { maskName } from "@/lib/quipstats-api";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface Props { nodes: QuipNode[]; }
type Filter = "all" | "active" | "24h" | "7d";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active Only" },
  { id: "24h", label: "24h+" },
  { id: "7d", label: "7d+" },
];

const RANK_COLOR = ["text-warning", "text-muted-foreground", "text-info"];
const TYPE_BAR: Record<string, string> = { GPU: "bg-success", CPU: "bg-info", QPU: "bg-foreground/70" };

function fmtUptime(hrs: number) {
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h`;
  return `${(Math.round(hrs * 10) / 10)}h`;
}

export function UptimeTab({ nodes }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const data = useMemo(() => {
    const arr = nodes
      .filter((n) => n.firstSeen > 0 && n.lastSeen > 0)
      .map((n) => ({ ...n, uptimeHrs: (n.lastSeen - n.firstSeen) / 3600 }))
      .sort((a, b) => b.uptimeHrs - a.uptimeHrs);
    const max = arr[0]?.uptimeHrs ?? 1;
    const avg = arr.length ? arr.reduce((s, n) => s + n.uptimeHrs, 0) / arr.length : 0;
    const longRun = arr.filter((n) => n.uptimeHrs >= 24).length;
    return { arr, max, avg, longRun };
  }, [nodes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return data.arr.filter((n) => {
      if (q && !n.name.toLowerCase().includes(q)) return false;
      if (filter === "active") return n.active;
      if (filter === "24h") return n.uptimeHrs >= 24;
      if (filter === "7d") return n.uptimeHrs >= 168;
      return true;
    }).slice(0, 200);
  }, [data, query, filter]);

  if (!nodes.length) return <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="⏱ Max Uptime" value={fmtUptime(data.max)} sub="longest running node" tone="warning" />
        <Stat label="✅ Long Running" value={data.longRun.toLocaleString()} sub="online 24h+" tone="success" />
        <Stat label="📊 Avg Uptime" value={fmtUptime(data.avg)} sub="across tracked nodes" tone="info" />
        <Stat label="🌐 Tracked" value={data.arr.length.toLocaleString()} sub="nodes with uptime data" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search node name"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-[13px] focus:border-foreground/30 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
            >{f.label}</button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_70px_minmax(0,1fr)_110px_70px] gap-3 border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <div>#</div><div>Node</div><div>Type</div><div>Uptime</div><div>First Seen</div><div>Status</div>
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No nodes match filter.</div>
          ) : filtered.map((n, i) => {
            const pct = Math.min(100, Math.round((n.uptimeHrs / data.max) * 100));
            const dateStr = n.firstSeen ? new Date(n.firstSeen * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
            return (
              <TiltRow
                key={n.uid + i}
                tilt={4}
                scale={1.01}
                spotlight
                className="grid grid-cols-[40px_minmax(0,1fr)_70px_minmax(0,1fr)_110px_70px] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-accent/30"
              >
                <div className={`text-center text-[12px] font-semibold ${i < 3 ? RANK_COLOR[i] : "text-muted-foreground"}`}>{i + 1}</div>
                <div className="truncate font-mono text-[12.5px] font-semibold" title={n.name}>{maskName(n.name)}</div>
                <div>
                  <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                    n.type === "GPU" && "border-success/30 text-success",
                    n.type === "CPU" && "border-info/30 text-info",
                    n.type === "QPU" && "border-foreground/20 text-foreground")}>{n.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div className={cn("h-full rounded-full", TYPE_BAR[n.type] || "bg-foreground/60")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[11.5px] font-semibold text-warning">{fmtUptime(n.uptimeHrs)}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">{dateStr}</div>
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", n.active ? "bg-success" : "bg-destructive")} />
                  <span className="text-[11px] text-muted-foreground">{n.active ? "on" : "off"}</span>
                </div>
              </TiltRow>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "success" | "warning" | "info" }) {
  const toneCls = { default: "text-foreground", success: "text-success", warning: "text-warning", info: "text-info" }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`font-mono text-[26px] font-semibold leading-none ${toneCls}`}>{value}</div>
      {sub && <div className="mt-2 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
