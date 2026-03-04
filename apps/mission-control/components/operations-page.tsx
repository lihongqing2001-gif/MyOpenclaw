"use client";

import { useEffect, useMemo, useState } from "react";

type DemandSummary = {
  total_main_tasks: number;
  done_main_tasks: number;
  satisfaction_percent: number;
};

type SnapshotMainTask = {
  id: number;
  title: string;
  owner: string;
  status: string;
  progress_percent: number;
  updated_at: string;
};

type SnapshotTask = {
  id: number;
  request_id: string;
  main_task_id: number;
  agent_id: string;
  task_desc: string;
  status: string;
  progress_percent: number;
  blocked_by: number;
  overdue: number;
  updated_at: string;
};

type SnapshotEvent = {
  id: number;
  request_id: string;
  event_type: string;
  actor: string;
  message: string;
  created_at: string;
};

type Snapshot = {
  demand: DemandSummary;
  tokens: { global: { total_tokens: number } };
  main_tasks: SnapshotMainTask[];
  tasks: SnapshotTask[];
  timeline: SnapshotEvent[];
};

const apiBase = process.env.NEXT_PUBLIC_MONITORING_API_URL ?? "http://127.0.0.1:8000";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function OperationsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`${apiBase}/api/snapshot`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Monitoring API returned ${response.status}`);
        }
        const data = (await response.json()) as Snapshot;
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Unable to load monitoring snapshot.";
          setError(message);
        }
      }
    }

    load();
    const timer = setInterval(load, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const timelineSummary = useMemo(() => {
    if (!snapshot) return [] as Array<{ type: string; count: number }>;
    const counts = new Map<string, number>();
    for (const item of snapshot.timeline) {
      counts.set(item.event_type, (counts.get(item.event_type) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [snapshot]);

  if (error) {
    return (
      <section className="panel stack">
        <div>
          <h1>Operations</h1>
          <p className="label">无法连接监控后端：{error}</p>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="panel stack">
        <div>
          <h1>Operations</h1>
          <p className="label">Loading monitoring snapshot...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <div>
        <h1>Operations</h1>
        <p className="label">Live data from monitoring backend {apiBase}</p>
      </div>

      <div className="cards-grid">
        <article className="card">
          <div className="label">Active Main Tasks</div>
          <strong>{snapshot.main_tasks.length}</strong>
        </article>
        <article className="card">
          <div className="label">Active Subtasks</div>
          <strong>{snapshot.tasks.length}</strong>
        </article>
        <article className="card">
          <div className="label">Demand Satisfaction</div>
          <strong>{snapshot.demand.satisfaction_percent}%</strong>
        </article>
        <article className="card">
          <div className="label">Total Tokens</div>
          <strong>{snapshot.tokens.global.total_tokens}</strong>
        </article>
      </div>

      <article className="card stack">
        <strong>Active Main Tasks</strong>
        {snapshot.main_tasks.map((task) => (
          <div className="row" key={task.id}>
            <div>
              <div>{task.title}</div>
              <div className="label">Owner: {task.owner || "-"}</div>
            </div>
            <div className="label">
              {task.status} · {task.progress_percent}% · {formatTime(task.updated_at)}
            </div>
          </div>
        ))}
        {snapshot.main_tasks.length === 0 ? <p className="label">No active main tasks.</p> : null}
      </article>

      <article className="card stack">
        <strong>Active Subtasks</strong>
        {snapshot.tasks.map((task) => (
          <div className="row" key={task.id}>
            <div>
              <div>{task.task_desc}</div>
              <div className="label">
                {task.agent_id} · {task.request_id}
              </div>
            </div>
            <div className="label">
              {task.status} · {task.progress_percent}% · blocked {task.blocked_by} · overdue {task.overdue}
            </div>
          </div>
        ))}
        {snapshot.tasks.length === 0 ? <p className="label">No active subtasks.</p> : null}
      </article>

      <article className="card stack">
        <strong>Timeline Summary</strong>
        <div className="chips">
          {timelineSummary.map((item) => (
            <span className="chip" key={item.type}>
              {item.type}: {item.count}
            </span>
          ))}
          {timelineSummary.length === 0 ? <span className="label">No timeline data.</span> : null}
        </div>
        {snapshot.timeline.slice(0, 8).map((event) => (
          <div className="row" key={event.id}>
            <div>
              <div>{event.message}</div>
              <div className="label">
                {event.actor} · {event.request_id}
              </div>
            </div>
            <div className="label">{formatTime(event.created_at)}</div>
          </div>
        ))}
      </article>
    </section>
  );
}
