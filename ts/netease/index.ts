import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// The SDK logs IP-range loading and dotenv tips during import. Keep skill calls quiet.
const sdkLogger = require("@neteasecloudmusicapienhanced/api/util/logger.js") as {
    info: (...args: unknown[]) => void;
};
const originalInfo = sdkLogger.info;
const originalDotenvQuiet = process.env.DOTENV_CONFIG_QUIET;
sdkLogger.info = () => {};
process.env.DOTENV_CONFIG_QUIET = "true";

let api: typeof import("@neteasecloudmusicapienhanced/api");
try {
    api = require("@neteasecloudmusicapienhanced/api");
} finally {
    sdkLogger.info = originalInfo;
    if (originalDotenvQuiet === undefined) {
        delete process.env.DOTENV_CONFIG_QUIET;
    } else {
        process.env.DOTENV_CONFIG_QUIET = originalDotenvQuiet;
    }
}

type RawArtist = {
    id?: number;
    name?: string;
};

type RawAlbum = {
    id?: number;
    name?: string;
    picUrl?: string;
};

type RawSong = {
    id?: number;
    name?: string;
    ar?: RawArtist[];
    artists?: RawArtist[];
    al?: RawAlbum;
    album?: RawAlbum;
    alia?: string[];
    alias?: string[];
    dt?: number;
    duration?: number;
    pop?: number;
    popularity?: number;
    fee?: number;
    mv?: number;
    mvid?: number;
    publishTime?: number;
};

type RawLyricBlock = {
    lyric?: string;
    version?: number;
};

type RawLyricResponse = {
    lrc?: RawLyricBlock;
    tlyric?: RawLyricBlock;
    romalrc?: RawLyricBlock;
    klyric?: RawLyricBlock;
    lyricUser?: {
        id?: number;
        userid?: number;
        nickname?: string;
    };
};

type ApiResponse<T> = {
    status: number;
    body: T & {
        code?: number;
        message?: string;
        msg?: string;
    };
};

type MusicSong = {
    id: number;
    name: string;
    artists: Array<{ id: number; name: string }>;
    album: { id: number; name: string; cover_url?: string };
    aliases: string[];
    duration_ms: number;
    popularity?: number;
    fee?: number;
    mv_id?: number;
    publish_time?: number;
    web_url: string;
    lyrics?: MusicLyrics;
};

type MusicLyrics = {
    original: string;
    translated: string;
    romanized: string;
    karaoke: string;
    has_lyrics: boolean;
    lyric_user?: {
        id: number;
        name: string;
    };
    unavailable_reason?: string;
};

const cookie = process.env.NETEASE_CLOUD_MUSIC_COOKIE?.trim();

function normalizeSong(song: RawSong): MusicSong {
    const album = song.al ?? song.album ?? {};

    return {
        id: song.id ?? 0,
        name: song.name ?? "",
        artists: (song.ar ?? song.artists ?? []).map((artist) => ({
            id: artist.id ?? 0,
            name: artist.name ?? "",
        })),
        album: {
            id: album.id ?? 0,
            name: album.name ?? "",
            ...(album.picUrl ? { cover_url: album.picUrl } : {}),
        },
        aliases: song.alia ?? song.alias ?? [],
        duration_ms: song.dt ?? song.duration ?? 0,
        ...(song.pop !== undefined || song.popularity !== undefined
            ? { popularity: song.pop ?? song.popularity }
            : {}),
        ...(song.fee !== undefined ? { fee: song.fee } : {}),
        ...(song.mv !== undefined || song.mvid !== undefined
            ? { mv_id: song.mv ?? song.mvid }
            : {}),
        ...(song.publishTime !== undefined ? { publish_time: song.publishTime } : {}),
        web_url: `https://music.163.com/song?id=${song.id ?? 0}`,
    };
}

function normalizeLyrics(body: RawLyricResponse): MusicLyrics {
    const lyrics = {
        original: body.lrc?.lyric ?? "",
        translated: body.tlyric?.lyric ?? "",
        romanized: body.romalrc?.lyric ?? "",
        karaoke: body.klyric?.lyric ?? "",
    };

    return {
        ...lyrics,
        has_lyrics: Object.values(lyrics).some(Boolean),
        ...(body.lyricUser
            ? {
                  lyric_user: {
                      id: body.lyricUser.id ?? body.lyricUser.userid ?? 0,
                      name: body.lyricUser.nickname ?? "",
                  },
              }
            : {}),
    };
}

function unwrap<T>(response: ApiResponse<T>, action: string): T {
    const code = response.body.code;
    if (response.status >= 400 || (code !== undefined && code !== 200)) {
        const message = response.body.message ?? response.body.msg ?? `code ${code ?? response.status}`;
        throw new Error(`[netease skill] ${action}失败：${message}`);
    }

    return response.body;
}

function withCookie<T extends Record<string, unknown>>(params: T): T & { cookie?: string } {
    return cookie ? { ...params, cookie } : params;
}

function normalizeSongIds(ids: number | string | Array<number | string>): string {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (
        idList.length === 0 ||
        idList.length > 1000 ||
        idList.some((id) => !/^\d+$/.test(String(id).trim()))
    ) {
        throw new Error("[netease skill] 请提供 1 到 1000 个有效的数字歌曲 ID。");
    }

    return idList.map((id) => String(id).trim()).join(",");
}

async function getLyrics(songId: number): Promise<MusicLyrics> {
    try {
        const response = await api.lyric(withCookie({ id: songId }));
        const body = unwrap(response as ApiResponse<RawLyricResponse>, "获取歌词");
        return normalizeLyrics(body);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            original: "",
            translated: "",
            romanized: "",
            karaoke: "",
            has_lyrics: false,
            unavailable_reason: message,
        };
    }
}

async function mapWithConcurrency<T, R>(
    values: T[],
    limit: number,
    mapper: (value: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(values.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < values.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(values[index]);
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(limit, values.length) }, () => worker()),
    );
    return results;
}

export default {
    /**
     * 搜索网易云音乐单曲。
     */
    search_music: async (
        keywords: string,
        options?: { limit?: number; offset?: number },
    ): Promise<{ songs: MusicSong[]; total: number }> => {
        if (!keywords.trim()) {
            throw new Error("[netease skill] 搜索关键词不能为空。");
        }

        const limit = Math.min(100, Math.max(1, Math.trunc(options?.limit ?? 20)));
        const offset = Math.max(0, Math.trunc(options?.offset ?? 0));
        const response = await api.cloudsearch(
            withCookie({
                keywords: keywords.trim(),
                type: 1,
                limit,
                offset,
            }),
        );
        const body = unwrap(
            response as ApiResponse<{ result?: { songs?: RawSong[]; songCount?: number } }>,
            "搜索音乐",
        );

        return {
            songs: (body.result?.songs ?? []).map(normalizeSong),
            total: body.result?.songCount ?? 0,
        };
    },

    /**
     * 获取一个或多个网易云歌曲的详细信息。
     */
    get_song_info: async (
        ids: number | string | Array<number | string>,
    ): Promise<MusicSong[]> => {
        const response = await api.song_detail(
            withCookie({ ids: normalizeSongIds(ids) }),
        );
        const body = unwrap(
            response as ApiResponse<{ songs?: RawSong[] }>,
            "获取歌曲信息",
        );

        const songs = (body.songs ?? []).map(normalizeSong);

        return mapWithConcurrency(songs, 5, async (song) => ({
            ...song,
            lyrics: await getLyrics(song.id),
        }));
    },

    /**
     * 获取登录用户的每日推荐歌曲。
     */
    get_recommendations: async (): Promise<{
        songs: MusicSong[];
        reasons: Array<{ song_id: number; reason: string }>;
    }> => {
        if (!cookie) {
            throw new Error(
                "[netease skill] 每日推荐需要登录。请设置 NETEASE_CLOUD_MUSIC_COOKIE。",
            );
        }

        const response = await api.recommend_songs({ cookie });
        const body = unwrap(
            response as ApiResponse<{
                data?: {
                    dailySongs?: RawSong[];
                    recommendReasons?: Array<{
                        songId?: number;
                        reason?: string;
                    }>;
                };
            }>,
            "获取每日推荐",
        );

        return {
            songs: (body.data?.dailySongs ?? []).map(normalizeSong),
            reasons: (body.data?.recommendReasons ?? []).map((item) => ({
                song_id: item.songId ?? 0,
                reason: item.reason ?? "",
            })),
        };
    },
};
