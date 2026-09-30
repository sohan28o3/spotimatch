import type { MusicData, MusicItem, TasteMatch } from "@/types";

export interface UserTasteVector {
  artistWeights: Map<string, number>;
  artistDisplayNames: Map<string, string>;
  artistPlays: Map<string, number>;
  genreWeights: Map<string, number>;
  artistMagnitude: number;
  genreMagnitude: number;
  topTracks: Array<{ name: string; artist: string; plays: number }>;
  primaryVibe: string;
  totalPlays: number;
}

export interface TasteMatchResult {
  matchScore: number;
  sharedArtists: string[];
  vibe: string;
  topTrack: string;
  topTrackArtist?: string;
  rawArtistCosine: number;
  rawGenreCosine: number;
  combinedSimilarity: number;
}

// Curated artist to genre/vibe mapping for accurate semantic bridging
export const ARTIST_GENRES: Record<string, string[]> = {
  // Indie / Alternative Rock / Dream Pop / Shoegaze
  "radiohead": ["art rock", "alternative rock", "electronic", "experimental"],
  "beach house": ["dream pop", "shoegaze", "indie pop"],
  "alvvays": ["jangle pop", "dream pop", "indie pop", "indie rock"],
  "slowdive": ["shoegaze", "dream pop", "ambient rock"],
  "cocteau twins": ["dream pop", "ethereal wave", "shoegaze"],
  "tame impala": ["psychedelic pop", "neo-psychedelia", "synth-pop", "indie rock"],
  "mac demarco": ["indie rock", "slacker rock", "bedroom pop", "psychedelic pop"],
  "the japanese house": ["indie pop", "electropop", "dream pop"],
  "men i trust": ["indie pop", "dream pop", "bedroom pop"],
  "cigarettes after sex": ["ambient pop", "dream pop", "slowcore"],
  "phoebe bridgers": ["indie folk", "indie rock", "chamber pop"],
  "boygenius": ["indie rock", "indie folk", "folk rock"],
  "clairo": ["bedroom pop", "indie pop", "lo-fi"],
  "mitski": ["indie rock", "art pop", "chamber pop"],
  "arctic monkeys": ["indie rock", "garage rock", "post-punk revival"],
  "the strokes": ["indie rock", "garage rock", "post-punk revival"],
  "the smiths": ["indie pop", "jangle pop", "post-punk"],
  "the cure": ["gothic rock", "post-punk", "new wave", "alternative rock"],
  "joy division": ["post-punk", "gothic rock", "new wave"],
  "new order": ["synth-pop", "post-punk", "dance-rock"],
  "interpol": ["post-punk revival", "indie rock"],
  "vampire weekend": ["indie rock", "baroque pop", "indie pop"],
  "mgmt": ["psychedelic pop", "indie pop", "synth-pop"],
  "tv girl": ["indie pop", "hypnagogic pop", "lo-fi"],
  "beabadoobee": ["indie rock", "slacker rock", "bedroom pop"],
  "wallows": ["indie rock", "indie pop", "post-punk revival"],

  // R&B / Neo-Soul / Funk / Psychedelic
  "khruangbin": ["psychedelic funk", "neo-soul", "surf rock", "world"],
  "leon bridges": ["soul", "r&b", "gospel", "neo-soul"],
  "frank ocean": ["neo-soul", "contemporary r&b", "art pop"],
  "sza": ["contemporary r&b", "neo-soul", "alt r&b"],
  "daniel caesar": ["contemporary r&b", "neo-soul", "soul"],
  "steve lacy": ["bedroom pop", "neo-soul", "lo-fi r&b", "funk"],
  "thundercat": ["funk", "jazz fusion", "neo-soul", "psychedelic funk"],
  "childish gambino": ["hip-hop", "funk", "neo-soul", "psychedelic soul"],
  "tyler, the creator": ["hip-hop", "neo-soul", "alternative hip-hop"],
  "kali uchis": ["neo-soul", "contemporary r&b", "latin pop"],
  "brent faiyaz": ["contemporary r&b", "alt r&b"],
  "the weeknd": ["contemporary r&b", "synth-pop", "pop"],
  "anderson .paak": ["neo-soul", "funk", "hip-hop", "contemporary r&b"],
  "free nationals": ["funk", "neo-soul", "r&b"],
  "toro y moi": ["chillwave", "indie pop", "synth-pop", "neo-soul"],
  "unknown mortal orchestra": ["psychedelic rock", "neo-psychedelia", "lo-fi"],
  "erykah badu": ["neo-soul", "soul", "contemporary r&b"],
  "d'angelo": ["neo-soul", "soul", "funk", "r&b"],
  "lauryn hill": ["neo-soul", "hip-hop", "r&b"],

  // Hip-Hop / Rap
  "kendrick lamar": ["conscious rap", "hip-hop", "west coast hip-hop"],
  "eminem": ["hip-hop", "rap"],
  "drake": ["hip-hop", "contemporary r&b", "pop rap"],
  "j. cole": ["conscious rap", "hip-hop"],
  "kanye west": ["hip-hop", "art pop", "progressive rap"],
  "travis scott": ["trap", "hip-hop", "psychedelic rap"],
  "21 savage": ["trap", "hip-hop"],
  "metro boomin": ["trap", "hip-hop", "beatmaking"],
  "a$ap rocky": ["cloud rap", "hip-hop", "psychedelic rap"],
  "mac miller": ["hip-hop", "jazz rap", "neo-soul"],
  "kid cudi": ["alternative hip-hop", "cloud rap", "psychedelic pop"],
  "lil wayne": ["hip-hop", "southern hip-hop"],
  "nas": ["hip-hop", "east coast hip-hop"],
  "jay-z": ["hip-hop", "east coast hip-hop"],
  "outkast": ["hip-hop", "southern hip-hop", "funk"],
  "denzel curry": ["hardcore hip-hop", "trap", "hip-hop"],
  "jid": ["hip-hop", "conscious rap"],
  "joey bada$$": ["hip-hop", "east coast hip-hop", "jazz rap"],
  "playboi carti": ["trap", "rage", "experimental hip-hop"],
  "post malone": ["pop rap", "contemporary r&b", "pop"],
  "t.i.": ["trap", "hip-hop", "southern hip-hop"],

  // Pop / Soul / Ballads / Contemporary
  "adele": ["soul", "pop", "ballad"],
  "taylor swift": ["pop", "country", "folk-pop", "indie folk"],
  "billie eilish": ["alt pop", "art pop", "electropop"],
  "olivia rodrigo": ["pop rock", "alt pop", "pop"],
  "dua lipa": ["dance-pop", "disco", "nu-disco"],
  "charli xcx": ["hyperpop", "electropop", "dance-pop"],
  "lorde": ["art pop", "electropop", "indie pop"],
  "lana del rey": ["dream pop", "baroque pop", "cinematic pop", "alt pop"],
  "ariana grande": ["pop", "contemporary r&b", "dance-pop"],
  "beyoncé": ["contemporary r&b", "pop", "dance-pop"],
  "rihanna": ["contemporary r&b", "pop", "dancehall"],
  "harry styles": ["pop rock", "soft rock", "britpop"],
  "the 1975": ["indie pop", "pop rock", "synth-pop"],
  "lauv": ["indie pop", "electropop", "pop"],
  "lany": ["indie pop", "dream pop", "synth-pop"],
  "rex orange county": ["bedroom pop", "neo-soul", "indie pop"],
  "amy winehouse": ["soul", "neo-soul", "jazz", "r&b"],

  // Electronic / Dance / Ambient
  "daft punk": ["french house", "electronic", "synth-pop", "disco"],
  "fred again..": ["electronic", "future garage", "dance"],
  "disclosure": ["uk garage", "deep house", "electronic"],
  "flume": ["future bass", "electronic", "wonky"],
  "odesza": ["chillwave", "electronic", "indie electronic"],
  "rufus du sol": ["indie electronic", "deep house", "synth-pop"],
  "kaytranada": ["electronic", "neo-soul", "house", "hip-hop"],
  "four tet": ["folktronica", "ambient", "electronic", "microhouse"],
  "aphex twin": ["idm", "ambient techno", "drill 'n' bass"],
  "bicep": ["electronic", "breakbeat", "deep house"],
  "porter robinson": ["electropop", "synth-pop", "indie electronic"],

  // Rock / Classic / Grunge
  "nirvana": ["grunge", "alternative rock"],
  "foo fighters": ["post-grunge", "alternative rock", "hard rock"],
  "red hot chili peppers": ["funk rock", "alternative rock"],
  "linkin park": ["nu metal", "alternative rock"],
  "green day": ["punk rock", "pop punk", "alternative rock"],
  "blink-182": ["pop punk", "skate punk"],
  "weezer": ["power pop", "alternative rock", "geek rock"],
  "smashing pumpkins": ["alternative rock", "grunge", "dream pop"],
  "pink floyd": ["progressive rock", "psychedelic rock", "art rock"],
  "led zeppelin": ["hard rock", "blues rock", "heavy metal"],
  "the beatles": ["classic rock", "psychedelic pop", "pop rock"],
  "queen": ["glam rock", "classic rock", "hard rock"],
  "fleetwood mac": ["soft rock", "classic rock", "pop rock"],
  "david bowie": ["glam rock", "art rock", "new wave"],
};

export const GENRE_TITLES: Record<string, string> = {
  "dream pop": "Dream Pop",
  "shoegaze": "Shoegaze",
  "art rock": "Art Rock",
  "alternative rock": "Alternative Rock",
  "indie rock": "Indie Rock",
  "indie pop": "Indie Pop",
  "jangle pop": "Jangle Pop",
  "psychedelic pop": "Psychedelic Pop",
  "psychedelic funk": "Psychedelic Funk",
  "neo-soul": "Neo-Soul",
  "soul": "Soul",
  "contemporary r&b": "Contemporary R&B",
  "r&b": "R&B",
  "alt r&b": "Alternative R&B",
  "conscious rap": "Conscious Rap",
  "hip-hop": "Hip-Hop",
  "trap": "Trap",
  "ambient pop": "Ambient Pop",
  "electronic": "Electronic",
  "synth-pop": "Synth-Pop",
  "bedroom pop": "Bedroom Pop",
  "pop": "Pop",
  "alt pop": "Alternative Pop",
  "grunge": "Grunge",
  "progressive rock": "Progressive Rock",
};

/** Normalize artist name for stable matching (handles case, whitespace, 'feat.', etc.) */
export function normalizeArtistName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s*(feat\.|ft\.|featuring).*$/i, "")
    .replace(/[^\w\s&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Get genres for an artist, querying the curated dictionary or generating fallbacks */
export function getArtistGenres(artistName: string): string[] {
  const norm = normalizeArtistName(artistName);
  if (ARTIST_GENRES[norm]) return ARTIST_GENRES[norm];

  // Partial match check for variations (e.g. "Khruangbin & Leon Bridges" matches "khruangbin")
  for (const [key, genres] of Object.entries(ARTIST_GENRES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return genres;
    }
  }

  return [];
}

/** Format a genre or vibe tag for user-facing presentation */
export function formatGenreTitle(tag: string): string {
  const lower = tag.toLowerCase().trim();
  if (GENRE_TITLES[lower]) return GENRE_TITLES[lower];
  return lower
    .split(/[\s-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Builds a weighted taste vector from a user's MusicData (favorites, spotify, lastfm).
 * Implements log-dampened play counts and genre tag projections.
 */
export function buildTasteVector(
  music: Partial<MusicData> | null | undefined,
  fallbackProfile?: { bio?: string; topTrack?: string; topTrackArtist?: string }
): UserTasteVector {
  const artistWeights = new Map<string, number>();
  const artistDisplayNames = new Map<string, string>();
  const artistPlays = new Map<string, number>();
  const genreWeights = new Map<string, number>();
  const topTracksMap = new Map<string, { name: string; artist: string; plays: number }>();
  let totalPlays = 0;

  function registerArtist(name: string, weight: number, plays = 0) {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const key = normalizeArtistName(cleanName);
    if (!key) return;

    if (!artistDisplayNames.has(key)) {
      artistDisplayNames.set(key, cleanName);
    }

    const currentW = artistWeights.get(key) || 0;
    artistWeights.set(key, currentW + weight);

    const currentP = artistPlays.get(key) || 0;
    artistPlays.set(key, currentP + plays);

    // Project artist weight onto associated genres
    const genres = getArtistGenres(cleanName);
    for (const g of genres) {
      const gw = genreWeights.get(g) || 0;
      genreWeights.set(g, gw + weight);
    }
  }

  function registerTrack(trackName: string, artistName: string, weight: number, plays = 1) {
    if (!trackName || !artistName) return;
    const trackKey = `${normalizeArtistName(artistName)}:::${trackName.toLowerCase().trim()}`;
    const existing = topTracksMap.get(trackKey);
    if (existing) {
      existing.plays += plays;
    } else {
      topTracksMap.set(trackKey, {
        name: trackName.trim(),
        artist: artistName.trim(),
        plays,
      });
    }
    registerArtist(artistName, weight, plays);
  }

  // 1. Process Favorites (Intentional handpicked affinity -> strong base weight +5.0)
  if (Array.isArray(music?.favorites)) {
    for (const fav of music.favorites) {
      if (fav.kind === "artist") {
        registerArtist(fav.name, 5.0, 10);
      } else if (fav.kind === "track") {
        registerTrack(fav.name, fav.artist, 3.5, fav.plays || 5);
      } else if (fav.kind === "album") {
        registerArtist(fav.artist, 3.0, fav.plays || 5);
      }
    }
  }

  // 2. Process Spotify Import (Log-dampened play counts: w = 1.0 + 1.5 * log2(1 + plays))
  if (music?.spotify?.items && Array.isArray(music.spotify.items)) {
    totalPlays += music.spotify.totalPlays || 0;
    for (const item of music.spotify.items) {
      const plays = Math.max(1, Number(item.plays) || 1);
      // Logarithmic damping prevents single 500-play track from dwarfing other artists
      const logWeight = 1.0 + 1.5 * Math.log2(1 + plays);

      if (item.kind === "artist") {
        registerArtist(item.name, logWeight, plays);
      } else if (item.kind === "track") {
        registerTrack(item.name, item.artist, logWeight * 0.8, plays);
      } else if (item.kind === "album") {
        registerArtist(item.artist, logWeight * 0.6, plays);
      }
    }

    // Boost monthly capsule highlights if present
    if (music.spotify.monthlyCapsules) {
      for (const cap of Object.values(music.spotify.monthlyCapsules)) {
        if (cap.topArtist?.name) registerArtist(cap.topArtist.name, 2.5, 10);
        if (cap.topSong?.name && cap.topSong?.artist) {
          registerTrack(cap.topSong.name, cap.topSong.artist, 2.0, 5);
        }
      }
    }
  }

  // 3. Process Last.fm Data
  if (music?.lastfm) {
    if (Array.isArray(music.lastfm.recentArtists)) {
      for (const a of music.lastfm.recentArtists) {
        const plays = Number(a.plays) || 4;
        const logWeight = 1.0 + 1.2 * Math.log2(1 + plays);
        registerArtist(a.name, logWeight, plays);
      }
    }
    if (Array.isArray(music.lastfm.recentTracks)) {
      for (const t of music.lastfm.recentTracks) {
        registerTrack(t.name, t.artist, 2.0, 1);
      }
    }
    if (music.lastfm.nowPlaying?.artist) {
      registerArtist(music.lastfm.nowPlaying.artist, 2.0, 1);
    }
  }

  // 4. Fallback profile info if user provided a bio or fallback track
  if (artistWeights.size === 0 && fallbackProfile) {
    if (fallbackProfile.topTrack && fallbackProfile.topTrackArtist) {
      registerTrack(fallbackProfile.topTrack, fallbackProfile.topTrackArtist, 4.0, 5);
    }
  }

  // Compute Euclidean Magnitudes
  let sumArtistSq = 0;
  for (const w of artistWeights.values()) {
    sumArtistSq += w * w;
  }
  const artistMagnitude = Math.sqrt(sumArtistSq);

  let sumGenreSq = 0;
  for (const w of genreWeights.values()) {
    sumGenreSq += w * w;
  }
  const genreMagnitude = Math.sqrt(sumGenreSq);

  // Sort top tracks by play count descending
  const sortedTracks = Array.from(topTracksMap.values()).sort((a, b) => b.plays - a.plays);

  // Determine primary vibe from top genres
  const sortedGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => formatGenreTitle(g));

  let primaryVibe = "Eclectic Music Listener";
  if (sortedGenres.length >= 2) {
    primaryVibe = `${sortedGenres[0]} & ${sortedGenres[1]}`;
  } else if (sortedGenres.length === 1) {
    primaryVibe = `${sortedGenres[0]} Enthusiast`;
  } else if (fallbackProfile?.bio) {
    primaryVibe = fallbackProfile.bio;
  }

  return {
    artistWeights,
    artistDisplayNames,
    artistPlays,
    genreWeights,
    artistMagnitude,
    genreMagnitude,
    topTracks: sortedTracks,
    primaryVibe,
    totalPlays,
  };
}

/**
 * Calculates Cosine Similarity and Harmonic Overlap between two users.
 * Returns calibrated match percentage (0-100), dynamic shared artists list, vibe, and top track.
 */
export function calculateTasteMatch(
  userA: UserTasteVector | Partial<MusicData> | null | undefined,
  userB: UserTasteVector | Partial<MusicData> | null | undefined,
  options?: {
    userBName?: string;
    userBBio?: string;
    userBTopTrackFallback?: string;
    userBTopTrackArtistFallback?: string;
  }
): TasteMatchResult {
  const vecA: UserTasteVector =
    userA && "artistWeights" in userA
      ? (userA as UserTasteVector)
      : buildTasteVector(userA as Partial<MusicData>);

  const vecB: UserTasteVector =
    userB && "artistWeights" in userB
      ? (userB as UserTasteVector)
      : buildTasteVector(userB as Partial<MusicData>, {
          bio: options?.userBBio,
          topTrack: options?.userBTopTrackFallback,
          topTrackArtist: options?.userBTopTrackArtistFallback,
        });

  // 1. Calculate Artist Cosine Similarity
  let artistDotProduct = 0;
  const sharedArtistEntries: Array<{ name: string; score: number }> = [];

  for (const [artistKey, weightA] of vecA.artistWeights.entries()) {
    const weightB = vecB.artistWeights.get(artistKey);
    if (weightB !== undefined && weightB > 0) {
      artistDotProduct += weightA * weightB;

      // Ranking score for shared artist prominence
      const displayName =
        vecB.artistDisplayNames.get(artistKey) ||
        vecA.artistDisplayNames.get(artistKey) ||
        artistKey;
      const significance = Math.min(weightA, weightB) * Math.log2(2 + weightA + weightB);
      sharedArtistEntries.push({ name: displayName, score: significance });
    }
  }

  const rawArtistCosine =
    vecA.artistMagnitude > 0 && vecB.artistMagnitude > 0
      ? Math.min(1.0, Math.max(0.0, artistDotProduct / (vecA.artistMagnitude * vecB.artistMagnitude)))
      : 0.0;

  // 2. Calculate Genre / Tag Cosine Similarity
  let genreDotProduct = 0;
  const sharedGenreEntries: Array<{ name: string; score: number }> = [];

  for (const [genreKey, weightA] of vecA.genreWeights.entries()) {
    const weightB = vecB.genreWeights.get(genreKey);
    if (weightB !== undefined && weightB > 0) {
      genreDotProduct += weightA * weightB;
      sharedGenreEntries.push({ name: genreKey, score: Math.min(weightA, weightB) });
    }
  }

  const rawGenreCosine =
    vecA.genreMagnitude > 0 && vecB.genreMagnitude > 0
      ? Math.min(1.0, Math.max(0.0, genreDotProduct / (vecA.genreMagnitude * vecB.genreMagnitude)))
      : 0.0;

  // 3. Combined Similarity (70% Direct Artists + 30% Genre/Tag Bridge)
  let combinedSimilarity = 0.0;
  if (vecA.artistMagnitude > 0 && vecB.artistMagnitude > 0) {
    if (vecA.genreMagnitude > 0 && vecB.genreMagnitude > 0) {
      combinedSimilarity = 0.7 * rawArtistCosine + 0.3 * rawGenreCosine;
    } else {
      combinedSimilarity = rawArtistCosine;
    }
  } else if (vecA.genreMagnitude > 0 && vecB.genreMagnitude > 0) {
    combinedSimilarity = 0.5 * rawGenreCosine;
  }

  // Sort shared artists by joint significance
  sharedArtistEntries.sort((a, b) => b.score - a.score);
  const sharedArtists = sharedArtistEntries.slice(0, 5).map(e => e.name);

  // 4. Calibrated Match Score
  let matchScore: number;

  if (vecA.artistMagnitude === 0 || vecB.artistMagnitude === 0) {
    // Cold start with no music data
    matchScore = 50;
  } else if (combinedSimilarity <= 0.0001) {
    // Completely disjoint tastes
    matchScore = 48;
  } else {
    // Non-linear calibration curve: S^0.65 maps cosine space to intuitive 50% - 99% scale
    const curved = Math.pow(combinedSimilarity, 0.65);
    let calculated = Math.round(48 + 51 * curved);

    // Direct artist sharing bonus
    if (sharedArtists.length >= 4) {
      calculated += 3;
    } else if (sharedArtists.length >= 2) {
      calculated += 2;
    }

    matchScore = Math.min(99, Math.max(50, calculated));
  }

  // 5. Dynamic Vibe String
  sharedGenreEntries.sort((a, b) => b.score - a.score);
  let vibe = vecB.primaryVibe;
  if (sharedGenreEntries.length >= 2) {
    vibe = `${formatGenreTitle(sharedGenreEntries[0].name)} & ${formatGenreTitle(sharedGenreEntries[1].name)}`;
  } else if (sharedGenreEntries.length === 1) {
    vibe = `${formatGenreTitle(sharedGenreEntries[0].name)} Compatibility`;
  } else if (options?.userBBio) {
    vibe = options.userBBio;
  }

  // 6. Dynamic Top Track
  let topTrack = options?.userBTopTrackFallback || "Shared Favorites";
  let topTrackArtist = options?.userBTopTrackArtistFallback;

  if (vecB.topTracks.length > 0) {
    topTrack = vecB.topTracks[0].name;
    topTrackArtist = vecB.topTracks[0].artist;
  } else if (sharedArtists.length > 0) {
    topTrack = `Top ${sharedArtists[0]} Selection`;
    topTrackArtist = sharedArtists[0];
  }

  return {
    matchScore,
    sharedArtists,
    vibe,
    topTrack,
    topTrackArtist,
    rawArtistCosine,
    rawGenreCosine,
    combinedSimilarity,
  };
}

/** Authentic music profiles for default demo candidates */
export const DEFAULT_CANDIDATE_MUSIC: Record<string, Partial<MusicData>> = {
  "user-maya": {
    favorites: [
      { kind: "artist", name: "Radiohead", artist: "" },
      { kind: "artist", name: "Beach House", artist: "" },
      { kind: "artist", name: "Frank Ocean", artist: "" },
      { kind: "artist", name: "Tame Impala", artist: "" },
      { kind: "artist", name: "Slowdive", artist: "" },
      { kind: "artist", name: "Cocteau Twins", artist: "" },
      { kind: "track", name: "Weird Fishes / Arpeggi", artist: "Radiohead", plays: 240 },
      { kind: "track", name: "Space Song", artist: "Beach House", plays: 195 },
      { kind: "track", name: "Myth", artist: "Beach House", plays: 160 },
      { kind: "track", name: "When the Sun Hits", artist: "Slowdive", plays: 140 },
    ],
  },
  "user-sam": {
    favorites: [
      { kind: "artist", name: "Khruangbin", artist: "" },
      { kind: "artist", name: "Leon Bridges", artist: "" },
      { kind: "artist", name: "Radiohead", artist: "" },
      { kind: "artist", name: "Tame Impala", artist: "" },
      { kind: "artist", name: "Kendrick Lamar", artist: "" },
      { kind: "artist", name: "Thundercat", artist: "" },
      { kind: "track", name: "Texas Sun", artist: "Khruangbin & Leon Bridges", plays: 310 },
      { kind: "track", name: "Time (You and I)", artist: "Khruangbin", plays: 220 },
      { kind: "track", name: "Pelota", artist: "Khruangbin", plays: 180 },
      { kind: "track", name: "Them Changes", artist: "Thundercat", plays: 165 },
    ],
  },
  "user-leo": {
    favorites: [
      { kind: "artist", name: "Lauv", artist: "" },
      { kind: "artist", name: "Frank Ocean", artist: "" },
      { kind: "artist", name: "Beach House", artist: "" },
      { kind: "artist", name: "Khruangbin", artist: "" },
      { kind: "artist", name: "LANY", artist: "" },
      { kind: "artist", name: "Rex Orange County", artist: "" },
      { kind: "track", name: "I Like Me Better", artist: "Lauv", plays: 280 },
      { kind: "track", name: "Pink + White", artist: "Frank Ocean", plays: 230 },
      { kind: "track", name: "ILYSB", artist: "LANY", plays: 175 },
    ],
  },
  "user-elena": {
    favorites: [
      { kind: "artist", name: "Adele", artist: "" },
      { kind: "artist", name: "Rihanna", artist: "" },
      { kind: "artist", name: "Eminem", artist: "" },
      { kind: "artist", name: "Alvvays", artist: "" },
      { kind: "artist", name: "Lana Del Rey", artist: "" },
      { kind: "artist", name: "Amy Winehouse", artist: "" },
      { kind: "track", name: "Skyfall", artist: "Adele", plays: 320 },
      { kind: "track", name: "Video Games", artist: "Lana Del Rey", plays: 210 },
      { kind: "track", name: "Back to Black", artist: "Amy Winehouse", plays: 190 },
    ],
  },
  "user-jordan": {
    favorites: [
      { kind: "artist", name: "Kendrick Lamar", artist: "" },
      { kind: "artist", name: "Eminem", artist: "" },
      { kind: "artist", name: "T.I.", artist: "" },
      { kind: "artist", name: "J. Cole", artist: "" },
      { kind: "artist", name: "A$AP Rocky", artist: "" },
      { kind: "artist", name: "Nas", artist: "" },
      { kind: "track", name: "N95", artist: "Kendrick Lamar", plays: 290 },
      { kind: "track", name: "Lose Yourself", artist: "Eminem", plays: 260 },
      { kind: "track", name: "No Role Modelz", artist: "J. Cole", plays: 215 },
    ],
  },
  "user-chloe": {
    favorites: [
      { kind: "artist", name: "Alvvays", artist: "" },
      { kind: "artist", name: "Beach House", artist: "" },
      { kind: "artist", name: "Radiohead", artist: "" },
      { kind: "artist", name: "Men I Trust", artist: "" },
      { kind: "artist", name: "The Japanese House", artist: "" },
      { kind: "track", name: "Archie, Marry Me", artist: "Alvvays", plays: 340 },
      { kind: "track", name: "Show Me How", artist: "Men I Trust", plays: 230 },
      { kind: "track", name: "Dreams Tonite", artist: "Alvvays", plays: 205 },
    ],
  },
};

/** Pre-computed taste vectors for default demo candidates */
export const DEFAULT_CANDIDATE_VECTORS: Record<string, UserTasteVector> = {
  "user-maya": buildTasteVector(DEFAULT_CANDIDATE_MUSIC["user-maya"]),
  "user-sam": buildTasteVector(DEFAULT_CANDIDATE_MUSIC["user-sam"]),
  "user-leo": buildTasteVector(DEFAULT_CANDIDATE_MUSIC["user-leo"]),
  "user-elena": buildTasteVector(DEFAULT_CANDIDATE_MUSIC["user-elena"]),
  "user-jordan": buildTasteVector(DEFAULT_CANDIDATE_MUSIC["user-jordan"]),
  "user-chloe": buildTasteVector(DEFAULT_CANDIDATE_MUSIC["user-chloe"]),
};
