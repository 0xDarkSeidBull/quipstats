import { useEffect, useMemo, useState } from "react";
import { TiltRow } from "@/components/TiltRow";
import { fetchBlocks, type BlocksResponse, timeAgo } from "@/lib/quipstats-api";

function shortMiner(id: string) {
  const w = id.match(/(0x[a-fA-F0-9]{40})/);
  const wallet = w ? w[1] : "";
  const display = id.replace(/(0x[a-fA-F0-9]{40})/, "").replace(/[-_\s]+$/, "").trim() || (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : id.slice(0, 24));
  return { display, walletShort: wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "" };
}

const RANK_EMOJI = ["🥇", "🥈", "🥉"];
const RANK_COLOR = ["text-warning", "text-muted-foreground", "text-info"];

export function BlocksTab() {
  const [data, setData] = useState<BlocksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    function load() {
      fetchBlocks()
        .then((d) => { if (mounted) { setData(d); setError(null); } })
        .catch((e) => { if (mounted) setError(e.message); });
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const lb = data.leaderboard ?? [];
    const top = lb[0];
    const energies = lb.map((m) => m.best_energy ?? 0).filter((e) => e !== 0);
    const bestE = energies.length ? Math.min(...energies) : 0;
    return {
      total: data.total_blocks ?? 0,
      miners: lb.length,
      topName: top ? shortMiner(top.miner_id || "").display : "—",
      topBlocks: top?.blocks ?? 0,
      bestE,
    };
  }, [data]);

  if (error) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">Block API error: {error}</div>;
  }
  if (!data || !stats) {
    return <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted-foreground">Loading block data…</div>;
  }

  const lb = data.leaderboard ?? [];
  const maxBlocks = lb[0]?.blocks || 1;
  const recent = data.recent_blocks ?? [];
  const now = Date.now() / 1000;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="⛏ Total Blocks" value={stats.total.toLocaleString()} />
        <StatPill label="🥇 Top Miner" value={stats.topName} sub={`${stats.topBlocks.toLocaleString()} blocks`} small tone="warning" />
        <StatPill label="⚡ Best Energy" value={stats.bestE ? stats.bestE.toLocaleString() : "—"} sub="lowest = best proof" tone="success" small />
        <StatPill label="👥 Unique Miners" value={stats.miners.toLocaleString()} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">All Miners Ranked</div>
          <div className="rounded-xl border border-border bg-surface">
            <div className="grid grid-cols-[40px_minmax(0,1fr)_70px_110px_120px] gap-3 border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <div>#</div><div>Miner</div><div className="text-right">Blocks</div><div className="text-right">Avg Energy</div><div>Progress</div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {lb.map((m, i) => {
                const sm = shortMiner(m.miner_id || "");
                const pct = Math.round((m.blocks / maxBlocks) * 100);
                return (
                  <TiltRow
                    key={m.miner_id + i}
                    tilt={4}
                    scale={1.01}
                    spotlight
                    className="grid grid-cols-[40px_minmax(0,1fr)_70px_110px_120px] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-accent/30"
                  >
                    <div className={`text-center text-[13px] font-semibold ${i < 3 ? RANK_COLOR[i] : "text-muted-foreground"}`}>
                      {i < 3 ? RANK_EMOJI[i] : i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[12.5px] font-semibold text-foreground" title={m.miner_id}>{sm.display || "Unknown"}</div>
                      {sm.walletShort && <div className="truncate font-mono text-[10px] text-muted-foreground">{sm.walletShort}</div>}
                    </div>
                    <div className="text-right font-mono text-[15px] font-semibold text-info">{m.blocks}</div>
                    <div className="text-right font-mono text-[12px] text-success">{m.avg_energy ? m.avg_energy.toLocaleString() : "—"}</div>
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-foreground/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </TiltRow>
                );
              })}
              {!lb.length && <div className="px-4 py-12 text-center text-sm text-muted-foreground">No miners yet.</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Recent Blocks
          </div>
          <div className="rounded-xl border border-border bg-surface">
            <div className="max-h-[600px] overflow-y-auto">
              {recent.map((b, i) => {
                const idx = b.block_index ?? b.index ?? "?";
                const mid = b.miner?.miner_id || "unknown";
                const display = shortMiner(mid).display;
                const qp = b.quantum_proof || {};
                const energy = qp.energy != null ? qp.energy.toLocaleString() : "—";
                const div = qp.diversity != null ? qp.diversity.toFixed(3) : "—";
                const sols = qp.num_solutions ?? qp.solutions ?? "—";
                const mt = qp.mining_time_secs ?? qp.mining_time;
                const ago = b.timestamp ? timeAgo(now - b.timestamp) : "";
                return (
                  <TiltRow key={i} tilt={4} scale={1.01} spotlight className="border-b border-border/60 px-4 py-3 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[15px] font-semibold text-info">#{idx}</div>
                      <div className="text-[10px] text-muted-foreground">{ago}</div>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11.5px]" title={mid}>{display}</div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span>⚡ <span className="text-success font-semibold">{energy}</span></span>
                      <span>🌈 <span className="text-foreground font-semibold">{div}</span></span>
                      <span>✅ <span className="text-foreground font-semibold">{sols} sol</span></span>
                      {mt != null && <span>⏱ <span className="text-foreground font-semibold">{mt}s</span></span>}
                    </div>
                  </TiltRow>
                );
              })}
              {!recent.length && <div className="px-4 py-12 text-center text-sm text-muted-foreground">No recent blocks.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, sub, tone = "default", small = false }: { label: string; value: string | number; sub?: string; tone?: "default" | "success" | "warning" | "info"; small?: boolean }) {
  const toneCls = { default: "text-foreground", success: "text-success", warning: "text-warning", info: "text-info" }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`font-mono ${small ? "text-[16px]" : "text-[26px]"} font-semibold leading-none ${toneCls}`}>{value}</div>
      {sub && <div className="mt-2 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
