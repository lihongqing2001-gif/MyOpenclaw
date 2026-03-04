"use client";

import { useState } from "react";

const monitoringUrl = "/monitoring/index.html";
const zoomLevels = [1, 1.1, 1.2, 1.35];

export function OperationsPage({ activeTab }: { activeTab: string }) {
  const [zoom, setZoom] = useState(1.2);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="ops-shell">
      <div className={`ops-controls ${collapsed ? "collapsed" : ""}`}>
        <div className="ops-controls-row">
          <span className="ops-label">Ops</span>
          <div className="ops-tabs">
            <a className={`ops-tab ${activeTab === "operations" ? "active" : ""}`} href="/?tab=operations">
              Operations
            </a>
            <a className="ops-tab" href="/?tab=memory">
              Memory
            </a>
            <a className="ops-tab" href="/?tab=team">
              Team
            </a>
          </div>
          <button className="ops-toggle" type="button" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
        <div className="ops-controls-row">
          <span className="ops-label">Zoom</span>
          {zoomLevels.map((level) => (
            <button
              key={level}
              className={`ops-pill ${zoom === level ? "active" : ""}`}
              onClick={() => setZoom(level)}
              type="button"
            >
              {Math.round(level * 100)}%
            </button>
          ))}
          <a className="ops-link" href={monitoringUrl} target="_blank" rel="noreferrer">
            Open panel
          </a>
        </div>
      </div>
      <div className="ops-frame" style={{ "--zoom": zoom } as React.CSSProperties}>
        <iframe title="Monitoring Panel" src={monitoringUrl} />
      </div>
    </section>
  );
}
