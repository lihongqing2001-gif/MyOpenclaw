import Link from "next/link";

const tabs = [
  { key: "operations", label: "Operations" },
  { key: "memory", label: "Memory" },
  { key: "team", label: "Team" }
];

export function Shell({ activeTab, children }: { activeTab: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">Mission Control</div>
        <nav className="nav-links">
          {tabs.map((tab) => (
            <Link
              className={`nav-link ${activeTab === tab.key ? "active" : ""}`}
              href={`/?tab=${tab.key}`}
              key={tab.key}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
