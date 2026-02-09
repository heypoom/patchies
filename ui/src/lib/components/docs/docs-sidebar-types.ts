export interface Topic {
  slug: string;
  title: string;
  category?: string;
}

export interface ObjectItem {
  slug: string;
  title?: string;
}

export type TopicsByCategory = Map<string, Topic[]>;
