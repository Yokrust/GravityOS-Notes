import { randomUUID } from "node:crypto";

import type { IdGeneratorPort } from "@gravity/application";

interface PrefixedIdGeneratorOptions {
  randomUuid?: () => string;
}

export function createPrefixedIdGenerator(
  options: PrefixedIdGeneratorOptions = {}
): IdGeneratorPort {
  const nextUuid = options.randomUuid ?? randomUUID;

  return {
    next(prefix: string) {
      const normalizedPrefix = prefix.trim();
      if (!normalizedPrefix) {
        throw new Error("ID prefix is required.");
      }

      return `${normalizedPrefix}-${nextUuid()}`;
    }
  };
}
