/**
 * Query utility functions for database optimization
 */

/**
 * Paginate a Prisma query
 */
export function paginate(
  query: any,
  page: number = 1,
  pageSize: number = 10
): any {
  const skip = (page - 1) * pageSize;
  return {
    ...query,
    skip,
    take: pageSize,
  } as any;
}

/**
 * Add sorting to a Prisma query
 */
export function addSorting(
  query: any,
  sortBy: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): any {
  return {
    ...query,
    orderBy: {
      [sortBy]: sortOrder,
    },
  } as any;
}

/**
 * Add date range filter to a Prisma query
 */
export function addDateRange(
  query: any,
  field: string,
  startDate?: Date,
  endDate?: Date
): any {
  const where = query.where || {};
  const dateFilter: any = {};

  if (startDate || endDate) {
    if (startDate && endDate) {
      dateFilter[field] = {
        gte: startDate,
        lte: endDate,
      };
    } else if (startDate) {
      dateFilter[field] = {
        gte: startDate,
      };
    } else if (endDate) {
      dateFilter[field] = {
        lte: endDate,
      };
    }
  }

  return {
    ...query,
    where: {
      ...where,
      ...dateFilter,
    },
  } as any;
}

/**
 * Add soft delete filter to a Prisma query
 */
export function addSoftDeleteFilter(
  query: any,
  includeDeleted: boolean = false
): any {
  const where = query.where || {};

  if (!includeDeleted) {
    return {
      ...query,
      where: {
        ...where,
        deletedAt: null,
      },
    } as any;
  }

  return query;
}

/**
 * Build a Prisma where clause from search criteria
 */
export function buildWhereClause(criteria: Record<string, any>): any {
  const where: any = {};

  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle nested objects and operators
      where[key] = value;
    } else if (Array.isArray(value)) {
      // Handle array values (IN clause)
      where[key] = { in: value };
    } else {
      // Handle simple equality
      where[key] = value;
    }
  }

  return where;
}

/**
 * Select specific fields from a Prisma query
 */
export function selectFields(
  query: any,
  fields: string[]
): any {
  const select: Record<string, boolean> = {};
  fields.forEach(field => {
    select[field] = true;
  });

  return {
    ...query,
    select,
  } as any;
}

/**
 * Include related entities in a Prisma query
 */
export function includeRelations(
  query: any,
  relations: Record<string, boolean | any>
): any {
  return {
    ...query,
    include: relations,
  } as any;
}

/**
 * Count total records for pagination
 */
export async function getCount<T>(
  model: any,
  where?: any
): Promise<number> {
  return await model.count({ where });
}

/**
 * Execute a query with retry logic
 */
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      const backoffDelay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError!;
}

/**
 * Batch query results to avoid memory issues
 */
export async function* batchQuery<T>(
  queryFn: (skip: number, take: number) => Promise<T[]>,
  batchSize: number = 100
): AsyncGenerator<T[]> {
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const results = await queryFn(skip, batchSize);
    
    if (results.length === 0) {
      hasMore = false;
    } else {
      yield results;
      skip += batchSize;
      
      if (results.length < batchSize) {
        hasMore = false;
      }
    }
  }
}

/**
 * Cache key generator for query results
 */
export function generateCacheKey(
  modelName: string,
  operation: string,
  params: Record<string, any>
): string {
  const paramString = JSON.stringify(params, Object.keys(params).sort());
  return `${modelName}:${operation}:${Buffer.from(paramString).toString('base64')}`;
}

/**
 * Parse and validate query parameters
 */
export function parseQueryParams(params: {
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
  [key: string]: any;
}): {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters: Record<string, any>;
} {
  const page = parseInt(params.page || '1', 10);
  const pageSize = Math.min(parseInt(params.pageSize || '10', 10), 100); // Max 100 per page
  const sortBy = params.sortBy;
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  // Extract filters (non-pagination params)
  const filters: Record<string, any> = {};
  const excludeKeys = ['page', 'pageSize', 'sortBy', 'sortOrder'];
  
  for (const [key, value] of Object.entries(params)) {
    if (!excludeKeys.includes(key)) {
      filters[key] = value;
    }
  }

  return {
    page: Math.max(1, page),
    pageSize: Math.max(1, pageSize),
    sortBy,
    sortOrder,
    filters,
  };
}

/**
 * Transform query results to a standardized format
 */
export function transformResults<T, R>(
  results: T[],
  transformer: (item: T) => R
): R[] {
  return results.map(transformer);
}

/**
 * Calculate query performance metrics
 */
export interface QueryMetrics {
  executionTime: number;
  recordCount: number;
  timestamp: Date;
}

export async function measureQuery<T>(
  queryFn: () => Promise<T>
): Promise<{ result: T; metrics: QueryMetrics }> {
  const startTime = Date.now();
  const result = await queryFn();
  const executionTime = Date.now() - startTime;

  let recordCount = 0;
  if (Array.isArray(result)) {
    recordCount = result.length;
  } else if (result && typeof result === 'object') {
    // Check if it's a paginated result with count
    if ('count' in result) {
      recordCount = (result as any).count;
    } else {
      recordCount = 1;
    }
  }

  return {
    result,
    metrics: {
      executionTime,
      recordCount,
      timestamp: new Date(),
    },
  };
}

/**
 * Validate query complexity before execution
 */
export function validateQueryComplexity(
  query: any,
  maxJoins: number = 5,
  maxFilters: number = 10
): { valid: boolean; reason?: string } {
  const includeCount = query.include ? Object.keys(query.include).length : 0;
  const whereCount = query.where ? Object.keys(query.where).length : 0;

  if (includeCount > maxJoins) {
    return {
      valid: false,
      reason: `Query includes too many relations (${includeCount} > ${maxJoins})`,
    };
  }

  if (whereCount > maxFilters) {
    return {
      valid: false,
      reason: `Query has too many filters (${whereCount} > ${maxFilters})`,
    };
  }

  return { valid: true };
}

/**
 * Build a search query for text search
 */
export function buildSearchQuery(
  searchFields: string[],
  searchTerm: string
): any {
  if (!searchTerm || searchFields.length === 0) {
    return {};
  }

  const searchConditions = searchFields.map(field => ({
    [field]: {
      contains: searchTerm,
      mode: 'insensitive' as const,
    },
  }));

  return {
    OR: searchConditions,
  };
}

/**
 * Add cursor-based pagination to a query
 */
export function addCursorPagination(
  query: any,
  cursor?: string,
  cursorField: string = 'id'
): any {
  if (!cursor) {
    return query;
  }

  return {
    ...query,
    cursor: {
      [cursorField]: cursor,
    },
  } as any;
}
