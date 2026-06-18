/**
 * Type shim for typeorm
 *
 * Covers the subset used in this project (decorators + DataSource + QueryRunner).
 * Replace by installing typeorm once package management is unblocked.
 */

// ─── Decorator factories ──────────────────────────────────────────────────────

export declare function Entity(name?: string): ClassDecorator;
export declare function PrimaryGeneratedColumn(strategy?: 'uuid' | 'increment' | 'rowid'): PropertyDecorator;
export declare function Column(opts?: Record<string, unknown>): PropertyDecorator;
export declare function ManyToOne(typeFn: () => Function, inverseSideOrOpts?: Function | string | Record<string, unknown>, opts?: Record<string, unknown>): PropertyDecorator;
export declare function OneToMany(typeFn: () => Function, inverseSide: Function | string, opts?: Record<string, unknown>): PropertyDecorator;
export declare function OneToOne(typeFn: () => Function, inverseSide?: Function | string, opts?: Record<string, unknown>): PropertyDecorator;
export declare function JoinColumn(opts?: Record<string, unknown>): PropertyDecorator;
export declare function Index(fields?: string | string[]): ClassDecorator & PropertyDecorator;
export declare function Unique(fields?: string | string[]): ClassDecorator;
export declare function CreateDateColumn(opts?: Record<string, unknown>): PropertyDecorator;
export declare function UpdateDateColumn(opts?: Record<string, unknown>): PropertyDecorator;
export declare function DeleteDateColumn(opts?: Record<string, unknown>): PropertyDecorator;

// ─── Repository / QueryBuilder ────────────────────────────────────────────────

export interface SelectQueryBuilder<Entity> {
  where(condition: string, params?: Record<string, unknown>): this;
  andWhere(condition: string, params?: Record<string, unknown>): this;
  orWhere(condition: string, params?: Record<string, unknown>): this;
  select(selection: string, selectionAliasName?: string): this;
  addSelect(selection: string, selectionAliasName?: string): this;
  groupBy(field: string): this;
  addGroupBy(field: string): this;
  orderBy(field: string, order?: 'ASC' | 'DESC'): this;
  limit(limit: number): this;
  offset(offset: number): this;
  leftJoinAndSelect(relation: string, alias: string): this;
  innerJoinAndSelect(relation: string, alias: string): this;
  getOne(): Promise<Entity | null>;
  getMany(): Promise<Entity[]>;
  getRawOne<T = Record<string, unknown>>(): Promise<T>;
  getRawMany<T = Record<string, unknown>>(): Promise<T[]>;
}

export interface Repository<Entity> {
  find(opts?: Record<string, unknown>): Promise<Entity[]>;
  findOne(opts: Record<string, unknown>): Promise<Entity | null>;
  save(entity: Partial<Entity>): Promise<Entity>;
  remove(entity: Entity): Promise<Entity>;
  count(opts?: Record<string, unknown>): Promise<number>;
  createQueryBuilder(alias: string): SelectQueryBuilder<Entity>;
}

// ─── DataSource ───────────────────────────────────────────────────────────────

export declare class DataSource {
  constructor(opts: Record<string, unknown>);
  initialize(): Promise<this>;
  destroy(): Promise<void>;
  getRepository<T>(entity: new (...args: unknown[]) => T): Repository<T>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
}

// ─── QueryRunner (used in migrations) ────────────────────────────────────────

export interface QueryRunner {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  createTable(table: unknown, ifNotExist?: boolean): Promise<void>;
  dropTable(tableName: string, ifExist?: boolean): Promise<void>;
  addColumn(table: string | unknown, column: unknown): Promise<void>;
  dropColumn(table: string | unknown, columnName: string | unknown): Promise<void>;
}

export interface MigrationInterface {
  up(queryRunner: QueryRunner): Promise<void>;
  down(queryRunner: QueryRunner): Promise<void>;
}
