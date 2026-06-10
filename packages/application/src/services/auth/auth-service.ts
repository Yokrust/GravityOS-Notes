import type { AuthPort } from "../../contracts/index.js";
import type { AuthStateRecord } from "../../dto/index.js";

export class AuthService {
  constructor(private readonly auth: AuthPort) {}

  async hydrate(): Promise<AuthStateRecord> {
    return this.auth.getState();
  }

  async saveApiKey(input: {
    apiKey: string;
    providerId: string;
  }): Promise<AuthStateRecord> {
    const providerId = input.providerId.trim();
    if (!providerId) {
      throw new Error("Provider is required.");
    }

    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      throw new Error("API key is required.");
    }

    return this.auth.setApiKey({
      apiKey,
      providerId
    });
  }

  async beginOAuthLogin(providerId: string): Promise<AuthStateRecord> {
    const normalizedProviderId = providerId.trim();
    if (!normalizedProviderId) {
      throw new Error("Provider is required.");
    }

    return this.auth.beginOAuthLogin(normalizedProviderId);
  }

  async submitOAuthInput(input: {
    flowId: string;
    value: string;
  }): Promise<AuthStateRecord> {
    if (!input.flowId.trim()) {
      throw new Error("Auth flow is required.");
    }

    return this.auth.submitOAuthInput({
      flowId: input.flowId.trim(),
      value: input.value
    });
  }

  async logout(providerId: string): Promise<AuthStateRecord> {
    const normalizedProviderId = providerId.trim();
    if (!normalizedProviderId) {
      throw new Error("Provider is required.");
    }

    return this.auth.logout(normalizedProviderId);
  }
}
