# Zoom App Mode Integration Blueprint

> **Author**: Jared Allen  
> **Date**: January 14, 2026  
> **Status**: Draft

## Overview

This document outlines the integration plan for "Zoom App mode" in bolt.diy—a specialized development mode that enforces hard constraints via the prompt system to ensure generated applications comply with Zoom Marketplace requirements.

### Goals

1. Provide a pre-configured Zoom App template that scaffolds a Marketplace-ready application
2. Enforce Zoom SDK and Marketplace constraints through a dedicated prompt profile
3. Automate Marketplace manifest generation and configuration
4. Enable one-click GitHub push for deployment-ready code

### Hard Constraints

- **Stable OAuth Callback URL**: `https://zoomvibes.j4red4llen.com/api/oauth/proxy/callback`
- **WebContainer Environment**: No native binaries, ephemeral preview URLs
- **Zoom Marketplace Requirements**: Valid manifest, proper OAuth scopes, security compliance

---

## Stage 1: Zoom App Template

### Description

Create a GitHub-hosted starter template specifically designed for Zoom Apps that includes:
- Zoom App SDK pre-installed and configured
- OAuth flow boilerplate using bolt.diy's proxy
- Sample meeting/user endpoints
- Marketplace-compliant directory structure

### Implementation Location

| Component | Path |
|-----------|------|
| Template registration | `app/utils/constants.ts` → `STARTER_TEMPLATES` array |
| Template repo | `github.com/zoom-jaredallen/bolt-zoom-app-template` (to be created) |
| Template-specific prompt | `.bolt/prompt` in template repo |
| Template ignore rules | `.bolt/ignore` in template repo |

### Template Structure

```
bolt-zoom-app-template/
├── .bolt/
│   ├── prompt          # Zoom-specific LLM instructions
│   └── ignore          # Files to exclude from modification
├── src/
│   ├── api/
│   │   ├── auth.ts     # OAuth callback handler
│   │   ├── meetings.ts # Meeting API endpoints
│   │   └── webhooks.ts # Webhook receiver
│   ├── components/
│   │   └── ZoomApp.tsx # Main app component
│   └── index.tsx
├── public/
│   └── manifest.json   # Zoom Marketplace manifest template
├── package.json        # With @zoom/appssdk dependency
└── vite.config.ts
```

### Acceptance Criteria

- [ ] Template appears in bolt.diy's template selector when "zoom" keywords detected
- [ ] Template scaffolds with working OAuth flow using proxy
- [ ] `.bolt/prompt` contains Zoom-specific development rules
- [ ] `npm run dev` starts without errors in WebContainer

---

## Stage 2: Zoom App Prompt Profile

### Description

Create a dedicated prompt profile that enforces Zoom App development constraints. This profile will be available in the Settings → Prompts tab and can be auto-selected when using the Zoom template.

### Implementation Location

| Component | Path |
|-----------|------|
| New section definition | `app/lib/common/prompts/sections.ts` |
| Built-in prompt | `app/lib/common/prompt-library.ts` |
| Store integration | `app/lib/stores/customPrompts.ts` |

### New Prompt Section: `zoomAppInstructions`

```typescript
// To be added to app/lib/common/prompts/sections.ts
zoomAppInstructions: `<zoom_app_instructions>
  You are building a Zoom Marketplace App. Follow these CRITICAL requirements:

  ZOOM SDK INTEGRATION:
  - ALWAYS use @zoom/appssdk for client-side Zoom integration
  - Import zoomSdk from '@zoom/appssdk' and call zoomSdk.config() before any API calls
  - Use zoomSdk.callZoomApi() for meeting controls, NOT direct REST API calls
  - Handle zoomSdk.addEventListener() for Zoom events (onMeeting, onMessage, etc.)

  OAUTH REQUIREMENTS:
  - Use bolt.diy's OAuth proxy: https://zoomvibes.j4red4llen.com/api/oauth/proxy/start?provider=zoom
  - NEVER store OAuth tokens client-side; use httpOnly cookies or server-side sessions
  - Request ONLY necessary scopes: meeting:read, meeting:write, user:read
  - Implement token refresh before expiry

  WEBHOOK HANDLING:
  - Use bolt.diy's webhook proxy for development: /api/webhook/session → get sessionId
  - Configure webhooks in Zoom Marketplace to point to: https://zoomvibes.j4red4llen.com/api/webhook/proxy/{sessionId}
  - Poll /api/webhook/poll/{sessionId} to receive webhook events
  - Validate webhook signatures using the verification token

  SECURITY REQUIREMENTS:
  - Validate all Zoom context headers (x-zoom-app-context)
  - Use Content Security Policy headers compatible with Zoom client
  - NEVER expose Client Secret in client-side code
  - Implement state parameter for OAuth CSRF protection

  UI/UX REQUIREMENTS:
  - Design for embedded mode (inside Zoom client) with compact layouts
  - Support both light and dark themes matching Zoom's color scheme
  - Handle window resize events for different Zoom panel sizes
  - Provide loading states while waiting for Zoom SDK initialization

  MANIFEST REQUIREMENTS:
  - Home URL must be HTTPS and publicly accessible
  - Redirect URLs must include OAuth callback endpoint
  - Scopes in manifest must match OAuth request scopes
  - Short description max 50 chars, long description max 4000 chars
</zoom_app_instructions>`
```

### Built-in Prompt Registration

```typescript
// To be added to app/lib/common/prompt-library.ts
'zoom-app': {
  label: 'Zoom App Mode',
  description: 'Enforces Zoom Marketplace app constraints and best practices',
  get: (options) => getZoomAppPrompt(options.cwd, options.supabase, options.designScheme),
}
```

### Acceptance Criteria

- [ ] "Zoom App Mode" appears in Settings → Prompts dropdown
- [ ] Selecting Zoom App Mode injects `zoomAppInstructions` section
- [ ] LLM refuses to generate code violating Zoom constraints
- [ ] Template variables like `{{zoomCallbackUrl}}` are processed

---

## Stage 3: Marketplace Automation

### Description

Automate the generation and updating of Zoom Marketplace app configuration, including manifest generation and Home URL/Redirect URL setup.

### Implementation Location

| Component | Path |
|-----------|------|
| Manifest service | `app/lib/services/zoom-marketplace.ts` (NEW) |
| Manifest UI | `app/components/@settings/tabs/integrations/ZoomMarketplace.tsx` (NEW) |
| API route | `app/routes/api.zoom-marketplace.ts` (NEW) |

### Manifest Generation

```typescript
// app/lib/services/zoom-marketplace.ts
export interface ZoomManifestConfig {
  appName: string;
  shortDescription: string;
  longDescription: string;
  developerName: string;
  developerEmail: string;
  homeUrl: string;
  redirectUrl: string;
  scopes: string[];
  webhookUrl?: string;
}

export function generateManifest(config: ZoomManifestConfig): object {
  return {
    "appInfo": {
      "appName": config.appName,
      "shortDescription": config.shortDescription,
      "longDescription": config.longDescription,
      "developer": {
        "name": config.developerName,
        "email": config.developerEmail
      }
    },
    "oauth": {
      "redirectUrl": config.redirectUrl,
      "scopes": config.scopes
    },
    "features": {
      "homeUrl": config.homeUrl,
      "meetingApp": true
    },
    "webhooks": config.webhookUrl ? {
      "eventSubscription": {
        "eventTypes": ["meeting.started", "meeting.ended"],
        "notificationUrl": config.webhookUrl
      }
    } : undefined
  };
}
```

### URL Configuration

| URL Type | Development Value | Production Value |
|----------|-------------------|------------------|
| Home URL | `{WebContainer preview URL}` | User-provided deployment URL |
| OAuth Redirect | `https://zoomvibes.j4red4llen.com/api/oauth/proxy/callback` | Same (stable proxy) |
| Webhook URL | `https://zoomvibes.j4red4llen.com/api/webhook/proxy/{sessionId}` | User-provided webhook endpoint |

### Acceptance Criteria

- [ ] "Generate Manifest" button in Zoom settings tab
- [ ] Manifest JSON file created at `public/manifest.json`
- [ ] Warning shown if Home URL is WebContainer ephemeral URL
- [ ] One-click copy of OAuth redirect URL

---

## Stage 4: GitHub Push Integration

### Description

Extend the existing GitHub push functionality to include Marketplace-specific files and provide guidance for deployment.

### Implementation Location

| Component | Path |
|-----------|------|
| Push flow | `app/lib/stores/workbench.ts` → `pushToRepository()` |
| Push UI | `app/components/git/GitPushModal.tsx` (existing) |
| Zoom-specific logic | `app/lib/services/zoom-marketplace.ts` (enhancement) |

### Enhanced Push Flow

1. **Pre-push validation**:
   - Verify manifest.json exists and is valid
   - Check for sensitive data (no exposed secrets)
   - Validate OAuth callback URL is stable proxy

2. **Post-push actions**:
   - Display deployment checklist
   - Show Marketplace submission link
   - Provide Vercel/Netlify deploy button if configured

### GitHub Actions Workflow (Generated in Template)

```yaml
# .github/workflows/deploy.yml
name: Deploy Zoom App
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Acceptance Criteria

- [ ] "Push to GitHub" validates Zoom manifest before push
- [ ] README.md includes Marketplace submission instructions
- [ ] Deployment workflow file included in pushed code
- [ ] Post-push modal shows "Submit to Marketplace" link

---

## Risks and Mitigations

### Risk 1: Ephemeral WebContainer URLs

**Problem**: WebContainer preview URLs are temporary and change on each session, making them unsuitable for Marketplace Home URL.

**Mitigation**:
- Use stable proxy URL for OAuth callbacks ✓
- Display warning when user tries to use preview URL as Home URL
- Provide deployment guides for Vercel/Netlify/Cloudflare
- Consider adding Vercel integration for one-click stable URLs

### Risk 2: OAuth Token Storage in WebContainer

**Problem**: WebContainer has no persistent storage; OAuth tokens would be lost on refresh.

**Mitigation**:
- Store tokens server-side via bolt.diy proxy
- Use `getOAuthTokens(sessionId)` API
- Implement token passing via secure postMessage to WebContainer iframe
- Document that production apps need proper backend storage

### Risk 3: Zoom Marketplace API Changes

**Problem**: Zoom may update SDK versions or change Marketplace requirements.

**Mitigation**:
- Pin @zoom/appssdk version in template
- Include version check in prompt instructions
- Create maintenance schedule for template updates
- Monitor Zoom Developer changelog

### Risk 4: Webhook Delivery Reliability

**Problem**: In-memory webhook queue may lose events if bolt.diy restarts.

**Mitigation**:
- Document webhook polling best practices (poll every 5s)
- Add webhook replay capability for missed events
- Consider Redis/persistent storage for production deployments
- Implement webhook signature validation to prevent replay attacks

### Risk 5: Client Secret Exposure

**Problem**: Users might accidentally expose OAuth client secrets in generated code.

**Mitigation**:
- Prompt enforces "NEVER expose Client Secret in client-side code"
- Add lint rule to detect secrets in code files
- Environment variable template includes `.env.local` gitignore
- Pre-push validation checks for exposed secrets

---

## Implementation Timeline

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1 | Create template repo, register in constants.ts | 2-3 days |
| Phase 2 | Implement zoomAppInstructions section, test constraints | 2 days |
| Phase 3 | Build manifest generation UI and service | 3 days |
| Phase 4 | Enhance GitHub push with validation | 2 days |
| Testing | End-to-end testing, documentation | 2 days |

**Total**: ~2 weeks

---

## Appendix: Related Files Quick Reference

### Prompt System
- `app/lib/common/prompts/sections.ts` - Section definitions
- `app/lib/common/prompts/template-processor.ts` - Variable substitution
- `app/lib/common/prompt-library.ts` - Prompt registration
- `app/lib/stores/customPrompts.ts` - Custom prompt persistence

### OAuth Proxy
- `app/lib/services/oauth-proxy.ts` - Core OAuth service
- `app/routes/api.oauth.proxy.start.ts` - OAuth initiation
- `app/routes/api.oauth.proxy.callback.ts` - Callback handler

### Webhook Proxy
- `app/lib/services/webhook-proxy.ts` - Core webhook service
- `app/routes/api.webhook.session.ts` - Session management
- `app/routes/api.webhook.proxy.$sessionId.ts` - Webhook receiver
- `app/routes/api.webhook.poll.$sessionId.ts` - Polling endpoint

### Template System
- `app/utils/constants.ts` - STARTER_TEMPLATES array
- `app/utils/selectStarterTemplate.ts` - LLM template selection
- `app/routes/api.github-template.ts` - Template fetching

### GitHub Integration
- `app/lib/stores/workbench.ts` - pushToRepository() method
- `app/components/git/GitPushModal.tsx` - Push UI
