import { expect, Page, test } from "@playwright/test";

function createHeartbeat(overrides?: Partial<ReturnType<typeof createHeartbeatBase>>) {
  return {
    ...createHeartbeatBase(),
    ...overrides,
  };
}

function createHeartbeatBase() {
  return {
    status: "alive",
    timestamp: Date.now(),
    agent: {
      id: "openclaw-resident-agent",
      online: true,
      lastSeenAt: Date.now(),
    },
    activeTasks: [],
    queuedTasks: [],
    recentTasks: [],
    decisionQueue: [
      {
        id: "dq-1",
        priority: "p0",
        title: "Blocked Workflow",
        reason: "Archive workflow is blocked until the target root is confirmed.",
        nextAction: "Confirm the asset root before the next archive run.",
        status: "open",
        evidenceLevel: "runtime",
        relatedTaskId: "task-dq-1",
        relatedNodeId: "project_file_organize",
        refs: [{ label: "Task", value: "task-dq-1" }],
      },
      {
        id: "dq-2",
        priority: "p2",
        title: "Queued Follow-up",
        reason: "Indexing is ready after the archive finishes.",
        nextAction: "Review the generated index and confirm the evidence.",
        status: "watch",
        evidenceLevel: "declared",
        relatedTaskId: "task-dq-2",
        relatedNodeId: "project_file_index",
        refs: [
          {
            label: "Target Dir",
            value: "/Users/liumobei/.openclaw/workspace/content_system/skilltree",
            path: "/Users/liumobei/.openclaw/workspace/content_system/skilltree",
          },
          { label: "Task", value: "task-dq-2" },
        ],
      },
    ],
  };
}

function createSkillTreeResponse() {
  return {
    source: "test-skill-tree",
    nodes: [
      {
        id: "domain-content",
        level: 1,
        label: "内容系统",
        status: "idle",
        parentId: null,
      },
      {
        id: "area-content-ops",
        level: 2,
        label: "内容运营",
        status: "idle",
        parentId: "domain-content",
      },
      {
        id: "sop-content-run",
        level: 3,
        label: "内容生成试跑",
        status: "idle",
        parentId: "area-content-ops",
        sourceType: "sop",
        sourcePath: "/tmp/sops/content-run.md",
        drawerContent: {
          summary: "A deterministic SOP for testing the drawer flow.",
          prerequisites: "Provide a topic before execution.",
          capabilities: ["Generate a content draft", "Return a runtime artifact"],
          useCases: [
            {
              title: "Testing",
              summary: "Used to verify drawer execution and feedback flow.",
            },
          ],
          inputs: [
            {
              field: "主题",
              type: "text",
              required: true,
              placeholder: "请输入主题",
            },
          ],
          invoke: "python3 /tmp/scripts/content-run.py --topic <主题>",
          commands: ["python3 /tmp/scripts/content-run.py --topic <主题>"],
          requiredSkills: [],
          knowledgeBase: {
            tags: ["test", "drawer"],
            documents: [],
          },
        },
      },
    ],
  };
}

function createControlPlaneState(configured = false) {
  return {
    assetRoot: {
      path: configured
        ? "/Volumes/For Win/01_Projects/AI"
        : "/Users/liumobei/Documents/mission-control-assets",
      configured,
      source: configured ? "saved" : "default",
      configPath:
        "/Users/liumobei/.openclaw/workspace/agents/runtime/agent-os-config-v1.json",
      suggestedPath: "/Users/liumobei/Documents/mission-control-assets",
      legacyWorkspaceRoots: ["/Users/liumobei/.openclaw/workspace/content_system"],
      namingContract: {
        version: "v1",
        summary: [
          "New long-term assets use a type prefix + date/version + status suffix.",
          "Human-readable and AI-readable companions share the same base name and differ only by the role suffix.",
        ],
        rules: [],
      },
    },
    decisionQueue: createHeartbeat().decisionQueue,
  };
}

function createKnowledgeResults() {
  return {
    results: [
      {
        id: "ev-runtime",
        evidenceLevel: "runtime",
        knowledgeType: "asset-index",
        sourceKind: "runtime",
        human: {
          title: "资料到索引运行案例",
          summary: "Archive and index completed with runtime evidence.",
          content_md: "",
          tags: ["runtime"],
          domain: "Knowledge",
          platform: "Mission Control",
          links: [
            {
              title: "Index Markdown",
              url: "/api/v1/doc?path=%2Ftmp%2FINDEX.md",
            },
          ],
        },
        machine: {
          intent: "workflow_runtime",
          entities: {},
          steps: [],
          commands: [],
          constraints: [],
        },
      },
      {
        id: "ev-declared",
        evidenceLevel: "declared",
        knowledgeType: "reference",
        sourceKind: "reference",
        human: {
          title: "资料目录规则",
          summary: "Declared storage and naming guidance.",
          content_md: "",
          tags: ["declared"],
          domain: "Knowledge",
          platform: "Mission Control",
          links: [
            {
              title: "Reference",
              url: "/api/v1/doc?path=%2Ftmp%2Freference.md",
            },
          ],
        },
        machine: {
          intent: "reference",
          entities: {},
          steps: [],
          commands: [],
          constraints: [],
        },
      },
    ],
  };
}

async function mockDashboardApis(
  page: Page,
  options?: {
    heartbeat?: Partial<ReturnType<typeof createHeartbeatBase>>;
    skillTreeResponse?: ReturnType<typeof createSkillTreeResponse>;
  },
) {
  let assetRootConfigured = false;
  const heartbeat = createHeartbeat(options?.heartbeat);
  const skillTreeResponse = options?.skillTreeResponse ?? { nodes: [], source: "mock-fallback" };

  await page.route("**/api/v1/stream", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: `data: ${JSON.stringify({ type: "heartbeat", payload: heartbeat })}\n\n`,
    });
  });

  await page.route("**/api/v1/skill-tree", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(skillTreeResponse),
    });
  });

  await page.route("**/api/v1/task-history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        groups: [],
        nextOffset: null,
        hasMore: false,
        totalGroups: 0,
      }),
    });
  });

  await page.route("**/api/v1/control-plane/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createControlPlaneState(assetRootConfigured)),
    });
  });

  await page.route("**/api/v1/control-plane/asset-root", async (route) => {
    assetRootConfigured = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        assetRoot: createControlPlaneState(true).assetRoot,
      }),
    });
  });

  return {
    setAssetIntakeRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/control-plane/asset-intake", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            queuedTasks: [
              {
                id: "task-asset-intake",
                nodeLabel: "project_file_organize",
              },
            ],
            decisionSummary: "Archive queued for the selected target directory.",
          }),
        });
      });
    },
    setKnowledgeSearchRoute() {
      return page.route("**/api/v1/knowledge/search", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createKnowledgeResults()),
        });
      });
    },
    setNodeExecuteRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/node-execute", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Execution queued",
            task: {
              id: "task-node-execute",
              nodeLabel: "内容生成试跑",
            },
          }),
        });
      });
    },
    setTaskFeedbackRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/task-feedback", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            summary: "Feedback recorded and evolution task queued.",
            feedbackPath: "/tmp/feedback.md",
            evolutionPath: "/tmp/evolution.md",
            suggestions: ["Tighten the output contract."],
            evolutionTaskId: "task-evo-1",
          }),
        });
      });
    },
  };
}

test.describe("dashboard control panels", () => {
  test("renders the asset intake and decision queue panels from control-plane state", async ({
    page,
  }) => {
    await mockDashboardApis(page);
    await page.goto("/");

    await expect(page.getByTestId("asset-intake-panel")).toBeVisible();
    await expect(page.getByLabel("Target intake directory")).toHaveValue(
      "/Users/liumobei/.openclaw/workspace/content_system",
    );
    await expect(page.getByTestId("decision-queue-panel")).toBeVisible();
    await expect(page.getByText("Blocked Workflow")).toBeVisible();
    await expect(page.getByText("Queued Follow-up")).toBeVisible();
  });

  test("lets a decision jump directly into the asset intake flow", async ({
    page,
  }) => {
    await mockDashboardApis(page);
    await page.goto("/");

    const followUpCard = page
      .getByText("Queued Follow-up")
      .locator("xpath=ancestor::article[1]");
    await followUpCard.getByRole("button", { name: /Open asset intake/i }).click();

    await expect(page.getByTestId("asset-intake-panel")).toBeVisible();
    await expect(page.getByLabel("Target intake directory")).toHaveValue(
      "/Users/liumobei/.openclaw/workspace/content_system/skilltree",
    );
  });

  test("queues archive intake with the current target directory and note", async ({
    page,
  }) => {
    const routes = await mockDashboardApis(page);
    let intakePayload: Record<string, unknown> | null = null;
    await routes.setAssetIntakeRoute((payload) => {
      intakePayload = payload;
    });

    await page.goto("/");
    await page.getByLabel("Target intake directory").fill("/Volumes/For Win/01_Projects/AI");
    await page.getByLabel("Archive rule note").fill("Keep the project root stable.");
    await page.getByRole("button", { name: "Queue archive" }).click();

    await expect
      .poll(() => intakePayload, { timeout: 5000 })
      .not.toBeNull();

    expect(intakePayload).toMatchObject({
      action: "organize",
      targetDir: "/Volumes/For Win/01_Projects/AI",
      archiveRule: "Keep the project root stable.",
    });

    await expect(page.getByText("Last action: Archive queued for the selected target directory.")).toBeVisible();
  });

  test("searches evidence and filters results by evidence level", async ({ page }) => {
    const routes = await mockDashboardApis(page);
    await routes.setKnowledgeSearchRoute();

    await page.goto("/");
    const evidencePanel = page.getByTestId("evidence-search-panel");
    await evidencePanel.getByLabel("Search evidence by keyword, path, or tag").fill("资料");
    await evidencePanel.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText("资料到索引运行案例")).toBeVisible();
    await expect(page.getByText("资料目录规则")).toBeVisible();

    await page.getByRole("button", { name: "Runtime" }).click();
    await expect(page.getByText("资料到索引运行案例")).toBeVisible();
    await expect(page.getByText("资料目录规则")).toHaveCount(0);
  });

  test("opens the lazily loaded skill tree view from the dashboard", async ({
    page,
  }) => {
    await mockDashboardApis(page, { skillTreeResponse: createSkillTreeResponse() });
    await page.goto("/");

    await page.getByRole("button", { name: /Open Neural Skill Tree/i }).click();

    await expect(page.getByTestId("skill-tree-view")).toBeVisible();
    await expect(page.getByRole("button", { name: /Back to Lobby/i })).toBeVisible();
    await expect(page.getByLabel("Search skill tree")).toBeVisible();
  });

  test("opens the drawer from skill tree and queues SOP execution", async ({
    page,
  }) => {
    const routes = await mockDashboardApis(page, {
      skillTreeResponse: createSkillTreeResponse(),
    });
    let executePayload: Record<string, unknown> | null = null;
    await routes.setNodeExecuteRoute((payload) => {
      executePayload = payload;
    });

    await page.goto("/");
    await page.getByRole("button", { name: /Open Neural Skill Tree/i }).click();
    await page.getByRole("button", { name: "Expand All" }).click();
    await page.getByText("内容生成试跑").click();

    await expect(page.getByText("Overview")).toBeVisible();
    await page.getByPlaceholder("请输入主题").fill("测试主题");
    await page.getByRole("button", { name: "Execute SOP" }).click();

    await expect
      .poll(() => executePayload, { timeout: 5000 })
      .not.toBeNull();

    expect(executePayload).toMatchObject({
      nodeId: "sop-content-run",
      command: "python3 /tmp/scripts/content-run.py --topic <主题>",
      inputValues: {
        主题: "测试主题",
      },
    });

    await expect(page.getByText("Queued for agent: 内容生成试跑")).toBeVisible();
  });

  test("opens the feedback modal from a recent task and submits feedback", async ({
    page,
  }) => {
    const recentTask = {
      id: "task-recent-1",
      nodeId: "project_file_index",
      nodeLabel: "资料清单化与索引",
      command: "python3 /tmp/run_project_file_index.py --target-dir /tmp/demo",
      executionMode: "asset-index",
      status: "completed",
      stage: "completed",
      evidenceLevel: "runtime",
      updatedAt: Date.now(),
      createdAt: Date.now() - 1000,
      agentId: "openclaw-resident-agent",
      resultSummary: "索引已生成。",
      resultDetail: "Knowledge note: /tmp/knowledge-note.md",
      artifactRefs: [
        {
          path: "/tmp/INDEX.md",
          key: "index_md",
          label: "Index Markdown",
          primary: true,
        },
      ],
    };
    const routes = await mockDashboardApis(page, {
      heartbeat: {
        recentTasks: [recentTask],
      },
    });
    let feedbackPayload: Record<string, unknown> | null = null;
    await routes.setTaskFeedbackRoute((payload) => {
      feedbackPayload = payload;
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Feedback" }).first().click();

    await expect(page.getByTestId("task-feedback-modal")).toBeVisible();
    await expect(page.getByLabel("Your Feedback")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Save Feedback" })).toBeDisabled();

    await page.getByLabel("Your Feedback").fill("Please add a summary block to the index output.");
    await page.getByRole("button", { name: "Save Feedback" }).click();

    await expect
      .poll(() => feedbackPayload, { timeout: 5000 })
      .not.toBeNull();

    expect(feedbackPayload).toMatchObject({
      taskId: "task-recent-1",
      feedback: "Please add a summary block to the index output.",
    });

    const modal = page.getByTestId("task-feedback-modal");
    await expect(modal.getByText("Feedback Saved", { exact: true })).toBeVisible();
    await expect(modal.getByText("Evolution Task Queued", { exact: true })).toBeVisible();
  });
});
