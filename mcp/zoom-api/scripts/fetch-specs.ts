#!/usr/bin/env tsx
/**
 * Fetch Zoom API specs from official endpoints
 * Run with: npm run fetch-specs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// API spec URLs provided by Zoom
const API_SPECS: Record<string, string> = {
  meetings: 'https://developers.zoom.us/api-hub/meetings/methods/endpoints.json',
  users: 'https://developers.zoom.us/api-hub/users/methods/endpoints.json',
  phone: 'https://developers.zoom.us/api-hub/phone/methods/endpoints.json',
  'contact-center': 'https://developers.zoom.us/api-hub/contact-center/methods/endpoints.json',
  'number-management': 'https://developers.zoom.us/api-hub/number-management/methods/endpoints.json',
  accounts: 'https://developers.zoom.us/api-hub/accounts/methods/endpoints.json',
  marketplace: 'https://developers.zoom.us/api-hub/marketplace/methods/endpoints.json',
};

const RAW_SPECS_DIR = join(__dirname, '..', 'data', 'raw-specs');

async function fetchSpec(category: string, url: string): Promise<void> {
  console.log(`Fetching ${category} spec from ${url}...`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZoomMCPServer/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const outputPath = join(RAW_SPECS_DIR, `${category}.json`);
    
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`  ✓ Saved to ${outputPath}`);
  } catch (error) {
    console.error(`  ✗ Failed to fetch ${category}:`, error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Zoom API Spec Fetcher');
  console.log('='.repeat(60));
  console.log('');

  // Create output directory
  if (!existsSync(RAW_SPECS_DIR)) {
    mkdirSync(RAW_SPECS_DIR, { recursive: true });
    console.log(`Created directory: ${RAW_SPECS_DIR}`);
  }

  // Fetch all specs
  const results: { category: string; success: boolean; error?: string }[] = [];

  for (const [category, url] of Object.entries(API_SPECS)) {
    try {
      await fetchSpec(category, url);
      results.push({ category, success: true });
    } catch (error) {
      results.push({ 
        category, 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✓ Successfully fetched: ${successful.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log(`✗ Failed: ${failed.map(f => f.category).join(', ')}`);
  }

  console.log('');
  console.log('Next step: Run "npm run build-index" to process the specs');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
