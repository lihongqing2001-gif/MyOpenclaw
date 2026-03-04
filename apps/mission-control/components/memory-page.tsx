"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

type MemoryItem = {
  _id: string;
  title: string;
  summary: string;
  tags: string[];
};

const listMemoriesRef = makeFunctionReference<"query", { search?: string }, MemoryItem[]>("memories:list");
const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
const fallbackMemories: MemoryItem[] = [
  {
    _id: "local-1",
    title: "Mission Control scaffold",
    summary: "Operations, Memory, and Team pages are staged for phased rollout.",
    tags: ["ops", "phase-1"]
  },
  {
    _id: "local-2",
    title: "Monitoring continuity",
    summary: "Legacy monitoring panel remains active while Mission Control ramps.",
    tags: ["monitoring", "parity"]
  }
];

function MemoryDetail({ memory }: { memory: MemoryItem }) {
  return (
    <article className="card detail-card">
      <div className="detail-header">
        <strong>{memory.title}</strong>
        <a className="detail-back" href="/?tab=memory">
          Back
        </a>
      </div>
      <p>{memory.summary}</p>
      <p className="label">{memory.tags.join(" | ")}</p>
      <div className="detail-meta">ID: {memory._id}</div>
    </article>
  );
}

function MemoryWithConvex({ selectedId }: { selectedId?: string }) {
  const [search, setSearch] = useState("");
  const args = useMemo(() => ({ search }), [search]);
  const memories = useQuery(listMemoriesRef, args) ?? [];
  const selected = selectedId ? memories.find((memory) => memory._id === selectedId) : undefined;

  return (
    <section className="panel stack">
      <div>
        <h1>Memory</h1>
        <p className="label">Search internal notes and decisions indexed in Convex.</p>
      </div>
      <input
        className="input"
        placeholder="Search memories"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {selected ? <MemoryDetail memory={selected} /> : null}
      <div className="stack">
        {memories.map((memory) => (
          <article className="card" key={memory._id}>
            <strong>{memory.title}</strong>
            <p>{memory.summary}</p>
            <p className="label">{memory.tags.join(" | ")}</p>
            <a className="detail-link" href={`/?tab=memory&memoryId=${memory._id}`}>
              View details
            </a>
          </article>
        ))}
        {memories.length === 0 ? <p className="label">No memories match this search.</p> : null}
      </div>
    </section>
  );
}

function MemoryFallback({ selectedId }: { selectedId?: string }) {
  const selected = selectedId ? fallbackMemories.find((memory) => memory._id === selectedId) : undefined;

  return (
    <section className="panel stack">
      <div>
        <h1>Memory</h1>
        <p className="label">Convex is not configured. Showing local fallback notes.</p>
      </div>
      {selected ? <MemoryDetail memory={selected} /> : null}
      <div className="stack">
        {fallbackMemories.map((memory) => (
          <article className="card" key={memory._id}>
            <strong>{memory.title}</strong>
            <p>{memory.summary}</p>
            <p className="label">{memory.tags.join(" | ")}</p>
            <a className="detail-link" href={`/?tab=memory&memoryId=${memory._id}`}>
              View details
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MemoryPage({ selectedId }: { selectedId?: string }) {
  return hasConvex ? <MemoryWithConvex selectedId={selectedId} /> : <MemoryFallback selectedId={selectedId} />;
}
