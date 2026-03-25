import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CommunityPackageInspection,
  CommunityPackageInstallResult,
  InstalledCommunityPackage,
} from "../types";
import {
  disableLocalPackage,
  enableLocalPackage,
  inspectLocalPackage,
  installLocalPackage,
  listLocalPackages,
  rollbackLocalPackage,
  uninstallLocalPackage,
} from "../services/api";
import { useI18n } from "../i18n";
import { FileUp, FolderOpen, RefreshCcw, ShieldCheck, Undo2 } from "lucide-react";

const panelStyle: React.CSSProperties = {
  background: "var(--panel-surface)",
  border: "1px solid var(--border-color)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "var(--panel-shadow)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-color)",
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  fontSize: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const CommunityPackagesWorkspace = React.memo(function CommunityPackagesWorkspace({
  onOpenPath,
}: {
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [packagePath, setPackagePath] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; contentBase64: string } | null>(null);
  const [inspection, setInspection] = useState<CommunityPackageInspection | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [installResult, setInstallResult] = useState<CommunityPackageInstallResult | null>(null);
  const [packages, setPackages] = useState<InstalledCommunityPackage[]>([]);
  const [error, setError] = useState("");

  const loadPackages = useCallback(async () => {
    try {
      const result = await listLocalPackages();
      setPackages(result.packages);
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const handleInspect = useCallback(async () => {
    try {
      setInspectLoading(true);
      setError("");
      setInstallResult(null);
      const result = await inspectLocalPackage(
        uploadedFile
          ? {
              fileName: uploadedFile.name,
              contentBase64: uploadedFile.contentBase64,
            }
          : {
              packagePath,
            },
      );
      setInspection(result);
    } catch (inspectError) {
      console.error(inspectError);
      setError(inspectError instanceof Error ? inspectError.message : "Failed to inspect package");
    } finally {
      setInspectLoading(false);
    }
  }, [packagePath, uploadedFile]);

  const handleInstall = useCallback(async () => {
    if (!inspection?.packagePath) {
      return;
    }
    try {
      setInstallLoading(true);
      setError("");
      const result = await installLocalPackage({ packagePath: inspection.packagePath });
      setInstallResult(result);
      await loadPackages();
    } catch (installError) {
      console.error(installError);
      setError(installError instanceof Error ? installError.message : "Failed to install package");
    } finally {
      setInstallLoading(false);
    }
  }, [inspection?.packagePath, loadPackages]);

  return (
    <div
      className="rounded-[1.35rem] border p-4 space-y-4"
      style={{
        background: "var(--panel-surface)",
        borderColor: "var(--border-color)",
        boxShadow: "var(--panel-shadow)",
      }}
      data-testid="community-packages-workspace"
    >
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("packages.title")}
        </div>
        <div className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
          {t("packages.subtitle")}
        </div>
      </div>

      <div className="rounded-[1.2rem] border p-4 space-y-4" style={{ backgroundColor: "var(--panel-surface-soft)", borderColor: "var(--border-color)" }}>
        <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
          {t("packages.inspect.title")}
        </div>
        <input
          value={packagePath}
          onChange={(event) => setPackagePath(event.target.value)}
          placeholder={t("packages.inspect.pathPlaceholder")}
          style={inputStyle}
          aria-label={t("packages.inspect.pathLabel")}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-2"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <FileUp className="h-3.5 w-3.5" />
            {t("packages.inspect.upload")}
          </button>
          {uploadedFile ? (
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {uploadedFile.name}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleInspect}
            disabled={inspectLoading || (!packagePath.trim() && !uploadedFile)}
            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: "rgba(59, 130, 246, 0.12)", borderColor: "var(--node-run-border)", color: "var(--text-primary)" }}
          >
            {inspectLoading ? t("packages.inspect.inspecting") : t("packages.inspect.action")}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            setUploadedFile({
              name: file.name,
              contentBase64: await toBase64(file),
            });
          }}
        />
        {error ? (
          <div className="rounded-xl border px-3 py-3 text-[12px]" style={{ borderColor: "rgba(239, 68, 68, 0.35)", color: "var(--node-err-text)" }}>
            {error}
          </div>
        ) : null}
        {inspection ? (
          <div className="rounded-xl border px-4 py-4 space-y-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-primary)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {inspection.manifest.name}
                </div>
                <div className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  {inspection.manifest.packageId} · v{inspection.manifest.version}
                </div>
              </div>
              <span
                className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase"
                style={{
                  borderColor: inspection.success ? "rgba(52, 211, 153, 0.4)" : "rgba(239, 68, 68, 0.35)",
                  color: inspection.success ? "#34D399" : "var(--node-err-text)",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                {inspection.success ? t("packages.inspect.valid") : t("packages.inspect.invalid")}
              </span>
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {inspection.manifest.description}
            </div>
            {inspection.onboarding.available ? (
              <div className="rounded-lg border px-3 py-3 space-y-2" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                  Onboarding
                </div>
                <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                  {inspection.onboarding.title}
                </div>
                {inspection.onboarding.description ? (
                  <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {inspection.onboarding.description}
                  </div>
                ) : null}
                <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {inspection.onboarding.steps.length} steps · {inspection.onboardingState.pendingRequiredSteps} required pending · source: {inspection.onboarding.source}
                </div>
                <div className="space-y-2">
                  {inspection.onboarding.steps.map((step) => (
                    <div key={step.id} className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-primary)" }}>
                      <div style={{ color: "var(--text-primary)" }}>
                        {step.required ? "[required] " : "[optional] "}
                        {step.title}
                      </div>
                      {step.description ? (
                        <div style={{ color: "var(--text-secondary)" }}>
                          {step.description}
                        </div>
                      ) : null}
                      {(step.command || step.installUrl || step.docPath) ? (
                        <div style={{ color: "var(--text-secondary)" }}>
                          {[step.command, step.installUrl, step.docPath].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                  {t("packages.inspect.permissions")}
                </div>
                <div className="mt-2 space-y-2">
                  {inspection.manifest.permissions.map((permission) => (
                    <div key={permission.key} className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                      <div style={{ color: "var(--text-primary)" }}>{permission.key}</div>
                      <div style={{ color: "var(--text-secondary)" }}>{permission.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                  {t("packages.inspect.dependencies")}
                </div>
                <div className="mt-2 space-y-2">
                  {inspection.manifest.dependencies.length > 0 ? inspection.manifest.dependencies.map((dependency) => (
                    <div key={dependency.id} className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                      <div style={{ color: "var(--text-primary)" }}>{dependency.label}</div>
                      <div style={{ color: "var(--text-secondary)" }}>{dependency.id}</div>
                    </div>
                  )) : (
                    <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      {t("packages.inspect.noDependencies")}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {inspection.validationIssues.length > 0 ? (
              <div className="rounded-lg border px-3 py-3 text-[11px]" style={{ borderColor: "rgba(239, 68, 68, 0.35)", color: "var(--node-err-text)" }}>
                {inspection.validationIssues.join(" · ")}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenPath(inspection.packagePath, { reveal: true })}
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-2"
                style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t("packages.inspect.reveal")}
              </button>
              <button
                type="button"
                onClick={handleInstall}
                disabled={!inspection.success || installLoading}
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-2"
                style={{ backgroundColor: "rgba(59, 130, 246, 0.12)", borderColor: "var(--node-run-border)", color: "var(--text-primary)" }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {installLoading ? t("packages.install.installing") : t("packages.install.action")}
              </button>
            </div>
            {installResult ? (
              <div className="rounded-lg border px-3 py-3 text-[11px] space-y-1" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                <div style={{ color: "var(--text-primary)" }}>
                  Installed {installResult.packageId} v{installResult.version}
                </div>
                <div>
                  Onboarding phase: {installResult.onboardingState.phase} · {installResult.onboardingState.pendingRequiredSteps} required pending
                </div>
                <div>
                  Install state: {installResult.installState.installed ? "installed" : "unknown"} ·
                  {" "}
                  {installResult.installState.versionStatus || "status unavailable"} ·
                  {" "}
                  active {installResult.installState.activeVersion || "-"}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-[1.2rem] border p-4 space-y-4" style={{ backgroundColor: "var(--panel-surface-soft)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
            {t("packages.installed.title")}
          </div>
          <button
            type="button"
            onClick={() => void loadPackages()}
            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-2"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {t("packages.installed.refresh")}
          </button>
        </div>
        <div className="space-y-3">
          {packages.length > 0 ? packages.map((pkg) => (
            <div key={pkg.packageId} className="rounded-xl border px-4 py-4" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-primary)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {pkg.name}
                  </div>
                  <div className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
                    {pkg.packageId} · {t("packages.installed.activeVersion", { version: pkg.activeVersion || "-" })}
                  </div>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  {pkg.type}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {pkg.installedVersions.map((version) => (
                  <div key={`${pkg.packageId}-${version.version}`} className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                        v{version.version} · {version.status}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await enableLocalPackage({ packageId: pkg.packageId, version: version.version });
                            await loadPackages();
                          }}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                          style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "transparent" }}
                        >
                          {t("packages.installed.enable")}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await disableLocalPackage({ packageId: pkg.packageId, version: version.version });
                            await loadPackages();
                          }}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                          style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "transparent" }}
                        >
                          {t("packages.installed.disable")}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await rollbackLocalPackage({ packageId: pkg.packageId, targetVersion: version.version });
                            await loadPackages();
                          }}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold inline-flex items-center gap-1"
                          style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "transparent" }}
                        >
                          <Undo2 className="h-3 w-3" />
                          {t("packages.installed.rollback")}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await uninstallLocalPackage({ packageId: pkg.packageId, version: version.version });
                            await loadPackages();
                          }}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                          style={{ borderColor: "rgba(239, 68, 68, 0.35)", color: "var(--node-err-text)", backgroundColor: "transparent" }}
                        >
                          {t("packages.installed.uninstall")}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {version.installPath}
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {(version.distributionChannel || pkg.distributionChannel || "local-file") +
                        (version.releaseUrl ? ` · ${version.releaseUrl}` : "")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPath(version.manifestPath)}
                        className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "transparent" }}
                      >
                        {t("packages.installed.openManifest")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPath(version.installPath, { reveal: true })}
                        className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", backgroundColor: "transparent" }}
                      >
                        {t("packages.installed.revealInstall")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {t("packages.installed.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
