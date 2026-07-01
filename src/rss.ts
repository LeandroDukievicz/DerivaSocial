import Parser from 'rss-parser';
import { config } from './config.ts';
import { get } from './state.ts';

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ['description', 'descriptionRaw'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

export interface Post {
  guid: string;
  title: string;
  link: string;
  summary: string;
  categories: string[];
  image?: string;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchPosts(): Promise<Post[]> {
  const feed = await parser.parseURL(config.rssUrl);
  return (feed.items || [])
    .map((it: any): Post => ({
      guid: it.guid || it.link || it.title || '',
      title: (it.title || '').trim(),
      link: it.link || '',
      summary: stripHtml(it.descriptionRaw || it.contentSnippet || '').slice(0, 600),
      categories: it.categories || [],
      image: it.enclosure?.url,
    }))
    .filter((p) => p.guid && p.link);
}

/** Posts que ainda não estão no estado (nunca vistos). */
export function newPosts(posts: Post[]): Post[] {
  const seen = get().seen;
  return posts.filter((p) => !seen[p.guid]);
}
