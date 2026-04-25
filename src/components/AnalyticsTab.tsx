import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { QuipNode } from "@/lib/quipstats-api";
import { maskName } from "@/lib/quipstats-api";
import { TiltRow } from "@/components/TiltRow";

interface Props { nodes: QuipNode[]; }

const HSL = {
  cpu: "hsl(var(--info))",
  gpu: "hsl(var(--success))",
  qpu: "hsl(var(--ring))",
  off: "hsl(var(--muted-foreground))",
};

function Card({
  title, sub, children,
}: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <TiltRow tilt={4} scale={1.01} spotlight className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
        {title}
      </div>
      {sub && <div className="mb-4 text-[11px] text-muted-foreground">{sub}</div>}
      {children}
    </TiltRow>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground first:mt-0">
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--surface-elevated))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

function Donut({
  data, total,
}: { data: { name: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={56}
            outerRadius={78}
            paddingAngle={2}
            dataKey="value"
            stroke="hsl(var(--surface))"
            strokeWidth={2}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, n) => [`${v.toLocaleString()} (${Math.round((v / (total || 1)) * 100)}%)`, n]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-xl font-semibold">{total.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">total</div>
      </div>
    </div>
  );
}

function Legend({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </div>
          <div className="font-mono text-foreground">
            {d.value.toLocaleString()} <span className="text-muted-foreground">({Math.round((d.value / (total || 1)) * 100)}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsTab({ nodes }: Props) {
  const data = useMemo(() => {
    let cpuT = 0, gpuT = 0, qpuT = 0, cpuA = 0, gpuA = 0, qpuA = 0, totA = 0, totO = 0;
    const cores: number[] = [];
    const coreNodes: { name: string; cores: number; type: string; active: boolean }[] = [];
    const gpuNodes: { name: string; type: string; active: boolean }[] = [];
    nodes.forEach((n) => {
      const isGPU = n.type === "GPU", isQPU = n.type === "QPU", isCPU = !isGPU && !isQPU;
      if (n.active) totA++; else totO++;
      if (isGPU) { gpuT++; if (n.active) gpuA++; }
      else if (isQPU) { qpuT++; if (n.active) qpuA++; }
      else { cpuT++; if (n.active) cpuA++; }
      if (isCPU && n.cpus > 0) {
        cores.push(n.cpus);
        coreNodes.push({ name: n.name, cores: n.cpus, type: n.type, active: n.active });
      }
      if (isGPU || isQPU) gpuNodes.push({ name: n.name, type: n.type, active: n.active });
    });

    const buckets = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96];
    const histo = buckets.map((b, i) => ({
      label: i === buckets.length - 1 ? "96+" : String(b),
      count: cores.filter((c) => i < buckets.length - 1 ? c === b : c >= 96).length,
    }));

    const sortedCores = [...cores].sort((a, b) => a - b);
    const median = sortedCores.length ? sortedCores[Math.floor(sortedCores.length / 2)] : 0;
    const max = cores.length ? Math.max(...cores) : 0;
    const avg = cores.length ? Math.round(cores.reduce((a, b) => a + b, 0) / cores.length) : 0;

    const top = [...coreNodes].sort((a, b) => b.cores - a.cores).slice(0, 12);

    return {
      typeBreakdown: [
        { name: "CPU", value: cpuT, color: HSL.cpu },
        { name: "GPU", value: gpuT, color: HSL.gpu },
        { name: "QPU", value: qpuT, color: HSL.qpu },
      ].filter((d) => d.value > 0),
      activeBreakdown: [
        { name: "Active", value: totA, color: HSL.gpu },
        { name: "Offline", value: totO, color: HSL.off },
      ],
      activeByType: [
        { name: "CPU", value: cpuA, color: HSL.cpu },
        { name: "GPU", value: gpuA, color: HSL.gpu },
        { name: "QPU", value: qpuA, color: HSL.qpu },
      ].filter((d) => d.value > 0),
      histo,
      stats: { max, avg, median, count: cores.length },
      activeRate: [
        { type: "CPU", rate: cpuT ? Math.round((cpuA / cpuT) * 100) : 0 },
        { type: "GPU", rate: gpuT ? Math.round((gpuA / gpuT) * 100) : 0 },
        { type: "QPU", rate: qpuT ? Math.round((qpuA / qpuT) * 100) : 0 },
      ],
      top,
      gpuNodes: [...gpuNodes].sort((a, b) => Number(b.active) - Number(a.active)),
    };
  }, [nodes]);

  if (!nodes.length) {
    return <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted-foreground">No data yet…</div>;
  }

  const totType = data.typeBreakdown.reduce((a, b) => a + b.value, 0);
  const totAct = data.activeBreakdown.reduce((a, b) => a + b.value, 0);
  const totActT = data.activeByType.reduce((a, b) => a + b.value, 0);

  return (
    <div>
      <SectionLabel>Node distribution</SectionLabel>
      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Nodes by type" sub="All observed miners">
          <Donut data={data.typeBreakdown} total={totType} />
          <Legend data={data.typeBreakdown} total={totType} />
        </Card>
        <Card title="Active vs offline" sub="Last refresh window">
          <Donut data={data.activeBreakdown} total={totAct} />
          <Legend data={data.activeBreakdown} total={totAct} />
        </Card>
        <Card title="Active by type" sub="Currently online">
          <Donut data={data.activeByType} total={totActT} />
          <Legend data={data.activeByType} total={totActT} />
        </Card>
      </div>

      <SectionLabel>Compute resources</SectionLabel>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="CPU cores distribution" sub="Frequency across CPU nodes">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.histo} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--accent) / 0.4)" }} />
              <Bar dataKey="count" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-4 gap-3 border-t border-border pt-4 text-center">
            {[
              { l: "Max", v: data.stats.max },
              { l: "Avg", v: data.stats.avg },
              { l: "Median", v: data.stats.median },
              { l: "Reported", v: data.stats.count },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-mono text-base font-semibold">{s.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Active rate by type" sub="% of each type currently live">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.activeRate} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "active"]} cursor={{ fill: "hsl(var(--accent) / 0.4)" }} />
              <Bar dataKey="rate" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <SectionLabel>Node intelligence</SectionLabel>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Top compute nodes" sub="Highest CPU core count">
          <div className="flex flex-col gap-1.5">
            {data.top.map((n, i) => {
              const pct = data.top[0]?.cores ? Math.round((n.cores / data.top[0].cores) * 100) : 0;
              const display = maskName(n.name);
              return (
                <div key={`${n.name}-${i}`} className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <span className="w-5 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-[12px] text-foreground" title={n.name}>{display}</span>
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{n.type}</span>
                  <span className="w-10 text-right font-mono text-[12px]">{n.cores}c</span>
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-info" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="GPU / QPU nodes" sub={`${data.gpuNodes.length} accelerated miners on network`}>
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">#</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Node</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Type</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.gpuNodes.map((n, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1.5 truncate max-w-[180px]" title={n.name}>{maskName(n.name)}</td>
                    <td className="px-2 py-1.5"><span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{n.type}</span></td>
                    <td className="px-2 py-1.5">
                      <span className={"mr-2 inline-block h-1.5 w-1.5 rounded-full " + (n.active ? "bg-success" : "bg-muted-foreground")} />
                      <span className="text-muted-foreground">{n.active ? "Active" : "Offline"}</span>
                    </td>
                  </tr>
                ))}
                {!data.gpuNodes.length && (
                  <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">No GPU/QPU nodes yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
