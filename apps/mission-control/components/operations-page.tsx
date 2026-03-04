const monitoringUrl = "/monitoring/index.html";

export function OperationsPage() {
  return (
    <section className="panel" style={{ padding: 0, minHeight: "calc(100vh - 80px)" }}>
      <iframe
        title="Monitoring Panel"
        src={monitoringUrl}
        style={{ width: "100%", height: "calc(100vh - 80px)", border: "none" }}
      />
    </section>
  );
}
