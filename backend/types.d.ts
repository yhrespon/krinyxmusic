declare module "yt-search" {
  export type Video = {
    videoId: string;
    title: string;
    author?: { name?: string };
    timestamp?: string;
    seconds: number;
    thumbnail: string;
    url: string;
    views: number;
  };
  const yts: (query: string) => Promise<{ videos: Video[] }>;
  export default yts;
}
