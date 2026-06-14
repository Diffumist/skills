/**
 * youtube.d.ts — YouTube Data API Skill
 *
 * 使用 `youtube.ts` 查询公开视频、频道和评论。需要设置 `YOUTUBE_API_KEY`。
 * 所有方法均为只读操作，不提供视频下载或账号写入能力。
 */

interface YouTubeSearchOptions {
    /** 返回数量，范围 1-50，默认 10 */
    max_results?: number;
    /** 上一页结果返回的分页 token */
    page_token?: string;
    /** 排序方式 */
    order?: "date" | "relevance" | "rating" | "title" | "videoCount" | "viewCount";
    /** 只搜索指定频道中的内容 */
    channel_id?: string;
    /** 只返回此时间之后发布的内容，RFC 3339 格式 */
    published_after?: string;
    /** 只返回此时间之前发布的内容，RFC 3339 格式 */
    published_before?: string;
    /** ISO 3166-1 alpha-2 地区代码，如 "US"、"JP" */
    region_code?: string;
    /** ISO 639-1 语言代码，如 "en"、"ja" */
    relevance_language?: string;
    /** 安全搜索级别 */
    safe_search?: "moderate" | "none" | "strict";
}

interface YouTubeVideoSummary {
    id: string;
    title: string;
    description: string;
    channel_id: string;
    channel_title: string;
    published_at: string;
    live_broadcast_content: string;
    thumbnail_url?: string;
    url: string;
}

interface YouTubeVideoInfo extends YouTubeVideoSummary {
    tags: string[];
    category_id?: string;
    /** ISO 8601 时长，如 "PT4M13S" */
    duration?: string;
    definition?: string;
    has_captions: boolean;
    licensed_content?: boolean;
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    privacy_status?: string;
    embeddable?: boolean;
    made_for_kids?: boolean;
}

interface YouTubeChannelSummary {
    id: string;
    title: string;
    description: string;
    published_at: string;
    thumbnail_url?: string;
    url: string;
}

interface YouTubeChannelInfo extends YouTubeChannelSummary {
    custom_url?: string;
    country?: string;
    banner_url?: string;
    view_count?: number;
    subscriber_count?: number;
    hidden_subscriber_count: boolean;
    video_count?: number;
    uploads_playlist_id?: string;
}

interface YouTubeComment {
    id: string;
    author: string;
    author_channel_id?: string;
    text: string;
    like_count: number;
    published_at: string;
    updated_at: string;
}

declare const youtube: {
    /**
     * 搜索 YouTube 视频。YouTube Data API 的一次搜索请求通常消耗 100 quota。
     *
     * @example
     * const result = await youtube.search_videos("OpenAI", {
     *   max_results: 5,
     *   order: "viewCount",
     * });
     * result.videos.forEach(video => console.log(video.title, video.url));
     */
    search_videos(
        query: string,
        options?: YouTubeSearchOptions,
    ): Promise<{
        videos: YouTubeVideoSummary[];
        next_page_token?: string;
        total_results: number;
    }>;

    /**
     * 获取视频详情。参数可以是视频 ID、YouTube URL 或搜索关键词。
     *
     * @example
     * const video = await youtube.get_video_info("dQw4w9WgXcQ");
     * console.log(video.title, video.duration, video.view_count);
     */
    get_video_info(video: string): Promise<YouTubeVideoInfo>;

    /**
     * 搜索 YouTube 频道。一次搜索请求通常消耗 100 quota。
     *
     * @example
     * const result = await youtube.search_channels("OpenAI", { max_results: 5 });
     * result.channels.forEach(channel => console.log(channel.title, channel.url));
     */
    search_channels(
        query: string,
        options?: YouTubeSearchOptions,
    ): Promise<{
        channels: YouTubeChannelSummary[];
        next_page_token?: string;
        total_results: number;
    }>;

    /**
     * 获取频道详情。参数可以是频道 ID、频道 URL 或搜索关键词。
     *
     * @example
     * const channel = await youtube.get_channel_info("OpenAI");
     * console.log(channel.title, channel.subscriber_count, channel.video_count);
     */
    get_channel_info(channel: string): Promise<YouTubeChannelInfo>;

    /**
     * 获取视频的顶级评论及 API 返回的回复。部分视频可能关闭评论。
     *
     * @example
     * const result = await youtube.get_video_comments("dQw4w9WgXcQ", {
     *   max_results: 10,
     *   order: "relevance",
     * });
     * result.comments.forEach(item => console.log(item.comment.author, item.comment.text));
     */
    get_video_comments(
        video: string,
        options?: {
            max_results?: number;
            page_token?: string;
            order?: "relevance" | "time";
        },
    ): Promise<{
        comments: Array<{
            thread_id: string;
            comment: YouTubeComment;
            reply_count: number;
            replies: YouTubeComment[];
        }>;
        next_page_token?: string;
        total_results: number;
    }>;
};
