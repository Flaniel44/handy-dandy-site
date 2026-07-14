# Automatic production deployment

Production deployment has two gates:

1. GitHub Actions runs unit tests, PostgreSQL-backed integration tests, linting, type checking, and a production build for every pull request and every update to `main`.
2. After an update to `main` passes all checks, GitHub advances the `production` branch to that exact commit. The MacBook watches `production` and deploys only that tested commit.

The production environment file stays exclusively on the MacBook. It is never read by GitHub Actions or committed to the repository.

## One-time MacBook installation

After this automation has been merged into `main` and its first CI run has passed, update the existing checkout once and install the LaunchAgent:

```bash
cd /Users/daniel/handy-dandy-site
git pull --ff-only origin main
chmod +x scripts/install-macos-auto-deploy.sh scripts/deploy-production.sh
./scripts/install-macos-auto-deploy.sh
```

The LaunchAgent runs as the logged-in `daniel` user every 15 minutes. Docker Desktop must be running, as it already is for the other hosted services. A normal check only performs a small Git fetch; container builds happen only when CI has promoted a new commit to `production`.

## Verify the installation

Check the job and watch its deployment log:

```bash
launchctl print gui/$(id -u)/place.whatisthis.handy-dandy-deploy
tail -f ~/Library/Logs/handy-dandy-deploy.log
```

Verify the containers and health endpoint after a deployment:

```bash
cd /Users/daniel/handy-dandy-site
docker compose --env-file apps/web/.env.production -f compose.production.yaml ps
curl --fail http://127.0.0.1:3010/api/health
```

## How a deployment works

The deployer:

- prevents overlapping deployments;
- refuses to overwrite tracked local changes;
- fetches the tested `production` branch;
- requires a fast-forward update;
- builds the migrator, web app, and reminder worker images one at a time so an older Mac is not hit with several simultaneous builds;
- applies database migrations;
- recreates only services whose image or configuration changed;
- waits up to 150 seconds for the health endpoint;
- records the deployed commit only after the health check succeeds.

If a build, migration, container start, or health check fails, the commit is not marked as deployed. The next scheduled run retries it, and the error is written to `~/Library/Logs/handy-dandy-deploy-error.log`.

## Run or stop it manually

Trigger an immediate check:

```bash
launchctl kickstart -k gui/$(id -u)/place.whatisthis.handy-dandy-deploy
```

Disable automatic deployment:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/place.whatisthis.handy-dandy-deploy.plist
```

Re-run `./scripts/install-macos-auto-deploy.sh` to install or enable it again.
