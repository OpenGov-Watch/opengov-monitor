# Deploying to Our Infrastructure

## What We Need From You

| Field | Example | Required |
|-------|---------|----------|
| Image | `ghcr.io/your-org/your-repo:prod` | Yes |
| Port | `3000` | Yes |
| Domain | `myapp.example.com` | Yes |
| Secrets | `DATABASE_URL`, `API_KEY` | If any |
| Storage | `/app/data` | If any |

## Image Requirements

- Push to `ghcr.io` with `:prod` tag on main branch
- **Make the package public** (required for our server to pull it)
- Expose your app port
- Health endpoint at `/health` (optional, recommended)

### Making Your Package Public

After your first image push, the package will be private by default. To make it public:

1. Go to your GitHub org
2. Click **Packages**
3. Click your package name
4. Click **Package settings** (right sidebar)
5. Scroll to **Danger Zone**
6. Click **Change visibility** → Select **Public** → Confirm

## Add to Your Workflow

After we configure your service, add this deploy job:

```yaml
deploy:
  needs: build  # or whatever your build job is called
  runs-on: ubuntu-latest
  steps:
    - uses: google-github-actions/auth@v2
      with:
        credentials_json: ${{ secrets.GCP_SA_KEY }}

    - uses: google-github-actions/setup-gcloud@v2

    - name: Deploy
      run: |
        gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
          --command="sudo /usr/local/bin/deploy-service SERVICE_NAME"
```

Replace `SERVICE_NAME` with the name we give you.

## Setup Process

1. Send us the 5 fields above
2. We send you back:
   - Your **service name**
   - A **GCP service account key file** (JSON)
3. You:
   - Add the key to GitHub as `GCP_SA_KEY` secret
   - Add the deploy job to your workflow
4. Push to main → auto-deploys

## What You Get

The service account key gives you:
- **Deploy access** - trigger deployments from CI/CD
- **Status access** - check if your container is running/healthy
- **Log access** - view your container logs
- **Shell access** - exec into your container for debugging

You can only access your own service, not others.

## Local Setup (Optional)

To use the key locally for debugging:

```bash
# Authenticate with gcloud
gcloud auth activate-service-account --key-file=path/to/your-key.json

# Set project
gcloud config set project cyberphunk-agency
```

## Accessing Your Service

Check status:
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status SERVICE_NAME"
```

View logs:
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs SERVICE_NAME 100"
```

Shell into container:
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell SERVICE_NAME"
```

Replace `SERVICE_NAME` with the name we gave you.
