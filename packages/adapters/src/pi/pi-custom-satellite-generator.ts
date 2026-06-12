import {
  completeSimple,
  StringEnum,
  Type,
  validateToolArguments,
  type Api,
  type Model,
  type SimpleStreamOptions
} from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

import type { CustomSatelliteGeneratorPort } from "@gravity/application";
import {
  CUSTOM_SATELLITE_COLORS,
  CUSTOM_SATELLITE_ICONS,
  SATELLITE_VALUE_TYPES,
  type CustomSatelliteProposal
} from "@gravity/domain";

const proposalTool = {
  name: "propose_custom_satellite",
  description:
    "Return one safe, data-only Custom Satellite proposal for Gravity Notes.",
  parameters: Type.Object(
    {
      name: Type.String({ minLength: 1, maxLength: 50 }),
      description: Type.Optional(Type.String({ maxLength: 200 })),
      icon: StringEnum(CUSTOM_SATELLITE_ICONS),
      color: StringEnum(CUSTOM_SATELLITE_COLORS),
      appearance: Type.Literal("card"),
      properties: Type.Array(
        Type.Object(
          {
            key: Type.String({
              minLength: 1,
              maxLength: 50,
              pattern: "^[a-z][a-z0-9_]*$"
            }),
            label: Type.String({ minLength: 1, maxLength: 50 }),
            valueType: StringEnum(SATELLITE_VALUE_TYPES),
            required: Type.Boolean(),
            options: Type.Optional(
              Type.Array(Type.String({ minLength: 1, maxLength: 40 }), {
                minItems: 1,
                maxItems: 10
              })
            )
          },
          { additionalProperties: false }
        ),
        { minItems: 1, maxItems: 12 }
      )
    },
    { additionalProperties: false }
  )
};

const MODEL_PREFERENCES: ReadonlyArray<readonly [string, string]> = [
  ["openai", "gpt-5-mini"],
  ["anthropic", "claude-sonnet-4-6"],
  ["google", "gemini-2.5-flash"],
  ["openai-codex", "gpt-5.1-codex-mini"]
];

interface SatelliteModelRegistry {
  getApiKeyAndHeaders(model: Model<Api>): Promise<
    | {
        ok: true;
        apiKey?: string;
        headers?: Record<string, string>;
      }
    | {
        ok: false;
        error: string;
      }
  >;
  getAvailable(): Model<Api>[];
}

export interface PiCustomSatelliteGeneratorOptions {
  authStorage?: AuthStorage;
  complete?: typeof completeSimple;
  modelRegistry?: SatelliteModelRegistry;
}

export class PiCustomSatelliteGenerator implements CustomSatelliteGeneratorPort {
  private readonly complete: typeof completeSimple;
  private readonly modelRegistry: SatelliteModelRegistry;

  constructor(options: PiCustomSatelliteGeneratorOptions = {}) {
    const authStorage = options.authStorage ?? AuthStorage.create();
    this.modelRegistry =
      options.modelRegistry ?? ModelRegistry.create(authStorage);
    this.complete = options.complete ?? completeSimple;
  }

  async generate(description: string): Promise<CustomSatelliteProposal> {
    const model = selectSatelliteModel(this.modelRegistry.getAvailable());
    if (!model) {
      throw new Error(
        "No AI provider is configured. Add a provider credential in Settings."
      );
    }

    const auth = await this.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) {
      throw new Error(auth.error);
    }

    const response = await this.complete(
      model,
      {
        systemPrompt: [
          "You create Custom Satellites for Gravity Notes.",
          "A Custom Satellite is a passive single-column card that stores user-edited structured data.",
          "It cannot run actions, formulas, timers, reminders, notifications, network calls, or background behavior.",
          "Use only the provided tool. Call it exactly once.",
          "Prefer 3 to 7 useful properties. Do not include options on non-select properties.",
          "Respond in the same language as the user's description."
        ].join(" "),
        messages: [
          {
            role: "user",
            content: description,
            timestamp: Date.now()
          }
        ],
        tools: [proposalTool]
      },
      createSatelliteCompletionOptions(auth)
    );

    return extractProposal(response);
  }
}

export function createSatelliteCompletionOptions(auth: {
  apiKey?: string;
  headers?: Record<string, string>;
}): SimpleStreamOptions {
  return {
    ...(auth.apiKey === undefined ? {} : { apiKey: auth.apiKey }),
    ...(auth.headers === undefined ? {} : { headers: auth.headers }),
    maxTokens: 1800,
    reasoning: "minimal",
    timeoutMs: 45_000
  };
}

export function selectSatelliteModel(
  availableModels: Model<Api>[]
): Model<Api> | null {
  for (const [provider, modelId] of MODEL_PREFERENCES) {
    const match = availableModels.find(
      (model) => model.provider === provider && model.id === modelId
    );
    if (match) {
      return match;
    }
  }

  return (
    availableModels
      .filter((model) => model.input.includes("text"))
      .toSorted(
        (left, right) =>
          left.cost.output +
            left.cost.input -
            (right.cost.output + right.cost.input) ||
          left.name.localeCompare(right.name)
      )[0] ?? null
  );
}

function extractProposal(
  response: Awaited<ReturnType<typeof completeSimple>>
): CustomSatelliteProposal {
  if (response.stopReason === "error" || response.stopReason === "aborted") {
    throw new Error(response.errorMessage ?? "Satellite generation failed.");
  }

  const toolCalls = response.content.filter(
    (content): content is Extract<typeof content, { type: "toolCall" }> =>
      content.type === "toolCall" && content.name === proposalTool.name
  );
  const toolCall = toolCalls[0];
  if (toolCalls.length !== 1 || !toolCall) {
    throw new Error(
      "The AI did not return exactly one Custom Satellite proposal."
    );
  }

  const generated = validateToolArguments(proposalTool, toolCall) as {
    name: string;
    description?: string;
    icon: CustomSatelliteProposal["icon"];
    color: CustomSatelliteProposal["color"];
    appearance: "card";
    properties: Array<{
      key: string;
      label: string;
      valueType: CustomSatelliteProposal["properties"][number]["valueType"];
      required: boolean;
      options?: string[];
    }>;
  };

  return {
    name: generated.name,
    ...(generated.description === undefined
      ? {}
      : { description: generated.description }),
    icon: generated.icon,
    color: generated.color,
    appearance: "card",
    properties: generated.properties.map((property) => ({
      key: property.key,
      label: property.label,
      valueType: property.valueType,
      required: property.required,
      ...(property.options === undefined ? {} : { options: property.options })
    }))
  };
}
