import Link from "next/link";

const tabs = [
  { key: "operations", label: "Operations" },
  { key: "memory", label: "Memory" },
  { key: "team", label: "Team" }
];

export function Shell({
  activeTab,
  children,
  fullBleed = false
}: {
  activeTab: string;
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  return (
    <div className={`shell ${fullBleed ? "shell-full" : ""}`}>
      {!fullBleed ? (
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
      ) : (
        <div className="nav-mini">
          {tabs.map((tab) => (
            <Link
              className={`nav-pill ${activeTab === tab.key ? "active" : ""}`}
              href={`/?tab=${tab.key}`}
              key={tab.key}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}
      <main className={`main ${fullBleed ? "main-full" : ""}`}>{children}</main>
    </div>
  );
}
