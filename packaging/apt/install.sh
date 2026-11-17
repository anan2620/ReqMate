#!/bin/bash
# ReqMate APT repository installer
# Usage: curl -fsSL https://anan2620.github.io/reqmate-apt/install.sh | sudo bash

set -euo pipefail

REPO_URL="https://anan2620.github.io/reqmate-apt"
KEYRING="/usr/share/keyrings/reqmate-archive-keyring.gpg"
LIST="/etc/apt/sources.list.d/reqmate.list"

echo "Adding ReqMate APT repository..."

# Download and install GPG key
curl -fsSL "${REPO_URL}/gpg-key.gpg" | gpg --dearmor -o "${KEYRING}"

# Add repository
echo "deb [signed-by=${KEYRING}] ${REPO_URL} stable main" > "${LIST}"

# Update and install
apt-get update -o Dir::Etc::sourcelist="${LIST}" -o Dir::Etc::sourceparts="-" -o APT::Get::List-Cleanup="0"
echo ""
echo "Repository added. Install ReqMate with:"
echo "  sudo apt install reqmate"
