export type CharacterPose = "idle" | "working" | "blocked";

export interface CharacterProfile {
  id: string;
  name: string;
  role: string;
  tagline: string;
  accent: string;
  glow: string;
  shell: string;
  core: string;
  ring: string;
}

export const characterProfiles: CharacterProfile[] = [
  {
    id: "navigator",
    name: "Navi-01",
    role: "Pathfinder",
    tagline: "Good at routing context, scanning the tree, and keeping the system calm.",
    accent: "#3fb6ff",
    glow: "rgba(63, 182, 255, 0.24)",
    shell: "linear-gradient(180deg, rgba(9,18,32,0.96) 0%, rgba(20,34,58,0.92) 100%)",
    core: "linear-gradient(180deg, #8ed8ff 0%, #3fb6ff 100%)",
    ring: "rgba(143, 217, 255, 0.7)",
  },
  {
    id: "operator",
    name: "Ops-77",
    role: "Executor",
    tagline: "Built for dispatch, queue handling, and stable high-focus execution.",
    accent: "#7df0b8",
    glow: "rgba(125, 240, 184, 0.22)",
    shell: "linear-gradient(180deg, rgba(10,26,20,0.96) 0%, rgba(18,44,35,0.92) 100%)",
    core: "linear-gradient(180deg, #bbffd8 0%, #7df0b8 100%)",
    ring: "rgba(180, 255, 218, 0.75)",
  },
  {
    id: "archivist",
    name: "Memo-K",
    role: "Archivist",
    tagline: "Optimized for knowledge indexing, SOP recall, and artifact preservation.",
    accent: "#f7c86a",
    glow: "rgba(247, 200, 106, 0.24)",
    shell: "linear-gradient(180deg, rgba(31,24,12,0.96) 0%, rgba(58,42,18,0.92) 100%)",
    core: "linear-gradient(180deg, #ffe7a7 0%, #f7c86a 100%)",
    ring: "rgba(255, 228, 161, 0.78)",
  },
];
