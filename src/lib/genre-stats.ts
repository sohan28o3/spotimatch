import type { MusicData } from "@/types";
import { buildTasteVector, formatGenreTitle } from "@/lib/music-matching";

export interface GenreStat {
  genre: string;
  listeners: number;
}

export interface GenreStats {
  genres: GenreStat[];
  totalListeners: number;
  updatedAt: string;
}

export function hasListeningConnection(music: Partial<MusicData> | null | undefined): boolean {
  return Boolean(music?.spotify || music?.lastfm);
}

export function topGenresForListener(music: Partial<MusicData>): string[] {
  const listeningOnly: Partial<MusicData> = {
    favorites: [],
    spotify: music.spotify || null,
    lastfm: music.lastfm || null,
  };

  return Array.from(buildTasteVector(listeningOnly).genreWeights.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([genre]) => formatGenreTitle(genre));
}

export function aggregateGenreStats(musicByUser: Array<Partial<MusicData>>): GenreStats {
  const counts = new Map<string, number>();
  let totalListeners = 0;

  for (const music of musicByUser) {
    if (!hasListeningConnection(music)) continue;
    totalListeners += 1;
    for (const genre of new Set(topGenresForListener(music))) {
      counts.set(genre, (counts.get(genre) || 0) + 1);
    }
  }

  return {
    genres: Array.from(counts, ([genre, listeners]) => ({ genre, listeners })).sort(
      (a, b) => b.listeners - a.listeners || a.genre.localeCompare(b.genre)
    ),
    totalListeners,
    updatedAt: new Date().toISOString(),
  };
}
