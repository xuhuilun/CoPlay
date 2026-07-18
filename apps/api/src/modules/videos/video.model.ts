export type Video = {
  id: string;
  title: string;
  description: string;
  source: "bilibili" | "library";
  sourceUrl: string;
  cdnUrl: string;
  posterUrl: string;
  durationSeconds: number;
  cachedAt: string;
  tags: string[];
  hotScore: number;
};
