const monitoringUrl = process.env.MONITORING_PANEL_URL ?? "http://localhost:3000";

export function OperationsPage() {
  return (
    <section className="panel stack">
      <div>
        <h1>Operations</h1>
        <p className="label">Current monitoring stack remains active while Mission Control is phased in.</p>
      </div>
      <article className="card">
        <p>
          Existing monitoring capabilities are preserved and can be accessed through the current panel.
          Mission Control will absorb those workflows incrementally after parity checks.
        </p>
        <a href={monitoringUrl} rel="noreferrer" target="_blank">
          Open monitoring panel
        </a>
      </article>
    </section>
  );
}
