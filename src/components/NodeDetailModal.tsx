import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TiltCard } from "@/components/TiltCard";
import type { QuipNode } from "@/lib/quipstats-api";
import { formatResource, maskIP, maskName } from "@/lib/quipstats-api";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface NodeDetailModalProps {
  node: QuipNode | null;
  open: boolean;
  onClose: () => void;
}

function Field({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/60 p-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-mono text-base font-medium tracking-tight text-foreground break-all", valueClass)}>
        {value}
      </div>
    </div>
  );
}

export function NodeDetailModal({ node, open, onClose }: NodeDetailModalProps) {
  if (!node) return null;
  const ramGB = node.ram ? `${(node.ram / 1024).toFixed(1)} GB` : "—";
  const lastSeen = node.lastSeen ? new Date(node.lastSeen * 1000).toLocaleTimeString() : "—";
  const firstSeen = node.firstSeen ? new Date(node.firstSeen * 1000).toLocaleDateString() : "—";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-[640px] [&>button]:hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Node {maskName(node.name)}</DialogTitle>
          <DialogDescription>Live telemetry details for this node.</DialogDescription>
        </VisuallyHidden.Root>
        <TiltCard
          tiltLimit={6}
          scale={1.01}
          perspective={1400}
          effect="evade"
          spotlight
          className="rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Node
              </div>
              <h2 className="truncate font-mono text-base font-semibold text-foreground">
                {maskName(node.name)}
              </h2>
              {node.version && (
                <div className="mt-1 font-mono text-[11px] text-success">v{node.version}</div>
              )}
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{maskIP(node.ip)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {node.type}
              </span>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Resources" value={formatResource(node)} />
            <Field
              label="Status"
              value={node.active ? "Online" : "Offline"}
              valueClass={node.active ? "text-success" : "text-destructive"}
            />
            <Field label="Last Seen" value={lastSeen} />
            <Field label="RAM" value={ramGB} />
            <Field label="Node Address" value={maskIP(node.address || node.ip || "—")} />
            <Field label="First Seen" value={firstSeen} />
          </div>

          {node.cpuBrand && (
            <div className="mt-3 rounded-md border border-border/70 bg-background/60 px-4 py-3 text-[11px] text-muted-foreground">
              <span className="text-foreground">CPU:</span> {node.cpuBrand}
            </div>
          )}
        </TiltCard>
      </DialogContent>
    </Dialog>
  );
}
