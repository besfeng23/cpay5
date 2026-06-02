# Speedcash Slack Bridge

This bridge exposes a Vercel/Next.js endpoint for the Slack slash command `/speedcash cleanup`.

## Endpoint

```text
POST /api/slack/speedcash
```

Use the deployed Vercel URL as the Slack slash-command request URL.

Example:

```text
https://your-speedcash-domain.vercel.app/api/slack/speedcash
```

## Supported command

```text
/speedcash cleanup
```

The command dispatches the GitHub Actions workflow:

```text
repo-hygiene-cleanup.yml
```

on:

```text
main
```

## Required environment variables

Set these in Vercel. Do not commit them.

```text
SLACK_SIGNING_SECRET=
SLACK_ALLOWED_USER_IDS=
GITHUB_WORKFLOW_DISPATCH_TOKEN=
```

Optional overrides:

```text
GITHUB_REPO_OWNER=besfeng23
GITHUB_REPO_NAME=speedcash
GITHUB_WORKFLOW_ID=repo-hygiene-cleanup.yml
GITHUB_WORKFLOW_REF=main
```

## GitHub token requirements

The GitHub token must be able to dispatch workflows for `besfeng23/speedcash`.

Use the narrowest possible token. It needs Actions write access for this repository.

## Slack setup

1. Create a Slack app.
2. Add a Slash Command named `/speedcash`.
3. Set the Request URL to the deployed endpoint.
4. Copy the Slack Signing Secret into Vercel as `SLACK_SIGNING_SECRET`.
5. Add your Slack user ID to `SLACK_ALLOWED_USER_IDS`.
6. Deploy the Vercel app.
7. Run `/speedcash cleanup` from Slack.

## Safety boundaries

This endpoint only supports the `cleanup` command.

It does not support deploy, production, wallet, provider, payout, or money-movement commands.

Speedcash remains NO-GO until CI, repo hygiene, provider confirmation, ledger, webhook idempotency, reconciliation, and staging evidence are complete.
