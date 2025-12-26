#!/bin/bash

# Exit on error
set -e

# Configuration
SERVICE_NAME="ktmb-frontend"
REGION="us-central1"
API_URL="https://ktmb-api-769756648802.us-central1.run.app"

# Get Project ID
PROJECT_ID=$(gcloud config get-value project)
echo "Deploying to Project: $PROJECT_ID"

# Build the image using Cloud Build
echo "Building container image..."
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_API_URL=$API_URL,_IMAGE_NAME=gcr.io/$PROJECT_ID/$SERVICE_NAME \
  .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "Deployment complete!"
