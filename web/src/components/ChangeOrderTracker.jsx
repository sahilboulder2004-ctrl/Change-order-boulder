"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCOs } from "@/lib/useCOs.js";
import { uploadFile, getSignedUrl, removeFile, isFileMeta, MAX_FILE_BYTES } from "@/lib/storage.js";
import { supabaseReady } from "@/lib/supabase.js";
import { exportCOPdf, exportCOsPdf } from "@/lib/pdf.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  FileText, List, Calendar, BarChart3, Plus, RotateCcw, Search,
  Link2, Minus, Hourglass, Check, AlarmClock, Clock,
  ChevronLeft, ChevronRight, AlertTriangle, LogOut,
  Cloud, HardDrive, Download, Upload, Paperclip, Image as ImageIcon,
  X, Trash2, Briefcase, Ruler, HelpCircle, TriangleAlert, PlusCircle,
  MinusCircle, RefreshCw, Lightbulb, CloudRain, DollarSign,
  HardHat, Wrench, Zap, TreePine, Home, Palette, Truck, ClipboardList,
  Pencil, Send, Eye, CheckCircle2, XCircle, CircleDot, FilePen,
  Circle, Printer, MessageSquare, FileDown, FileUp
} from "lucide-react";

// ─── TOKENS ───────────────────────────────────────────────────────
// Reduced palette: orange (brand), stone (neutral), emerald (success), red (danger).
const C = {
  bg:"#ffffff", surface:"#ffffff", panel:"#fafaf9", card:"#ffffff",
  border:"#e7e5e4", borderSoft:"#f5f5f4",
  accent:"#ea580c",
  orangeLight:"#fb923c", orangeSoft:"#fed7aa", orangeFaint:"#fff7ed",
  green:"#059669",
  red:"#dc2626",
  text:"#1c1917", textSub:"#78716c", textMuted:"#d6d3d1",
  // kept for backwards-compat references (mapped to our reduced palette)
  blue:"#ea580c", yellow:"#ea580c", purple:"#78716c",
  teal:"#059669", pink:"#78716c", sky:"#ea580c", gold:"#ea580c",
  silver:"#57534e", bronze:"#9a3412",
};

// CO Statuses (orange luminance ladder, red/emerald only for terminal states)
const STATUSES = [
  { id:"draft",       label:"Draft",         color:"#a8a29e", Icon:Pencil },
  { id:"submitted",   label:"Submitted",     color:"#fb923c", Icon:Send },
  { id:"under_review",label:"Under Review",  color:"#ea580c", Icon:Eye },
  { id:"approved",    label:"Approved",      color:"#c2410c", Icon:CheckCircle2 },
  { id:"executed",    label:"Executed",      color:"#059669", Icon:FilePen },
  { id:"rejected",    label:"Rejected",      color:"#dc2626", Icon:XCircle },
  { id:"voided",      label:"Voided",        color:"#a8a29e", Icon:CircleDot },
];

// CO Types — neutral stone; icon carries semantics.
const CO_TYPES = {
  owner_directed:{ label:"Owner Directed",     color:"#57534e", Icon:Briefcase },
  design_change: { label:"Design Change",      color:"#57534e", Icon:Ruler },
  rfi:           { label:"RFI / Clarification",color:"#57534e", Icon:HelpCircle },
  unforeseen:    { label:"Unforeseen Cond.",   color:"#dc2626", Icon:TriangleAlert },
  scope_add:     { label:"Scope Addition",     color:"#ea580c", Icon:PlusCircle },
  scope_del:     { label:"Scope Deduction",    color:"#059669", Icon:MinusCircle },
  error_omission:{ label:"Error / Omission",   color:"#57534e", Icon:RefreshCw },
  value_eng:     { label:"Value Engineering",  color:"#57534e", Icon:Lightbulb },
  weather:       { label:"Weather / Force",    color:"#57534e", Icon:CloudRain },
  allowance:     { label:"Allowance Draw",     color:"#ea580c", Icon:DollarSign },
};

// Trade categories — all neutral stone; icon differentiates.
const TRADE_CATS = {
  concrete:   { label:"Concrete",      color:"#57534e", Icon:HardHat },
  steel:      { label:"Steel",         color:"#57534e", Icon:Wrench },
  mep:        { label:"MEP",           color:"#57534e", Icon:Zap },
  framing:    { label:"Framing",       color:"#57534e", Icon:TreePine },
  roofing:    { label:"Roofing",       color:"#57534e", Icon:Home },
  finishes:   { label:"Finishes",      color:"#57534e", Icon:Palette },
  sitework:   { label:"Sitework",      color:"#57534e", Icon:Truck },
  electrical: { label:"Electrical",    color:"#57534e", Icon:Zap },
  plumbing:   { label:"Plumbing",      color:"#57534e", Icon:Wrench },
  general:    { label:"General Cond.", color:"#57534e", Icon:ClipboardList },
};

// Priority — orange saturation ladder, red for critical.
const PRIORITY = {
  critical: { label:"Critical", color:"#dc2626", Icon:Circle },
  high:     { label:"High",     color:"#ea580c", Icon:Circle },
  medium:   { label:"Medium",   color:"#fb923c", Icon:Circle },
  low:      { label:"Low",      color:"#a8a29e", Icon:Circle },
};

const MEMBERS = [
  { id:"pm",    name:"Mike Torres",     role:"PM",             avatar:"MT", color:C.blue,   group:"internal" },
  { id:"super", name:"Mike Ramirez",    role:"Superintendent", avatar:"MR", color:C.accent, group:"internal" },
  { id:"apm",   name:"Sarah Chen",      role:"Asst. PM",       avatar:"SC", color:C.purple, group:"internal" },
  { id:"owner", name:"Owner Rep",       role:"Owner",          avatar:"OR", color:C.gold,   group:"owner"    },
  { id:"arch",  name:"Davis+Partners",  role:"Architect",      avatar:"DA", color:C.sky,    group:"design"   },
  { id:"sub1",  name:"SteelTech Fab.",  role:"Sub",            avatar:"ST", color:C.red,    group:"sub"      },
  { id:"sub2",  name:"Alpine Concrete", role:"Sub",            avatar:"AC", color:C.teal,   group:"sub"      },
  { id:"sub3",  name:"Precision MEP",   role:"Sub",            avatar:"PM", color:C.green,  group:"sub"      },
  { id:"sub4",  name:"FastFrame Inc.",  role:"Sub",            avatar:"FF", color:C.yellow, group:"sub"      },
];

const PROJECTS = [
  { id:"tpsj", prefix:"TPSJ", name:"TownePlace Suites — Jackson",    originalContract:0, currentContract:0 },
  { id:"sybj", prefix:"SYBJ", name:"Staybridge Suites — Jackson",    originalContract:0, currentContract:0 },
  { id:"cwsj", prefix:"CWSJ", name:"Candlewood Suites — Jackson",    originalContract:0, currentContract:0 },
  { id:"his",  prefix:"HIS",  name:"Holiday Inn Express — Stephenville", originalContract:0, currentContract:0 },
  { id:"hibr", prefix:"HIBR", name:"Hampton Inn — Baton Rouge",      originalContract:0, currentContract:0 },
  { id:"hwg",  prefix:"HWG",  name:"Homewood Suites — Gonzales",     originalContract:0, currentContract:0 },
];

// Next CO number for a given project — highest trailing number +1, zero-padded.
function nextCONumber(cos, projectId) {
  const proj = PROJECTS.find((p) => p.id === projectId);
  if (!proj) return "CO-001";
  const projCOs = cos.filter((c) => c.project === projectId);
  let maxN = 0;
  for (const co of projCOs) {
    const m = String(co.num || "").match(/(\d+)\s*$/);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `${proj.prefix}-CO-${String(maxN + 1).padStart(3, "0")}`;
}

const TODAY_DATE = new Date(); TODAY_DATE.setHours(0,0,0,0);
const TODAY = TODAY_DATE.toISOString().slice(0,10);

// ─── INITIAL DATA ─────────────────────────────────────────────────
const INIT_COs = [];

// Sub-COs (sub's pricing for a prime CO)
const INIT_SUBCOs = [];

// ─── HELPERS ──────────────────────────────────────────────────────
function Avatar({ id, size = 24 }) {
  const m = MEMBERS.find((x) => x.id === id);
  if (!m) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex shrink-0 items-center justify-center rounded-full ring-2 ring-white"
            style={{
              width: size,
              height: size,
              background: m.color,
              fontSize: size * 0.38,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          >
            {m.avatar}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">
          {m.name} · <span className="opacity-70">{m.role}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Pill({ label, color, size = 10, Icon, filled }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-semibold transition-colors"
      style={{
        background: color + "1f",
        color,
        fontSize: size,
        border: `1px solid ${color}33`,
      }}
    >
      {Icon && <Icon size={size + 1} fill={filled ? color : "none"} strokeWidth={2} />}
      {label}
    </span>
  );
}
function fmtDate(s) { if(!s)return"—"; return new Date(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function fmtShort(s) { if(!s)return"—"; return new Date(s).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function fmtAmt(n) {
  if (!n && n!==0) return "—";
  const abs = Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
  return (n<0 ? "-$" : "$") + abs;
}
function daysUntil(d) { if(!d)return null; return Math.round((new Date(d)-TODAY_DATE)/86400000); }

// ─── CSV EXPORT ───────────────────────────────────────────────────
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function exportCSV(cos) {
  const cols = [
    ["num","CO #"],["title","Title"],["type","Type"],["category","Trade"],
    ["priority","Priority"],["status","Status"],["project","Project"],
    ["submittedDate","Submitted"],["dueDate","Due"],["reviewedDate","Reviewed"],["executedDate","Executed"],
    ["requestedAmt","Requested $"],["approvedAmt","Approved $"],["scheduleImpact","Schedule Impact (days)"],
    ["description","Description"],["justification","Justification"],
    ["linkedRFI","Linked RFI"],["linkedSpec","Linked Spec"],["linkedDrawing","Linked Drawing"],
  ];
  const header = cols.map(c=>csvEscape(c[1])).join(",");
  const rows = cos.map(co => cols.map(c=>csvEscape(co[c[0]])).join(","));
  const csv = [header,...rows].join("\r\n");
  const blob = new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `change-orders-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function DueBadge({ due, status }) {
  if (!due || status === "executed" || status === "rejected" || status === "voided") return null;
  const d = daysUntil(due);
  const tone =
    d < 0 ? "text-red-700"
    : d === 0 ? "text-red-700"
    : d <= 3 ? "text-orange-700"
    : "text-stone-500";
  const label =
    d < 0 ? `${Math.abs(d)}d overdue`
    : d === 0 ? "Due today"
    : d === 1 ? "Tomorrow"
    : `${d}d`;
  return (
    <span className={`whitespace-nowrap text-[10px] font-bold ${tone}`}>
      {label}
    </span>
  );
}

// Contract summary per project
function calcProjectSummary(projectId, cos) {
  const mine = cos.filter(c=>c.project===projectId);
  const proj = PROJECTS.find(p=>p.id===projectId);
  const executed = mine.filter(c=>c.status==="executed");
  const approved = mine.filter(c=>c.status==="approved");
  const pending  = mine.filter(c=>["submitted","under_review"].includes(c.status));
  const executedAmt  = executed.reduce((a,c)=>a+(c.approvedAmt||0),0);
  const approvedAmt  = approved.reduce((a,c)=>a+(c.approvedAmt||0),0);
  const pendingAmt   = pending.reduce((a,c)=>a+(c.requestedAmt||0),0);
  const totalExposed = executedAmt + approvedAmt + pendingAmt;
  const schedImpact  = mine.reduce((a,c)=>a+(c.scheduleImpact||0),0);
  return { proj, mine, executed, approved, pending, executedAmt, approvedAmt, pendingAmt, totalExposed, schedImpact };
}

// ─── CO CARD ──────────────────────────────────────────────────────
function COCard({ co, onClick }) {
  const sc = STATUSES.find((s) => s.id === co.status);
  const ct = CO_TYPES[co.type];
  const cat = TRADE_CATS[co.category];
  const pr = PRIORITY[co.priority];
  const isCredit = co.requestedAmt < 0;
  const amtClass =
    co.status === "rejected" || co.status === "voided" ? "text-stone-400"
    : isCredit ? "text-emerald-600"
    : co.approvedAmt > 0 ? "text-emerald-600"
    : "text-orange-600";
  const displayAmt = co.approvedAmt !== 0 ? co.approvedAmt : co.requestedAmt;

  const metaCount = (co.photos?.length || 0) + (co.attachments?.length || 0);

  return (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onClick={() => onClick(co)}
      className="group mb-2 cursor-pointer overflow-hidden rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm transition-[border-color,box-shadow] hover:border-orange-200 hover:shadow-[0_8px_24px_-12px_rgba(234,88,12,0.25)]"
      style={{ borderLeft: `3px solid ${sc.color}` }}
    >
      {/* Meta row — CO number + sub/RFI chips */}
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px]">
        <span className="font-mono font-bold text-orange-600">{co.num}</span>
        {co.isSubCO && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-stone-100 px-1.5 py-px font-semibold text-stone-600">
            <Link2 className="size-2.5" />Sub
          </span>
        )}
        {co.linkedRFI && (
          <span className="rounded-sm bg-stone-100 px-1.5 py-px font-mono font-semibold text-stone-600">
            {co.linkedRFI}
          </span>
        )}
      </div>

      {/* Title + amount */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 flex-1 text-[13px] font-semibold leading-snug text-stone-900">
          {co.title}
        </h3>
        <div className="shrink-0 text-right">
          <div className={`font-mono text-[17px] font-extrabold leading-none tabular-nums ${amtClass}`}>
            {fmtAmt(displayAmt)}
          </div>
          {co.approvedAmt !== co.requestedAmt && co.requestedAmt !== 0 && (
            <div className="mt-1 text-[10px] text-stone-400">
              Req <span className="font-mono tabular-nums">{fmtAmt(co.requestedAmt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags — tight single-tone row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-stone-600">
        {ct && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <ct.Icon className="size-3 text-stone-400" />
            {ct.label}
          </span>
        )}
        {cat && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <cat.Icon className="size-3 text-stone-400" />
            {cat.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold" style={{ color: pr.color }}>
          <span className="size-1.5 rounded-full" style={{ background: pr.color }} />
          {pr.label}
        </span>
        {co.scheduleImpact !== 0 && (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${
            co.scheduleImpact > 0 ? "text-orange-600" : "text-emerald-600"
          }`}>
            <Clock className="size-3" />
            {co.scheduleImpact > 0 ? "+" : ""}{co.scheduleImpact}d
          </span>
        )}
      </div>

      {/* Footer — status chip + avatars + due */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: sc.color + "1a", color: sc.color }}
        >
          <sc.Icon className="size-3" />
          {sc.label}
        </span>

        {co.assignees.length > 0 && (
          <div className="flex shrink-0 items-center">
            {co.assignees.slice(0, 3).map((id, i) => (
              <div key={id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                <Avatar id={id} size={20} />
              </div>
            ))}
            {co.assignees.length > 3 && (
              <div className="ml-[-4px] flex size-[20px] items-center justify-center rounded-full bg-stone-200 text-[9px] font-bold text-stone-700 ring-2 ring-white">
                +{co.assignees.length - 3}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 text-[10px] text-stone-400">
          {co.comments.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="size-3" />
              {co.comments.length}
            </span>
          )}
          {metaCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="size-3" />
              {metaCount}
            </span>
          )}
          <DueBadge due={co.dueDate} status={co.status} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── FILES TAB ────────────────────────────────────────────────────
function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return n + " B";
  if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
  return (n/1024/1024).toFixed(2) + " MB";
}
function isImage(f) {
  const m = f?.mime || "";
  return m.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(f?.name || "");
}

function FileRow({ f, onRemove }) {
  const legacy = !isFileMeta(f);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let cancel = false;
    if (!legacy && supabaseReady) {
      getSignedUrl(f.path).then((u) => { if (!cancel) setUrl(u); }).catch((e) => setErr(e.message));
    }
    return () => { cancel = true; };
  }, [f, legacy]);

  const Ico = isImage(f) ? ImageIcon : FileText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="mb-1.5 flex items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2 transition-colors hover:border-orange-300"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-orange-50 text-orange-600">
        <Ico className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs font-semibold text-orange-600 hover:underline"
          >
            {legacy ? f : f.name}
          </a>
        ) : (
          <span className={`block truncate text-xs ${legacy ? "text-stone-500" : "text-stone-800"}`}>
            {legacy ? f : f.name}
            {legacy && <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-orange-500">demo</span>}
          </span>
        )}
        {!legacy && (
          <div className="mt-0.5 text-[10px] tabular-nums text-stone-500">
            {fmtBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}
          </div>
        )}
        {err && <div className="mt-0.5 text-[10px] text-red-600">{err}</div>}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} title="Remove" className="text-stone-400 hover:text-red-600">
        <Trash2 className="size-3.5" />
      </Button>
    </motion.div>
  );
}

function FilesTab({ t, setT }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const attachInput = useRef(null);
  const photoInput = useRef(null);

  async function pickAndUpload(kind, files) {
    setErr(null);
    if (!supabaseReady) {
      setErr("Sign in to upload files. Files saved in local mode won't persist.");
      return;
    }
    setBusy(true);
    try {
      const uploaded = [];
      for (const f of Array.from(files)) {
        const meta = await uploadFile(t.id, f, kind);
        uploaded.push(meta);
      }
      const key = kind === "photo" ? "photos" : "attachments";
      setT((p) => ({ ...p, [key]: [...(p[key] || []), ...uploaded] }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind, index) {
    const key = kind === "photo" ? "photos" : "attachments";
    const f = t[key][index];
    try {
      if (isFileMeta(f)) await removeFile(f.path);
    } catch (e) {
      setErr(e.message);
      return;
    }
    setT((p) => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));
  }

  return (
    <div className="max-w-[620px] space-y-6">
      {err && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          <AlertTriangle className="size-3.5" />
          {err}
        </div>
      )}
      {!supabaseReady && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
          Cloud mode required for real uploads. Sign in to enable.
        </div>
      )}

      <section>
        <div className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Site Photos</div>
        <AnimatePresence>
          {t.photos.map((p, i) => (
            <FileRow key={i} f={p} onRemove={() => remove("photo", i)} />
          ))}
        </AnimatePresence>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) pickAndUpload("photo", e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => photoInput.current?.click()}
          className="border-dashed border-orange-300 text-stone-700 hover:bg-orange-50 hover:text-orange-700"
        >
          <ImageIcon className="size-3.5" />
          {busy ? "Uploading…" : "Add photos"}
        </Button>
      </section>

      <section>
        <div className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Attachments</div>
        <AnimatePresence>
          {t.attachments.map((a, i) => (
            <FileRow key={i} f={a} onRemove={() => remove("attachment", i)} />
          ))}
        </AnimatePresence>
        <input
          ref={attachInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) pickAndUpload("attachment", e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => attachInput.current?.click()}
          className="border-dashed border-orange-300 text-stone-700 hover:bg-orange-50 hover:text-orange-700"
        >
          <Upload className="size-3.5" />
          {busy ? "Uploading…" : "Upload attachment"}
        </Button>
        <div className="mt-1.5 text-[10px] text-stone-500">
          Max {MAX_FILE_BYTES / 1024 / 1024} MB per file. Files are private to your workspace.
        </div>
      </section>
    </div>
  );
}

// ─── CO DETAIL MODAL ──────────────────────────────────────────────
function COModal({ co, subCOs, onClose, onUpdate, onDelete }) {
  const [t, setT] = useState({ ...co });
  const [li, setLi] = useState([...co.lineItems]);
  const [newComment, setNewComment] = useState("");
  const [tab, setTab] = useState("details");
  const [newLI, setNewLI] = useState({ desc: "", qty: 1, unit: "EA", rate: 0, total: 0 });

  function save() { onUpdate({ ...t, lineItems: li }); onClose(); }
  function addComment() {
    if (!newComment.trim()) return;
    setT((p) => ({ ...p, comments: [...p.comments, { author: "pm", text: newComment.trim(), time: "Just now" }] }));
    setNewComment("");
  }
  const calcLI = (item) => Math.round(item.qty * item.rate * 100) / 100;
  function addLineItem() {
    if (!newLI.desc) return;
    setLi((p) => [...p, { ...newLI, total: calcLI(newLI) }]);
    setNewLI({ desc: "", qty: 1, unit: "EA", rate: 0, total: 0 });
  }
  function updateLI(i, field, val) {
    setLi((p) => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      updated.total = calcLI(updated);
      return updated;
    }));
  }
  const removeLI = (i) => setLi((p) => p.filter((_, idx) => idx !== i));
  const subtotal = li.reduce((a, item) => a + item.total, 0);
  const gcMarkupAmt = subtotal * (t.gcMarkup || 0);
  const totalAmt = subtotal + gcMarkupAmt;

  const sc = STATUSES.find((s) => s.id === t.status);
  const ct = CO_TYPES[t.type];
  const cat = TRADE_CATS[t.category];
  const pr = PRIORITY[t.priority];
  const mySubs = subCOs.filter((s) => s.parentCO === co.id);

  const statusOrder = ["draft", "submitted", "under_review", "approved", "executed"];
  const currentIdx = statusOrder.indexOf(t.status);

  function advanceStatus() {
    if (currentIdx < 0 || currentIdx >= statusOrder.length - 1) return;
    const next = statusOrder[currentIdx + 1];
    const update = { ...t, status: next };
    if (next === "submitted") update.submittedDate = TODAY;
    if (next === "approved") update.reviewedDate = TODAY;
    if (next === "executed") update.executedDate = TODAY;
    setT(update);
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[92vh] w-[min(1200px,calc(100vw-2rem))] !max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-stone-200 p-0 shadow-[0_40px_100px_-20px_rgba(234,88,12,0.25)] sm:!max-w-none"
      >
        <DialogTitle className="sr-only">Change Order {t.num} details</DialogTitle>

        {/* Header */}
        <div className="border-b border-stone-200 bg-gradient-to-b from-orange-50/60 to-white px-6 pt-5 pb-4">
          {/* Row 1 — identity + actions */}
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm font-bold text-orange-600">{t.num}</span>
                {sc && <Pill label={sc.label} Icon={sc.Icon} color={sc.color} size={10} />}
                {ct && <Pill label={ct.label} Icon={ct.Icon} color={ct.color} size={10} />}
                {t.isSubCO && <Pill label="Sub-Contractor CO" Icon={Link2} color="#7c3aed" size={10} />}
              </div>
              <input
                value={t.title}
                onChange={(e) => setT((p) => ({ ...p, title: e.target.value }))}
                className="w-full border-none bg-transparent text-xl font-extrabold tracking-tight text-stone-900 outline-none selection:bg-orange-100 selection:text-orange-900 focus:ring-0"
                placeholder="Change order title…"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {currentIdx < statusOrder.length - 1 && t.status !== "rejected" && t.status !== "voided" && (
                <Button
                  size="sm"
                  onClick={advanceStatus}
                  className="bg-gradient-to-br from-orange-400 to-orange-600 text-white hover:opacity-95"
                >
                  <Send className="size-3.5" />
                  {STATUSES.find((s) => s.id === statusOrder[currentIdx + 1])?.label}
                </Button>
              )}
              <Button size="sm" onClick={save} className="bg-stone-900 text-white hover:bg-stone-800">
                <Check className="size-3.5" />Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportCOPdf(t, {
                    project: PROJECTS.find((p) => p.id === t.project),
                    coType: ct, category: cat, priority: pr, status: sc, members: MEMBERS,
                  })
                }
              >
                <Printer className="size-3.5" />PDF
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => { onDelete(t.id); onClose(); }}
                className="text-stone-400 hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {/* Row 2 — status pipeline + amount chips */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-0">
              {statusOrder.map((sid, i) => {
                const ss = STATUSES.find((s) => s.id === sid);
                const past = i < currentIdx;
                const curr = i === currentIdx;
                return (
                  <div key={sid} className="flex items-center">
                    <motion.div
                      layout
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                        curr ? "border-orange-400 bg-orange-100 text-orange-700"
                        : past ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 bg-white text-stone-500"
                      }`}
                    >
                      {past ? <Check className="size-3" /> : curr ? <ss.Icon className="size-3" /> : null}
                      {ss.label}
                    </motion.div>
                    {i < statusOrder.length - 1 && (
                      <div className={`mx-0.5 h-px w-3 ${i < currentIdx ? "bg-emerald-400" : "bg-stone-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Requested</span>
                <span className="font-mono text-sm font-extrabold tabular-nums text-orange-600">{fmtAmt(t.requestedAmt)}</span>
              </div>
              {t.approvedAmt !== 0 && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70">Approved</span>
                  <span className="font-mono text-sm font-extrabold tabular-nums text-emerald-700">{fmtAmt(t.approvedAmt)}</span>
                  {t.approvedAmt === t.requestedAmt && <Check className="size-3 text-emerald-600" />}
                </div>
              )}
              {t.scheduleImpact !== 0 && (
                <div className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                  t.scheduleImpact > 0 ? "border-orange-200 bg-orange-50 text-orange-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}>
                  <Clock className="size-3" />
                  {t.scheduleImpact > 0 ? "+" : ""}{t.scheduleImpact}d schedule
                </div>
              )}
            </div>
          </div>

          {/* Row 3 — dates */}
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
            <span>Submitted: <span className="font-medium text-stone-700">{fmtDate(t.submittedDate)}</span></span>
            <span>Due: <span className={`font-medium ${daysUntil(t.dueDate) < 0 && !["executed","rejected"].includes(t.status) ? "text-red-600" : "text-stone-700"}`}>{fmtDate(t.dueDate)}</span></span>
            {t.reviewedDate && <span>Reviewed: <span className="font-medium text-stone-700">{fmtDate(t.reviewedDate)}</span></span>}
            {t.executedDate && <span className="inline-flex items-center gap-1 font-medium text-emerald-600"><Check className="size-3" />Executed: {fmtDate(t.executedDate)}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-stone-200 bg-stone-50/50 px-6">
          {[
            { key: "details",  label: "Details",                                  I: ClipboardList },
            { key: "pricing",  label: `Pricing (${li.length})`,                   I: DollarSign },
            { key: "comments", label: `Comments (${t.comments.length})`,           I: MessageSquare },
            { key: "files",    label: "Files",                                    I: Paperclip },
            { key: "subcOs",   label: `Sub COs (${mySubs.length})`,               I: Link2 },
          ].map(({ key, label, I }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                  active ? "text-orange-600" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <I className="size-3.5" />
                {label}
                {active && (
                  <motion.div
                    layoutId="modal-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "details" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                  <div className="space-y-4">
                    <FieldBlock label="Description">
                      <Textarea
                        value={t.description}
                        onChange={(e) => setT((p) => ({ ...p, description: e.target.value }))}
                        className="min-h-[90px]"
                      />
                    </FieldBlock>
                    <FieldBlock label="Justification / Basis of claim">
                      <Textarea
                        value={t.justification}
                        onChange={(e) => setT((p) => ({ ...p, justification: e.target.value }))}
                        placeholder="Why is this change warranted?"
                        className="min-h-[70px]"
                      />
                    </FieldBlock>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldBlock label="Status">
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((s) => {
                            const on = t.status === s.id;
                            return (
                              <button
                                key={s.id}
                                onClick={() => setT((p) => ({ ...p, status: s.id }))}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                  on ? "border-orange-400 bg-orange-50 text-orange-700" : "border-stone-200 text-stone-600 hover:border-orange-300 hover:text-stone-800"
                                }`}
                              >
                                <s.Icon className="size-3" />{s.label}
                              </button>
                            );
                          })}
                        </div>
                      </FieldBlock>
                      <FieldBlock label="CO type">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(CO_TYPES).map(([k, v]) => {
                            const on = t.type === k;
                            return (
                              <button
                                key={k}
                                onClick={() => setT((p) => ({ ...p, type: k }))}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                  on ? "border-orange-400 bg-orange-50 text-orange-700" : "border-stone-200 text-stone-600 hover:border-orange-300 hover:text-stone-800"
                                }`}
                              >
                                <v.Icon className="size-3" />{v.label}
                              </button>
                            );
                          })}
                        </div>
                      </FieldBlock>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldBlock label="Priority">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(PRIORITY).map(([k, v]) => {
                            const on = t.priority === k;
                            return (
                              <button
                                key={k}
                                onClick={() => setT((p) => ({ ...p, priority: k }))}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                  on ? "border-orange-400 bg-orange-50 text-orange-700" : "border-stone-200 text-stone-600 hover:border-orange-300"
                                }`}
                              >
                                <v.Icon className="size-3" fill={on ? v.color : "none"} />{v.label}
                              </button>
                            );
                          })}
                        </div>
                      </FieldBlock>
                      <FieldBlock label="Trade category">
                        <Select value={t.category} onValueChange={(v) => setT((p) => ({ ...p, category: v }))}>
                          <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TRADE_CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {[["Linked RFI", "linkedRFI"], ["Spec section", "linkedSpec"], ["Drawing ref", "linkedDrawing"]].map(([l, k]) => (
                        <FieldBlock key={k} label={l}>
                          <Input
                            value={t[k] || ""}
                            onChange={(e) => setT((p) => ({ ...p, [k]: e.target.value }))}
                            placeholder={l + "…"}
                            className="h-8 font-mono text-xs"
                          />
                        </FieldBlock>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      variant={t.isSubCO ? "default" : "outline"}
                      onClick={() => setT((p) => ({ ...p, isSubCO: !p.isSubCO }))}
                      className={t.isSubCO ? "bg-orange-600 text-white hover:bg-orange-700" : "border-orange-200"}
                    >
                      <Link2 className="size-3.5" />Sub-Contractor CO
                    </Button>
                  </div>

                  {/* Right sidebar */}
                  <div className="space-y-3">
                    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Dates</div>
                      {[["Submitted", t.submittedDate], ["Due / Response", t.dueDate], ["Reviewed", t.reviewedDate], ["Executed", t.executedDate]].map(([l, v]) => (
                        <div key={l} className="flex justify-between border-b border-stone-100 py-1 text-[11px] last:border-0">
                          <span className="text-stone-500">{l}</span>
                          <span className={`font-medium ${l === "Executed" ? "text-emerald-600" : "text-stone-700"}`}>{fmtDate(v)}</span>
                        </div>
                      ))}
                      <div className="mt-3">
                        <div className="mb-1 text-[10px] text-stone-500">Due / Response date</div>
                        <Input
                          type="date"
                          value={t.dueDate || ""}
                          onChange={(e) => setT((p) => ({ ...p, dueDate: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Schedule impact (days)</div>
                      <Input
                        type="number"
                        value={t.scheduleImpact || 0}
                        onChange={(e) => setT((p) => ({ ...p, scheduleImpact: +e.target.value }))}
                        className={`h-11 text-center text-lg font-bold tabular-nums ${t.scheduleImpact > 0 ? "text-orange-600" : t.scheduleImpact < 0 ? "text-emerald-600" : ""}`}
                      />
                      <div className="mt-1 text-center text-[10px] text-stone-500">Positive = delay · Negative = savings</div>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">GC markup</div>
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        max={0.5}
                        value={t.gcMarkup || 0}
                        onChange={(e) => setT((p) => ({ ...p, gcMarkup: +e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <div className="mt-1 text-[10px] text-stone-500">e.g. 0.10 = 10% markup on sub cost</div>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Parties</div>
                      {["internal", "owner", "design", "sub"].map((group) => {
                        const gm = MEMBERS.filter((m) => m.group === group);
                        const labels = { internal: "Internal", owner: "Owner", design: "Architect", sub: "Subs" };
                        return (
                          <div key={group} className="mb-2 last:mb-0">
                            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-stone-400">{labels[group]}</div>
                            <div className="flex flex-col gap-0.5">
                              {gm.map((m) => {
                                const on = t.assignees.includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => setT((p) => ({ ...p, assignees: on ? p.assignees.filter((x) => x !== m.id) : [...p.assignees, m.id] }))}
                                    className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-colors ${
                                      on ? "border-orange-300 bg-orange-50 font-semibold text-orange-700" : "border-transparent text-stone-700 hover:bg-stone-50"
                                    }`}
                                  >
                                    <Avatar id={m.id} size={18} />
                                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                                    {on && <Check className="size-3 text-orange-600" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {tab === "pricing" && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50/60 px-4 py-2.5 text-sm font-bold">
                      <DollarSign className="size-4 text-orange-600" />Line items
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-stone-50/60">
                          {["Description", "Qty", "Unit", "Unit rate", "Total", ""].map((h) => (
                            <th key={h} className="border-b border-stone-200 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {li.map((item, i) => (
                          <tr key={i} className="border-b border-stone-100 hover:bg-stone-50/40">
                            <td className="px-3 py-1.5">
                              <input value={item.desc} onChange={(e) => updateLI(i, "desc", e.target.value)} className="w-full bg-transparent text-xs outline-none" />
                            </td>
                            <td className="w-[70px] px-3 py-1.5">
                              <input type="number" value={item.qty} onChange={(e) => updateLI(i, "qty", +e.target.value)} className="w-full bg-transparent text-right font-mono text-xs tabular-nums outline-none" />
                            </td>
                            <td className="w-[70px] px-3 py-1.5">
                              <select value={item.unit} onChange={(e) => updateLI(i, "unit", e.target.value)} className="bg-transparent text-[11px] text-stone-500 outline-none">
                                {["EA", "LS", "SF", "LF", "CY", "LB", "Day", "HR", "Unit"].map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="w-[100px] px-3 py-1.5">
                              <input type="number" step={0.01} value={item.rate} onChange={(e) => updateLI(i, "rate", +e.target.value)} className="w-full bg-transparent text-right font-mono text-xs tabular-nums outline-none" />
                            </td>
                            <td className={`w-[110px] px-3 py-1.5 text-right font-mono font-bold tabular-nums ${item.total < 0 ? "text-emerald-600" : "text-stone-800"}`}>{fmtAmt(item.total)}</td>
                            <td className="w-[40px] px-3 py-1.5">
                              <Button variant="ghost" size="icon" onClick={() => removeLI(i)} className="size-7 text-stone-400 hover:text-red-600">
                                <X className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-orange-50/30">
                          <td className="px-3 py-1.5">
                            <input value={newLI.desc} onChange={(e) => setNewLI((p) => ({ ...p, desc: e.target.value }))} placeholder="New line item description…" className="w-full bg-transparent text-xs text-stone-500 outline-none placeholder:text-stone-400" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" value={newLI.qty} onChange={(e) => setNewLI((p) => ({ ...p, qty: +e.target.value }))} className="w-full bg-transparent text-right font-mono text-xs tabular-nums outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <select value={newLI.unit} onChange={(e) => setNewLI((p) => ({ ...p, unit: e.target.value }))} className="bg-transparent text-[11px] text-stone-500 outline-none">
                              {["EA", "LS", "SF", "LF", "CY", "LB", "Day", "HR", "Unit"].map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" step={0.01} value={newLI.rate} onChange={(e) => setNewLI((p) => ({ ...p, rate: +e.target.value }))} className="w-full bg-transparent text-right font-mono text-xs tabular-nums outline-none" />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-stone-500">{fmtAmt(calcLI(newLI))}</td>
                          <td className="px-3 py-1.5">
                            <Button size="sm" variant="outline" onClick={addLineItem} disabled={!newLI.desc} className="h-7 border-orange-200 px-2 text-[10px] text-orange-700 hover:bg-orange-50">
                              <Plus className="size-3" />Add
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <div className="w-[320px] rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                      {[["Subtotal", subtotal], [`GC markup (${Math.round((t.gcMarkup || 0) * 100)}%)`, gcMarkupAmt]].map(([l, v]) => (
                        <div key={l} className="flex justify-between border-b border-stone-100 py-1 text-xs">
                          <span className="text-stone-500">{l}</span>
                          <span className="font-mono font-semibold tabular-nums text-stone-700">{fmtAmt(v)}</span>
                        </div>
                      ))}
                      <div className="mt-2 flex items-baseline justify-between border-t-2 border-stone-200 pt-2">
                        <span className="text-sm font-extrabold text-stone-900">Total</span>
                        <span className={`font-mono text-xl font-extrabold tabular-nums ${totalAmt < 0 ? "text-emerald-600" : "text-orange-600"}`}>{fmtAmt(totalAmt)}</span>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">Approved amount</div>
                        <Input
                          type="number"
                          value={t.approvedAmt || 0}
                          onChange={(e) => setT((p) => ({ ...p, approvedAmt: +e.target.value }))}
                          className="h-9 font-mono text-sm font-bold tabular-nums text-emerald-600"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setT((p) => ({ ...p, requestedAmt: Math.round(totalAmt) }))}
                        className="mt-2.5 w-full border-stone-200 text-xs text-stone-600 hover:bg-stone-50"
                      >
                        Set as requested amount
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "comments" && (
                <div className="max-w-[640px]">
                  <div className="space-y-4">
                    {t.comments.map((c, i) => {
                      const m = MEMBERS.find((x) => x.id === c.author) || { name: c.author };
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex gap-3"
                        >
                          <Avatar id={c.author} size={32} />
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2 text-xs">
                              <span className="font-bold text-stone-800">{m.name}</span>
                              <span className="text-stone-400">{c.time}</span>
                            </div>
                            <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-stone-700 shadow-sm">
                              {c.text}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Avatar id="pm" size={32} />
                    <div className="flex-1">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment or response…"
                        className="min-h-[70px]"
                      />
                      <Button
                        size="sm"
                        onClick={addComment}
                        disabled={!newComment.trim()}
                        className="mt-2 bg-orange-600 text-white hover:bg-orange-700"
                      >
                        Post
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "files" && <FilesTab t={t} setT={setT} />}

              {tab === "subcOs" && (
                <div>
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Sub-contractor change orders tied to {co.num}
                  </div>
                  {mySubs.length === 0 && (
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-8 text-center text-xs text-stone-500">
                      No sub COs linked yet.
                    </div>
                  )}
                  {mySubs.map((sco) => (
                    <div key={sco.id} className="mb-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-orange-600">{sco.num}</span>
                            <Pill label={sco.status.toUpperCase()} color={sco.status === "approved" ? "#059669" : "#ea580c"} size={9} />
                          </div>
                          <div className="text-sm font-semibold text-stone-800">{sco.title}</div>
                          <div className="mt-0.5 text-[11px] text-stone-500">Sub: <span className="font-medium text-stone-700">{sco.subName}</span></div>
                          <div className="mt-0.5 text-[10px] text-stone-400">Submitted: {fmtDate(sco.submittedDate)} · Approved: {fmtDate(sco.approvedDate)}</div>
                          {sco.comments && <div className="mt-2 text-[11px] italic text-stone-500">{sco.comments}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg font-extrabold tabular-nums text-emerald-600">{fmtAmt(sco.approvedAmt)}</div>
                          {sco.approvedAmt !== sco.requestedAmt && <div className="text-[10px] text-stone-400">Req: {fmtAmt(sco.requestedAmt)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2 border-dashed border-orange-300 text-stone-700 hover:bg-orange-50">
                    <Plus className="size-3.5" />Add Sub CO
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldBlock({ label, children }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      {children}
    </div>
  );
}

// ─── ADD CO MODAL ─────────────────────────────────────────────────
function AddModal({ cos, defaultProject, onAdd, onClose }) {
  const initialProject = defaultProject || PROJECTS[0].id;
  const [t, setT] = useState({
    title: "", description: "", justification: "", type: "owner_directed", category: "general",
    priority: "medium", project: initialProject, status: "draft", submittedBy: "pm", reviewedBy: null,
    submittedDate: TODAY, reviewedDate: null, executedDate: null, dueDate: "",
    requestedAmt: 0, approvedAmt: 0, scheduleImpact: 0,
    linkedRFI: "", linkedSpec: "", linkedDrawing: "",
    assignees: ["pm"], photos: [], attachments: [], comments: [], lineItems: [],
    gcMarkup: 0.10, ownerMarkup: 0, isSubCO: false, subCOs: [],
  });
  const n = nextCONumber(cos, t.project);

  function submit() {
    if (!t.title.trim()) return;
    onAdd({ ...t, id: "co" + Date.now(), num: n });
    onClose();
  }

  const fields = [
    ["CO Type",     "type",        Object.entries(CO_TYPES).map(([k, v]) => ({ v: k, l: v.label }))],
    ["Trade",       "category",    Object.entries(TRADE_CATS).map(([k, v]) => ({ v: k, l: v.label }))],
    ["Priority",    "priority",    Object.entries(PRIORITY).map(([k, v]) => ({ v: k, l: v.label }))],
    ["Project",     "project",     PROJECTS.map((p) => ({ v: p.id, l: p.name }))],
    ["Status",      "status",      STATUSES.map((s) => ({ v: s.id, l: s.label }))],
    ["Submitted By","submittedBy", MEMBERS.filter((m) => m.group === "internal").map((m) => ({ v: m.id, l: m.name }))],
  ];

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[min(600px,calc(100%-2rem))] max-w-none rounded-2xl border-stone-200 p-0 shadow-[0_40px_100px_-20px_rgba(234,88,12,0.25)]"
      >
        <DialogTitle className="sr-only">New change order {n}</DialogTitle>

        <div className="border-b border-stone-200 bg-gradient-to-b from-orange-50/60 to-white px-6 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600">
              <Plus className="size-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-stone-900">New change order</div>
              <div className="font-mono text-xs font-bold text-orange-600">{n}</div>
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-auto px-6 py-5">
          <FieldBlock label="Title">
            <Input
              value={t.title}
              onChange={(e) => setT((p) => ({ ...p, title: e.target.value }))}
              placeholder="Change order title…"
              className="h-10 text-sm font-semibold"
              autoFocus
            />
          </FieldBlock>
          <FieldBlock label="Description">
            <Textarea
              value={t.description}
              onChange={(e) => setT((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description of change…"
              className="min-h-[70px]"
            />
          </FieldBlock>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([label, key, opts]) => (
              <FieldBlock key={key} label={label}>
                <Select value={t[key]} onValueChange={(v) => setT((p) => ({ ...p, [key]: v }))}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldBlock>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldBlock label="Amount ($)">
              <Input
                type="number"
                value={t.requestedAmt}
                onChange={(e) => setT((p) => ({ ...p, requestedAmt: +e.target.value }))}
                className="h-9 font-mono tabular-nums"
              />
            </FieldBlock>
            <FieldBlock label="Schedule impact (d)">
              <Input
                type="number"
                value={t.scheduleImpact}
                onChange={(e) => setT((p) => ({ ...p, scheduleImpact: +e.target.value }))}
                className="h-9 font-mono tabular-nums"
              />
            </FieldBlock>
            <FieldBlock label="Due date">
              <Input
                type="date"
                value={t.dueDate}
                onChange={(e) => setT((p) => ({ ...p, dueDate: e.target.value }))}
                className="h-9"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Linked RFI">
              <Input
                value={t.linkedRFI}
                onChange={(e) => setT((p) => ({ ...p, linkedRFI: e.target.value }))}
                placeholder="RFI-000"
                className="h-9 font-mono text-xs"
              />
            </FieldBlock>
            <FieldBlock label="Drawing ref">
              <Input
                value={t.linkedDrawing}
                onChange={(e) => setT((p) => ({ ...p, linkedDrawing: e.target.value }))}
                placeholder="S-401"
                className="h-9 font-mono text-xs"
              />
            </FieldBlock>
          </div>
        </div>

        <div className="flex gap-2 border-t border-stone-200 bg-stone-50/50 px-6 py-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={submit}
            disabled={!t.title.trim()}
            className="flex-[2] bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-[0_6px_20px_-4px_rgba(234,88,12,0.55)] hover:opacity-95"
          >
            <Plus className="size-4" strokeWidth={2.5} />Create change order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── CONTRACT SUMMARY PANEL ───────────────────────────────────────
// ─── DASHBOARD ─────────────────────────────────────────────────────
function Dashboard({
  scoped,
  filterProject,
  pendingAmt,
  approvedAmt,
  executedAmt,
  totalExposure,
  overdueCount,
  totalSchedImpact,
  onOpenCO,
  onViewChange,
}) {
  const proj = filterProject !== "all" ? PROJECTS.find((p) => p.id === filterProject) : null;
  const scopeLabel = proj ? proj.name : "All projects";

  const pending = scoped.filter((c) => ["submitted", "under_review"].includes(c.status));
  const overdueCOs = scoped.filter(
    (c) => c.dueDate && daysUntil(c.dueDate) < 0 && !["executed", "rejected", "voided"].includes(c.status)
  );
  const recent = [...scoped]
    .filter((c) => c.submittedDate)
    .sort((a, b) => (b.submittedDate > a.submittedDate ? 1 : -1))
    .slice(0, 5);

  const cards = [
    {
      icon: Hourglass,
      label: "Pending",
      value: fmtAmt(pendingAmt),
      sub: `${pending.length} in review`,
      tone: "border-orange-200 bg-orange-50",
      valueCls: "text-orange-700",
      iconCls: "bg-orange-100 text-orange-700",
    },
    {
      icon: Check,
      label: "Approved",
      value: fmtAmt(approvedAmt),
      sub: `${scoped.filter((c) => c.status === "approved").length} approved`,
      tone: "border-orange-300 bg-orange-100",
      valueCls: "text-orange-800",
      iconCls: "bg-orange-200 text-orange-800",
    },
    {
      icon: FileText,
      label: "Executed",
      value: fmtAmt(executedAmt),
      sub: `${scoped.filter((c) => c.status === "executed").length} executed`,
      tone: "border-orange-700 bg-orange-600",
      valueCls: "text-white",
      iconCls: "bg-orange-700 text-white",
      invert: true,
    },
    {
      icon: AlarmClock,
      label: "Overdue",
      value: String(overdueCount),
      sub: overdueCount === 1 ? "CO past due" : "COs past due",
      tone: "border-red-200 bg-red-50",
      valueCls: "text-red-700",
      iconCls: "bg-red-100 text-red-700",
    },
    {
      icon: Clock,
      label: "Schedule Impact",
      value: `${totalSchedImpact > 0 ? "+" : ""}${totalSchedImpact}d`,
      sub: "total delay / savings",
      tone: "border-stone-200 bg-white",
      valueCls: totalSchedImpact > 0 ? "text-orange-700" : totalSchedImpact < 0 ? "text-emerald-700" : "text-stone-700",
      iconCls: "bg-stone-100 text-stone-700",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            <span className="font-semibold text-stone-700">{scopeLabel}</span>
            <span className="mx-1.5">·</span>
            {scoped.length} change orders
            <span className="mx-1.5">·</span>
            <span className="font-mono font-semibold text-orange-700">{fmtAmt(totalExposure)}</span> total exposure
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onViewChange("board")}>
            <FileText className="size-3.5" />Open board
          </Button>
          <Button size="sm" variant="outline" onClick={() => onViewChange("list")}>
            <List className="size-3.5" />Open list
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className={`rounded-xl border p-4 shadow-sm ${c.tone}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className={`inline-flex size-8 items-center justify-center rounded-lg ${c.iconCls}`}>
                <c.icon className="size-4" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.invert ? "text-orange-100" : "text-stone-500"}`}>
                {c.label}
              </span>
            </div>
            <div className={`font-mono text-2xl font-extrabold tabular-nums leading-none ${c.valueCls}`}>
              {c.value}
            </div>
            <div className={`mt-1 text-[11px] ${c.invert ? "text-orange-100" : "text-stone-500"}`}>{c.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Needs attention */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-red-50 text-red-600">
              <AlertTriangle className="size-3.5" />
            </div>
            <h2 className="text-sm font-bold text-stone-900">Needs attention</h2>
            <span className="text-[11px] text-stone-500">({overdueCOs.length + pending.length})</span>
          </div>
          {overdueCOs.length === 0 && pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="text-sm font-semibold text-stone-700">Nothing pressing</div>
              <div className="text-xs text-stone-500">No overdue or in-review COs for {scopeLabel}.</div>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {overdueCOs.map((co) => (
                <DashRow key={co.id} co={co} onOpenCO={onOpenCO} urgent />
              ))}
              {pending.slice(0, 6).map((co) => (
                <DashRow key={co.id} co={co} onOpenCO={onOpenCO} />
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-orange-50 text-orange-600">
              <Clock className="size-3.5" />
            </div>
            <h2 className="text-sm font-bold text-stone-900">Recent submissions</h2>
          </div>
          {recent.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-500">No recent submissions.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {recent.map((co) => (
                <DashRow key={co.id} co={co} onOpenCO={onOpenCO} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashRow({ co, onOpenCO, urgent, compact }) {
  const sc = STATUSES.find((s) => s.id === co.status);
  const d = co.dueDate ? daysUntil(co.dueDate) : null;
  const displayAmt = co.approvedAmt !== 0 ? co.approvedAmt : co.requestedAmt;
  return (
    <button
      onClick={() => onOpenCO(co)}
      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-orange-50/40"
    >
      <div className="flex flex-col">
        <span className="font-mono text-[10px] font-bold text-orange-600">{co.num}</span>
        {!compact && sc && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: sc.color }}>
            <sc.Icon className="size-3" />
            {sc.label}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-stone-800">{co.title}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-stone-500">
          {co.dueDate && (
            <span className={urgent || (d !== null && d < 0) ? "font-semibold text-red-600" : ""}>
              Due {fmtShort(co.dueDate)}
              {d !== null && d < 0 && ` · ${Math.abs(d)}d overdue`}
            </span>
          )}
          {co.scheduleImpact !== 0 && (
            <span className={co.scheduleImpact > 0 ? "text-orange-600" : "text-emerald-600"}>
              {co.scheduleImpact > 0 ? "+" : ""}{co.scheduleImpact}d
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-mono text-sm font-extrabold tabular-nums ${displayAmt < 0 ? "text-emerald-600" : "text-stone-800"}`}>
          {fmtAmt(displayAmt)}
        </div>
      </div>
    </button>
  );
}

function ContractSummary({ cos }) {
  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="mb-1 text-lg font-extrabold tracking-tight text-stone-900">Contract Summary</div>
      <div className="mb-5 text-xs text-stone-500">
        Running contract value, CO exposure, and schedule impact per project
      </div>
      {PROJECTS.map((proj, pi) => {
        const s = calcProjectSummary(proj.id, cos);
        const currentContract = proj.originalContract + s.executedAmt + s.approvedAmt;
        const exposure = s.executedAmt + s.approvedAmt + s.pendingAmt;
        const pctChange = ((exposure / proj.originalContract) * 100).toFixed(1);
        const denom = Math.max(proj.originalContract + exposure, 1);

        const cards = [
          { label: "Original",           val: proj.originalContract, tone: "text-stone-700",    sub: `${s.mine.length} COs` },
          { label: "Executed",           val: s.executedAmt,          tone: "text-emerald-600",  sub: `${s.executed.length} executed` },
          { label: "Approved",           val: s.approvedAmt,          tone: "text-orange-700",   sub: `${s.approved.length} approved` },
          { label: "Pending review",     val: s.pendingAmt,           tone: "text-orange-500",   sub: `${s.pending.length} in review` },
        ];
        const pctLabel = proj.originalContract > 0 ? `+${pctChange}% change` : "new project";

        return (
          <motion.div
            key={proj.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pi * 0.06, duration: 0.3 }}
            className="mb-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
          >
            {/* Header — project identity + stat cards + contract value, all on one row */}
            <div className="flex flex-wrap items-stretch gap-2 border-b border-stone-200 bg-gradient-to-b from-orange-50/60 to-white px-4 py-3">
              {/* Identity */}
              <div className="flex min-w-[160px] flex-col justify-center pr-2">
                <div className="text-sm font-extrabold leading-tight tracking-tight text-stone-900">{proj.name}</div>
                <div className="mt-0.5 text-[11px] text-stone-500">
                  {s.mine.length} COs · {s.schedImpact}d sched
                </div>
              </div>

              {/* Inline stat cards — pushed to the right */}
              <div className="ml-auto flex flex-wrap items-stretch gap-1.5">
                {cards.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.04, duration: 0.2 }}
                    className="w-[120px] rounded-md border border-stone-200 bg-white px-2.5 py-1.5 shadow-sm"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">{item.label}</div>
                    <div className={`mt-0.5 font-mono text-sm font-extrabold tabular-nums leading-tight ${item.tone}`}>
                      {fmtAmt(item.val)}
                    </div>
                    <div className="mt-0.5 text-[9px] text-stone-500">{item.sub}</div>
                  </motion.div>
                ))}
              </div>

              {/* Current contract value */}
              <div className="w-[140px] rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-right shadow-sm">
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/80">Current</div>
                <div className="mt-0.5 font-mono text-base font-extrabold tabular-nums leading-tight text-emerald-700">{fmtAmt(currentContract)}</div>
                <div className="text-[9px] text-stone-500">
                  <span className="font-semibold text-orange-600">{pctLabel}</span>
                </div>
              </div>
            </div>

            <div className="p-5">

              <div className="mb-5">
                <div className="mb-1.5 flex justify-between text-[11px] text-stone-500">
                  <span>Original contract</span>
                  {proj.originalContract > 0 && (
                    <span className="font-semibold text-orange-600">{pctChange}% CO exposure</span>
                  )}
                  <span className="font-mono tabular-nums">Exposure: {fmtAmt(exposure)}</span>
                </div>
                <div className="flex h-[6px] overflow-hidden rounded-full bg-orange-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(proj.originalContract / denom) * 100}%` }}
                    transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                    className="bg-gradient-to-r from-orange-200 to-orange-300"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.executedAmt / denom) * 100}%` }}
                    transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
                    className="bg-emerald-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.approvedAmt / denom) * 100}%` }}
                    transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                    className="bg-orange-600"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.pendingAmt / denom) * 100}%` }}
                    transition={{ delay: 0.45, duration: 0.6, ease: "easeOut" }}
                    className="bg-orange-400"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-stone-500">
                  {[
                    ["Original", "bg-gradient-to-r from-orange-200 to-orange-300"],
                    ["Executed", "bg-emerald-500"],
                    ["Approved", "bg-orange-600"],
                    ["Pending", "bg-orange-400"],
                  ].map(([l, cls]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className={`size-2.5 rounded-sm ${cls}`} />
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-stone-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60">
                      {["#", "Title", "Type", "Status", "Requested", "Approved", "Sched.", ""].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.mine.map((co) => {
                      const sc = STATUSES.find((x) => x.id === co.status);
                      const ct = CO_TYPES[co.type];
                      return (
                        <tr key={co.id} className="border-b border-stone-100 hover:bg-orange-50/30">
                          <td className="px-3 py-2 font-mono text-[11px] font-bold text-orange-600">{co.num}</td>
                          <td className="max-w-[220px] px-3 py-2"><span className="block truncate">{co.title}</span></td>
                          <td className="px-3 py-2">{ct && <Pill label={ct.label} Icon={ct.Icon} color={ct.color} size={9} />}</td>
                          <td className="px-3 py-2">{sc && <Pill label={sc.label} Icon={sc.Icon} color={sc.color} size={9} />}</td>
                          <td className={`whitespace-nowrap px-3 py-2 font-mono font-semibold tabular-nums ${co.requestedAmt < 0 ? "text-emerald-600" : "text-stone-800"}`}>{fmtAmt(co.requestedAmt)}</td>
                          <td className={`whitespace-nowrap px-3 py-2 font-mono font-semibold tabular-nums ${co.approvedAmt < 0 ? "text-emerald-600" : co.approvedAmt > 0 ? "text-emerald-600" : "text-stone-400"}`}>{co.approvedAmt !== 0 ? fmtAmt(co.approvedAmt) : "—"}</td>
                          <td className={`px-3 py-2 tabular-nums ${co.scheduleImpact > 0 ? "font-bold text-orange-600" : co.scheduleImpact < 0 ? "font-bold text-emerald-600" : "text-stone-400"}`}>{co.scheduleImpact !== 0 ? (co.scheduleImpact > 0 ? "+" : "") + co.scheduleImpact + "d" : "—"}</td>
                          <td className="px-3 py-2"><DueBadge due={co.dueDate} status={co.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function ChangeOrderTracker({ user, onSignOut }) {
  const { cos, loading, error, addCO, updateCO, deleteCO, resetDemo, mode } = useCOs(INIT_COs, user);
  const [subCOs]        = useState(INIT_SUBCOs);
  const [view,  setView] = useState("dashboard");
  const [selectedCO, setSelectedCO] = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [groupBy,    setGroupBy]    = useState("status");
  const [sortBy,     setSortBy]     = useState("due");
  const [filterType,     setFilterType]     = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProject,  setFilterProject]  = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showSubOnly,    setShowSubOnly]     = useState(false);
  const [showCreditOnly, setShowCreditOnly]  = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [calYear,  setCalYear]  = useState(TODAY_DATE.getFullYear());
  const [calMonth, setCalMonth] = useState(TODAY_DATE.getMonth());
  const [listStatusTab, setListStatusTab] = useState("all");

  function handleDrop(gKey) {
    if (!dragging) return;
    if (groupBy==="status") {
      const co = cos.find(c=>c.id===dragging);
      if (co) updateCO({ ...co, status:gKey });
    }
    setDragging(null); setDragOver(null);
  }

  const filtered = useMemo(()=>{
    let arr=cos;
    if (filterType!=="all")     arr=arr.filter(c=>c.type===filterType);
    if (filterStatus!=="all")   arr=arr.filter(c=>c.status===filterStatus);
    if (filterPriority!=="all") arr=arr.filter(c=>c.priority===filterPriority);
    if (filterProject!=="all")  arr=arr.filter(c=>c.project===filterProject);
    if (filterCategory!=="all") arr=arr.filter(c=>c.category===filterCategory);
    if (showSubOnly)             arr=arr.filter(c=>c.isSubCO);
    if (showCreditOnly)          arr=arr.filter(c=>c.requestedAmt<0);
    if (search)                  arr=arr.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())||c.num.toLowerCase().includes(search.toLowerCase()));
    arr=[...arr].sort((a,b)=>{
      if (sortBy==="due") return (a.dueDate||"9")>(b.dueDate||"9")?1:-1;
      if (sortBy==="amount") return Math.abs(b.requestedAmt)-Math.abs(a.requestedAmt);
      if (sortBy==="priority") { const o={critical:0,high:1,medium:2,low:3}; return o[a.priority]-o[b.priority]; }
      if (sortBy==="num") return a.num.localeCompare(b.num);
      return 0;
    });
    return arr;
  },[cos,filterType,filterStatus,filterPriority,filterProject,filterCategory,showSubOnly,showCreditOnly,search,sortBy]);

  const grouped = useMemo(()=>{
    if (groupBy==="status")   return STATUSES.map(s=>({ key:s.id,label:s.label,color:s.color,Icon:s.Icon,items:filtered.filter(c=>c.status===s.id) }));
    if (groupBy==="type")     return Object.entries(CO_TYPES).map(([k,v])=>({ key:k,label:v.label,color:v.color,Icon:v.Icon,items:filtered.filter(c=>c.type===k) })).filter(g=>g.items.length);
    if (groupBy==="priority") return Object.entries(PRIORITY).map(([k,v])=>({ key:k,label:v.label,color:v.color,Icon:v.Icon,items:filtered.filter(c=>c.priority===k) })).filter(g=>g.items.length);
    if (groupBy==="category") return Object.entries(TRADE_CATS).map(([k,v])=>({ key:k,label:v.label,color:v.color,Icon:v.Icon,items:filtered.filter(c=>c.category===k) })).filter(g=>g.items.length);
    if (groupBy==="project")  return PROJECTS.map(p=>({ key:p.id,label:p.name,color:C.accent,Icon:HardHat,items:filtered.filter(c=>c.project===p.id) })).filter(g=>g.items.length);
    return [{ key:"all",label:"All COs",color:C.accent,Icon:ClipboardList,items:filtered }];
  },[filtered,groupBy]);

  // Stats — scoped to the active project (or all projects)
  const scoped = filterProject === "all" ? cos : cos.filter((c) => c.project === filterProject);
  const pending   = scoped.filter(c=>["submitted","under_review"].includes(c.status));
  const approved  = scoped.filter(c=>c.status==="approved");
  const executed  = scoped.filter(c=>c.status==="executed");
  const pendingAmt  = pending.reduce((a,c)=>a+c.requestedAmt,0);
  const approvedAmt = approved.reduce((a,c)=>a+c.approvedAmt,0);
  const executedAmt = executed.reduce((a,c)=>a+c.approvedAmt,0);
  const totalExposure = pendingAmt + approvedAmt + executedAmt;
  const overdueCount  = scoped.filter(c=>c.dueDate&&daysUntil(c.dueDate)<0&&!["executed","rejected","voided"].includes(c.status)).length;
  const totalSchedImpact = scoped.reduce((a,c)=>a+(c.scheduleImpact||0),0);

  function calDays(y,m){return new Date(y,m+1,0).getDate();}
  function cosOnDay(y,m,d){
    const dt=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return filtered.filter(c=>c.dueDate===dt);
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-white text-stone-900 font-[DM_Sans,system-ui,sans-serif]">
      {/* soft orange wash background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_0%_-10%,rgba(251,146,60,0.14),transparent),radial-gradient(900px_500px_at_100%_10%,rgba(234,88,12,0.08),transparent)]"
      />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {/* ── TOPBAR ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-orange-100/80 bg-white/85 px-6 py-3 shadow-[0_1px_0_0_rgba(234,88,12,0.04),0_8px_24px_-16px_rgba(234,88,12,0.15)] backdrop-blur-xl"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
          <div className="shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold leading-tight text-stone-900">
              Change Order Tracker
              <Badge
                variant="outline"
                className={mode === "cloud" ? "border-orange-300 bg-orange-50 text-orange-700" : "border-stone-300 bg-stone-50 text-stone-600"}
              >
                {mode === "cloud" ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
                {mode === "cloud" ? "CLOUD" : "LOCAL"}
              </Badge>
            </div>
            <div className="mt-0.5 text-[11px] text-stone-500">
              ConstructPro · {scoped.length} COs · <span className="font-mono font-semibold text-stone-700">{fmtAmt(totalExposure)}</span> total exposure
            </div>
          </div>

          {/* Project switcher */}
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger
              size="sm"
              className="h-9 min-w-[220px] border-orange-200 bg-white font-semibold text-stone-800 shadow-sm hover:border-orange-300"
            >
              <HardHat className="size-4 text-orange-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-semibold">All projects</span>
              </SelectItem>
              {PROJECTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View switcher */}
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="bg-orange-50/80 p-1">
              <TabsTrigger
                value="dashboard"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-[0_2px_8px_-2px_rgba(234,88,12,0.25)]"
              >
                <BarChart3 className="size-3.5" />Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="board"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-[0_2px_8px_-2px_rgba(234,88,12,0.25)]"
              >
                <FileText className="size-3.5" />Board
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-[0_2px_8px_-2px_rgba(234,88,12,0.25)]"
              >
                <List className="size-3.5" />List
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-[0_2px_8px_-2px_rgba(234,88,12,0.25)]"
              >
                <Calendar className="size-3.5" />Calendar
              </TabsTrigger>
              <TabsTrigger
                value="summary"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-[0_2px_8px_-2px_rgba(234,88,12,0.25)]"
              >
                <BarChart3 className="size-3.5" />Contract
              </TabsTrigger>
            </TabsList>
          </Tabs>

        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user && (
            <span className="max-w-[200px] truncate text-xs font-medium text-stone-500">
              {user.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Reset to demo data? This will erase all change orders.")) resetDemo(); }}
            className="text-stone-600"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          {onSignOut && (
            <Button variant="ghost" size="sm" onClick={onSignOut} className="text-stone-600">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} title="Export filtered list as CSV">
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCOsPdf(filtered, { coTypes: CO_TYPES, trades: TRADE_CATS, statuses: STATUSES, priorities: PRIORITY, projects: PROJECTS })}
            title="Export filtered list as PDF"
          >
            <FileDown className="size-3.5" />
            PDF
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            className="bg-orange-600 font-semibold text-white hover:bg-orange-700"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            New Change Order
          </Button>
        </div>
      </motion.header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-xs font-semibold text-red-700"
          >
            <AlertTriangle className="size-3.5" />
            {error}
          </motion.div>
        )}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-b border-stone-200 bg-stone-50 px-6 py-2 text-xs text-stone-500"
          >
            Loading change orders…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-orange-100/80 bg-white/70 px-6 py-2.5 backdrop-blur-sm">
        {(view === "board" || view === "list") && (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Group</span>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger size="sm" className="w-auto text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="type">By CO Type</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
                <SelectItem value="category">By Trade</SelectItem>
                <SelectItem value="project">By Project</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Sort</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger size="sm" className="w-auto text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Due Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="num">CO Number</SelectItem>
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="mx-1 h-5" />
          </>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search COs…"
            className="h-8 w-44 pl-8 text-xs"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger size="sm" className="w-auto text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger size="sm" className="w-auto text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(CO_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger size="sm" className="w-auto text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {Object.entries(TRADE_CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger size="sm" className="w-auto text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={showSubOnly ? "default" : "outline"}
          onClick={() => setShowSubOnly(!showSubOnly)}
          className={showSubOnly ? "bg-orange-600 text-white hover:bg-orange-700" : "border-orange-200 text-stone-700 hover:bg-orange-50"}
        >
          <Link2 className="size-3.5" />
          Sub COs
        </Button>
        <Button
          size="sm"
          variant={showCreditOnly ? "default" : "outline"}
          onClick={() => setShowCreditOnly(!showCreditOnly)}
          className={showCreditOnly ? "bg-orange-600 text-white hover:bg-orange-700" : "border-orange-200 text-stone-700 hover:bg-orange-50"}
        >
          <Minus className="size-3.5" />
          Credits
        </Button>

        <span className="ml-auto text-xs tabular-nums text-stone-500">{filtered.length} COs</span>
      </div>

      {/* ══ VIEWS ══ */}
      <AnimatePresence mode="wait">
        {view === "dashboard" && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <Dashboard
              scoped={scoped}
              filterProject={filterProject}
              pendingAmt={pendingAmt}
              approvedAmt={approvedAmt}
              executedAmt={executedAmt}
              totalExposure={totalExposure}
              overdueCount={overdueCount}
              totalSchedImpact={totalSchedImpact}
              onOpenCO={setSelectedCO}
              onViewChange={setView}
            />
          </motion.div>
        )}
        {view === "board" && (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-auto px-6 py-5"
          >
            <div className="flex gap-3" style={{ minWidth: grouped.length * 320 }}>
              {grouped.map((g, gi) => (
                <motion.div
                  key={g.key}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.04, duration: 0.25 }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(g.key); }}
                  onDrop={() => handleDrop(g.key)}
                  onDragLeave={() => setDragOver(null)}
                  className="flex min-w-[300px] flex-1 flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-colors"
                  style={{ borderColor: dragOver === g.key ? g.color : "#e7e5e4" }}
                >
                  <div
                    className="flex items-center gap-2 border-b px-3.5 py-2.5"
                    style={{ background: g.color + "10", borderBottomColor: "#e7e5e4" }}
                  >
                    <span className="inline-flex size-2 rounded-full" style={{ background: g.color }} />
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: g.color }}>
                      {g.Icon && <g.Icon size={13} />}
                      {g.label}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: g.color }}>
                        {fmtAmt(g.items.reduce((a, c) => a + (c.approvedAmt || c.requestedAmt || 0), 0))}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-5 border-0 px-2 text-[10px] font-extrabold"
                        style={{ background: g.color + "22", color: g.color }}
                      >
                        {g.items.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex min-h-[120px] flex-col gap-0 p-2.5">
                    <AnimatePresence mode="popLayout">
                      {g.items.map((co, i) => (
                        <motion.div
                          key={co.id}
                          layout
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          draggable
                          onDragStart={() => setDragging(co.id)}
                          onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        >
                          <COCard co={co} onClick={setSelectedCO} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <button
                      onClick={() => setShowAdd(true)}
                      className="mt-1 w-full rounded-md border border-dashed border-stone-300 py-1.5 text-xs text-stone-500 transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600"
                    >
                      + New CO
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-auto px-6 py-5"
          >
            {(() => {
              const statusTabs = [
                { id: "all", label: "All", color: "#ea580c", Icon: ClipboardList },
                ...STATUSES,
              ];
              const rowsForTab = listStatusTab === "all"
                ? filtered
                : filtered.filter((c) => c.status === listStatusTab);
              const totalForTab = rowsForTab.reduce((a, c) => a + (c.approvedAmt || c.requestedAmt || 0), 0);

              return (
                <>
                  {/* Status tab bar */}
                  <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-stone-200 bg-white p-1.5 shadow-sm">
                    {statusTabs.map((s) => {
                      const count = s.id === "all"
                        ? filtered.length
                        : filtered.filter((c) => c.status === s.id).length;
                      const active = listStatusTab === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setListStatusTab(s.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            active ? "" : "text-stone-600 hover:bg-stone-50"
                          }`}
                          style={active ? { color: s.color, background: s.color + "14" } : undefined}
                        >
                          <s.Icon className="size-3.5" />
                          {s.label}
                          <span
                            className={`ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${
                              active ? "" : "bg-stone-100 text-stone-600"
                            }`}
                            style={active ? { background: s.color + "22", color: s.color } : undefined}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                    <div className="ml-auto flex items-center gap-3 px-2 text-xs text-stone-500">
                      <span className="font-mono tabular-nums">
                        <span className="font-semibold text-stone-700">{rowsForTab.length}</span> rows
                      </span>
                      {totalForTab !== 0 && (
                        <span className="font-mono tabular-nums text-orange-600 font-semibold">
                          {fmtAmt(totalForTab)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Single table */}
                  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur-sm">
                          {["#", "Title", "Type", "Trade", "Priority", "Status", "Requested", "Approved", "Sched.", "Submitted", "Due", "Executed", "Parties", ""].map((h) => (
                            <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowsForTab.map((co) => {
                            const sc = STATUSES.find((s) => s.id === co.status);
                            const ct = CO_TYPES[co.type];
                            const cat = TRADE_CATS[co.category];
                            const pr = PRIORITY[co.priority];
                            return (
                              <tr
                                key={co.id}
                                onClick={() => setSelectedCO(co)}
                                className="cursor-pointer border-b border-stone-100 hover:bg-orange-50/40"
                              >
                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] font-bold text-orange-600">{co.num}</td>
                                <td className="max-w-[220px] px-3 py-2">
                                  <span className="block truncate font-medium">{co.title}</span>
                                  {co.linkedRFI && <span className="font-mono text-[9px] text-stone-500">{co.linkedRFI}</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {ct && (
                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-stone-700">
                                      <ct.Icon className="size-3 text-stone-400" />
                                      {ct.label}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {cat && (
                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-stone-700">
                                      <cat.Icon className="size-3 text-stone-400" />
                                      {cat.label}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold" style={{ color: pr.color }}>
                                    <span className="size-1.5 rounded-full" style={{ background: pr.color }} />
                                    {pr.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {sc && (
                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold" style={{ color: sc.color }}>
                                      <sc.Icon className="size-3" />
                                      {sc.label}
                                    </span>
                                  )}
                                </td>
                                <td className={`whitespace-nowrap px-3 py-2 font-mono font-semibold tabular-nums ${co.requestedAmt < 0 ? "text-emerald-600" : "text-stone-800"}`}>
                                  {fmtAmt(co.requestedAmt)}
                                </td>
                                <td className={`whitespace-nowrap px-3 py-2 font-mono font-semibold tabular-nums ${co.approvedAmt < 0 ? "text-emerald-600" : co.approvedAmt > 0 ? "text-emerald-600" : "text-stone-400"}`}>
                                  {co.approvedAmt !== 0 ? fmtAmt(co.approvedAmt) : "—"}
                                </td>
                                <td className={`px-3 py-2 tabular-nums ${co.scheduleImpact > 0 ? "font-bold text-orange-600" : co.scheduleImpact < 0 ? "font-bold text-emerald-600" : "text-stone-400"}`}>
                                  {co.scheduleImpact !== 0 ? (co.scheduleImpact > 0 ? "+" : "") + co.scheduleImpact + "d" : "—"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-stone-500">{fmtShort(co.submittedDate)}</td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`font-mono text-[10px] ${daysUntil(co.dueDate) !== null && daysUntil(co.dueDate) < 0 && !["executed","rejected"].includes(co.status) ? "text-red-600" : "text-stone-700"}`}
                                    >
                                      {fmtShort(co.dueDate)}
                                    </span>
                                    <DueBadge due={co.dueDate} status={co.status} />
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-emerald-600">{fmtShort(co.executedDate)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex">
                                    {co.assignees.slice(0, 2).map((id, i) => (
                                      <div key={id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                                        <Avatar id={id} size={20} />
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">Open</Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {rowsForTab.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                          <ClipboardList className="size-5" />
                        </div>
                        <div className="text-sm font-semibold text-stone-700">No change orders</div>
                        <div className="text-xs text-stone-500">
                          {listStatusTab === "all"
                            ? "Adjust filters or create a new change order."
                            : `No COs currently in ${STATUSES.find((s) => s.id === listStatusTab)?.label}.`}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}

        {view === "calendar" && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-auto px-6 py-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-stone-900">
                {new Date(calYear, calMonth, 1).toLocaleString("default", { month: "long" })} {calYear}
                <span className="ml-2 text-sm font-medium text-stone-500">— Response Deadlines</span>
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }}
                >
                  <ChevronLeft className="size-4" /> Prev
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setCalYear(TODAY_DATE.getFullYear()); setCalMonth(TODAY_DATE.getMonth()); }}
                  className="bg-orange-600 text-white hover:bg-orange-700"
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-stone-500">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: new Date(calYear, calMonth, 1).getDay() }).map((_, i) => (
                <div key={`e${i}`} />
              ))}
              {Array.from({ length: calDays(calYear, calMonth) }).map((_, di) => {
                const day = di + 1;
                const dt = cosOnDay(calYear, calMonth, day);
                const isToday = calYear === TODAY_DATE.getFullYear() && calMonth === TODAY_DATE.getMonth() && day === TODAY_DATE.getDate();
                return (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: di * 0.008, duration: 0.2 }}
                    className={`min-h-[96px] rounded-lg border p-1.5 transition-shadow hover:shadow-sm ${isToday ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300" : "border-stone-200 bg-white"}`}
                  >
                    <div className={`mb-1 text-xs ${isToday ? "font-extrabold text-orange-700" : "font-medium text-stone-500"}`}>
                      {day}
                    </div>
                    {dt.slice(0, 3).map((co) => {
                      const sc = STATUSES.find((s) => s.id === co.status);
                      return (
                        <button
                          key={co.id}
                          onClick={() => setSelectedCO(co)}
                          className="mb-1 block w-full truncate rounded px-1.5 py-0.5 text-left text-[9px] font-semibold transition-opacity hover:opacity-80"
                          style={{ background: sc.color + "22", border: `1px solid ${sc.color}44`, color: sc.color }}
                        >
                          {co.num} {co.title}
                        </button>
                      );
                    })}
                    {dt.length > 3 && <div className="text-[9px] text-stone-500">+{dt.length - 3}</div>}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {view === "summary" && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <ContractSummary cos={cos} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      {selectedCO && (
        <COModal
          co={selectedCO}
          subCOs={subCOs}
          onClose={() => setSelectedCO(null)}
          onUpdate={(c) => { updateCO(c); setSelectedCO(c); }}
          onDelete={(id) => { deleteCO(id); setSelectedCO(null); }}
        />
      )}
      {showAdd && <AddModal cos={cos} defaultProject={filterProject !== "all" ? filterProject : PROJECTS[0].id} onAdd={addCO} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
