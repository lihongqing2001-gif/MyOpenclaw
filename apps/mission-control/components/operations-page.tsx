"use client";

import { useState } from "react";

const monitoringUrl = "/monitoring/index.html";

const zoomLevels = [1, 1.1, 1.2, 1.35];

export function OperationsPage() {
  const [zoom, setZoom] = useState(1.2);

  return (
    <section className="ops-shell">
      <div className="ops-controls">
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
      <div className="ops-frame" style={{ "--zoom": zoom } as React.CSSProperties}>
        <iframe title="Monitoring Panel" src={monitoringUrl} />
      </div>
    </section>
  );
}
