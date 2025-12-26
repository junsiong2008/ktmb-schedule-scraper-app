---
description: Deploy the Node.js API to Google Cloud Run
---

This workflow guides you through deploying the `ktmb_api` to Google Cloud Run.

## Prerequisites

1.  **Google Cloud Project**: Ensure you have a Google Cloud project selected.
2.  **Billing Enabled**: Billing must be enabled for your project.
3.  **APIs Enabled**: Ensure `Cloud Run API` and `Artifact Registry API` (or `Container Registry API`) are enabled.
4.  **Database**: Your application connects to a PostgreSQL database. For Cloud Run, you should use **Google Cloud SQL** (PostgreSQL). You will need to create a Cloud SQL instance and configure the connection.

## Deployment Steps

1.  Navigate to the API directory:
    ```bash
    cd ktmb_api
    ```

2.  Deploy using `gcloud run deploy`. This command builds the container from the source (using the Dockerfile we created) and deploys it.
    Replace `[SERVICE_NAME]` with your desired service name (e.g., `ktmb-api`) and `[REGION]` with your preferred region (e.g., `asia-southeast1`).

    ```bash
    gcloud run deploy ktmb-api --source . --region asia-southeast1 --allow-unauthenticated
    ```
    *   `--source .`: Builds the container from the current directory.
    *   `--allow-unauthenticated`: Makes the API publicly accessible. Remove this if you want to restrict access.

3.  **Configure Environment Variables**:
    During deployment (or afterwards via the Cloud Console), you need to set the environment variables for your database connection:
    *   `DB_USER`
    *   `DB_PASSWORD`
    *   `DB_NAME`
    *   `DB_HOST` (For Cloud SQL, this might be the instance connection name if using the socket, or the public IP if authorized)
    *   `DB_PORT`

    To set environment variables during deployment, add the `--set-env-vars` flag:
    ```bash
    gcloud run deploy ktmb-api \
      --source . \
      --region asia-southeast1 \
      --allow-unauthenticated \
      --set-env-vars DB_USER=[USER],DB_PASSWORD=[PASSWORD],DB_NAME=[DB_NAME],DB_HOST=[HOST],DB_PORT=5432
    ```

    **Note on Cloud SQL**: If using Cloud SQL, the recommended way is to use the Cloud SQL Auth Proxy which Cloud Run supports natively. You would add `--add-cloudsql-instances [INSTANCE_CONNECTION_NAME]` and set `DB_HOST` to `/cloudsql/[INSTANCE_CONNECTION_NAME]` (if using Unix sockets) or `127.0.0.1` (if using TCP).

## Verifying Deployment

After successful deployment, `gcloud` will output the Service URL. You can test it by visiting that URL (e.g., `https://ktmb-api-xyz-uc.a.run.app`).
