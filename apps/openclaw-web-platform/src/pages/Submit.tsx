import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Info, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSubmission, validateSubmissionPackage } from "@/lib/api";
import { usePlatform } from "@/lib/platform";

export function Submit() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<null | {
    packageId: string;
    name: string;
    version: string;
    type: string;
    description: string;
    capabilities: number;
    dependencies: number;
    permissions: number;
    docs: number;
  }>(null);
  const { session } = usePlatform();
  const navigate = useNavigate();

  async function handleSubmit() {
    if (!file || !session?.csrfToken) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await createSubmission(file, session.csrfToken);
      setMessage(`Submission created for ${response.packageId}.`);
      navigate("/me");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Failed to submit package");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidate() {
    if (!file || !session?.csrfToken) {
      return;
    }
    setValidating(true);
    setMessage("");
    try {
      const result = await validateSubmissionPackage(file, session.csrfToken);
      setValidation(result.manifest);
      setMessage(`Validated ${result.manifest.packageId}.`);
    } catch (cause) {
      setValidation(null);
      setMessage(cause instanceof Error ? cause.message : "Failed to validate package");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Link to="/community" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Community
      </Link>

      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Submit a Package</h1>
        <p className="text-slate-400">Upload a reviewed-ready package bundle from SoloCore Console and send it into the moderation pipeline.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-xl">Package Archive</CardTitle>
              <CardDescription>Select the exported community package zip you want to publish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="package-file" className="text-sm font-medium text-slate-300">Community package zip <span className="text-red-500">*</span></label>
                <input
                  id="package-file"
                  type="file"
                  accept=".zip"
                  className="flex w-full rounded-md border border-slate-800 bg-[#0a0e17] px-3 py-3 text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-200"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <p className="text-xs text-slate-500">The archive must contain a valid <code className="font-mono">community-package.json</code> manifest.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Selected file</label>
                <div className="rounded-md border border-slate-800 bg-[#0a0e17] px-3 py-3 text-sm text-slate-300">
                  {file ? file.name : "No file selected yet"}
                </div>
              </div>
              {validation && (
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-100">
                  <div className="font-semibold mb-2">Manifest looks valid</div>
                  <div className="space-y-1 text-emerald-100/80">
                    <div>{validation.name} · {validation.version}</div>
                    <div className="font-mono text-xs">{validation.packageId}</div>
                    <div>{validation.capabilities} capabilities · {validation.dependencies} dependencies · {validation.permissions} permissions · {validation.docs} docs</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-xl">Manifest Validation</CardTitle>
              <CardDescription>SoloCore Hub parses the archive manifest before the submission enters review.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-[#0a0e17] border border-slate-800 rounded-lg p-6 text-center border-dashed">
                <UploadCloud className="w-10 h-10 text-slate-500 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-slate-300 mb-2">Ready to validate</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                  Upload the exact zip exported from SoloCore Console so the package contract, permissions, and docs can be reviewed together.
                </p>
                <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" disabled={!file || validating} onClick={() => void handleValidate()}>
                  {validating ? "Validating..." : "Validate Manifest"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {message && (
            <div className="rounded-md border border-slate-800 bg-[#0a0e17] px-4 py-3 text-sm text-slate-300">
              {message}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => navigate("/community")}>Cancel</Button>
            <Button className="gap-2 shadow-sm shadow-blue-900/20" disabled={!file || submitting} onClick={() => void handleSubmit()}>
              {submitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Submission Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-400">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 font-mono text-xs">1</div>
                <div>
                  <strong className="text-slate-200 block mb-1">Upload Export</strong>
                  Send the package archive generated by SoloCore Console.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 border border-slate-700 font-mono text-xs">2</div>
                <div>
                  <strong className="text-slate-200 block mb-1">Manifest Parse</strong>
                  SoloCore Hub checks the package contract and validates the archive layout.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 border border-slate-700 font-mono text-xs">3</div>
                <div>
                  <strong className="text-slate-200 block mb-1">Manual Review</strong>
                  Reviewers inspect permissions, docs, and intended runtime behavior.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 border border-slate-700 font-mono text-xs">4</div>
                <div>
                  <strong className="text-slate-200 block mb-1">Published</strong>
                  Approved packages become visible in community listings and package detail pages.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-900/30 bg-amber-900/10">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200/80">
                <strong className="text-amber-400 block mb-1">Security Notice</strong>
                Packages with misleading permissions, broken manifests, or unsafe runtime behavior should not be submitted.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
