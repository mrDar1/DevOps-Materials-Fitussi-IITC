#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t labs-jenkins-master:latest -f docker/Dockerfile docker
docker build -t labs-agent-alpine:latest -f docker/Dockerfile.agent-alpine docker
docker build -t labs-agent-python:latest -f docker/Dockerfile.agent-python docker
