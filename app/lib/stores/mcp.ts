import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';

const MCP_SETTINGS_KEY = 'mcp_settings';
const MCP_CONFIG_VERSION_KEY = 'mcp_config_version';
const CURRENT_CONFIG_VERSION = 2; // Increment when adding new default servers
const isBrowser = typeof window !== 'undefined';

type MCPSettings = {
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
};

/*
 * Default MCP servers that should be available to all users.
 * When adding new default servers, increment CURRENT_CONFIG_VERSION above.
 */
const defaultMCPServers = {
  /* shadcn/ui MCP server - https://ui.shadcn.com/docs/mcp */
  shadcn: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['shadcn@latest', 'mcp'],
  },

  /* Context7 - Live npm/framework documentation - https://context7.com */
  context7: {
    type: 'streamable-http' as const,
    url: 'https://mcp.context7.com/mcp',
  },

  /*
   * Zoom API - Zoom API endpoint documentation and discovery
   * Provides tools: zoom_list_categories, zoom_search_endpoints, zoom_get_endpoint, zoom_get_scopes
   */
  'zoom-api': {
    type: 'streamable-http' as const,
    url: 'https://zoomvibes.j4red4llen.com/mcp/zoom-api',
  },
};

const defaultSettings = {
  maxLLMSteps: 5,
  mcpConfig: {
    mcpServers: {
      /* shadcn/ui MCP server - https://ui.shadcn.com/docs/mcp */
      shadcn: {
        type: 'stdio',
        command: 'npx',
        args: ['shadcn@latest', 'mcp'],
      },

      /* Context7 - Live npm/framework documentation - https://context7.com */
      context7: {
        type: 'streamable-http',
        url: 'https://mcp.context7.com/mcp',
      },

      /*
       * Zoom API - Zoom API endpoint documentation and discovery
       * Provides tools: zoom_list_categories, zoom_search_endpoints, zoom_get_endpoint, zoom_get_scopes
       * For local development, use stdio config instead:
       * 'zoom-api': { type: 'stdio', command: 'node', args: ['./mcp/zoom-api/dist/index.js'] }
       */
      'zoom-api': {
        type: 'streamable-http',
        url: 'https://zoomvibes.j4red4llen.com/mcp/zoom-api',
      },
    },
  },
} satisfies MCPSettings;

type Store = {
  isInitialized: boolean;
  settings: MCPSettings;
  serverTools: MCPServerTools;
  error: string | null;
  isUpdatingConfig: boolean;
};

type Actions = {
  initialize: () => Promise<void>;
  updateSettings: (settings: MCPSettings) => Promise<void>;
  checkServersAvailabilities: () => Promise<void>;
};

export const useMCPStore = create<Store & Actions>((set, get) => ({
  isInitialized: false,
  settings: defaultSettings,
  serverTools: {},
  error: null,
  isUpdatingConfig: false,
  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    if (isBrowser) {
      const savedConfig = localStorage.getItem(MCP_SETTINGS_KEY);
      const savedVersion = parseInt(localStorage.getItem(MCP_CONFIG_VERSION_KEY) || '0', 10);

      if (savedConfig) {
        try {
          let settings = JSON.parse(savedConfig) as MCPSettings;

          /*
           * Migration logic: Add missing default MCP servers to existing configs.
           * This ensures users get new default servers while keeping their custom ones.
           */
          if (savedVersion < CURRENT_CONFIG_VERSION) {
            const existingServers = settings.mcpConfig?.mcpServers || {};

            // Merge defaults with user's existing servers (user's servers take priority)
            const mergedServers = {
              ...defaultMCPServers,
              ...existingServers,
            };

            settings = {
              ...settings,
              mcpConfig: {
                ...settings.mcpConfig,
                mcpServers: mergedServers as MCPConfig['mcpServers'],
              },
            };

            // Save migrated config
            localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(settings));
            localStorage.setItem(MCP_CONFIG_VERSION_KEY, String(CURRENT_CONFIG_VERSION));
            console.info(
              `MCP config migrated from version ${savedVersion} to ${CURRENT_CONFIG_VERSION}. Added default servers.`,
            );
          }

          const serverTools = await updateServerConfig(settings.mcpConfig);
          set(() => ({ settings, serverTools }));
        } catch (error) {
          console.error('Error parsing saved mcp config:', error);
          set(() => ({
            error: `Error parsing saved mcp config: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        // New user: save defaults and version
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));
        localStorage.setItem(MCP_CONFIG_VERSION_KEY, String(CURRENT_CONFIG_VERSION));
      }
    }

    set(() => ({ isInitialized: true }));
  },
  updateSettings: async (newSettings: MCPSettings) => {
    if (get().isUpdatingConfig) {
      return;
    }

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  checkServersAvailabilities: async () => {
    const response = await fetch('/api/mcp-check', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    const serverTools = (await response.json()) as MCPServerTools;

    set(() => ({ serverTools }));
  },
}));

async function updateServerConfig(config: MCPConfig) {
  const response = await fetch('/api/mcp-update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as MCPServerTools;

  return data;
}
