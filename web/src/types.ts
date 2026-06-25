// Общие типы индексов и правил
export type RuleItem = {
  code: string;
  kind: "section" | "param" | "example";
  title: string;
  page: number;
  x?: number;
  y: number;
  endPage?: number;
  endY?: number;
  highlightHeight?: number;
  label?: string;
  order: number;
};

export type TocSection = {
  code: string;
  title: string;
  page: number;
  x?: number;
  y?: number;
  label?: string;
  items: RuleItem[];
};

export type RulesIndex = {
  generatedAt: string;
  version: string;
  gitCommit: string;
  toc: TocSection[];
  flat: Record<string, RuleItem>;
};

export type SearchEntry = {
  code: string;
  kind: "param" | "example";
  title: string;
  page: number;
  text: string;
};
