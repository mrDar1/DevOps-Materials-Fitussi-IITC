#!/usr/bin/env bash
# Build and run the dummy payment system.
# Usage: bash commands.sh

docker build -t dummy-payment-ts .
docker run --rm -p 3000:3000 dummy-payment-ts
