import argparse
import subprocess
import os
import re

class MySkillInstaller:
    def __init__(self, skill_id, perform_test=True, report_format="markdown", force_install=False):
        self.skill_id = skill_id
        self.perform_test = perform_test
        self.report_format = report_format
        self.force_install = force_install # New parameter
        self.installed_skill_path = None
        self.report = {
            "skill_name": skill_id,
            "installation_status": "Failed",
            "description": "N/A",
            "commands": [],
            "test_results": [],
            "configuration_needs": [],
            "recommendations": []
        }

    def _run_command(self, command, input_data=None, capture_output=True):
        try:
            process = subprocess.run(
                command,
                shell=True,
                capture_output=capture_output,
                text=True,
                input=input_data,
                check=False
            )
            return process.stdout.strip(), process.stderr.strip()
        except subprocess.CalledProcessError as e:
            return e.stdout.strip(), e.stderr.strip()
        except Exception as e:
            return "", str(e)

    def install_skill(self):
        print(f"📦 Installing skill: {self.skill_id}")
        install_command = f"npx clawhub@latest install {self.skill_id}"
        if self.force_install:
            install_command += " --force"
        
        stdout, stderr = self._run_command(install_command, input_data="y\n", capture_output=True)

        # Re-ordered and refined logic for installation status
        # Priority 1: Successful installation (checking stderr first now)
        if "OK. Installed" in stderr: # Changed to check stderr first
            self.report["installation_status"] = "Success"
            match = re.search(r"OK\. Installed .* -> (.*)", stderr) # Extract path from stderr
            if match:
                self.installed_skill_path = match.group(1).strip()
                self.report["skill_name"] = os.path.basename(self.installed_skill_path)
            print(f"✅ Successfully installed {self.skill_id} to {self.installed_skill_path}")
            return True
        # Priority 2: Already installed (checking stderr or stdout)
        elif "Already installed" in stderr or "Already installed" in stdout:
            self.report["installation_status"] = "Already Installed"
            match = re.search(r"Already installed: (.*?) \(", stderr + stdout)
            if match:
                self.installed_skill_path = match.group(1).strip()
                self.report["skill_name"] = os.path.basename(self.installed_skill_path)
            print(f"ℹ️ Skill {self.skill_id} is already installed at {self.installed_skill_path}. Skipping re-installation.")
            return True
        # Priority 3: Any other failure
        else:
            self.report["installation_status"] = "Failed"
            self.report["test_results"].append(f"Installation Error: {stderr or stdout}")
            print(f"❌ Failed to install {self.skill_id}. Error: {stderr or stdout}")
            return False

    def read_skill_md(self):
        if not self.installed_skill_path:
            return

        skill_md_path = os.path.join(self.installed_skill_path, "SKILL.md")
        if not os.path.exists(skill_md_path):
            skill_md_path = os.path.join(self.installed_skill_path, os.path.basename(self.installed_skill_path), "SKILL.md")
            if not os.path.exists(skill_md_path):
                print(f"⚠️ SKILL.md not found in {self.installed_skill_path}")
                return

        with open(skill_md_path, 'r', encoding='utf-8') as f:
            content = f.read()
            self.report["description"] = self._extract_description(content)
            self.report["commands"] = self._extract_commands(content)
        print(f"📖 Read SKILL.md for {self.report['skill_name']}")

    def _extract_description(self, md_content):
        match = re.search(r"description: \"(.*?)\"", md_content)
        if match:
            return match.group(1)
        return md_content.split('---')[2].strip().split('\n')[0] if len(md_content.split('---')) > 2 else "No description found."

    def _extract_commands(self, md_content):
        extracted_commands = []

        commands_section_match = re.search(r"## Commands(.*?)((## |\Z))", md_content, re.DOTALL)
        if commands_section_match:
            commands_text = commands_section_match.group(1)
            command_pattern = re.compile(r"### (/\S+)(.*?)(```.*?```)", re.DOTALL)
            matches = command_pattern.findall(commands_text)
            for name, desc, usage in matches:
                extracted_commands.append({
                    "name": name.strip(),
                    "description": desc.strip(),
                    "usage_example": usage.strip()
                })
        
        if not extracted_commands:
            command_ref_section_match = re.search(r"## Command Reference(.*?)((## |\Z))", md_content, re.DOTALL)
            scheduling_rules_section_match = re.search(r"## Scheduling Rules(.*?)((## |\Z))", md_content, re.DOTALL)
            
            sections_to_check = []
            if command_ref_section_match:
                sections_to_check.append(command_ref_section_match.group(1))
            if scheduling_rules_section_match:
                sections_to_check.append(scheduling_rules_section_match.group(1))
            
            for section_text in sections_to_check:
                code_blocks = re.findall(r"```(?:bash|sh|txt)\n(.*?)\n```", section_text, re.DOTALL)
                for block in code_blocks:
                    if block.strip().startswith("openclaw cron add") or block.strip().startswith("openclaw cron add"):
                        extracted_commands.append({
                            "name": "Cron Command Example",
                            "description": "Example cron command found in SKILL.md",
                            "usage_example": block.strip()
                        })
                    elif block.strip().startswith("openclaw cron list") or block.strip().startswith("openclaw cron run"):
                         extracted_commands.append({
                            "name": "Cron Management Command",
                            "description": "Example cron management command found in SKILL.md",
                            "usage_example": block.strip()
                        })
                    elif block.strip().startswith("./scripts/") and "send.sh" in block.strip():
                        extracted_commands.append({
                            "name": "Script Execution Example",
                            "description": "Example script execution found in SKILL.md",
                            "usage_example": block.strip()
                        })

        return extracted_commands

    def perform_preliminary_tests(self):
        if not self.perform_test or not self.installed_skill_path:
            return

        print(f"🔬 Performing preliminary tests for {self.report['skill_name']}...")
        scripts_dir = os.path.join(self.installed_skill_path, "scripts")
        if not os.path.isdir(scripts_dir):
            scripts_dir = os.path.join(self.installed_skill_path, os.path.basename(self.installed_skill_path), "scripts")
            if not os.path.isdir(scripts_dir):
                self.report["test_results"].append("No 'scripts' directory found for testing.")
                
        sh_scripts = []
        if os.path.isdir(scripts_dir):
            sh_scripts = [f for f in os.listdir(scripts_dir) if f.endswith(".sh")]

        for script in sh_scripts:
            script_path = os.path.join(scripts_dir, script)
            if not os.access(script_path, os.X_OK):
                print(f"    ➕ Adding execute permission to {script}...")
                stdout, stderr = self._run_command(f"chmod +x {script_path}")
                if stderr:
                    self.report["test_results"].append(f"Failed to chmod +x {script_path}: {stderr}")
                else:
                    self.report["test_results"].append(f"Added execute permission to {script_path}.")

        test_commands = []
        if os.path.exists(os.path.join(scripts_dir, "status.sh")):
            test_commands.append(os.path.join(scripts_dir, "status.sh"))
        if os.path.exists(os.path.join(scripts_dir, "help.sh")):
            test_commands.append(os.path.join(scripts_dir, "help.sh"))
        
        main_script = os.path.join(self.installed_skill_path, "index.js")
        if os.path.exists(main_script):
            test_commands.append(f"node {main_script} status")
            test_commands.append(f"node {main_script} help")
        
        main_script_py = os.path.join(self.installed_skill_path, "main.py")
        if os.path.exists(main_script_py):
            test_commands.append(f"python3 {main_script_py} status")
            test_commands.append(f"python3 {main_script_py} help")

        if not test_commands and sh_scripts:
            test_commands.append(os.path.join(scripts_dir, sh_scripts[0]))

        for cmd in test_commands:
            print(f"    ▶️ Running test command: {cmd}")
            stdout, stderr = self._run_command(cmd)
            self.report["test_results"].append(f"Command: `{cmd}`\n  STDOUT: {stdout}\n  STDERR: {stderr}")
            
            if "not configured" in stdout.lower() or "missing environment variables" in stdout.lower():
                self.report["configuration_needs"].append(f"Skill likely needs configuration based on output from `{cmd}`: {stdout}")
            if "FRESHRSS_URL" in stdout or "GOTIFY_URL" in stdout or "BACKUP_REPO" in stdout:
                 self.report["configuration_needs"].append(f"Environment variables/config file detected: {stdout}")

            if "usage:" in stdout.lower() or "configured" in stdout.lower() or "version" in stdout.lower():
                break
        
        if self.report["commands"]:
            self.report["test_results"].append(f"Found {len(self.report['commands'])} commands in SKILL.md. Manual testing recommended for specific command functionality.")
        else:
            self.report["test_results"].append("No specific commands found in SKILL.md to test automatically.")

        print("✅ Preliminary tests complete.")

    def generate_report(self):
        if self.report_format == "markdown":
            return self._generate_markdown_report()
        elif self.report_format == "json":
            import json
            return json.dumps(self.report, indent=2, ensure_ascii=False)
        return "Unsupported report format."

    def _generate_markdown_report(self):
        report_str = f"# 📦 Skill Installation Report: {self.report['skill_name']}\n\n"
        report_str += f"## Installation Status: {self.report['installation_status']}\n\n"
        
        if self.report["description"]:
            report_str += f"## Description\n{self.report['description']}\n\n"

        if self.report["commands"]:
            report_str += "## Commands\n"
            for cmd in self.report["commands"]:
                report_str += f"- **{cmd['name']}**: {cmd['description']}\n"
                report_str += f"  ```\n{cmd['usage_example']}\n  ```\n"
            report_str += "\n"

        if self.perform_test:
            report_str += "## Preliminary Test Results\n"
            if not self.report["test_results"]:
                report_str += "No specific test commands executed or output captured.\n"
            else:
                for result in self.report["test_results"]:
                    report_str += f"- {result}\n"
            report_str += "\n"

            if self.report["configuration_needs"]:
                report_str += "## Identified Configuration Needs\n"
                for need in self.report["configuration_needs"]:
                    report_str += f"- {need}\n"
                report_str += "\n"
            else:
                report_str += "## Identified Configuration Needs\nNo specific configuration needs detected from preliminary tests. Refer to SKILL.md for full setup.\n\n"

            if self.report["recommendations"]:
                report_str += "## Recommendations\n"
                for rec in self.report["recommendations"]:
                    report_str += f"- {rec}\n"
                report_str += "\n"
            else:
                report_str += "## Recommendations\nConsult the skill's `SKILL.md` or `README.md` for detailed usage and full configuration.\n\n"
        
        return report_str

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automate OpenClaw skill installation and testing.")
    parser.add_argument("skill_id", help="The slug or GitHub repository URL of the skill to install.")
    parser.add_argument("--perform_test", type=lambda x: x.lower() == 'true', default=True,
                        help="Whether to perform preliminary tests after installation. Defaults to true.")
    parser.add_argument("--report_format", default="markdown",
                        help="The desired format for the report (e.g., 'markdown', 'json'). Defaults to 'markdown'.")
    parser.add_argument("--force_install", type=lambda x: x.lower() == 'true', default=False,
                        help="Whether to force installation of suspicious skills. Defaults to false.")
    
    args = parser.parse_args()

    installer = MySkillInstaller(args.skill_id, args.perform_test, args.report_format, args.force_install)
    
    if installer.install_skill():
        installer.read_skill_md()
        installer.perform_preliminary_tests()
    
    report = installer.generate_report()
    print(report)
