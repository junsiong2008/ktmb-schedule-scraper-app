#!/bin/bash

# Exit on error
set -e

# Configuration
SERVICE_NAME="ktmb-nextjs-frontend"
REGION="us-central1"
API_URL="https://ktmb-api-769756648802.us-central1.run.app/api"

# CARTO basemaps key: use the shell env var if set, otherwise read it from .env.local
if [ -z "$NEXT_PUBLIC_CARTO_KEY" ] && [ -f .env.local ]; then
  NEXT_PUBLIC_CARTO_KEY=$(grep -E '^NEXT_PUBLIC_CARTO_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"' \r")
fi
if [ -z "$NEXT_PUBLIC_CARTO_KEY" ]; then
  echo "Error: NEXT_PUBLIC_CARTO_KEY is not set (export it or add it to .env.local)" >&2
  exit 1
fi

# Get Project ID
PROJECT_ID=$(gcloud config get-value project)
echo "Deploying to Project: $PROJECT_ID"

# Build the image using Cloud Build
echo "Building container image..."
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_API_URL=$API_URL,_NEXT_PUBLIC_CARTO_KEY=$NEXT_PUBLIC_CARTO_KEY,_IMAGE_NAME=gcr.io/$PROJECT_ID/$SERVICE_NAME \
  .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "Deployment complete!"
