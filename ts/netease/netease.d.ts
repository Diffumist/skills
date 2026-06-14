/**
 * netease.d.ts — 网易云音乐 Skill
 *
 * 搜索网易云歌曲、查询歌曲详情，以及获取登录用户的每日推荐。
 * 搜索和歌曲详情无需登录；每日推荐需要通过环境变量提供登录 Cookie。
 */

interface NeteaseMusicArtist {
    /** 歌手 ID */
    id: number;
    /** 歌手名称 */
    name: string;
}

interface NeteaseMusicAlbum {
    /** 专辑 ID */
    id: number;
    /** 专辑名称 */
    name: string;
    /** 专辑封面 URL */
    cover_url?: string;
}

interface NeteaseMusicSong {
    /** 歌曲 ID */
    id: number;
    /** 歌曲名称 */
    name: string;
    /** 歌手列表 */
    artists: NeteaseMusicArtist[];
    /** 所属专辑 */
    album: NeteaseMusicAlbum;
    /** 歌曲别名 */
    aliases: string[];
    /** 歌曲时长，单位毫秒 */
    duration_ms: number;
    /** 热度，通常为 0-100 */
    popularity?: number;
    /** 版权/付费类型 */
    fee?: number;
    /** 关联 MV ID，0 表示没有 MV */
    mv_id?: number;
    /** 发布时间，Unix 毫秒时间戳 */
    publish_time?: number;
    /** 网易云音乐歌曲页面 */
    web_url: string;
    /** 歌词信息。`get_song_info` 会返回该字段；搜索结果可能不包含。 */
    lyrics?: NeteaseMusicLyrics;
}

interface NeteaseMusicLyrics {
    /** 原文歌词，通常为 LRC 格式 */
    original: string;
    /** 翻译歌词，通常为 LRC 格式；没有翻译时为空字符串 */
    translated: string;
    /** 罗马音歌词，通常为 LRC 格式；没有罗马音时为空字符串 */
    romanized: string;
    /** Karaoke/逐字扩展歌词；没有时为空字符串 */
    karaoke: string;
    /** 是否至少拿到了任意一种歌词 */
    has_lyrics: boolean;
    /** 歌词贡献者 */
    lyric_user?: {
        id: number;
        name: string;
    };
    /** 歌词请求失败或不可用时的原因 */
    unavailable_reason?: string;
}

declare const netease: {
    /**
     * 按关键词搜索网易云音乐单曲，无需登录。
     *
     * @param keywords 歌曲名、歌手名或组合关键词
     * @param options 分页参数；limit 默认 20，offset 默认 0
     *
     * @example
     * const result = await netease.search_music("周杰伦 搁浅", { limit: 10 });
     * result.songs.forEach(song => {
     *   console.log(song.name, song.artists.map(a => a.name).join("/"), song.web_url);
     * });
     */
    search_music(
        keywords: string,
        options?: { limit?: number; offset?: number },
    ): Promise<{ songs: NeteaseMusicSong[]; total: number }>;

    /**
     * 获取一个或多个歌曲 ID 的详细信息，并同时返回歌词。无需登录。
     *
     * @example
     * const [song] = await netease.get_song_info(347230);
     * console.log(song.name, song.album.name, song.duration_ms);
     * console.log(song.lyrics?.original);
     *
     * @example 批量查询
     * const songs = await netease.get_song_info([347230, 347231]);
     */
    get_song_info(
        ids: number | string | Array<number | string>,
    ): Promise<NeteaseMusicSong[]>;

    /**
     * 获取当前登录用户的每日推荐歌曲。
     *
     * 需要设置完整 Cookie 到 `NETEASE_CLOUD_MUSIC_COOKIE` 环境变量。
     *
     * @example
     * const result = await netease.get_recommendations();
     * result.songs.forEach(song => console.log(song.name, song.web_url));
     */
    get_recommendations(): Promise<{
        songs: NeteaseMusicSong[];
        reasons: Array<{ song_id: number; reason: string }>;
    }>;
};
