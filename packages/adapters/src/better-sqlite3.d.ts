declare module "better-sqlite3" {
  interface Statement {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  interface Database {
    pragma(command: string): unknown;
    exec(command: string): this;
    prepare(command: string): Statement;
    transaction<TArgs extends unknown[]>(
      fn: (...args: TArgs) => void
    ): (...args: TArgs) => void;
    close(): void;
  }

  interface DatabaseConstructor {
    new (databasePath: string): Database;
  }

  const Database: DatabaseConstructor;

  export default Database;
}
