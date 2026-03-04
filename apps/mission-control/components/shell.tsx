import Link from "next/link";

const tabs = [
  { key: "operations", label: "Operations" },
  { key: "memory", label: "Memory" },
  { key: "team", label: "Team" }
];

export function Shell({
  activeTab,
  children,
  fullBleed = false,
  hideTopbar = false
}: {
  activeTab: string;
  children: React.ReactNode;
  fullBleed?: boolean;
  hideTopbar?: boolean;
}) {
  return (
    <div className={`shell ${fullBleed ? "shell-full" : ""} ${hideTopbar ? "shell-no-top" : ""}`}>
      {hideTopbar ? null : (
        <header className={`topbar ${fullBleed ? "topbar-float" : ""}`}>
          <div className="brand">
            <span className="brand-mark">MC</span>
            <div>
              <div className="brand-title">Mission Control</div>
              <div className="brand-subtitle">Local command layer</div>
            </div>
          </div>
          <nav className="tabs">
            {tabs.map((tab) => (
              <Link
                className={`tab ${activeTab === tab.key ? "active" : ""}`}
                href={`/?tab=${tab.key}`}
                key={tab.key}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>
      )}
      <main className={`main ${fullBleed ? "main-full" : ""}`}>{children}</main>
    </div>
  );
}
