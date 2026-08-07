export interface DbLike {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
      run(): Promise<unknown>;
    };
  };
}
