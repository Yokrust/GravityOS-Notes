import { AuthStorage, type AuthStatus } from "@mariozechner/pi-coding-agent";
import type { AuthPort, AuthState } from "@gravity/application";
import type {
  OAuthAuthInfo,
  OAuthLoginCallbacks,
  OAuthPrompt
} from "@mariozechner/pi-ai";

interface PiAuthProviderDefinition {
  displayName: string;
  providerId: string;
  supportsApiKey: boolean;
  supportsOAuth: boolean;
}

interface ActiveFlowRecord {
  authUrl?: string;
  errorMessage?: string;
  flowId: string;
  instructions?: string;
  progressMessage?: string;
  prompt: {
    allowEmpty?: boolean;
    kind: "text" | "manual_code";
    message: string;
    placeholder?: string;
  } | null;
  providerId: string;
  providerName: string;
  rejectInput?: (error: Error) => void;
  resolveInput?: (value: string) => void;
  status: "in_progress" | "awaiting_input" | "failed";
}

export interface PiAuthAdapterOptions {
  authStorage?: AuthStorage;
  loginWithOAuth?: (
    providerId: string,
    callbacks: OAuthLoginCallbacks
  ) => Promise<void>;
  providers?: PiAuthProviderDefinition[];
}

const DEFAULT_PI_AUTH_PROVIDERS: PiAuthProviderDefinition[] = [
  {
    displayName: "Anthropic",
    providerId: "anthropic",
    supportsApiKey: true,
    supportsOAuth: true
  },
  {
    displayName: "DeepSeek",
    providerId: "deepseek",
    supportsApiKey: true,
    supportsOAuth: false
  },
  {
    displayName: "GitHub Copilot",
    providerId: "github-copilot",
    supportsApiKey: true,
    supportsOAuth: true
  },
  {
    displayName: "Google",
    providerId: "google",
    supportsApiKey: true,
    supportsOAuth: false
  },
  {
    displayName: "Google Antigravity",
    providerId: "google-antigravity",
    supportsApiKey: true,
    supportsOAuth: true
  },
  {
    displayName: "Google Gemini CLI",
    providerId: "google-gemini-cli",
    supportsApiKey: true,
    supportsOAuth: true
  },
  {
    displayName: "Groq",
    providerId: "groq",
    supportsApiKey: true,
    supportsOAuth: false
  },
  {
    displayName: "OpenAI",
    providerId: "openai",
    supportsApiKey: true,
    supportsOAuth: false
  },
  {
    displayName: "OpenAI Codex",
    providerId: "openai-codex",
    supportsApiKey: true,
    supportsOAuth: true
  },
  {
    displayName: "OpenRouter",
    providerId: "openrouter",
    supportsApiKey: true,
    supportsOAuth: false
  },
  {
    displayName: "xAI",
    providerId: "xai",
    supportsApiKey: true,
    supportsOAuth: false
  }
];

export class PiAuthAdapter implements AuthPort {
  private activeFlow: ActiveFlowRecord | null = null;
  private activeLoginPromise: Promise<void> | null = null;
  private readonly authStorage: AuthStorage;
  private nextFlowId = 0;
  private readonly providers: PiAuthProviderDefinition[];

  constructor(private readonly options: PiAuthAdapterOptions = {}) {
    this.authStorage = options.authStorage ?? AuthStorage.create();
    this.providers = options.providers ?? DEFAULT_PI_AUTH_PROVIDERS;
  }

  async getState(): Promise<AuthState> {
    return this.serializeState();
  }

  async setApiKey(input: {
    apiKey: string;
    providerId: string;
  }): Promise<AuthState> {
    this.getProvider(input.providerId);
    this.authStorage.set(input.providerId, {
      key: input.apiKey,
      type: "api_key"
    });
    return this.serializeState();
  }

  async logout(providerId: string): Promise<AuthState> {
    this.getProvider(providerId);
    if (this.activeFlow?.providerId === providerId) {
      this.activeFlow.rejectInput?.(new Error("Auth flow cancelled."));
      this.activeFlow = null;
    }

    this.authStorage.logout(providerId);
    return this.serializeState();
  }

  async beginOAuthLogin(providerId: string): Promise<AuthState> {
    const provider = this.getProvider(providerId);
    if (!provider.supportsOAuth) {
      throw new Error(`Provider does not support OAuth login: ${providerId}`);
    }
    if (this.activeFlow?.status === "failed") {
      this.activeFlow = null;
    } else if (this.activeFlow) {
      throw new Error("Another auth flow is already active.");
    }

    const flowId = `auth_flow-${this.nextFlowId + 1}`;
    this.nextFlowId += 1;
    this.activeFlow = {
      flowId,
      prompt: null,
      providerId,
      providerName: provider.displayName,
      status: "in_progress"
    };

    this.activeLoginPromise = this.runOAuthLogin(providerId, flowId).finally(
      () => {
        this.activeLoginPromise = null;
      }
    );

    return this.serializeState();
  }

  async submitOAuthInput(input: {
    flowId: string;
    value: string;
  }): Promise<AuthState> {
    if (!this.activeFlow || this.activeFlow.flowId !== input.flowId) {
      throw new Error(`Unknown auth flow: ${input.flowId}`);
    }
    if (!this.activeFlow.resolveInput) {
      throw new Error("Auth flow is not waiting for input.");
    }

    const { allowEmpty } = this.activeFlow.prompt ?? {};
    if (!allowEmpty && !input.value.trim()) {
      throw new Error("Auth input is required.");
    }

    const resolveInput = this.activeFlow.resolveInput;
    this.activeFlow = {
      ...this.activeFlow,
      progressMessage: "Finishing provider login...",
      prompt: null,
      status: "in_progress"
    };
    delete this.activeFlow.rejectInput;
    delete this.activeFlow.resolveInput;
    resolveInput(input.value);
    await this.activeLoginPromise;
    return this.serializeState();
  }

  private async runOAuthLogin(
    providerId: string,
    flowId: string
  ): Promise<void> {
    try {
      await (this.options.loginWithOAuth ?? this.defaultLoginWithOAuth).call(
        this,
        providerId,
        {
          onAuth: (info: OAuthAuthInfo) => {
            this.updateFlow(flowId, {
              authUrl: info.url,
              ...(info.instructions ? { instructions: info.instructions } : {})
            });
          },
          onManualCodeInput: () =>
            this.waitForInput(flowId, {
              kind: "manual_code",
              message: "Enter the authorization code from the provider."
            }),
          onProgress: (message: string) => {
            this.updateFlow(flowId, {
              progressMessage: message
            });
          },
          onPrompt: (prompt: OAuthPrompt) =>
            this.waitForInput(flowId, {
              kind: "text",
              message: prompt.message,
              ...(prompt.allowEmpty !== undefined
                ? { allowEmpty: prompt.allowEmpty }
                : {}),
              ...(prompt.placeholder ? { placeholder: prompt.placeholder } : {})
            })
        }
      );
      if (this.activeFlow?.flowId === flowId) {
        this.activeFlow = null;
      }
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : "Provider login failed.";
      if (this.activeFlow?.flowId === flowId) {
        this.activeFlow = {
          ...this.activeFlow,
          errorMessage: failureMessage,
          prompt: null,
          status: "failed"
        };
        delete this.activeFlow.rejectInput;
        delete this.activeFlow.resolveInput;
      }
    }
  }

  private defaultLoginWithOAuth(
    providerId: string,
    callbacks: OAuthLoginCallbacks
  ): Promise<void> {
    return this.authStorage.login(providerId, callbacks);
  }

  private waitForInput(
    flowId: string,
    prompt: ActiveFlowRecord["prompt"]
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.activeFlow || this.activeFlow.flowId !== flowId) {
        reject(new Error(`Unknown auth flow: ${flowId}`));
        return;
      }

      this.activeFlow = {
        ...this.activeFlow,
        prompt,
        rejectInput: reject,
        resolveInput: resolve,
        status: "awaiting_input"
      };
      delete this.activeFlow.progressMessage;
    });
  }

  private updateFlow(
    flowId: string,
    changes: Partial<
      Omit<ActiveFlowRecord, "flowId" | "providerId" | "providerName">
    >
  ): void {
    if (!this.activeFlow || this.activeFlow.flowId !== flowId) {
      return;
    }

    this.activeFlow = {
      ...this.activeFlow,
      ...changes
    };
  }

  private getProvider(providerId: string): PiAuthProviderDefinition {
    const provider = this.providers.find(
      (entry) => entry.providerId === providerId
    );
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    return provider;
  }

  private serializeState(): AuthState {
    return {
      activeFlow: this.activeFlow
        ? {
            flowId: this.activeFlow.flowId,
            prompt: this.activeFlow.prompt,
            providerId: this.activeFlow.providerId,
            providerName: this.activeFlow.providerName,
            status: this.activeFlow.status,
            ...(this.activeFlow.authUrl
              ? { authUrl: this.activeFlow.authUrl }
              : {}),
            ...(this.activeFlow.errorMessage
              ? { errorMessage: this.activeFlow.errorMessage }
              : {}),
            ...(this.activeFlow.instructions
              ? { instructions: this.activeFlow.instructions }
              : {}),
            ...(this.activeFlow.progressMessage
              ? { progressMessage: this.activeFlow.progressMessage }
              : {})
          }
        : null,
      providers: this.providers
        .map((provider) => ({
          ...provider,
          status: serializeAuthStatus(
            this.authStorage.getAuthStatus(provider.providerId)
          )
        }))
        .toSorted((left, right) =>
          left.displayName.localeCompare(right.displayName)
        )
    };
  }
}

function serializeAuthStatus(status: AuthStatus): {
  configured: boolean;
  label?: string;
  source?:
    | "stored"
    | "runtime"
    | "environment"
    | "fallback"
    | "models_json_key"
    | "models_json_command";
} {
  return {
    ...(status.label ? { label: status.label } : {}),
    ...(status.source ? { source: status.source } : {}),
    configured: status.configured
  };
}
