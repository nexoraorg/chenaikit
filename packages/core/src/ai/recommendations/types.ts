
export type ID = string;

export interface Interaction {
  userId: ID;
  itemId: ID;
  score?: number;

  rating?: number;
  timestamp?: number;
}

export interface Item {
  id: ID;
  title?: string;

  features?: Record<string, number | string | (string | number)[]>;
  metadata?: Record<string, any>;

  popularity?: number;
}

export interface UserProfile {
  userId: ID;

  vector: Record<string, number>;
}

export interface Recommendation {
  itemId: ID;
  score: number;
  reasons?: string[];
}
