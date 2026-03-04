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

export function MemoryPage() {
  const [search, setSearch] = useState("");
  const args = useMemo(() => ({ search }), [search]);
  const memories = useQuery(listMemoriesRef, args) ?? [];

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
      <div className="stack">
        {memories.map((memory) => (
          <article className="card" key={memory._id}>
            <strong>{memory.title}</strong>
            <p>{memory.summary}</p>
            <p className="label">{memory.tags.join(" | ")}</p>
          </article>
        ))}
        {memories.length === 0 ? <p className="label">No memories match this search.</p> : null}
      </div>
    </section>
  );
}
