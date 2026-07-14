#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLIST_DIR="${HOME}/Library/LaunchAgents"
LOG_DIR="${HOME}/Library/Logs"
PLIST_PATH="${PLIST_DIR}/place.whatisthis.handy-dandy-deploy.plist"
LABEL="place.whatisthis.handy-dandy-deploy"
USER_DOMAIN="gui/$(id -u)"

mkdir -p "${PLIST_DIR}" "${LOG_DIR}"

cat > "${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${REPO_DIR}/scripts/deploy-production.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>180</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/handy-dandy-deploy.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/handy-dandy-deploy-error.log</string>
</dict>
</plist>
EOF

chmod +x "${REPO_DIR}/scripts/deploy-production.sh"
plutil -lint "${PLIST_PATH}"
launchctl bootout "${USER_DOMAIN}" "${PLIST_PATH}" 2>/dev/null || true
launchctl bootstrap "${USER_DOMAIN}" "${PLIST_PATH}"
launchctl enable "${USER_DOMAIN}/${LABEL}"
launchctl kickstart -k "${USER_DOMAIN}/${LABEL}"

echo "Automatic deployment is installed and checks every 3 minutes."
echo "Deployment log: ${LOG_DIR}/handy-dandy-deploy.log"
echo "Error log:      ${LOG_DIR}/handy-dandy-deploy-error.log"
