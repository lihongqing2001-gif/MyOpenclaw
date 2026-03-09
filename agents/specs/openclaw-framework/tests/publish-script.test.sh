#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCRIPT_PATH="${ROOT_DIR}/publish-script.sh"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

if [ ! -x "${SCRIPT_PATH}" ]; then
  fail "publish-script.sh is not executable"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

pkg_dir="${tmp_dir}/capability"
mkdir -p "${pkg_dir}"

cat <<'JSON' > "${pkg_dir}/capability-manifest.json"
{
  "id": "cap.acme.analytics.demo",
  "name": "Demo Capability",
  "version": "1.2.3",
  "description": "Test capability",
  "domain": "analytics",
  "category": "demo",
  "tags": ["demo"],
  "ownership": "acme",
  "publish": "clawhub",
  "dependencies": [],
  "requires": ">=0.1.0",
  "skills": [],
  "sops": [],
  "install": "./install.sh",
  "healthcheck": "./healthcheck.sh",
  "outputs": []
}
JSON

touch "${pkg_dir}/README.md"

tar_name="cap.acme.analytics.demo-1.2.3.tgz"
checksum_path="${tmp_dir}/outputs/publish/cap.acme.analytics.demo-1.2.3.checksum.txt"

(
  cd "${tmp_dir}"
  "${SCRIPT_PATH}" "${pkg_dir}" > /dev/null
)

if [ ! -f "${tmp_dir}/${tar_name}" ]; then
  fail "archive ${tar_name} not created"
fi

if [ ! -f "${checksum_path}" ]; then
  fail "checksum file not created"
fi

read -r archive checksum < "${checksum_path}"
if [ "${archive}" != "${tar_name}" ]; then
  fail "checksum file archive mismatch"
fi

expected_checksum="$(shasum -a 256 "${tmp_dir}/${tar_name}" | awk '{print $1}')"
if [ "${checksum}" != "${expected_checksum}" ]; then
  fail "checksum mismatch"
fi

bad_pkg_dir="${tmp_dir}/bad-capability"
mkdir -p "${bad_pkg_dir}"

set +e
(
  cd "${tmp_dir}"
  "${SCRIPT_PATH}" "${bad_pkg_dir}" > /dev/null 2>&1
)
status=$?
set -e

if [ "${status}" -eq 0 ]; then
  fail "script should fail without capability-manifest.json"
fi

echo "OK"
