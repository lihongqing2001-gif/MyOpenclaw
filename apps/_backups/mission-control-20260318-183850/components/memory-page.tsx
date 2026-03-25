"use client";

import { useMemo, useState } from "react";
import { memoryEntries, type MemoryEntry } from "@/data/local";

function MemoryDetail({ memory }: { memory: MemoryEntry }) {
  return (
    <article className="detail-card">
      <div className="detail-header">
        <div>
          <p className="detail-kicker">Owner · {memory.owner}</p>
          <h2>{memory.title}</h2>
        </div>
        <a className="detail-back" href="/?tab=memory">
          Back
        </a>
      </div>
      <p className="detail-summary">{memory.summary}</p>
      <div className="detail-meta-row">
        <span>{memory.updatedAt}</span>
        <span>{memory.source}</span>
      </div>
      <div className="tag-row">
        {memory.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <ul className="detail-notes">
        {memory.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </article>
  );
}

export function MemoryPage({ selectedId }: { selectedId?: string }) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");

  const tags = useMemo(() => {
    const allTags = new Set<string>();
    memoryEntries.forEach((entry) => entry.tags.forEach((t) => allTags.add(t)));
    return ["all", ...Array.from(allTags)];
  }, []);

  const filtered = useMemo(() => {
    return memoryEntries.filter((entry) => {
      const matchesSearch =
        entry.title.toLowerCase().includes(search.toLowerCase()) ||
        entry.summary.toLowerCase().includes(search.toLowerCase());
      const matchesTag = tag === "all" || entry.tags.includes(tag);
      return matchesSearch && matchesTag;
    });
  }, [search, tag]);

  const selected = selectedId
    ? memoryEntries.find((entry) => entry.id === selectedId)
    : filtered[0] ?? memoryEntries[0];

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <p className="page-kicker">Memory Vault</p>
          <h1>Decisions, handoffs, and the trail of what matters.</h1>
          <p className="page-subtitle">All entries live locally for now. Fast, searchable, and offline-friendly.</p>
        </div>
        <div className="page-actions">
          <input
            className="input"
            placeholder="Search notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="tag-row">
            {tags.map((t) => (
              <button
                key={t}
                className={`tag ${tag === t ? "active" : ""}`}
                type="button"
                onClick={() => setTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="split-grid">
        <div className="stack">
          {filtered.map((entry) => (
            <article className="list-card" key={entry.id}>
              <div className="list-card-header">
                <div>
                  <h3>{entry.title}</h3>
                  <p>{entry.summary}</p>
                </div>
                <span className="status-chip">{entry.owner}</span>
              </div>
              <div className="meta-row">
                <span>{entry.updatedAt}</span>
                <span>{entry.source}</span>
              </div>
              <div className="tag-row">
                {entry.tags.map((tagItem) => (
                  <span className="tag" key={tagItem}>
                    {tagItem}
                  </span>
                ))}
              </div>
              <a className="detail-link" href={`/?tab=memory&memoryId=${entry.id}`}>
                View details
              </a>
            </article>
          ))}
        </div>
        {selected ? <MemoryDetail memory={selected} /> : null}
      </div>
    </section>
  );
}
