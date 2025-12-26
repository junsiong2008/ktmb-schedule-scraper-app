---
description: Deploy the Next.js Frontend to Google Cloud Run
---

This workflow guides you through deploying the `nextjs_frontend` to Google Cloud Run.

## Prerequisites

1.  **Google Cloud Project**: Ensure you have a Google Cloud project selected.
2.  **Billing Enabled**: Billing must be enabled for your project.
3.  **APIs Enabled**: Ensure `Cloud Run API` and `Cloud Build API` are enabled.
4.  **API URL**: You should have the URL of your deployed backend API.

## Deployment Steps

1.  Navigate to the frontend directory:
    ```bash
    cd nextjs_frontend
    ```

2.  Run the deployment script. This script builds the Docker image using Cloud Build and deploys it to Cloud Run.
    
    // turbo
    ```bash
    ./deploy.sh
    ```

    The script assumes:
    - Service Name: `ktmb-frontend`
    - Region: `us-central1`
    - API URL: `https://ktmb-api-769756648802.us-central1.run.app`

    If you need to change these, edit `deploy.sh` before running.

## Verifying Deployment

After successful deployment, the script will output the Service URL. You can visit that URL to see your application running.
