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
        refs: [
          {
            label: "Target Dir",
            value: "/Users/liumobei/.openclaw/workspace/content_system/skilltree",
            path: "/Users/liumobei/.openclaw/workspace/content_system/skilltree",
          },
          { label: "Task", value: "task-dq-1" },
        ],
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
        refs: [{ label: "Task", value: "task-dq-2" }],
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
    shortVideoFactory: {
      defaultSeries: "AI内容系统",
      defaultInstance: "2026-03__短视频对标试点",
      minSampleSize: 3,
      defaultSampleSize: 5,
      latestSampleBatch: null,
      latestResearchBundle: null,
      latestCreativeBrief: null,
      latestProductionPack: null,
      latestRoughCut: null,
      latestInspirationRecord: null,
      latestNotebookSummary: null,
      latestNotebookEnhancedBrief: null,
      geminiConsentGranted: false,
      notebooklmAvailable: true,
      gates: [
        {
          id: "pilot-account",
          label: "账号试点",
          status: "pending",
          detail: "先导入一个 3-5 条样本的账号批次。",
        },
      ],
    },
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
    controlPlaneState?: ReturnType<typeof createControlPlaneState>;
  },
) {
  let assetRootConfigured = options?.controlPlaneState?.assetRoot.configured ?? false;
  let shortVideoState = options?.controlPlaneState?.shortVideoFactory ?? createControlPlaneState(false).shortVideoFactory;
  let currentDecisionQueue = (options?.heartbeat?.decisionQueue as any[]) ?? createHeartbeat().decisionQueue;
  const heartbeat = createHeartbeat(options?.heartbeat);
  heartbeat.decisionQueue = currentDecisionQueue as any;
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
      body: JSON.stringify({
        ...createControlPlaneState(assetRootConfigured),
        shortVideoFactory: shortVideoState,
        decisionQueue: currentDecisionQueue,
      }),
    });
  });

  await page.route("**/api/v1/control-plane/decision-action", async (route) => {
    const payload = JSON.parse(route.request().postData() ?? "{}");
    if (payload.action === "ignore" || payload.action === "resolve" || payload.action === "snooze") {
      currentDecisionQueue = currentDecisionQueue.filter((item) => item.id !== payload.decisionId);
      heartbeat.decisionQueue = currentDecisionQueue as any;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
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
    setShortVideoBatchRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/control-plane/short-video/sample-batch", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        shortVideoState = {
          ...shortVideoState,
          latestSampleBatch: {
            label: "样本批次",
            path: "/tmp/sample_manifest.json",
            updatedAt: new Date().toISOString(),
          },
          gates: shortVideoState.gates.map((gate) =>
            gate.id === "pilot-account"
              ? { ...gate, status: "completed", detail: "已建立样本批次：/tmp/sample_manifest.json" }
              : gate,
          ),
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            sampleManifest: "/tmp/sample_manifest.json",
            sourceLinksCsv: "/tmp/source_links.csv",
            executionSummary: "已创建试点账号的短视频样本批次，共 3 条链接。",
          }),
        });
      });
    },
    setShortVideoResearchRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/control-plane/short-video/account-research", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        shortVideoState = {
          ...shortVideoState,
          latestResearchBundle: {
            label: "账号研究包",
            path: "/tmp/account_research_bundle.json",
            updatedAt: new Date().toISOString(),
          },
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Short-video account research queued",
            task: {
              id: "task-short-video-research",
              nodeLabel: "运行账号研究",
            },
          }),
        });
      });
    },
    setShortVideoBriefRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/control-plane/short-video/creative-brief", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        shortVideoState = {
          ...shortVideoState,
          latestCreativeBrief: {
            label: "Creative Brief",
            path: "/tmp/creative_brief.json",
            updatedAt: new Date().toISOString(),
          },
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Creative brief queued",
            task: {
              id: "task-short-video-brief",
              nodeLabel: "生成 Creative Brief",
            },
          }),
        });
      });
    },
    setShortVideoProductionRoute(handler: (payload: Record<string, unknown>) => void) {
      return page.route("**/api/v1/control-plane/short-video/director-production", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}");
        handler(payload);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Director production queued",
            task: {
              id: "task-short-video-production",
              nodeLabel: "启动导演与生产链",
            },
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
    setStorageSearchRoute() {
      return page.route("**/api/v1/storage-retrieval/search", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            assets: [],
            knowledge: createKnowledgeResults().results.map((item: any) => ({
              id: item.id,
              title: item.human.title,
              kind: "knowledge",
              fileType: "knowledge",
              path: "/tmp/reference.md",
              summary: item.human.summary,
              updatedAt: new Date().toISOString(),
              projectSeries: "AI内容系统",
              platform: "mission-control",
              linkedKnowledgePath: "/tmp/reference.md",
            })),
          }),
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
    setLocalPackagesRoute() {
      return page.route("**/api/v1/local-packages", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            packages: [
              {
                packageId: "cap.openclaw.sop.content-schedule-planning",
                name: "日程规划与冲突检测",
                type: "sop-pack",
                author: { name: "OpenClaw", id: "official/openclaw" },
                activeVersion: "0.2.0",
                installedVersions: [
                  {
                    version: "0.2.0",
                    status: "enabled",
                    installedAt: new Date().toISOString(),
                    installPath: "/tmp/community-packages/schedule",
                    sourcePath: "/tmp/community-packages/schedule.zip",
                    manifestPath: "/tmp/community-packages/schedule/community-package.json",
                    permissions: [],
                    compatibility: {
                      openclawMinVersion: "2026.3.2",
                      installMode: "local-console",
                      platforms: ["macos"],
                    },
                  },
                ],
              },
            ],
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

    await page.getByTestId("workspace-tab-storage-retrieval").click();
    await expect(page.getByTestId("asset-intake-panel")).toBeVisible();
    await expect(page.getByLabel("Target intake directory")).toHaveValue(
      "/Users/liumobei/.openclaw/workspace/content_system",
    );
    await expect(page.getByTestId("decision-queue-panel")).toBeVisible();
    await expect(page.getByText("Blocked Workflow")).toBeVisible();
    await expect(page.getByText("Queued Follow-up")).toBeVisible();
  });

  test("opens the asset intake panel from a decision queue action and pre-fills the target directory", async ({
    page,
  }) => {
    const routes = await mockDashboardApis(page);
    let intakePayload: Record<string, unknown> | null = null;
    await routes.setAssetIntakeRoute((payload) => {
      intakePayload = payload;
    });
    await page.goto("/");

    await page.getByRole("button", { name: /Run archive for Blocked Workflow|直接归档 for 阻塞任务|直接归档 for Blocked Workflow/i }).click();
    await expect
      .poll(() => intakePayload, { timeout: 5000 })
      .not.toBeNull();
    expect(intakePayload).toMatchObject({
      action: "organize",
      targetDir: "/Users/liumobei/.openclaw/workspace/content_system/skilltree",
    });
  });

  test("ignores a decision directly from the queue", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/");

    await expect(page.getByText("Blocked Workflow")).toBeVisible();
    await page.getByRole("button", { name: /Ignore for Blocked Workflow|忽略 for 阻塞任务|忽略 for Blocked Workflow/i }).first().click();
    await expect(page.getByText("Blocked Workflow")).toHaveCount(0);
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
    await page.getByTestId("workspace-tab-storage-retrieval").click();
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

  test("creates a short-video sample batch and queues account research", async ({ page }) => {
    const routes = await mockDashboardApis(page);
    let batchPayload: Record<string, unknown> | null = null;
    await routes.setShortVideoBatchRoute((payload) => {
      batchPayload = payload;
    });

    await page.goto("/");
    await page.getByTestId("workspace-tab-short-video-factory").click();
    await page.getByTestId("short-video-factory-panel").getByLabel(/Account name|账号名/).fill("试点账号");
    await page.getByTestId("short-video-factory-panel").getByLabel(/Sample size|样本数/).fill("3");
    await page.getByTestId("short-video-factory-panel").getByLabel(/Sample links|样本链接/).fill(
      "douyin,https://v.douyin.com/demo1/\n" +
        "xiaohongshu,https://www.xiaohongshu.com/explore/demo2\n" +
        "douyin,https://v.douyin.com/demo3/",
    );

    await page.getByRole("button", { name: /Create sample batch|创建样本批次/ }).click();
    await expect(
      page.getByTestId("short-video-factory-panel").getByText(/试点账号的短视频样本批次|Created a short-video sample batch/i),
    ).toBeVisible();
    await expect(
      page.getByTestId("short-video-factory-panel").getByText("/tmp/sample_manifest.json").first(),
    ).toBeVisible();

    expect(batchPayload).toMatchObject({
      accountName: "试点账号",
      sampleSize: 3,
    });
  });

  test("queues account research when a sample batch already exists", async ({ page }) => {
    const controlPlaneState = createControlPlaneState(false);
    controlPlaneState.shortVideoFactory.latestSampleBatch = {
      label: "样本批次",
      path: "/tmp/sample_manifest.json",
      updatedAt: new Date().toISOString(),
    };
    const routes = await mockDashboardApis(page, { controlPlaneState });
    let researchPayload: Record<string, unknown> | null = null;
    await routes.setShortVideoResearchRoute((payload) => {
      researchPayload = payload;
    });

    await page.goto("/");
    await page.getByTestId("workspace-tab-short-video-factory").click();
    await page.getByRole("button", { name: /Run account research|运行账号研究/ }).click();
    await expect
      .poll(() => researchPayload, { timeout: 5000 })
      .not.toBeNull();
    expect(researchPayload).toMatchObject({
      manifestPath: "/tmp/sample_manifest.json",
    });
  });

  test("searches evidence and filters results by evidence level", async ({ page }) => {
    const routes = await mockDashboardApis(page);
    await routes.setStorageSearchRoute();

    await page.goto("/");
    await page.getByTestId("workspace-tab-storage-retrieval").click();
    await page.getByTestId("storage-tab-search").click();
    await page.getByLabel("Search evidence by keyword, path, or tag").fill("资料");
    await page.getByTestId("evidence-search-panel").getByRole("button", { name: "Search" }).click();

    await expect(page.getByText("资料到索引运行案例")).toBeVisible();
    await expect(page.getByText("资料目录规则")).toBeVisible();

    await expect(page.getByText("资料到索引运行案例")).toBeVisible();
    await expect(page.getByText("资料目录规则")).toBeVisible();
  });

  test("opens the community packages workspace", async ({ page }) => {
    const routes = await mockDashboardApis(page);
    await routes.setLocalPackagesRoute();

    await page.goto("/");
    await page.getByTestId("workspace-tab-community-packages").click();

    await expect(page.getByTestId("community-packages-workspace")).toBeVisible();
    await expect(page.getByText(/本地社区包|Local Community Packages/)).toBeVisible();
    await expect(page.getByText("日程规划与冲突检测")).toBeVisible();
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

  test("uses a decision queue action to jump into the asset intake flow", async ({
    page,
  }) => {
    const routes = await mockDashboardApis(page, {
      heartbeat: {
        decisionQueue: [
          {
            id: "blocked:asset-intake",
            priority: "p0",
            title: "Blocked Workflow",
            reason: "Archive workflow is blocked until the target directory is confirmed.",
            nextAction: "Resolve the intake blocker before the next archive run.",
            status: "open",
            evidenceLevel: "runtime",
            relatedTaskId: "task-blocked-asset",
            relatedNodeId: "project_file_organize",
            refs: [
              {
                label: "Target Dir",
                value: "/Volumes/For Win/01_Projects/AI",
                path: "/Volumes/For Win/01_Projects/AI",
              },
            ],
          },
        ],
      },
    });
    let intakePayload: Record<string, unknown> | null = null;
    await routes.setAssetIntakeRoute((payload) => {
      intakePayload = payload;
    });

    await page.goto("/");
    await page.getByRole("button", { name: /Run archive for Blocked Workflow|直接归档 for 阻塞任务|直接归档 for Blocked Workflow/i }).click();
    await expect
      .poll(() => intakePayload, { timeout: 5000 })
      .not.toBeNull();
    expect(intakePayload).toMatchObject({
      action: "organize",
      targetDir: "/Volumes/For Win/01_Projects/AI",
    });
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
