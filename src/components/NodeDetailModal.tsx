import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TiltCard } from "@/components/TiltCard";
import type { NodeRecord } from "@/lib/mock-nodes";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeDetailModalProps {
  node: NodeRecord | null;
  open: boolean;
  onClose: () => void;
}

function Field({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/60 p-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-mono text-lg font-medium tracking-tight text-foreground", valueClass)}>
        {value}
      </div>
    </div>
  );
}

export function NodeDetailModal({ node, open, onClose }: NodeDetailModalProps) {
  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="border-none bg-transparent p-0 shadow-none sm:max-w-[640px] [&>button]:hidden"
      >
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
                {node.name}
              </h2>
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
            <Field label="Resources" value={node.resources} />
            <Field
              label="Status"
              value={node.status === "online" ? "Online" : "Offline"}
              valueClass={node.status === "online" ? "text-success" : "text-destructive"}
            />
            <Field label="Last Seen" value={node.lastSeen} />
            <Field label="RAM" value={node.ram ?? "—"} />
            <Field label="Node Address" value={node.ip} />
            <Field label="First Seen" value={node.firstSeen} />
          </div>
        </TiltCard>
      </DialogContent>
    </Dialog>
  );
}
