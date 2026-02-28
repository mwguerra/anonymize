import { AnonymizationCache } from './cache.js';
import { FakeValueGenerator } from './generator.js';
import type { Logger } from '../utils/logger.js';

const MAX_COLLISION_RETRIES = 10;

export interface AnonymizeCellDeps {
  cache: AnonymizationCache;
  generator: FakeValueGenerator;
  logger: Logger;
}

export function composeCacheKey(original: string, identityValue?: string): string {
  return identityValue ? `${identityValue}::${original}` : original;
}

export function anonymizeCell(
  deps: AnonymizeCellDeps,
  ruleId: string,
  expression: string,
  original: string | null | undefined,
  identityValue?: string,
): string | null | undefined {
  if (original === null || original === undefined || original.trim() === '') {
    return original;
  }

  const cacheKey = composeCacheKey(original, identityValue);

  const cached = deps.cache.get(ruleId, cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let fake: string = '';
  let attempts = 0;

  while (attempts < MAX_COLLISION_RETRIES) {
    fake = String(deps.generator.generate(ruleId, expression));
    attempts++;

    if (!deps.cache.hasValue(ruleId, fake)) {
      break;
    }

    if (attempts === MAX_COLLISION_RETRIES) {
      deps.logger.warn(
        `Collision limit reached for rule "${ruleId}" after ${MAX_COLLISION_RETRIES} attempts. Using last generated value.`,
      );
    }
  }

  deps.cache.set(ruleId, cacheKey, fake);
  return fake;
}
