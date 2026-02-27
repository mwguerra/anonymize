export class AnonymizationCache {
  private cache = new Map<string, Map<string, string>>();

  get(ruleId: string, original: string): string | undefined {
    return this.cache.get(ruleId)?.get(original);
  }

  set(ruleId: string, original: string, fake: string): void {
    if (!this.cache.has(ruleId)) {
      this.cache.set(ruleId, new Map());
    }
    this.cache.get(ruleId)!.set(original, fake);
  }

  has(ruleId: string, original: string): boolean {
    return this.cache.get(ruleId)?.has(original) ?? false;
  }

  hasValue(ruleId: string, fake: string): boolean {
    const ruleMap = this.cache.get(ruleId);
    if (!ruleMap) return false;
    for (const value of ruleMap.values()) {
      if (value === fake) return true;
    }
    return false;
  }

  size(ruleId: string): number {
    return this.cache.get(ruleId)?.size ?? 0;
  }

  ruleIds(): string[] {
    return [...this.cache.keys()];
  }

  clear(): void {
    this.cache.clear();
  }
}
