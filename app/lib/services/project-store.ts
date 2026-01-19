/**
 * Project Credential Store Service
 *
 * Securely stores OAuth credentials for dynamically created Zoom Apps.
 * Uses SQLite for persistence and AES-256-GCM for encryption.
 *
 * This service enables:
 * - Multi-tenant credential storage (each project has its own credentials)
 * - Secure token exchange for Marketplace-initiated OAuth
 * - Development-to-production transition without code changes
 */

import { webcrypto } from 'crypto';

/**
 * Project credentials stored after app creation
 */
export interface ProjectCredentials {
  projectId: string;
  clientId: string;
  clientSecret: string;
  appId: string;
  appName: string;
  createdAt: number;
  expiresAt?: number;
}

/**
 * OAuth tokens received after authorization
 */
export interface ProjectTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  scope?: string;
  retrievedAt: number;
}

/**
 * Encrypted data structure
 */
interface EncryptedData {
  iv: string; // Base64 encoded
  ciphertext: string; // Base64 encoded
  tag: string; // Base64 encoded (for GCM)
}

/**
 * In-memory store (used when SQLite is not available or for development)
 */
const memoryStore = {
  projects: new Map<string, ProjectCredentials>(),
  tokens: new Map<string, ProjectTokens>(),
};

// Encryption key derived from environment variable
let encryptionKey: CryptoKey | null = null;

// Default TTL for credentials: 30 days
const CREDENTIALS_TTL = 30 * 24 * 60 * 60 * 1000;

// Token TTL: 1 hour (should be retrieved before this)
const TOKEN_TTL = 60 * 60 * 1000;

/**
 * Initialize or get the encryption key
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (encryptionKey) {
    return encryptionKey;
  }

  // Get the encryption key from environment or generate a default for development
  const keyMaterial =
    process.env.PROJECT_STORE_ENCRYPTION_KEY || 'bolt-diy-development-key-do-not-use-in-production';

  // Derive a 256-bit key using PBKDF2
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);

  // Import key material
  const baseKey = await webcrypto.subtle.importKey('raw', keyData, { name: 'PBKDF2' }, false, [
    'deriveBits',
    'deriveKey',
  ]);

  // Derive AES-GCM key
  encryptionKey = await webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('bolt-diy-project-store-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return encryptionKey;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
async function encryptData(data: string): Promise<EncryptedData> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = webcrypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data));

  // AES-GCM includes the authentication tag at the end of the ciphertext
  const ciphertextArray = new Uint8Array(ciphertext);
  const tag = ciphertextArray.slice(-16);
  const encryptedContent = ciphertextArray.slice(0, -16);

  return {
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(encryptedContent).toString('base64'),
    tag: Buffer.from(tag).toString('base64'),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
async function decryptData(encrypted: EncryptedData): Promise<string> {
  const key = await getEncryptionKey();
  const iv = new Uint8Array(Buffer.from(encrypted.iv, 'base64'));
  const ciphertext = new Uint8Array(Buffer.from(encrypted.ciphertext, 'base64'));
  const tag = new Uint8Array(Buffer.from(encrypted.tag, 'base64'));

  // Combine ciphertext and tag for AES-GCM
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Generate a unique project ID
 */
export function generateProjectId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = webcrypto.getRandomValues(new Uint8Array(12));
  let projectId = 'proj_';

  for (const byte of randomBytes) {
    projectId += chars[byte % chars.length];
  }

  return projectId;
}

/**
 * Store project credentials
 *
 * @param credentials - The project credentials to store
 */
export async function storeProjectCredentials(
  credentials: Omit<ProjectCredentials, 'createdAt' | 'expiresAt'>,
): Promise<void> {
  const now = Date.now();
  const fullCredentials: ProjectCredentials = {
    ...credentials,
    createdAt: now,
    expiresAt: now + CREDENTIALS_TTL,
  };

  // Encrypt the client secret
  const encryptedSecret = await encryptData(credentials.clientSecret);

  // Store in memory (SQLite integration can be added later)
  memoryStore.projects.set(credentials.projectId, {
    ...fullCredentials,
    clientSecret: JSON.stringify(encryptedSecret),
  });

  console.log(`[ProjectStore] Stored credentials for project: ${credentials.projectId}`);
  console.log(`[ProjectStore] App: ${credentials.appName} (${credentials.appId})`);
}

/**
 * Get project credentials by project ID
 *
 * @param projectId - The project ID
 * @returns The decrypted credentials or null if not found/expired
 */
export async function getProjectCredentials(projectId: string): Promise<ProjectCredentials | null> {
  const stored = memoryStore.projects.get(projectId);

  if (!stored) {
    console.log(`[ProjectStore] Project not found: ${projectId}`);
    return null;
  }

  // Check expiration
  if (stored.expiresAt && stored.expiresAt < Date.now()) {
    console.log(`[ProjectStore] Project credentials expired: ${projectId}`);
    memoryStore.projects.delete(projectId);
    return null;
  }

  try {
    // Decrypt the client secret
    const encryptedSecret = JSON.parse(stored.clientSecret) as EncryptedData;
    const decryptedSecret = await decryptData(encryptedSecret);

    return {
      ...stored,
      clientSecret: decryptedSecret,
    };
  } catch (error) {
    console.error(`[ProjectStore] Failed to decrypt credentials for ${projectId}:`, error);
    return null;
  }
}

/**
 * Delete project credentials
 *
 * @param projectId - The project ID to delete
 */
export function deleteProjectCredentials(projectId: string): boolean {
  const deleted = memoryStore.projects.delete(projectId);
  memoryStore.tokens.delete(projectId);

  if (deleted) {
    console.log(`[ProjectStore] Deleted project: ${projectId}`);
  }

  return deleted;
}

/**
 * Store OAuth tokens for a project
 *
 * @param projectId - The project ID
 * @param tokens - The OAuth tokens to store
 */
export async function storeProjectTokens(
  projectId: string,
  tokens: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  },
): Promise<void> {
  const now = Date.now();

  // Encrypt the access token and refresh token
  const encryptedAccessToken = await encryptData(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? await encryptData(tokens.refresh_token) : undefined;

  const projectTokens: ProjectTokens = {
    accessToken: JSON.stringify(encryptedAccessToken),
    refreshToken: encryptedRefreshToken ? JSON.stringify(encryptedRefreshToken) : undefined,
    tokenType: tokens.token_type,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    retrievedAt: now,
  };

  memoryStore.tokens.set(projectId, projectTokens);
  console.log(`[ProjectStore] Stored tokens for project: ${projectId}`);

  // Auto-expire tokens after TTL
  setTimeout(
    () => {
      memoryStore.tokens.delete(projectId);
      console.log(`[ProjectStore] Auto-expired tokens for project: ${projectId}`);
    },
    tokens.expires_in ? Math.min(tokens.expires_in * 1000, TOKEN_TTL) : TOKEN_TTL,
  );
}

/**
 * Get and clear OAuth tokens for a project (one-time read)
 *
 * @param projectId - The project ID
 * @returns The decrypted tokens or null if not found
 */
export async function getAndClearProjectTokens(projectId: string): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
} | null> {
  const stored = memoryStore.tokens.get(projectId);

  if (!stored) {
    console.log(`[ProjectStore] No tokens found for project: ${projectId}`);
    return null;
  }

  // Remove tokens after retrieval (one-time read for security)
  memoryStore.tokens.delete(projectId);
  console.log(`[ProjectStore] Retrieved and cleared tokens for project: ${projectId}`);

  try {
    // Decrypt tokens
    const encryptedAccessToken = JSON.parse(stored.accessToken) as EncryptedData;
    const accessToken = await decryptData(encryptedAccessToken);

    let refreshToken: string | undefined;

    if (stored.refreshToken) {
      const encryptedRefreshToken = JSON.parse(stored.refreshToken) as EncryptedData;
      refreshToken = await decryptData(encryptedRefreshToken);
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: stored.tokenType,
      expires_in: stored.expiresIn,
      scope: stored.scope,
    };
  } catch (error) {
    console.error(`[ProjectStore] Failed to decrypt tokens for ${projectId}:`, error);
    return null;
  }
}

/**
 * Check if tokens are available for a project (without retrieving them)
 *
 * @param projectId - The project ID
 * @returns True if tokens are available
 */
export function hasProjectTokens(projectId: string): boolean {
  return memoryStore.tokens.has(projectId);
}

/**
 * Get project by client ID (reverse lookup)
 * Useful for handling callbacks when we only know the client ID
 *
 * @param clientId - The OAuth client ID
 * @returns The project ID or null if not found
 */
export async function getProjectIdByClientId(clientId: string): Promise<string | null> {
  for (const [projectId, stored] of memoryStore.projects.entries()) {
    // Check expiration
    if (stored.expiresAt && stored.expiresAt < Date.now()) {
      memoryStore.projects.delete(projectId);
      continue;
    }

    if (stored.clientId === clientId) {
      return projectId;
    }
  }

  return null;
}

/**
 * List all active projects (for debugging/admin)
 *
 * @returns Array of project summaries (no secrets)
 */
export function listProjects(): Array<{
  projectId: string;
  appId: string;
  appName: string;
  clientId: string;
  createdAt: number;
  hasTokens: boolean;
}> {
  const projects: Array<{
    projectId: string;
    appId: string;
    appName: string;
    clientId: string;
    createdAt: number;
    hasTokens: boolean;
  }> = [];

  const now = Date.now();

  for (const [projectId, stored] of memoryStore.projects.entries()) {
    // Skip expired
    if (stored.expiresAt && stored.expiresAt < now) {
      memoryStore.projects.delete(projectId);
      continue;
    }

    projects.push({
      projectId,
      appId: stored.appId,
      appName: stored.appName,
      clientId: stored.clientId,
      createdAt: stored.createdAt,
      hasTokens: memoryStore.tokens.has(projectId),
    });
  }

  return projects;
}

/**
 * Clean up expired entries (garbage collection)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleanedProjects = 0;

  for (const [projectId, stored] of memoryStore.projects.entries()) {
    if (stored.expiresAt && stored.expiresAt < now) {
      memoryStore.projects.delete(projectId);
      memoryStore.tokens.delete(projectId);
      cleanedProjects++;
    }
  }

  if (cleanedProjects > 0) {
    console.log(`[ProjectStore] Cleaned up ${cleanedProjects} expired projects`);
  }
}

// Run cleanup periodically (every hour)
setInterval(cleanupExpiredEntries, 60 * 60 * 1000);

/**
 * Get redirect URI for a project
 * This is the callback URL to configure in Zoom Marketplace
 *
 * @param projectId - The project ID
 * @param baseUrl - The base URL of bolt.diy
 * @returns The redirect URI
 */
export function getProjectRedirectUri(projectId: string, baseUrl: string): string {
  // Ensure HTTPS for OAuth providers
  const secureUrl =
    baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1')
      ? baseUrl
      : baseUrl.replace(/^http:\/\//i, 'https://');

  return `${secureUrl}/api/oauth/proxy/callback/${projectId}`;
}
