import { useMemo, useState } from "react";

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
  | "cancelled";

type AgentName =
  | "ResearchBot"
  | "CodeBot"
  | "SyncGuardBot"
  | "OrchestratorBot"
  | "ContractBot"
  | "SecurityBot"
  | "DatabaseBot"
  | "BackendBot"
  | "QABot"
  | "GrowthBot"
  | "DocsBot"
  | "FrontendBot";

interface TaskNode {
  id: string;
  title: string;
  status: TaskStatus;
  target_agent?: AgentName;
  updatedAt?: string;
  output?: string;
  children?: TaskNode[];
}

interface NexusMonitorTabProps {
  tasks: TaskNode[];
  outputLog?: string;
  loading?: boolean;
  lastUpdated?: string;
}

const AGENTS: AgentName[] = [
  "ResearchBot",
  "CodeBot",
  "SyncGuardBot",
  "OrchestratorBot",
  "ContractBot",
  "SecurityBot",
  "DatabaseBot",
  "BackendBot",
  "QABot",
  "GrowthBot",
  "DocsBot",
  "FrontendBot",
];

function normalizeStatus(status: TaskStatus) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "done") return "completed";
  if (s === "failed" || s === "blocked" || s === "cancelled") return "failed";
  return "processing";
}

function countTasks(nodes: TaskNode[]) {
  const totals = { total: 0, completed: 0, failed: 0, processing: 0 };

  const walk = (items: TaskNode[]) => {
    for (const node of items) {
      totals.total += 1;
      const bucket = normalizeStatus(node.status);
      totals[bucket] += 1;
      if (node.children?.length) walk(node.children);
    }
  };

  walk(nodes);
  return totals;
}

function filterTasksByAgent(tasks: TaskNode[], activeAgent: AgentName | null): TaskNode[] {
  if (!activeAgent) return tasks;

  const filterNode = (node: TaskNode): TaskNode | null => {
    if (node.target_agent !== activeAgent) return null;

    return {
      ...node,
      children: (node.children ?? [])
        .map(filterNode)
        .filter((child): child is TaskNode => child !== null),
    };
  };

  return tasks.map(filterNode).filter((node): node is TaskNode => node !== null);
}

function getStatusTone(status: TaskStatus) {
  switch (normalizeStatus(status)) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/20";
    case "failed":
      return "bg-rose-500/15 text-rose-300 border-rose-400/20";
    default:
      return "bg-cyan-500/15 text-cyan-300 border-cyan-400/20";
  }
}

function getStatusLabel(status: TaskStatus) {
  switch (normalizeStatus(status)) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Processing";
  }
}

function TaskTreeNode({ node, depth = 0 }: { node: TaskNode; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-4 pl-4 border-l border-white/10" : ""}>
      <div className="relative flex items-start gap-3 py-3">
        <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.65)]" />
        </div>

        <div className="min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium tracking-wide text-white/90">{node.title}</p>
              <p className="mt-1 text-[11px] text-white/45">
                {node.target_agent ? `Target: ${node.target_agent}` : "Target: Unassigned"}
                {node.updatedAt ? ` • Updated ${node.updatedAt}` : ""}
              </p>
            </div>

            <div
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusTone(
                node.status
              )}`}
            >
              {getStatusLabel(node.status)}
            </div>
          </div>

          {node.output ? (
            <p className="mt-3 whitespace-pre-wrap text-[11px] leading-5 text-white/70">{node.output}</p>
          ) : null}
        </div>
      </div>

      {node.children?.length ? (
        <div className="ml-2">
          {node.children.map((child) => (
            <TaskTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function NexusMonitorTab({
  tasks,
  outputLog = "",
  loading = false,
  lastUpdated,
}: NexusMonitorTabProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);
  const [isOutputOpen, setIsOutputOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const visibleTasks = useMemo(
    () => filterTasksByAgent(tasks, selectedAgent),
    [tasks, selectedAgent]
  );

  const stats = useMemo(() => countTasks(visibleTasks), [visibleTasks]);
  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputLog || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-5 text-white">
      <div className="rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white/90">Nexus Monitor</h2>
            <p className="mt-1 text-[11px] text-white/45">
              {loading ? "Synchronizing live task feed..." : "Real-time hierarchical task feed"}
              {lastUpdated ? ` • Last updated ${lastUpdated}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedAgent(null)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/75 transition hover:bg-white/10"
          >
            Clear Filter
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Tasks", value: stats.total },
            { label: "Completed", value: stats.completed },
            { label: "Failed", value: stats.failed },
            { label: "Processing", value: stats.processing },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur-xl"
            >
              <p className="text-[11px] text-white/45">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white/90">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-white/60">Completion</p>
            <p className="text-[11px] text-white/70">{completionPct}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white/90">Agent Registry</h3>
          <p className="text-[11px] text-white/45">12 agents</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {AGENTS.map((agent) => {
            const active = selectedAgent === agent;
            return (
              <button
                key={agent}
                type="button"
                onClick={() => setSelectedAgent(active ? null : agent)}
                className={[
                  "rounded-2xl border px-3 py-3 text-left transition backdrop-blur-xl",
                  active
                    ? "border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                    : "border-white/5 bg-white/5 hover:bg-white/10",
                ].join(" ")}
              >
                <p className="text-[11px] font-medium text-white/90">{agent}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  {active ? "Filtered" : "Click to filter"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white/90">Hierarchical Task Feed</h3>
          <p className="text-[11px] text-white/45">{visibleTasks.length} root node(s)</p>
        </div>

        <div className="mt-4">
          {visibleTasks.length ? (
            visibleTasks.map((task) => <TaskTreeNode key={task.id} node={task} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-[11px] text-white/45">
              No tasks match the current filter.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setIsOutputOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
          aria-expanded={isOutputOpen}
          aria-controls="nexus-output-log"
        >
          <div>
            <h3 className="text-sm font-semibold text-white/90">Output Log</h3>
            <p className="mt-1 text-[11px] text-white/45">Collapsible execution log with quick copy</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleCopy();
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/75 transition hover:bg-white/10"
              aria-label="Copy output log"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="text-white/40">{isOutputOpen ? "−" : "+"}</span>
          </div>
        </button>

        {isOutputOpen ? (
          <div id="nexus-output-log" className="border-t border-white/5 p-4">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/5 bg-black/20 p-4 text-[11px] leading-5 text-white/75">
              {outputLog || "No output available."}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}