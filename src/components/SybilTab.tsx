import { useMemo, useState } from "react";
import { ChevronDown, Copy, Download, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { TiltRow } from "@/components/TiltRow";
import type { QuipNode } from "@/lib/quipstats-api";
import { extractWallet, maskIP, maskName } from "@/lib/quipstats-api";

interface Props { nodes: QuipNode[]; }

interface DupeGroup { ip: string; nodes: QuipNode[]; walletCount: number; }

const filters = [
  { id: 2, label: "All 2+" },
  { id: 5, label: "5+" },
  { id: 10, label: "10+" },
  { id: 50, label: "50+" },
] as const;

type SortKey = "count-desc" | "count-asc" | "wallets-desc";

function threatLevel(n: number) {
  if (n >= 50) return { label: "Critical", chip: "border-warning/30 bg-warning/10 text-warning", bar: "border-l-warning" };
  if (n >= 10) return { label: "High",     chip: "border-info/30 bg-info/10 text-info",          bar: "border-l-info" };
  return        { label: "Medium",   chip: "border-border bg-muted/40 text-muted-foreground",   bar: "border-l-border" };
}

function StatChip({
  label, value, tone,
}: { label: string; value: string | number; tone?: "default" | "warning" | "info" | "success" | "muted" }) {
  const toneClass: Record<string, string> = {
    default: "text-foreground",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-[26px] font-semibold leading-none", toneClass[tone || "default"])}>{value}</div>
    </div>
  );
}

export function SybilTab({ nodes }: Props) {
  const [query, setQuery] = useState("");
  const [minCount, setMinCount] = useState<number>(2);
  const [sort, setSort] = useState<SortKey>("count-desc");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const { stats, dupes } = useMemo(() => {
    const ipMap = new Map<string, QuipNode[]>();
    nodes.forEach((n) => {
      const ip = n.ip ? n.ip.split(":")[0] : (n.address || "unknown");
      const arr = ipMap.get(ip) ?? [];
      arr.push(n);
      ipMap.set(ip, arr);
    });
    const dupes: DupeGroup[] = [];
    ipMap.forEach((arr, ip) => {
      if (arr.length > 1) {
        const wallets = new Set(arr.map((n) => extractWallet(n.name)).filter(Boolean) as string[]);
        dupes.push({ ip, nodes: arr, walletCount: wallets.size });
      }
    });
    const total = nodes.length;
    const unique = ipMap.size;
    const dupeIPs = dupes.length;
    const extra = dupes.reduce((s, d) => s + d.nodes.length - 1, 0);
    const rate = total ? ((extra / total) * 100).toFixed(1) : "0.0";
    return { stats: { total, unique, dupeIPs, extra, rate }, dupes };
  }, [nodes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let out = dupes.filter((d) => {
      if (d.nodes.length < minCount) return false;
      if (!q) return true;
      if (d.ip.toLowerCase().includes(q)) return true;
      return d.nodes.some((n) => (n.name || "").toLowerCase().includes(q) || (extractWallet(n.name || "") || "").toLowerCase().includes(q));
    });
    if (sort === "count-asc") out = out.sort((a, b) => a.nodes.length - b.nodes.length);
    else if (sort === "wallets-desc") out = out.sort((a, b) => b.walletCount - a.walletCount);
    else out = out.sort((a, b) => b.nodes.length - a.nodes.length);
    return out;
  }, [dupes, minCount, query, sort]);

  const top = dupes.length ? [...dupes].sort((a, b) => b.nodes.length - a.nodes.length)[0] : null;

  function exportCSV() {
    const rows: string[][] = [["IP", "Total Nodes", "Threat Level", "Node Name", "Wallet", "Type", "Active"]];
    dupes.forEach((d) => {
      const t = threatLevel(d.nodes.length);
      d.nodes.forEach((n) => {
        rows.push([d.ip, String(d.nodes.length), t.label, n.name || "", extractWallet(n.name || "") || "", n.type, n.active ? "Yes" : "No"]);
      });
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quip-sybil-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function copyDiscord(d: DupeGroup) {
    const wallets = new Set(d.nodes.map((n) => extractWallet(n.name)).filter(Boolean) as string[]);
    const list = d.nodes.slice(0, 20).map((n) => {
      const w = extractWallet(n.name);
      return `  • ${n.name || n.ip}${w ? " | " + w : ""}`;
    }).join("\n");
    const extra = d.nodes.length > 20 ? `\n  ...and ${d.nodes.length - 20} more` : "";
    const report =
      `🚨 Sybil Detection Report\nIP: ${d.ip}\nNodes: ${d.nodes.length} (${wallets.size} unique wallet${wallets.size !== 1 ? "s" : ""})\nDetected: ${new Date().toUTCString()}\n\nNodes on this IP:\n${list}${extra}`;
    navigator.clipboard.writeText(report);
  }

  if (!nodes.length) {
    return <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted-foreground">Loading network…</div>;
  }

  return (
    <div>
      {top && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-warning/25 border-l-2 border-l-warning bg-warning/[0.04] px-5 py-4">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-warning" />
          <div className="flex-1 min-w-[220px]">
            <div className="text-[13px] font-semibold text-foreground">
              {stats.dupeIPs} IPs running multiple nodes
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {stats.extra.toLocaleString()} extra nodes detected ({stats.rate}% of network) ·
              top offender <span className="font-mono text-foreground">{maskIP(top.ip)}</span> with <span className="font-mono text-foreground">{top.nodes.length}</span> nodes
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatChip label="Duplicate IPs" value={stats.dupeIPs} tone="warning" />
        <StatChip label="Extra Nodes" value={stats.extra.toLocaleString()} tone="warning" />
        <StatChip label="Total Nodes" value={stats.total.toLocaleString()} tone="info" />
        <StatChip label="Unique IPs" value={stats.unique.toLocaleString()} tone="success" />
        <StatChip label="Sybil Rate" value={`${stats.rate}%`} tone="muted" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search IP, node name or wallet"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setMinCount(f.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                minCount === f.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-foreground/30 focus:outline-none"
        >
          <option value="count-desc">Most nodes first</option>
          <option value="count-asc">Fewest nodes first</option>
          <option value="wallets-desc">Most wallets first</option>
        </select>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Flagged IPs <span className="ml-2 font-mono text-foreground">{filtered.length}</span>
        </h2>
        <span className="text-[11px] text-muted-foreground">Click any row to expand</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted-foreground">
          No results match your filters.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((d, i) => {
            const t = threatLevel(d.nodes.length);
            const open = openIdx === i;
            return (
              <div key={d.ip} className={cn("overflow-hidden rounded-xl border border-border bg-surface border-l-2", t.bar)}>
                <TiltRow
                  as="button"
                  tilt={3}
                  scale={1.005}
                  spotlight
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/30"
                >
                  <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", t.chip)}>
                    {t.label}
                  </span>
                  <span className="flex-1 truncate font-mono text-[13px] text-foreground">{maskIP(d.ip)}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-semibold text-foreground">{d.nodes.length}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">nodes</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-mono text-info">{d.walletCount}</span> wallet{d.walletCount !== 1 ? "s" : ""}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </TiltRow>
                {open && (
                  <div className="border-t border-border bg-background/40 px-5 py-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Node Name</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Wallet</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">IP:Port</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Type</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.nodes.map((n, idx) => {
                            const wallet = extractWallet(n.name);
                            const cleanName = (n.name || "").replace(/(0x[a-fA-F0-9]{40})/g, "").replace(/[-_\s]+$/, "").trim() || n.ip;
                            return (
                              <tr key={idx} className="border-t border-border/50">
                                <td className="max-w-[200px] truncate px-2 py-2 font-mono text-foreground" title={n.name}>{maskName(cleanName)}</td>
                                <td className="px-2 py-2">
                                  {wallet ? (
                                    <span className="flex items-center gap-1.5 font-mono text-info">
                                      {wallet.slice(0, 8)}…{wallet.slice(-6)}
                                      <button onClick={() => navigator.clipboard.writeText(wallet)} className="text-muted-foreground hover:text-foreground">
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic">no wallet</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 font-mono text-muted-foreground">{maskIP(n.ip)}</td>
                                <td className="px-2 py-2">
                                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{n.type}</span>
                                </td>
                                <td className="px-2 py-2">
                                  <span className={"mr-2 inline-block h-1.5 w-1.5 rounded-full " + (n.active ? "bg-success" : "bg-muted-foreground")} />
                                  <span className="text-muted-foreground">{n.active ? "Active" : "Offline"}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => copyDiscord(d)}
                        className="rounded border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                      >
                        Copy Discord report
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
