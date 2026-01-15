interface Env {
  // Authentication
  ADMIN_PASSWORD: string;
  RECAPTCHA_SECRET_KEY: string;

  // Zoom Server-to-Server OAuth (for Marketplace API / App creation)
  ZOOM_CLIENT_ID: string;
  ZOOM_CLIENT_SECRET: string;
  ZOOM_ACCOUNT_ID: string;

  // OAuth Proxy Credentials (for WebContainer apps)
  ZOOM_OAUTH_CLIENT_ID: string;
  ZOOM_OAUTH_CLIENT_SECRET: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  GITLAB_OAUTH_CLIENT_ID: string;
  GITLAB_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;

  // Webhook Proxy Configuration
  WEBHOOK_PROXY_TTL: string;
  WEBHOOK_PROXY_MAX_QUEUE: string;

  // GitHub Integration
  GITHUB_TOKEN: string;
  GITHUB_API_KEY: string;

  // AI Provider API Keys
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GROQ_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  MISTRAL_API_KEY: string;
  XAI_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  COHERE_API_KEY: string;
  MOONSHOT_API_KEY: string;
  HYPERBOLIC_API_KEY: string;
  HYPERBOLIC_API_BASE_URL: string;
  HuggingFace_API_KEY: string;
  OPEN_ROUTER_API_KEY: string;
  TOGETHER_API_KEY: string;
  TOGETHER_API_BASE_URL: string;
  AWS_BEDROCK_CONFIG: string;

  // Local Model Providers
  OLLAMA_API_BASE_URL: string;
  LMSTUDIO_API_BASE_URL: string;
  OPENAI_LIKE_API_KEY: string;
  OPENAI_LIKE_API_BASE_URL: string;
  OPENAI_LIKE_API_MODELS: string;

  // Docker/Runtime Settings
  RUNNING_IN_DOCKER: string;
  DEFAULT_NUM_CTX: string;
}
