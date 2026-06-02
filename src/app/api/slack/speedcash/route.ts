import {NextRequest, NextResponse} from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SlackResponse = {
  response_type: 'ephemeral';
  text: string;
};

const jsonSlack = (text: string, status = 200) => NextResponse.json<SlackResponse>({
  response_type: 'ephemeral',
  text,
}, {status});

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifySlackRequest = (request: NextRequest, rawBody: string, signingSecret: string): boolean => {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    return false;
  }

  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - requestTime) > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;

  return safeCompare(expected, signature);
};

const parseAllowedUsers = (): Set<string> => {
  const raw = getRequiredEnv('SLACK_ALLOWED_USER_IDS');
  return new Set(raw.split(',').map((userId) => userId.trim()).filter(Boolean));
};

const dispatchWorkflow = async (): Promise<void> => {
  const token = getRequiredEnv('GITHUB_WORKFLOW_DISPATCH_TOKEN');
  const owner = process.env.GITHUB_REPO_OWNER?.trim() || 'besfeng23';
  const repo = process.env.GITHUB_REPO_NAME?.trim() || 'speedcash';
  const workflowId = process.env.GITHUB_WORKFLOW_ID?.trim() || 'repo-hygiene-cleanup.yml';
  const ref = process.env.GITHUB_WORKFLOW_REF?.trim() || 'main';

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ref}),
  });

  if (response.status !== 204) {
    const body = await response.text();
    throw new Error(`GitHub workflow dispatch failed with ${response.status}: ${body.slice(0, 300)}`);
  }
};

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signingSecret = getRequiredEnv('SLACK_SIGNING_SECRET');

    if (!verifySlackRequest(request, rawBody, signingSecret)) {
      return jsonSlack('Unauthorized Slack request.', 401);
    }

    const form = new URLSearchParams(rawBody);
    const userId = form.get('user_id')?.trim();
    const commandText = (form.get('text') || '').trim().toLowerCase();
    const allowedUsers = parseAllowedUsers();

    if (!userId || !allowedUsers.has(userId)) {
      return jsonSlack('You are not allowed to run Speedcash commands.', 403);
    }

    if (!commandText || commandText === 'help') {
      return jsonSlack('Speedcash commands: `/speedcash cleanup`. Production and deploy commands are intentionally disabled.');
    }

    if (commandText !== 'cleanup') {
      return jsonSlack(`Unknown Speedcash command: ${commandText}. Allowed command: cleanup.`, 400);
    }

    await dispatchWorkflow();

    return jsonSlack('Speedcash repo hygiene cleanup workflow dispatched on `main`. Check GitHub Actions for the run and cleanup PR.');
  } catch (error: unknown) {
    console.error('Slack Speedcash bridge failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    return jsonSlack('Speedcash command failed. Check Vercel logs and GitHub Actions before retrying.', 500);
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'speedcash-slack-bridge',
    commands: ['cleanup'],
  });
}
