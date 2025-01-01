#!/bin/bash

# Get the current timestamp to create a unique commit message
timestamp=$(date +"%Y%m%d%H%M%S")

# Add all changes to staging
git add .

# Commit with a unique message based on the timestamp
git commit -m "test-auto-push-time-$timestamp"

# Push changes to the main branch
git push origin main
