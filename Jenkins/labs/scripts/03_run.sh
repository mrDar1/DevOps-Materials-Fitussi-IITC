#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
LABS_DIR="$(pwd)"

docker rm -f jenkins-lab >/dev/null 2>&1 || true

docker run -d \
  --name jenkins-lab \
  --network jenkins-lab \
  --user root \
  -p 8081:8080 \
  -p 50000:50000 \
  -v jenkins-lab-home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$LABS_DIR/casc:/var/jenkins_home/casc:ro" \
  -v "$LABS_DIR/repo:/repo:ro" \
  labs-jenkins-master:latest

echo "started jenkins-lab, waiting for it to come up on http://localhost:8081"
