# Frontend production deployment

The workflow runs lint, TypeScript, a production build, Docker build and Compose validation before manual deployment from `main` or `master`. Runtime uses Node 24, a standalone Next.js image, a non-root user, bounded logs and graceful shutdown.

Provision `/home/apps/machine-learning/shared/.env.fe` with mode `600`, `NEXT_PUBLIC_APP_MODE=multi_tenant`, `IS_MAINTANANCE=false`, and `NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV=https://your-api.example`. Public variables are baked into the browser bundle during build; rebuild after changing the API URL. Never place credentials in `NEXT_PUBLIC_*` variables.

Create the `production` GitHub environment and configure `SSH_HOST_DEV_NEW`, `SSH_USER`, `SSH_KEY`, and trusted ED25519 `SSH_FINGERPRINT` secrets. Restrict environment branches to `main`/`master`. The server needs Docker, Compose v2, `flock`, and the external `nginx-proxy-manager_default` network. Proxy this service through HTTPS; host port 8005 is bound to loopback, while Nginx Proxy Manager can reach the container through the shared network.

For an existing running frontend, register its original checkout directory in `/home/apps/machine-learning/shared/frontend-deployment/current` before first deployment. The script refuses to replace an existing release without a rollback configuration. A fresh install needs no registration.

Each release builds with a unique image tag in its own source directory. Failed startup restores the previous image and Compose configuration. A fresh deployment without a previous image cannot roll back. Keep the last good image and source directory; pruning is an operator task.

Local lint, TypeScript and Webpack build are verified. Docker image build and container health are checked by GitHub Actions; Docker is unavailable on the current development machine. After deploy, smoke-test login, event create/edit, monitoring, camera preview cleanup, captures and IN/OUT using the actual backend.
