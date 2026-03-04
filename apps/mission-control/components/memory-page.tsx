"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

type MemoryItem = {
  _id: string;
  title: string;
  summary: string;
  source: string;
  type: string;
  tags: string[];
};

const listMemoriesRef = makeFunctionReference<
  "query",
  { search?: string; source?: string; type?: string },
  MemoryItem[]
>("memories:list");

const sourceOptions = ["all", "operations", "product", "engineering", "support"];
const typeOptions = ["all", "incident", "decision", "runbook", "retrospective"];

export function MemoryPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [type, setType] = useState("all");

  const args = useMemo(
    () => ({
      search,
      source: source === "all" ? undefined : source,
      type: type === "all" ? undefined : type
    }),
    [search, source, type]
  );

  const memories = useQuery(listMemoriesRef, args) ?? [];

  return (
    <section className="panel stack">
      <div>
        <h1>Memory</h1>
        <p className="label">Search and filter Convex memory records by source and type.</p>
      </div>

      <div className="filters-grid">
        <input
          className="input"
          placeholder="Search memories"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              Source: {option}
            </option>
          ))}
        </select>
        <select className="input" value={type} onChange={(event) => setType(event.target.value)}>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              Type: {option}
            </option>
          ))}
        </select>
      </div>

      <div className="stack">
        {memories.map((memory) => (
          <article className="card stack" key={memory._id}>
            <strong>{memory.title}</strong>
            <p>{memory.summary}</p>
            <div className="chips">
              <span className="chip">{memory.source}</span>
              <span className="chip">{memory.type}</span>
              {memory.tags.map((tag) => (
                <span className="chip" key={`${memory._id}-${tag}`}>
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
        {memories.length === 0 ? <p className="label">No memories match this query.</p> : null}
      </div>
    </section>
  );
}
