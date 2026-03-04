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

export function TeamPage() {
  const members = useQuery(listTeamRef, {}) ?? [];

  return (
    <section className="panel stack">
      <div>
        <h1>Team</h1>
        <p className="label">中枢 coordinates specialists below by function.</p>
      </div>
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
                <div key={member._id}>
                  <div>{member.name}</div>
                  <div className="label">{member.role}</div>
                </div>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
}
