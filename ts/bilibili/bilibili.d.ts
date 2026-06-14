/**
 * bilibili.d.ts — Bilibili 视频查询 Skill
 *
 * 搜索 Bilibili 视频并获取视频详情。无需登录。
 * 视频详情包含点赞量、收藏量和封面 URL。
 */

interface BilibiliVideoSearchResult {
    aid: number;
    bvid: string;
    title: string;
    description: string;
    author: string;
    author_id: number;
    cover_url: string;
    /** 搜索结果返回的格式化时长，如 "12:34" */
    duration: string;
    /** Unix 秒时间戳 */
    published_at: number;
    view_count: number;
    favorite_count: number;
    comment_count: number;
    danmaku_count: number;
    tags: string[];
    url: string;
}

interface BilibiliVideoInfo {
    aid: number;
    bvid: string;
    title: string;
    description: string;
    /** 视频封面 URL */
    cover_url: string;
    duration_seconds: number;
    /** Unix 秒时间戳 */
    published_at: number;
    category: string;
    category_id: number;
    author: {
        id: number;
        name: string;
        avatar_url: string;
    };
    view_count: number;
    /** 点赞量 */
    like_count: number;
    /** 收藏量 */
    favorite_count: number;
    coin_count: number;
    share_count: number;
    comment_count: number;
    danmaku_count: number;
    pages: Array<{
        cid: number;
        page: number;
        title: string;
        duration_seconds: number;
        first_frame_url: string;
    }>;
    url: string;
}

interface BilibiliRecommendedVideo {
    aid: number;
    bvid: string;
    title: string;
    /** 视频封面 URL */
    cover_url: string;
    duration_seconds: number;
    /** Unix 秒时间戳 */
    published_at: number;
    author: {
        id: number;
        name: string;
        avatar_url: string;
    };
    view_count: number;
    like_count: number;
    danmaku_count: number;
    recommendation_reason: string;
    url: string;
}

declare const bilibili: {
    /**
     * 搜索 Bilibili 视频。结果包含标题、UP 主、封面、播放量和收藏量。
     *
     * @param query 搜索关键词
     * @param options 搜索筛选与排序参数
     *
     * @example
     * const result = await bilibili.search_videos("OpenAI", {
     *   order: "click",
     *   page: 1,
     * });
     * result.videos.forEach(video => {
     *   console.log(video.title, video.author, video.cover_url, video.url);
     * });
     */
    search_videos(
        query: string,
        options?: {
            /** 页码，默认 1 */
            page?: number;
            /** 综合、播放量、发布时间、弹幕、收藏量或评论量排序 */
            order?: "totalrank" | "click" | "pubdate" | "dm" | "stow" | "scores";
            /** 0 全部；1 十分钟以下；2 10-30 分钟；3 30-60 分钟；4 超过 60 分钟 */
            duration?: "0" | "1" | "2" | "3" | "4";
            /** Bilibili 分区 tid */
            category_id?: number;
        },
    ): Promise<{
        videos: BilibiliVideoSearchResult[];
        page: number;
        total_results: number;
        total_pages: number;
    }>;

    /**
     * 获取视频详情，包括点赞量、收藏量和封面 URL。
     *
     * 参数支持 BV 号、AV 号、数字 aid 或 Bilibili 视频 URL。
     *
     * @example
     * const video = await bilibili.get_video_info("BV1GJ411x7h7");
     * console.log(video.title);
     * console.log(video.like_count, video.favorite_count);
     * console.log(video.cover_url);
     */
    get_video_info(id_or_url: string | number): Promise<BilibiliVideoInfo>;

    /**
     * 获取 Bilibili 首页视频推荐。
     *
     * 未设置 `BILIBILI_COOKIE` 时返回游客推荐；设置后返回登录用户的个性化推荐。
     * 推荐接口不返回收藏量，需要通过 `get_video_info` 获取。
     *
     * @example
     * const result = await bilibili.get_recommendations({ limit: 10 });
     * console.log(result.personalized);
     * result.videos.forEach(video => {
     *   console.log(video.title, video.like_count, video.cover_url);
     * });
     */
    get_recommendations(options?: {
        /** 返回数量，默认 20，最大 50 */
        limit?: number;
    }): Promise<{
        /** 是否使用了 `BILIBILI_COOKIE` */
        personalized: boolean;
        videos: BilibiliRecommendedVideo[];
    }>;
};
