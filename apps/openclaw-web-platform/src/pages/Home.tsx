import { Button } from "@/components/ui/button";
import {
  Terminal,
  Layers,
  ShieldCheck,
  Download,
  ArrowRight,
  Cpu,
  Globe,
  Lock,
  Workflow,
  CheckCircle2,
  Copy,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useState } from "react";

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

function CopyCommand({
  label,
  command,
  hint,
}: {
  label: string;
  command: string;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#08101d]/80 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <div className="text-xs text-slate-500">{hint}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => {
            void copyText(command);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-white/8 bg-black/30 p-3 text-sm text-blue-300 font-mono whitespace-pre-wrap">
        <code>{command}</code>
      </pre>
    </div>
  );
}

const ParticleField = () => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 15,
      size: 2 + Math.random() * 4,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute bottom-[-10%] rounded-full bg-blue-400/30 blur-[1px]"
          style={{
            left: `${particle.x}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: ["0vh", "-120vh"],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

export function Home() {
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const [heroCopied, setHeroCopied] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] selection:bg-blue-500/30 font-sans">
      <section className="relative min-h-[95vh] flex items-center pt-24 pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0 flex justify-center pointer-events-none">
          <motion.div
            animate={{ opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 w-[800px] h-[1000px] bg-gradient-to-b from-blue-600/10 via-blue-900/5 to-transparent blur-[100px]"
          />
          <motion.div
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-0 w-[300px] h-[800px] bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent blur-[80px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
          <ParticleField />
        </div>

        <div className="container mx-auto px-4 z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
              }}
              className="max-w-2xl relative"
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  Forge product line is live
                </div>
              </motion.div>

              <motion.h1
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 leading-[1.05]"
              >
                The local-first <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">
                  package control plane.
                </span>
              </motion.h1>

              <motion.p
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                className="text-lg text-slate-400 mb-10 leading-relaxed max-w-xl"
              >
                Use SoloCore Hub to discover reviewed packages, manage submissions, and distribute signed downloads, while SoloCore Console keeps execution, assets, and resident-agent workflows safely local.
              </motion.p>

              <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                className="flex flex-col sm:flex-row items-center gap-4 mb-12"
              >
                <Link to="/downloads" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full h-12 px-8 text-base gap-2 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-[0_0_30px_rgba(37,99,235,0.25)] hover:shadow-[0_0_40px_rgba(37,99,235,0.4)] transition-all duration-300">
                    <Download className="w-4 h-4" />
                    Browse Downloads
                  </Button>
                </Link>
                <Link to="/community" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full h-12 px-8 text-base gap-2 border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-slate-200 backdrop-blur-md transition-all duration-300">
                    <Layers className="w-4 h-4" />
                    Explore Registry
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="bg-[#050810]/80 backdrop-blur-xl border border-white/10 rounded-lg p-4 flex items-center justify-between group max-w-md shadow-2xl relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <code className="text-sm font-mono text-slate-300 relative z-10">
                  <span className="text-blue-500 select-none">~ </span>
                  forge export --publish reviewed-package.zip
                </code>
                <button
                  className="text-slate-500 hover:text-slate-200 transition-colors relative z-10"
                  onClick={() => {
                    void copyText("forge export --publish reviewed-package.zip");
                    setHeroCopied(true);
                    window.setTimeout(() => setHeroCopied(false), 1600);
                  }}
                >
                  <Copy className="w-4 h-4" />
                </button>
                {heroCopied && <span className="absolute right-12 top-4 text-[10px] text-emerald-400 font-mono">Copied</span>}
              </motion.div>
            </motion.div>

            <motion.div
              style={{ y: yParallax }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5, delay: 0.3 }}
              className="relative hidden lg:block h-[650px] w-full"
            >
              <div className="absolute left-1/2 top-[80px] bottom-[120px] -translate-x-1/2 w-[2px] bg-gradient-to-b from-blue-500/10 via-blue-500/30 to-blue-500/10">
                <motion.div
                  animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "circInOut" }}
                  className="absolute left-1/2 -translate-x-1/2 w-[4px] h-32 bg-gradient-to-b from-transparent via-cyan-400 to-transparent blur-[2px]"
                />
              </div>

              <motion.div
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-72 bg-[#0a0e17]/80 backdrop-blur-2xl border border-white/10 rounded-xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] z-20"
              >
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5 pointer-events-none" />
                <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">SoloCore Hub</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Reviewed registry</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-8 rounded bg-white/[0.03] border border-white/5 flex items-center px-3 gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-mono text-slate-400">official packages</span>
                  </div>
                  <div className="h-8 rounded bg-white/[0.03] border border-white/5 flex items-center px-3 gap-2 relative overflow-hidden">
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                    />
                    <Activity className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-mono text-slate-400">community review queue</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [5, -5, 5] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 bg-[#0a0e17]/80 backdrop-blur-2xl border border-white/10 rounded-xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] z-20"
              >
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5 pointer-events-none" />
                <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">SoloCore Console</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">127.0.0.1:3000</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/40 rounded border border-white/5 p-2 relative overflow-hidden">
                    <div className="text-[10px] text-slate-500 mb-1">Status</div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Ready
                    </div>
                  </div>
                  <div className="bg-black/40 rounded border border-white/5 p-2">
                    <div className="text-[10px] text-slate-500 mb-1">Privacy</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Lock className="w-3 h-3 text-slate-400" /> Local-first
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [-15, 15, -15], rotate: [-1, 1, -1] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/3 -left-16 bg-[#0a0e17]/60 backdrop-blur-xl border border-white/10 rounded-lg p-3 flex items-center gap-3 shadow-2xl z-10"
              >
                <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20">
                  <Workflow className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-200">SOP Execution</div>
                  <div className="text-[10px] font-mono text-slate-500">Local agent</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [15, -15, 15], rotate: [1, -1, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-1/2 -right-12 bg-[#0a0e17]/60 backdrop-blur-xl border border-white/10 rounded-lg p-3 flex items-center gap-3 shadow-2xl z-10"
              >
                <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                  <Cpu className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-200">Signed delivery</div>
                  <div className="text-[10px] font-mono text-slate-500">Review + GitHub sync</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 relative border-b border-white/5">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6">
              One ecosystem. Two powerful engines.
            </h2>
            <p className="text-slate-400 text-lg">
              SoloCore Hub separates discovery from execution. Find capabilities on the public registry, then run them securely on your own hardware via SoloCore Console.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7 }}
              whileHover={{ y: -5 }}
              className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.04] transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">SoloCore Hub</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                The public registry for reusable packages. Discover official releases, review community submissions, and distribute signed downloads.
              </p>
              <ul className="space-y-3 text-sm text-slate-300 font-mono">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Official Package Registry</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Security Review Pipeline</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Signed Distribution Links</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2 }}
              whileHover={{ y: -5 }}
              className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.04] transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Terminal className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">SoloCore Console</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                Your private local control plane. Import packages from the web, manage local assets, and orchestrate AI agents without sending data to the cloud.
              </p>
              <ul className="space-y-3 text-sm text-slate-300 font-mono">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Local-First Execution</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Asset & Secret Management</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Local Agent Orchestration</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-28 relative border-b border-white/5 bg-[#050810]">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6"
          >
            <div className="max-w-3xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
                Install and initialize OpenClaw the official way.
              </h2>
              <p className="text-slate-400 text-lg">
                For beginners, the safest path is still the official installer plus the onboarding wizard. We surface the exact baseline commands here so you can get OpenClaw running first, then come back to SoloCore Hub for packages.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="https://docs.openclaw.ai/install" target="_blank" rel="noreferrer">
                <Button variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-white gap-2">
                  Official Install Docs <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="https://docs.openclaw.ai/start/wizard" target="_blank" rel="noreferrer">
                <Button variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-white gap-2">
                  Onboarding Wizard <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <CopyCommand
                label="macOS / Linux / WSL2"
                command={`curl -fsSL https://openclaw.ai/install.sh | bash`}
                hint="Official installer script. Detects OS, installs Node if needed, installs OpenClaw, then launches onboarding."
              />
              <CopyCommand
                label="Windows (PowerShell)"
                command={`iwr -useb https://openclaw.ai/install.ps1 | iex`}
                hint="Official PowerShell installer flow for native Windows."
              />
              <CopyCommand
                label="Onboarding Wizard"
                command={`openclaw onboard`}
                hint="Recommended first-run setup. Creates the local gateway, workspace defaults, and guided provider setup."
              />
              <CopyCommand
                label="Verify the install"
                command={`openclaw --version\nopenclaw doctor\nopenclaw gateway status`}
                hint="Use these checks to confirm the CLI is available and the gateway is healthy."
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-semibold text-white mb-5">Beginner initialization flow</h3>
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 font-mono text-xs">1</div>
                    <div>
                      <strong className="text-slate-100 block mb-1">Install OpenClaw first</strong>
                      Run the official installer script. On Windows, use the PowerShell command from the official install page.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700 font-mono text-xs">2</div>
                    <div>
                      <strong className="text-slate-100 block mb-1">Run the onboarding wizard</strong>
                      Choose the default local setup, keep the loopback gateway, and let OpenClaw create a safe first-run config.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700 font-mono text-xs">3</div>
                    <div>
                      <strong className="text-slate-100 block mb-1">Configure your model provider</strong>
                      During onboarding, paste the provider key you want to use. If you skip it, you can re-open config later with <code className="font-mono text-blue-300">openclaw configure</code>.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700 font-mono text-xs">4</div>
                    <div>
                      <strong className="text-slate-100 block mb-1">Start your first chat and validate health</strong>
                      The official quick path is <code className="font-mono text-blue-300">openclaw dashboard</code> for the first browser chat, then <code className="font-mono text-blue-300">openclaw doctor</code> if anything feels off.
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-blue-300 mb-3">Why this is on the homepage</h4>
                <p className="text-sm text-blue-100/80 leading-relaxed">
                  SoloCore Hub is where people discover reviewed packages, but OpenClaw itself still needs to be installed and initialized first. Once the official baseline is working, users can download SoloCore Console and start importing packages from Community.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 relative border-b border-white/5 bg-[#050810]">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6"
          >
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
                A modular capability network.
              </h2>
              <p className="text-slate-400 text-lg">
                Import reviewed packages to instantly give your local operators new skills, SOPs, tutorials, and workflow modules.
              </p>
            </div>
            <Link to="/community">
              <Button variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-white gap-2 transition-colors">
                Browse Registry <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              className="md:col-span-2 bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-8 hover:border-cyan-500/30 transition-colors duration-300"
            >
              <Workflow className="w-8 h-8 text-cyan-400 mb-6" />
              <h3 className="text-xl font-semibold text-white mb-2">Standard Operating Procedures</h3>
              <p className="text-slate-400 max-w-md">
                Download complex, multi-step workflows defined by experts. From planning systems to content pipelines, run them locally after review.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-8 hover:border-blue-500/30 transition-colors duration-300"
            >
              <Cpu className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-semibold text-white mb-2">Agent Skills</h3>
              <p className="text-slate-400">
                Plug-and-play tools for local agents. Give them access to files, network integrations, or runtime APIs with explicit permissions.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-8 hover:border-indigo-500/30 transition-colors duration-300"
            >
              <Layers className="w-8 h-8 text-indigo-400 mb-6" />
              <h3 className="text-xl font-semibold text-white mb-2">Demos & Tutorials</h3>
              <p className="text-slate-400">
                Learn by installing examples that teach teams how to publish and operate their own package libraries.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="md:col-span-2 bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
            >
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Ready to contribute?</h3>
                <p className="text-slate-400">Build your own package bundle and send it to the review queue.</p>
              </div>
              <Link to="/submit" className="w-full sm:w-auto">
                <Button className="w-full bg-white text-black hover:bg-slate-200 transition-colors">Submit Package</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
