import { MemoryPage } from "@/components/memory-page";
import { OperationsPage } from "@/components/operations-page";
import { Shell } from "@/components/shell";
import { TeamPage } from "@/components/team-page";

export default function Home({
  searchParams
}: {
  searchParams: { tab?: "operations" | "memory" | "team" };
}) {
  const tab = searchParams.tab ?? "operations";

  return (
    <Shell activeTab={tab}>
      {tab === "memory" ? <MemoryPage /> : null}
      {tab === "team" ? <TeamPage /> : null}
      {tab === "operations" ? <OperationsPage /> : null}
    </Shell>
  );
}
