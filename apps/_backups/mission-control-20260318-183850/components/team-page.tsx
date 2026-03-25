"use client";

import { teamMembers, type TeamMember } from "@/data/local";

const groups: TeamMember["group"][] = ["Developers", "Writers", "Designers", "Operations"];

function TeamDetail({ member }: { member: TeamMember }) {
  return (
    <article className="detail-card">
      <div className="detail-header">
        <div>
          <p className="detail-kicker">{member.group}</p>
          <h2>{member.name}</h2>
        </div>
        <a className="detail-back" href="/?tab=team">
          Back
        </a>
      </div>
      <p className="detail-summary">{member.role}</p>
      <div className="meta-row">
        <span>Focus: {member.focus}</span>
        <span>Status: {member.status}</span>
      </div>
      <div className="tag-row">
        {member.skills.map((skill) => (
          <span className="tag" key={skill}>
            {skill}
          </span>
        ))}
      </div>
    </article>
  );
}

export function TeamPage({ selectedId }: { selectedId?: string }) {
  const selected = selectedId
    ? teamMembers.find((member) => member.id === selectedId)
    : teamMembers[0];

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <p className="page-kicker">Team Atlas</p>
          <h1>Specialists aligned by focus, ready on demand.</h1>
          <p className="page-subtitle">Local roster with clear ownership and current focus.</p>
        </div>
      </div>

      <div className="split-grid">
        <div className="stack">
          <article className="hero-card">
            <div>
              <p className="detail-kicker">Orchestrator</p>
              <h2>中枢</h2>
              <p className="detail-summary">Planning, prioritization, and final decisions.</p>
            </div>
            <div className="meta-row">
              <span>Status: active</span>
              <span>Focus: strategy + arbitration</span>
            </div>
          </article>

          {groups.map((group) => (
            <section key={group} className="list-card">
              <div className="list-card-header">
                <div>
                  <h3>{group}</h3>
                  <p>Primary coverage for {group.toLowerCase()} workflows.</p>
                </div>
              </div>
              <div className="grid-list">
                {teamMembers
                  .filter((member) => member.group === group)
                  .map((member) => (
                    <div className="grid-item" key={member.id}>
                      <div>
                        <h4>{member.name}</h4>
                        <p>{member.role}</p>
                      </div>
                      <div className="meta-row">
                        <span>{member.focus}</span>
                        <span>{member.status}</span>
                      </div>
                      <a className="detail-link" href={`/?tab=team&memberId=${member.id}`}>
                        View details
                      </a>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
        {selected ? <TeamDetail member={selected} /> : null}
      </div>
    </section>
  );
}
