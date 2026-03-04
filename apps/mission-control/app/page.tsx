import { MemoryPage } from "@/components/memory-page";
import { OperationsPage } from "@/components/operations-page";
import { Shell } from "@/components/shell";
import { TeamPage } from "@/components/team-page";

export default function Home({
  searchParams
}: {
  searchParams: { tab?: "operations" | "memory" | "team"; memoryId?: string; memberId?: string };
}) {
  const tab = searchParams.tab ?? "operations";

  return (
    <Shell activeTab={tab} fullBleed={tab === "operations"}>
      {tab === "memory" ? <MemoryPage selectedId={searchParams.memoryId} /> : null}
      {tab === "team" ? <TeamPage selectedId={searchParams.memberId} /> : null}
      {tab === "operations" ? <OperationsPage /> : null}
    </Shell>
  );
}
