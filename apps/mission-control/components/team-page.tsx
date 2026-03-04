"use client";

import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

type TeamMember = {
  _id: string;
  name: string;
  role: string;
  group: "Developers" | "Writers" | "Designers" | "Operations";
};

const listTeamRef = makeFunctionReference<"query", Record<string, never>, TeamMember[]>("team:list");
const groups: TeamMember["group"][] = ["Developers", "Writers", "Designers", "Operations"];
const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
const fallbackMembers: TeamMember[] = [
  { _id: "local-dev-1", name: "Builder", role: "Platform integration", group: "Developers" },
  { _id: "local-dev-2", name: "Fixer", role: "Reliability + ops tooling", group: "Developers" },
  { _id: "local-writer-1", name: "Scribe", role: "Docs + handoffs", group: "Writers" },
  { _id: "local-des-1", name: "Lens", role: "UI polish + narrative", group: "Designers" },
  { _id: "local-ops-1", name: "Guardian", role: "Monitoring + response", group: "Operations" }
];

function TeamDetail({ member }: { member: TeamMember }) {
  return (
    <article className="card detail-card">
      <div className="detail-header">
        <strong>{member.name}</strong>
        <a className="detail-back" href="/?tab=team">
          Back
        </a>
      </div>
      <p>{member.role}</p>
      <p className="label">Group: {member.group}</p>
      <div className="detail-meta">ID: {member._id}</div>
    </article>
  );
}

function TeamWithConvex({ selectedId }: { selectedId?: string }) {
  const members = useQuery(listTeamRef, {}) ?? [];
  const selected = selectedId ? members.find((member) => member._id === selectedId) : undefined;

  return (
    <section className="panel stack">
      <div>
        <h1>Team</h1>
        <p className="label">中枢 coordinates specialists below by function.</p>
      </div>
      {selected ? <TeamDetail member={selected} /> : null}
      <article className="card">
        <strong>中枢</strong>
        <p className="label">Orchestrator for planning, prioritization, and final decisions.</p>
      </article>
      {groups.map((group) => (
        <article className="card" key={group}>
          <strong>{group}</strong>
          <div className="stack">
            {members
              .filter((member) => member.group === group)
              .map((member) => (
                <div key={member._id} className="detail-item">
                  <div>{member.name}</div>
                  <div className="label">{member.role}</div>
                  <a className="detail-link" href={`/?tab=team&memberId=${member._id}`}>
                    View details
                  </a>
                </div>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function TeamFallback({ selectedId }: { selectedId?: string }) {
  const selected = selectedId ? fallbackMembers.find((member) => member._id === selectedId) : undefined;

  return (
    <section className="panel stack">
      <div>
        <h1>Team</h1>
        <p className="label">Convex is not configured. Showing local fallback roster.</p>
      </div>
      {selected ? <TeamDetail member={selected} /> : null}
      <article className="card">
        <strong>中枢</strong>
        <p className="label">Orchestrator for planning, prioritization, and final decisions.</p>
      </article>
      {groups.map((group) => (
        <article className="card" key={group}>
          <strong>{group}</strong>
          <div className="stack">
            {fallbackMembers
              .filter((member) => member.group === group)
              .map((member) => (
                <div key={member._id} className="detail-item">
                  <div>{member.name}</div>
                  <div className="label">{member.role}</div>
                  <a className="detail-link" href={`/?tab=team&memberId=${member._id}`}>
                    View details
                  </a>
                </div>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export function TeamPage({ selectedId }: { selectedId?: string }) {
  return hasConvex ? <TeamWithConvex selectedId={selectedId} /> : <TeamFallback selectedId={selectedId} />;
}
