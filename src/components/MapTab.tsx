import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Search, MapPin } from "lucide-react";
import type { QuipNode } from "@/lib/quipstats-api";
import { fetchMyIP, geoBatch, getFlagEmoji, isPublicIP, maskIP, maskName, type GeoResult } from "@/lib/quipstats-api";
import { TiltRow } from "@/components/TiltRow";
import { cn } from "@/lib/utils";

interface Props { nodes: QuipNode[]; }

interface IPInfo {
  ip: string;
  geo?: GeoResult;
  nodes: QuipNode[];
}

const TYPE_COLOR: Record<string, string> = { GPU: "#22c55e", CPU: "#3b82f6", QPU: "#a78bfa" };

export function MapTab({ nodes }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [geoMap, setGeoMap] = useState<Map<string, GeoResult>>(new Map());
  const [myIP, setMyIP] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<IPInfo | null>(null);
  const [searching, setSearching] = useState(false);

  // Build IP→nodes map
  const ipNodeMap = useMemo(() => {
    const m = new Map<string, QuipNode[]>();
    nodes.forEach((n) => {
      const ip = n.ip ? n.ip.split(":")[0] : "";
      if (!ip || !isPublicIP(ip)) return;
      const arr = m.get(ip) ?? [];
      arr.push(n);
      m.set(ip, arr);
    });
    return m;
  }, [nodes]);

  // Init Leaflet
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: [20, 0], zoom: 2, worldCopyJump: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = null; };
  }, []);

  // Fetch own IP once
  useEffect(() => { fetchMyIP().then(setMyIP); }, []);

  // Geolocate IPs in batches and draw markers
  useEffect(() => {
    if (!ipNodeMap.size || !markersRef.current) return;
    let cancelled = false;
    const ips = Array.from(ipNodeMap.keys());
    setProgress({ done: 0, total: ips.length });
    setLoading(true);
    const local = new Map<string, GeoResult>();

    (async () => {
      const BATCH = 100;
      for (let i = 0; i < ips.length; i += BATCH) {
        if (cancelled) return;
        const batch = ips.slice(i, i + BATCH);
        const results = await geoBatch(batch);
        results.forEach((r) => { if (r.status === "success") local.set(r.query, r); });
        // Draw markers for this batch
        results.forEach((r) => {
          if (r.status !== "success" || !markersRef.current) return;
          const list = ipNodeMap.get(r.query) || [];
          if (!list.length) return;
          drawMarker(markersRef.current, r, list);
        });
        if (!cancelled) {
          setProgress({ done: Math.min(i + BATCH, ips.length), total: ips.length });
          setGeoMap(new Map(local));
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [ipNodeMap]);

  // Country aggregation
  const countries = useMemo(() => {
    const c = new Map<string, { count: number; flag: string; code: string; activeCount: number }>();
    geoMap.forEach((g) => {
      if (!g.country) return;
      const list = ipNodeMap.get(g.query) || [];
      const cur = c.get(g.country) ?? { count: 0, flag: getFlagEmoji(g.countryCode), code: g.countryCode || "", activeCount: 0 };
      cur.count += list.length;
      cur.activeCount += list.filter((n) => n.active).length;
      c.set(g.country, cur);
    });
    return Array.from(c.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [geoMap, ipNodeMap]);

  const stats = useMemo(() => {
    const mapped = geoMap.size;
    let activePins = 0;
    geoMap.forEach((g) => {
      const list = ipNodeMap.get(g.query) || [];
      if (list.some((n) => n.active)) activePins++;
    });
    const top = countries[0];
    return { countries: countries.length, mapped, activePins, top: top ? `${top[1].flag} ${top[0]}` : "—" };
  }, [geoMap, ipNodeMap, countries]);

  // IP search
  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const ip = search.trim();
    if (!ip) { setSearchResult(null); return; }
    const isOwn = myIP && ip === myIP;
    setSearching(true);
    (async () => {
      let geo = geoMap.get(ip);
      if (!geo) {
        const res = await geoBatch([ip]);
        geo = res.find((r) => r.status === "success");
      }
      const list = ipNodeMap.get(ip) || [];
      setSearchResult({ ip, geo, nodes: list });
      // Fly to location if found
      if (geo && geo.lat != null && geo.lon != null && mapRef.current) {
        mapRef.current.flyTo([geo.lat, geo.lon], 6, { duration: 1.2 });
        // Add highlight marker
        if (markersRef.current) {
          const ring = L.circleMarker([geo.lat, geo.lon], {
            radius: 18,
            fillColor: isOwn ? "#eab308" : "#a78bfa",
            color: isOwn ? "#eab308" : "#a78bfa",
            weight: 2,
            fillOpacity: 0.15,
            opacity: 0.9,
          });
          ring.addTo(markersRef.current);
          setTimeout(() => { markersRef.current?.removeLayer(ring); }, 4000);
        }
      }
      setSearching(false);
    })();
  }

  function searchMyIP() {
    if (!myIP) return;
    setSearch(myIP);
    setTimeout(() => handleSearch(), 0);
  }

  const isOwnIP = !!(searchResult && myIP && searchResult.ip === myIP);

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="🌍 Countries" value={stats.countries} tone="info" />
        <Stat label="📍 Mapped IPs" value={stats.mapped.toLocaleString()} />
        <Stat label="🟢 Active Pins" value={stats.activePins.toLocaleString()} tone="success" />
        <Stat label="💻 Top Country" value={stats.top} tone="info" small />
      </div>

      <form onSubmit={handleSearch} className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any IPv4 — or your own to see unmasked details"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-[13px] focus:border-foreground/30 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground hover:border-foreground/40">
          {searching ? "Searching…" : "Search"}
        </button>
        <button type="button" onClick={searchMyIP} disabled={!myIP} className="flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-4 py-2 text-xs font-medium text-info transition hover:bg-info/20 disabled:opacity-40">
          <MapPin className="h-3.5 w-3.5" /> {myIP ? `My IP (${myIP})` : "Detecting…"}
        </button>
      </form>

      {searchResult && (
        <div className={cn("mb-4 rounded-xl border p-4", isOwnIP ? "border-warning/40 bg-warning/5" : "border-border bg-surface")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {isOwnIP ? "🟡 Your IP — unmasked" : "Search result"}
                {searchResult.geo?.country && (
                  <span className="text-foreground">{getFlagEmoji(searchResult.geo.countryCode)} {searchResult.geo.city}, {searchResult.geo.country}</span>
                )}
              </div>
              <div className="font-mono text-base font-semibold text-foreground">
                {isOwnIP ? searchResult.ip : maskIP(searchResult.ip)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {searchResult.nodes.length} node{searchResult.nodes.length !== 1 ? "s" : ""} known on this IP
              </div>
            </div>
            <button onClick={() => setSearchResult(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          {searchResult.nodes.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              {searchResult.nodes.slice(0, 12).map((n, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12px]">
                  <span className={cn("h-1.5 w-1.5 rounded-full", n.active ? "bg-success" : "bg-muted-foreground")} />
                  <span className="truncate font-mono">{isOwnIP ? n.name : maskName(n.name)}</span>
                  <span className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{n.type}</span>
                </div>
              ))}
              {searchResult.nodes.length > 12 && <div className="text-center text-[11px] text-muted-foreground">+{searchResult.nodes.length - 12} more</div>}
            </div>
          )}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-border" style={{ height: 520 }}>
        <div ref={mapEl} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-3 bg-surface/95 backdrop-blur">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-info" />
            <div className="text-xs text-muted-foreground">Geolocating nodes…</div>
            <div className="font-mono text-[11px] text-muted-foreground">{progress.done} / {progress.total}</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <Legend color="#22c55e" label="GPU" />
        <Legend color="#3b82f6" label="CPU" />
        <Legend color="#a78bfa" label="QPU" />
        <Legend color="rgba(255,255,255,0.25)" label="Offline" />
      </div>

      {countries.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            🌐 Country Leaderboard <span className="ml-2 font-mono text-foreground">{countries.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map(([name, info], i) => (
              <TiltRow
                key={name}
                tilt={5}
                scale={1.02}
                spotlight
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <span className={cn("w-6 text-right font-mono text-[11px] font-semibold", i < 3 ? ["text-warning", "text-muted-foreground", "text-info"][i] : "text-muted-foreground")}>
                  {i + 1}
                </span>
                <span className="text-lg">{info.flag}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
                  <div className="text-[10px] text-muted-foreground">{info.activeCount} active · {info.code}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[16px] font-semibold text-info">{info.count}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">nodes</div>
                </div>
              </TiltRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/40" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function Stat({ label, value, tone = "default", small = false }: { label: string; value: string | number; tone?: "default" | "info" | "success"; small?: boolean }) {
  const cls = { default: "text-foreground", info: "text-info", success: "text-success" }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`font-mono ${small ? "text-[16px]" : "text-[24px]"} font-semibold leading-none ${cls}`}>{value}</div>
    </div>
  );
}

function drawMarker(layer: L.LayerGroup, geo: GeoResult, list: QuipNode[]) {
  if (geo.lat == null || geo.lon == null) return;
  const activeNodes = list.filter((n) => n.active);
  const isActive = activeNodes.length > 0;
  const rep = activeNodes[0] || list[0];
  const color = TYPE_COLOR[rep.type] || "#a78bfa";
  const radius = Math.min(4 + list.length, 14);
  const marker = L.circleMarker([geo.lat, geo.lon], {
    radius,
    fillColor: isActive ? color : "rgba(255,255,255,.2)",
    color: isActive ? color : "#6b6b8a",
    weight: 1.5,
    fillOpacity: isActive ? 0.8 : 0.3,
    opacity: isActive ? 1 : 0.5,
  });
  const flag = getFlagEmoji(geo.countryCode);
  const popup = `
    <div style="min-width:180px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">${flag} ${geo.city || ""}, ${geo.country || ""}</div>
      <div style="font-size:11px;color:hsl(var(--muted-foreground));margin-bottom:8px">${maskIP(geo.query)}</div>
      ${list.slice(0, 8).map((n) => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:7px;height:7px;border-radius:50%;background:${n.active ? (TYPE_COLOR[n.type] || "#a78bfa") : "#6b6b8a"};display:inline-block;flex-shrink:0"></span>
          <span style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${escapeHtml(maskName(n.name))}</span>
          <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.08);flex-shrink:0">${n.type}</span>
        </div>`).join("")}
      ${list.length > 8 ? `<div style="font-size:10px;color:hsl(var(--muted-foreground));margin-top:4px">+${list.length - 8} more</div>` : ""}
    </div>`;
  marker.bindPopup(popup, { maxWidth: 280 });
  marker.addTo(layer);
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
