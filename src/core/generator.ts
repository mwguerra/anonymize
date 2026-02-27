import type { Faker } from '@faker-js/faker';

export class GeneratorError extends Error {
  constructor(
    public readonly ruleId: string,
    public readonly expression: string,
    cause?: unknown,
  ) {
    super(
      `Generator error for rule "${ruleId}": failed to evaluate expression "${expression}"${cause instanceof Error ? ` — ${cause.message}` : ''}`,
    );
    this.name = 'GeneratorError';
  }
}

export class FakeValueGenerator {
  private generatorFns = new Map<string, (faker: Faker) => string>();

  constructor(private readonly faker: Faker) {}

  generate(ruleId: string, expression: string): string {
    let fn = this.generatorFns.get(ruleId);

    if (!fn) {
      fn = this.compile(ruleId, expression);
      this.generatorFns.set(ruleId, fn);
    }

    return fn(this.faker);
  }

  private compile(ruleId: string, expression: string): (faker: Faker) => string {
    try {
      const fn = new Function('faker', `return ${expression}`) as (faker: Faker) => string;

      // Validate the compiled function produces a result
      const testResult = fn(this.faker);
      if (testResult === undefined || testResult === null) {
        throw new Error('Expression returned null or undefined');
      }

      return fn;
    } catch (error) {
      throw new GeneratorError(ruleId, expression, error);
    }
  }
}

const LOCALE_MAP: Record<string, string> = {
  pt_BR: 'fakerPT_BR',
  en_US: 'fakerEN_US',
  en_GB: 'fakerEN_GB',
  en: 'fakerEN',
  es: 'fakerES',
  es_MX: 'fakerES_MX',
  fr: 'fakerFR',
  de: 'fakerDE',
  it: 'fakerIT',
  ja: 'fakerJA',
  ko: 'fakerKO',
  zh_CN: 'fakerZH_CN',
  zh_TW: 'fakerZH_TW',
  ru: 'fakerRU',
  pl: 'fakerPL',
  nl: 'fakerNL',
  sv: 'fakerSV',
  tr: 'fakerTR',
  uk: 'fakerUK',
};

export async function createFaker(locale: string): Promise<Faker> {
  const exportName = LOCALE_MAP[locale];
  if (!exportName) {
    // Fall back to default faker (en) if locale is not mapped
    const mod = await import('@faker-js/faker');
    return mod.faker;
  }

  const mod = await import('@faker-js/faker') as unknown as Record<string, Faker>;
  const fakerInstance = mod[exportName];

  if (!fakerInstance) {
    const { faker: defaultFaker } = await import('@faker-js/faker');
    return defaultFaker;
  }

  return fakerInstance;
}
