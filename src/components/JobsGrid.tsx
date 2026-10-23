"use client";

import { AllCommunityModule, type ColDef, type ICellRendererParams, themeQuartz } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { Check, Copy, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { formatUsd, formatWhen, type JobStatus } from "@/lib/types";
import type { JobRow } from "@/lib/views";

const modules = [AllCommunityModule];

const theme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 13.5,
  accentColor: "#5b4bff",
  foregroundColor: "#101828",
  borderColor: "#e9ecf2",
  headerBackgroundColor: "#f8f9fc",
  headerTextColor: "#5d6679",
  headerFontWeight: 600,
  rowHoverColor: "#f5f4ff",
  selectedRowBackgroundColor: "#eeecff",
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowHeight: 56,
  headerHeight: 44,
  spacing: 7,
});

type Tab = { key: string; label: string; statuses: JobStatus[] | null };

const TABS: Tab[] = [
  { key: "all", label: "All jobs", statuses: null },
  { key: "review", label: "Needs review", statuses: ["review"] },
  { key: "funded", label: "Funds held", statuses: ["funded"] },
  { key: "released", label: "Paid", statuses: ["released"] },
  { key: "voided", label: "Returned", statuses: ["voided"] },
];

function JobCell({ data }: ICellRendererParams<JobRow>) {
  if (!data) return null;
  return (
    <div style={{ lineHeight: 1.3, paddingTop: 9 }}>
      <b style={{ display: "block" }}>{data.title}</b>
      <span className="faint small">
        {data.city}
        {data.sample ? " · sample" : ""}
      </span>
    </div>
  );
}

function KindCell({ data }: ICellRendererParams<JobRow>) {
  if (!data) return null;
  if (data.kind === "repair") return <span className="pill plain pill-voided">Repair</span>;
  return (
    <span className="pill plain pill-funded" title={`${data.milestones} milestones paid`}>
      Project {data.milestones}
    </span>
  );
}

function StatusCell({ data }: ICellRendererParams<JobRow>) {
  return data ? <span className={`pill pill-${data.status}`}>{data.statusLabel}</span> : null;
}

function ConfidenceCell({ value }: ICellRendererParams<JobRow, number | null>) {
  if (value == null) return <span className="faint">—</span>;
  const percent = Math.round(value * 100);
  const pass = value >= 0.82;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#eef0f4", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: pass ? "#0f9f6e" : "#d97706" }} />
      </div>
      <span style={{ width: 34, textAlign: "right", fontWeight: 600 }}>{percent}%</span>
    </div>
  );
}

function ModeCell({ value }: ICellRendererParams<JobRow, string | null>) {
  if (!value) return <span className="faint">—</span>;
  return <span className={`pill plain ${value === "demo" ? "pill-voided" : "pill-funded"}`}>{value}</span>;
}

function CopyTechLink({ data }: ICellRendererParams<JobRow>) {
  const [copied, setCopied] = useState(false);
  if (data?.kind === "project") return <Link href="/schedule" className="btn btn-sm btn-ghost">Schedule board</Link>;
  if (!data?.technicianUrl) return <span className="faint">Not funded</span>;
  const url = data.technicianUrl;
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      onClick={async (event) => {
        event.stopPropagation();
        await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Technician link"}
    </button>
  );
}

export function JobsGrid({ initialRows, mode = "review" }: { initialRows: JobRow[]; mode?: "review" | "dispatch" }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState(mode === "dispatch" ? "funded" : initialRows.some((row) => row.status === "review") ? "review" : "all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const visible = useMemo(() => {
    const statuses = TABS.find((item) => item.key === tab)?.statuses;
    return statuses ? rows.filter((row) => statuses.includes(row.status)) : rows;
  }, [rows, tab]);

  const columns = useMemo<ColDef<JobRow>[]>(() => {
    const base: ColDef<JobRow>[] = [
      { headerName: "Job", field: "title", cellRenderer: JobCell, flex: 2, minWidth: 220, getQuickFilterText: (p) => `${p.data?.title} ${p.data?.city} ${p.data?.customerName}` },
      { headerName: "Type", field: "kind", cellRenderer: KindCell, width: 130 },
      { headerName: "Trade", field: "trade", width: 120 },
      { headerName: "Status", field: "status", cellRenderer: StatusCell, width: 170 },
      { headerName: "Held", field: "priceUsd", width: 110, type: "rightAligned", valueFormatter: (p) => formatUsd(p.value ?? 0) },
    ];
    if (mode === "dispatch") {
      return [
        ...base,
        { headerName: "Tech payout", field: "payoutUsd", width: 120, type: "rightAligned", valueFormatter: (p) => formatUsd(p.value ?? 0) },
        { headerName: "PayPal", field: "paypalMode", cellRenderer: ModeCell, width: 110 },
        { headerName: "Dispatch", field: "technicianUrl", cellRenderer: CopyTechLink, width: 180, sortable: false },
        { headerName: "Created", field: "createdAt", width: 150, sort: "desc", valueFormatter: (p) => (p.value ? formatWhen(p.value) : "") },
      ];
    }
    return [
      ...base,
      { headerName: "AI confidence", field: "confidence", cellRenderer: ConfidenceCell, width: 160 },
      { headerName: "PayPal", field: "paypalMode", cellRenderer: ModeCell, width: 110 },
      { headerName: "Payout", field: "payoutStatus", width: 110, valueFormatter: (p) => p.value ?? "—" },
      { headerName: "Updated", field: "updatedAt", width: 150, sort: "desc", valueFormatter: (p) => (p.value ? formatWhen(p.value) : "") },
    ];
  }, [mode]);

  async function refresh() {
    setLoading(true);
    try {
      const { data } = await api<{ data: JobRow[] }>("/api/v1/jobs");
      setRows(data.data);
    } finally {
      setLoading(false);
    }
  }

  const counts = (statuses: JobStatus[] | null) => (statuses ? rows.filter((row) => statuses.includes(row.status)).length : rows.length);
  const tabs = mode === "dispatch" ? TABS.filter((item) => item.key === "funded" || item.key === "all") : TABS;

  return (
    <section className="card flush">
      <div className="grid-toolbar">
        <div className="tabs">
          {tabs.map((item) => (
            <button key={item.key} type="button" className={tab === item.key ? "on" : ""} onClick={() => setTab(item.key)}>
              {item.label}
              <span>{counts(item.statuses)}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Search title, city, customer" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={refresh} disabled={loading} title="Reload from GET /api/v1/jobs">
            <RefreshCw size={14} className={loading ? "spin" : undefined} /> Refresh
          </button>
        </div>
      </div>
      <div className="grid-host">
        <AgGridProvider modules={modules}>
          <AgGridReact<JobRow>
            theme={theme}
            rowData={visible}
            columnDefs={columns}
            defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true }}
            quickFilterText={query}
            getRowId={(params) => params.data.id}
            animateRows
            domLayout="autoHeight"
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            rowStyle={{ cursor: mode === "review" ? "pointer" : "default" }}
            onRowClicked={(event) => {
              if (mode === "review" && event.data) router.push(`/review/${event.data.id}`);
            }}
            overlayNoRowsTemplate='<span class="faint">No jobs here yet. Create the sample job from the home page.</span>'
          />
        </AgGridProvider>
      </div>
    </section>
  );
}
