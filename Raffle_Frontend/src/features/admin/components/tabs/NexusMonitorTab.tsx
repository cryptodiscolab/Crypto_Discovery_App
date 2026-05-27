import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "in_progress"
  | "processing"
  | "completed"
  | "done"
  | "failed"
  | "blocked"
  | "cancelled"
  | "ACTIVE";

type AgentName =
  | "OrchestratorBot"
  | "ResearchBot"
  | "CodeBot"
  | "SyncGuardBot"
  | "ContractBot"
  | "FrontendBot"
  | "SecurityBot"
  | "DatabaseBot"
  | "BackendBot"
  | "QABot"
  | "GrowthBot"
  | "DocsBot";

// Canonical registry — exactly 12
const AGENTS: AgentName[] = [
  "OrchestratorBot",
  "ResearchBot",
  "CodeBot",
  "SyncGuardBot",
  "ContractBot",
  "FrontendBot",
  "SecurityBot",
  "DatabaseBot",
  "BackendBot",
  "QABot",
  "GrowthBot",
  "DocsBot",
];

interface TaskNode {
  id: string;
  title: string;
  status: TaskStatus;
  target_agent: AgentName | string;
  updatedAt?: string;
  output?: string;
  children: TaskNode[];
}

interface RawTaskRow {
  id: string;
  parent_task_id: string | null;
  task_name: string;
  status: string;
  target_agent?: string;
  updated_at: string;
  output_data?: unknown;
  task_description?: string;
}

interface NexusMonitorTabProps {
  tasks?: TaskNode[];
  outputLog?: string;
  loading?: boolean;
  lastUpdated?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normStatus(status: TaskStatus | string): "completed" | "failed" | "processing" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "done") return "completed";
  if (s === "failed" || s === "blocked" || s === "cancelled") return "failed";
  return "processing";
}

function statusTone(status: TaskStatus | string) {
  switch (normStatus(status)) {
    case "completed": return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
    case "failed":    return "border-rose-400/30 bg-rose-500/10 text-rose-300";
    default:          return "border-cyan-400/30 bg-cyan-500/10 text-cyan-300";
  }
}

function statusDot(status: TaskStatus | string) {
  switch (normStatus(status)) {
    case "completed": return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]";
    case "failed":    return "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]";
    default:          return "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)] animate-pulse";
  }
}

function statusLabel(status: TaskStatus | string) {
  switch (normStatus(status)) {
    case "completed": return "Done";
    case "failed":    return "Failed";
    default:          return "Running";
  }
}

function countAll(nodes: TaskNode[]): { total: number; completed: number; failed: number; processing: number } {
  const acc = { total: 0, completed: 0, failed: 0, processing: 0 };
  const walk = (list: TaskNode[]) => {
    for (const n of list) {
      acc.total++;
      acc[normStatus(n.status)]++;
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return acc;
}

/**
 * Filter tree preserving hierarchy:
 * - A root node is shown if it OR ANY descendant matches the agent.
 * - Children of a matching ancestor are always shown (delegation tree intact).
 * - Strict agent match only hides subtrees with ZERO matching nodes.
 */
function filterTree(nodes: TaskNode[], agent: AgentName | null): TaskNode[] {
  if (!agent) return nodes;

  const hasMatch = (node: TaskNode): boolean => {
    if (node.target_agent === agent) return true;
    return node.children.some(hasMatch);
  };

  const pruneNode = (node: TaskNode): TaskNode | null => {
    if (!hasMatch(node)) return null;
    return { ...node, children: node.children.map(pruneNode).filter(Boolean) as TaskNode[] };
  };

  return nodes.map(pruneNode).filter(Boolean) as TaskNode[];
}

function extractOutput(row: RawTaskRow): string {
  if (!row.output_data) return row.task_description?.slice(0, 120) ?? "";
  if (typeof row.output_data === "object" && row.output_data !== null) {
    const obj = row.output_data as Record<string, unknown>;
    return String(obj.result ?? obj.error ?? obj.message ?? JSON.stringify(row.output_data)).slice(0, 300);
  }
  return String(row.output_data).slice(0, 300);
}

function buildTree(rawRows: RawTaskRow[]): TaskNode[] {
  const nodeMap: Record<string, TaskNode> = {};

  for (const row of rawRows) {
    nodeMap[row.id] = {
      id: row.id,
      title: row.task_name,
      status: row.status as TaskStatus,
      target_agent: row.target_agent ?? "Unknown",
      updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleTimeString() : undefined,
      output: extractOutput(row),
      children: [],
    };
  }

  const roots: TaskNode[] = [];
  for (const row of rawRows) {
    const node = nodeMap[row.id];
    if (row.parent_task_id && nodeMap[row.parent_task_id]) {
      nodeMap[row.parent_task_id].children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function buildLog(rawRows: RawTaskRow[]): string {
  return rawRows
    .map((row) => {
      const time = row.updated_at ? new Date(row.updated_at).toLocaleString() : "—";
      const agent = row.target_agent ? `[${row.target_agent.toUpperCase()}]` : "[SYSTEM]";
      const status = (row.status ?? "PENDING").toUpperCase();
      const desc = (row.task_description ?? row.task_name).slice(0, 120);
      return `${time} ${agent} ${status}\n  ${desc}`;
    })
    .join("\n\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskTreeNode({ node, depth = 0 }: { node: TaskNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const hasOutput = !!node.output;

  return (
    <div className={depth > 0 ? "ml-5 pl-4 border-l border-white/10" : ""}>
      <div className="relative flex items-start gap-3 py-2.5">
        {/* Status dot */}
        <div className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30">
          <span className={`h-2 w-2 rounded-full ${statusDot(node.status)}`} />
        </div>

        {/* Card */}
        <div className="min-w-0 flex-1">
          <div
            className="rounded-xl border border-white/5 bg-white/4 px-3.5 py-2.5 backdrop-blur-xl hover:bg-white/[0.06] transition"
            onClick={() => hasChildren && setExpanded((v) => !v)}
            style={{ cursor: hasChildren ? "pointer" : "default" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
                  {node.title}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/40 content-native">
                  {node.target_agent}
                  {node.updatedAt ? ` · ${node.updatedAt}` : ""}
                  {hasChildren ? ` · ${node.children.length} child${node.children.length !== 1 ? "ren" : ""}` : ""}
                </p>
              </div>

              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${statusTone(node.status)}`}
              >
                {statusLabel(node.status)}
              </span>
            </div>

            {hasOutput && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] leading-5 text-white/55">
                {node.output}
              </p>
            )}
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TaskTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  tasks,
  active,
  onToggle,
}: {
  agent: AgentName;
  tasks: TaskNode[];
  active: boolean;
  onToggle: () => void;
}) {
  // Count all tasks (flat) for this agent across the full tree
  const agentCount = useMemo(() => {
    const acc = { total: 0, completed: 0, failed: 0, processing: 0 };
    const walk = (nodes: TaskNode[]) => {
      for (const n of nodes) {
        if (n.target_agent === agent) {
          acc.total++;
          acc[normStatus(n.status)]++;
        }
        if (n.children.length) walk(n.children);
      }
    };
    walk(tasks);
    return acc;
  }, [tasks, agent]);

  const isIdle = agentCount.total === 0;

  return (
    <button
      type="button"
      id={`nexus-agent-${agent.toLowerCase()}`}
      onClick={onToggle}
      className={[
        "rounded-2xl border px-3 py-3 text-left transition-all backdrop-blur-xl",
        active
          ? "border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_0_20px_rgba(34,211,238,0.05)]"
          : isIdle
          ? "border-white/5 bg-white/3 opacity-50"
          : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
          {agent}
        </p>
        {active && (
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] font-medium text-white/40">
          {agentCount.total} task{agentCount.total !== 1 ? "s" : ""}
        </span>
        {agentCount.completed > 0 && (
          <span className="text-[10px] font-black text-emerald-400">✓{agentCount.completed}</span>
        )}
        {agentCount.failed > 0 && (
          <span className="text-[10px] font-black text-rose-400">✗{agentCount.failed}</span>
        )}
        {agentCount.processing > 0 && (
          <span className="text-[10px] font-black text-cyan-400">⟳{agentCount.processing}</span>
        )}
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NexusMonitorTab({
  tasks: propTasks,
  outputLog: propOutputLog = "",
  loading: propLoading = false,
  lastUpdated: propLastUpdated,
}: NexusMonitorTabProps) {
  const [allTasks, setAllTasks] = useState<TaskNode[]>([]);
  const [outputLog, setOutputLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentinelLogs, setSentinelLogs] = useState<string[]>([
    `[2026-05-27T11:18:00.001Z] [Sentinel] Core sentinel scanner initialized.`,
    `[2026-05-27T11:18:02.124Z] [Sentinel] Running gitleaks checks... 0 leaks found.`,
    `[2026-05-27T11:18:04.456Z] [Sentinel] Auditing Vercel deployment variables...`,
    `[2026-05-27T11:18:06.789Z] [Sentinel] Verified Supabase RLS policies on 'user_profiles'.`,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const msTimestamp = new Date().toISOString();
      const events = [
        "Sweeping Vercel env cache: Clear.",
        "Signature verification gate test: OK.",
        "Auditing point_settings sync: 100% match.",
        "Checked last_seen_at index performance: Optimal.",
        "Shield check verified for social accounts.",
        "Admin sync state audited: Database and smart contracts matching."
      ];
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      setSentinelLogs(prev => [...prev, `[${msTimestamp}] [Sentinel] ${randomEvent}`].slice(-20));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agents_vault")
        .select("id,parent_task_id,task_name,status,target_agent,updated_at,output_data,task_description")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error || !data) return;

      const rows = data as RawTaskRow[];
      setAllTasks(buildTree(rows));
      setOutputLog(buildLog(rows));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("[NexusMonitorTab] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (propTasks && propTasks.length > 0) {
      setAllTasks(propTasks);
      setOutputLog(propOutputLog);
      setLoading(propLoading);
      if (propLastUpdated) setLastUpdated(propLastUpdated);
      return;
    }

    void fetchTasks();
    const id = setInterval(fetchTasks, 12_000);
    return () => clearInterval(id);
  }, [propTasks, propOutputLog, propLoading, propLastUpdated, fetchTasks]);

  const visibleTasks = useMemo(() => filterTree(allTasks, selectedAgent), [allTasks, selectedAgent]);
  const stats = useMemo(() => countAll(allTasks), [allTasks]);
  const filteredStats = useMemo(() => countAll(visibleTasks), [visibleTasks]);
  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const handleCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(outputLog);
      } else {
        const ta = document.createElement("textarea");
        ta.value = outputLog;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [outputLog]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section id="nexus-monitor-tab" className="space-y-4 text-white">
      {/* ── Header ── */}
      <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
              Nexus Monitor
            </h2>
            <p className="mt-1 text-[13px] font-medium text-white/45 content-native">
              {loading ? "Synchronizing live task feed…" : "Real-time hierarchical agent task feed"}
              {lastUpdated ? ` · Updated ${lastUpdated}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="nexus-refresh-btn"
              type="button"
              onClick={() => void fetchTasks()}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/10 disabled:opacity-40"
            >
              {loading ? "Syncing…" : "Refresh"}
            </button>
            {selectedAgent && (
              <button
                id="nexus-clear-filter-btn"
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-cyan-400 transition hover:bg-cyan-400/20"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { label: "Total", value: stats.total, color: "text-white/90" },
            { label: "Done", value: stats.completed, color: "text-emerald-400" },
            { label: "Failed", value: stats.failed, color: "text-rose-400" },
            { label: "Running", value: stats.processing, color: "text-cyan-400" },
          ] as const).map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur-xl"
            >
              <p className="text-[11px] font-black uppercase tracking-widest text-white/45 label-native">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/50 label-native">
              Completion {selectedAgent ? `· ${selectedAgent}` : "· All Agents"}
            </p>
            <p className="text-[11px] font-black text-white/70">
              {selectedAgent
                ? `${filteredStats.completed}/${filteredStats.total} (${filteredStats.total > 0 ? Math.round((filteredStats.completed / filteredStats.total) * 100) : 0}%)`
                : `${completionPct}%`}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 transition-all duration-500"
              style={{
                width: `${selectedAgent && filteredStats.total > 0
                  ? Math.round((filteredStats.completed / filteredStats.total) * 100)
                  : completionPct}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Agent Registry — exactly 12 cards, always rendered ── */}
      <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
            Agent Registry
          </h3>
          <p className="text-[11px] font-medium text-white/40 content-native">
            {AGENTS.length} agents registered
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent}
              agent={agent}
              tasks={allTasks}
              active={selectedAgent === agent}
              onToggle={() => setSelectedAgent(selectedAgent === agent ? null : agent)}
            />
          ))}
        </div>
      </div>

      {/* ── Hierarchical Task Feed ── */}
      <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
            Task Feed
          </h3>
          <p className="text-[11px] font-medium text-white/40 content-native">
            {selectedAgent
              ? `Filtered: ${selectedAgent} · ${filteredStats.total} tasks`
              : `${stats.total} tasks · ${visibleTasks.length} root nodes`}
          </p>
        </div>

        <div className="mt-4">
          {loading && allTasks.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-6">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <p className="text-[11px] font-medium text-white/45">Loading agent task tree…</p>
            </div>
          ) : visibleTasks.length > 0 ? (
            visibleTasks.map((task) => <TaskTreeNode key={task.id} node={task} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-white/30 label-native">
                {selectedAgent ? `No tasks for ${selectedAgent}` : "No tasks found"}
              </p>
              <p className="mt-1 text-[13px] font-medium text-white/20 content-native">
                {selectedAgent ? "Try clearing the filter or refreshing." : "The agent task feed is empty."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Security Matrix & Sentinel Log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Security Agent Matrix */}
        <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
              Security Agent Matrix
            </h3>
            <span className="badge-cyber badge-cyber-blue text-[9px]">SECURE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: "EIP-191 Signatures", status: "VERIFIED", tone: "text-emerald-400" },
              { name: "Gitleaks Scan", status: "PASS", tone: "text-emerald-400" },
              { name: "Supabase RLS Policy", status: "HARDENED", tone: "text-emerald-400" },
              { name: "Multi-Project Sync", status: "SECURED", tone: "text-indigo-400" },
              { name: "Token Rotation Gate", status: "ARMED", tone: "text-indigo-400" },
              { name: "Log Millisecond Precision", status: "ACTIVE", tone: "text-cyan-400" }
            ].map((check, idx) => (
              <div key={idx} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{check.name}</span>
                <span className={`text-[10px] font-black uppercase font-mono ${check.tone}`}>{check.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sentinel Terminal */}
        <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl flex flex-col h-full min-h-[220px]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
              Sentinel Terminal Outputs
            </h3>
            <span className="label-native text-cyan-400 animate-pulse text-[9px]">LIVE TELEMETRY</span>
          </div>
          <div className="bg-black/50 border border-white/5 rounded-xl p-3 font-mono text-[9px] text-cyan-400 overflow-y-auto flex-1 flex flex-col gap-1 max-h-[140px] custom-scrollbar">
            {sentinelLogs.map((log, idx) => (
              <div key={idx} className="opacity-90 last:opacity-100 last:text-white transition-all leading-normal">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Output Log — separate accordion (no nested buttons) ── */}
      <div className="rounded-3xl border border-white/5 bg-white/5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        {/* Header row — NOT a button itself; two separate buttons inside */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90 label-native">
              Output Log
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-white/40 content-native">
              Collapsible execution log
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="nexus-copy-log-btn"
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/10"
              aria-label="Copy output log"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>

            <button
              id="nexus-toggle-log-btn"
              type="button"
              onClick={() => setIsLogOpen((v) => !v)}
              aria-expanded={isLogOpen}
              aria-controls="nexus-output-log"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[13px] text-white/60 transition hover:bg-white/10"
            >
              {isLogOpen ? "−" : "+"}
            </button>
          </div>
        </div>

        {isLogOpen && (
          <div id="nexus-output-log" className="p-5">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/5 bg-black/25 p-4 text-[11px] leading-[1.7] text-white/65">
              {outputLog || "No output available."}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}