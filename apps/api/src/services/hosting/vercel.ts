/**
 * @file Vercel Deploy API wrapper.
 * Deploys a single-file HTML demo to Vercel as a static site.
 * Each lead gets a unique project slug and a live URL.
 * Uses Vercel's v13 deployments API.
 *
 * Cost: $0 on Vercel free tier — unlimited static deployments.
 *
 * @see https://vercel.com/docs/rest-api/endpoints/deployments
 */

import logger from '../../lib/logger.js';

const VERCEL_API = 'https://api.vercel.com';

/** Slugifies a business name for use in the deployment URL */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

/**
 * Deploys a demo HTML site to Vercel using the Deploy API.
 * Creates a new project per business (idempotent — if project exists, deploys to it).
 *
 * @param leadId - Lead UUID (used in the project name)
 * @param businessName - Business name for the project slug
 * @param html - Complete HTML string to deploy as index.html
 * @returns Object with live demo URL and Vercel deployment ID
 */
export async function deployDemoToVercel(
  leadId: string,
  businessName: string,
  html: string
): Promise<{ demoUrl: string; deploymentId: string }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN not set in environment');

  const teamId = process.env.VERCEL_TEAM_ID;
  const slug = `${slugify(businessName)}-${leadId.slice(0, 6)}`;
  const projectName = `demo-${slug}`;

  logger.info(`Deploying to Vercel: ${projectName}`);

  // Encode HTML as base64 for the file upload
  const htmlBase64 = Buffer.from(html).toString('base64');

  // Build deployment payload
  const deployPayload = {
    name: projectName,
    files: [
      {
        file: 'index.html',
        data: htmlBase64,
        encoding: 'base64',
      },
    ],
    projectSettings: {
      framework: null,
      outputDirectory: null,
      buildCommand: null,
      installCommand: null,
    },
    target: 'production',
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const url = teamId
    ? `${VERCEL_API}/v13/deployments?teamId=${teamId}`
    : `${VERCEL_API}/v13/deployments`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(deployPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Vercel deployment failed', { status: response.status, error });
    throw new Error(`Vercel deploy error ${response.status}: ${error}`);
  }

  const result = await response.json() as {
    id: string;
    url: string;
    alias?: string[];
  };

  const demoUrl = `https://${result.url}`;
  const deploymentId = result.id;

  logger.info(`Deployed successfully: ${demoUrl}`, { deploymentId, projectName });

  // Disable Vercel Deployment Protection (SSO) for this project to ensure public accessibility
  try {
    const projectUrl = teamId
      ? `${VERCEL_API}/v9/projects/${projectName}?teamId=${teamId}`
      : `${VERCEL_API}/v9/projects/${projectName}`;

    const patchResponse = await fetch(projectUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        ssoProtection: null,
      }),
    });

    if (patchResponse.ok) {
      logger.info(`Disabled Vercel deployment protection for project: ${projectName}`);
    } else {
      const errText = await patchResponse.text();
      logger.warn(`Failed to disable Vercel deployment protection for project ${projectName}:`, { error: errText });
    }
  } catch (err) {
    logger.warn(`Failed to disable Vercel deployment protection for project ${projectName}:`, { error: (err as Error).message });
  }

  return { demoUrl, deploymentId };
}

/**
 * Deletes a demo HTML site from Vercel.
 *
 * @param deploymentId - Vercel deployment ID
 */
export async function deleteDemoFromVercel(deploymentId: string): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN not set in environment');

  const teamId = process.env.VERCEL_TEAM_ID;
  logger.info(`Deleting Vercel deployment: ${deploymentId}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const url = teamId
    ? `${VERCEL_API}/v13/deployments/${deploymentId}?teamId=${teamId}`
    : `${VERCEL_API}/v13/deployments/${deploymentId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Vercel deployment deletion failed', { status: response.status, error });
    throw new Error(`Vercel delete error ${response.status}: ${error}`);
  }

  logger.info(`Deleted successfully: ${deploymentId}`);
}
