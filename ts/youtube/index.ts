import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Youtube = require("youtube.ts").default as typeof import("youtube.ts").default;
const decodeHtml = require("he").decode as (text: string) => string;

type ThumbnailMap = Record<
    string,
    { url?: string; width?: number; height?: number } | undefined
>;

type SearchItem = {
    id?: { videoId?: string; channelId?: string };
    snippet?: {
        title?: string;
        description?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        liveBroadcastContent?: string;
        thumbnails?: ThumbnailMap;
    };
};

type Video = {
    id?: string;
    snippet?: {
        title?: string;
        description?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        tags?: string[];
        categoryId?: string;
        liveBroadcastContent?: string;
        thumbnails?: ThumbnailMap;
    };
    contentDetails?: {
        duration?: string;
        definition?: string;
        caption?: string;
        licensedContent?: boolean;
    };
    statistics?: {
        viewCount?: string;
        likeCount?: string;
        favoriteCount?: string;
        commentCount?: string;
    };
    status?: {
        privacyStatus?: string;
        embeddable?: boolean;
        madeForKids?: boolean;
    };
};

type Channel = {
    id?: string;
    snippet?: {
        title?: string;
        description?: string;
        customUrl?: string;
        publishedAt?: string;
        country?: string;
        thumbnails?: ThumbnailMap;
    };
    statistics?: {
        viewCount?: string;
        subscriberCount?: string;
        hiddenSubscriberCount?: boolean;
        videoCount?: string;
    };
    contentDetails?: {
        relatedPlaylists?: { uploads?: string };
    };
    brandingSettings?: {
        image?: { bannerExternalUrl?: string };
    };
};

type Comment = {
    id?: string;
    snippet?: {
        authorDisplayName?: string;
        authorChannelId?: { value?: string };
        textOriginal?: string;
        likeCount?: number;
        publishedAt?: string;
        updatedAt?: string;
    };
};

type CommentThread = {
    id?: string;
    snippet?: {
        topLevelComment?: Comment;
        totalReplyCount?: number;
        canReply?: boolean;
        isPublic?: boolean;
    };
    replies?: { comments?: Comment[] };
    totalReplyCount?: number;
    canReply?: boolean;
    isPublic?: boolean;
};

type SearchOptions = {
    max_results?: number;
    page_token?: string;
    order?: "date" | "relevance" | "rating" | "title" | "videoCount" | "viewCount";
    channel_id?: string;
    published_after?: string;
    published_before?: string;
    region_code?: string;
    relevance_language?: string;
    safe_search?: "moderate" | "none" | "strict";
};

let client: InstanceType<typeof Youtube> | undefined;

function getClient() {
    const apiKey = process.env.YOUTUBE_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("[youtube skill] 请设置 YOUTUBE_API_KEY。");
    }
    if (!client) client = new Youtube(apiKey);
    return client;
}

function getThumbnail(thumbnails?: ThumbnailMap): string | undefined {
    return (
        thumbnails?.maxres?.url ??
        thumbnails?.standard?.url ??
        thumbnails?.high?.url ??
        thumbnails?.medium?.url ??
        thumbnails?.default?.url
    );
}

function normalizeCount(value?: string): number | undefined {
    if (value === undefined) return undefined;
    const count = Number(value);
    return Number.isSafeInteger(count) ? count : undefined;
}

function maxResults(value: number | undefined, fallback: number): number {
    const result = Math.trunc(value ?? fallback);
    return Number.isFinite(result) ? Math.min(50, Math.max(1, result)) : fallback;
}

function normalizeError(error: unknown, action: string): Error {
    if (error instanceof Error && error.message.startsWith("[youtube skill]")) {
        return error;
    }
    const apiMessage =
        typeof error === "object" && error !== null
            ? (error as {
                  response?: { data?: { error?: { message?: string } } };
              }).response?.data?.error?.message
            : undefined;
    const message = apiMessage ?? (typeof error === "string" ? error : "请求失败");
    return new Error(`[youtube skill] ${action}失败：${message}`);
}

function searchParams(query: string, options?: SearchOptions) {
    if (!query.trim()) throw new Error("[youtube skill] 搜索关键词不能为空。");

    return {
        q: query.trim(),
        maxResults: maxResults(options?.max_results, 10),
        ...(options?.page_token ? { pageToken: options.page_token } : {}),
        ...(options?.order ? { order: options.order } : {}),
        ...(options?.channel_id ? { channelId: options.channel_id } : {}),
        ...(options?.published_after ? { publishedAfter: options.published_after } : {}),
        ...(options?.published_before ? { publishedBefore: options.published_before } : {}),
        ...(options?.region_code ? { regionCode: options.region_code } : {}),
        ...(options?.relevance_language
            ? { relevanceLanguage: options.relevance_language }
            : {}),
        ...(options?.safe_search ? { safeSearch: options.safe_search } : {}),
    };
}

function normalizeVideoSearch(item: SearchItem) {
    const id = item.id?.videoId ?? "";
    return {
        id,
        title: decodeHtml(item.snippet?.title ?? ""),
        description: decodeHtml(item.snippet?.description ?? ""),
        channel_id: item.snippet?.channelId ?? "",
        channel_title: decodeHtml(item.snippet?.channelTitle ?? ""),
        published_at: item.snippet?.publishedAt ?? "",
        live_broadcast_content: item.snippet?.liveBroadcastContent ?? "none",
        thumbnail_url: getThumbnail(item.snippet?.thumbnails),
        url: `https://www.youtube.com/watch?v=${id}`,
    };
}

function normalizeVideo(video: Video) {
    const id = video.id ?? "";
    return {
        id,
        title: decodeHtml(video.snippet?.title ?? ""),
        description: decodeHtml(video.snippet?.description ?? ""),
        channel_id: video.snippet?.channelId ?? "",
        channel_title: decodeHtml(video.snippet?.channelTitle ?? ""),
        published_at: video.snippet?.publishedAt ?? "",
        tags: video.snippet?.tags ?? [],
        category_id: video.snippet?.categoryId,
        live_broadcast_content: video.snippet?.liveBroadcastContent ?? "none",
        thumbnail_url: getThumbnail(video.snippet?.thumbnails),
        duration: video.contentDetails?.duration,
        definition: video.contentDetails?.definition,
        has_captions: video.contentDetails?.caption === "true",
        licensed_content: video.contentDetails?.licensedContent,
        view_count: normalizeCount(video.statistics?.viewCount),
        like_count: normalizeCount(video.statistics?.likeCount),
        comment_count: normalizeCount(video.statistics?.commentCount),
        privacy_status: video.status?.privacyStatus,
        embeddable: video.status?.embeddable,
        made_for_kids: video.status?.madeForKids,
        url: `https://www.youtube.com/watch?v=${id}`,
    };
}

function normalizeChannelSearch(item: SearchItem) {
    const id = item.id?.channelId ?? "";
    return {
        id,
        title: decodeHtml(item.snippet?.title ?? ""),
        description: decodeHtml(item.snippet?.description ?? ""),
        published_at: item.snippet?.publishedAt ?? "",
        thumbnail_url: getThumbnail(item.snippet?.thumbnails),
        url: `https://www.youtube.com/channel/${id}`,
    };
}

function normalizeChannel(channel: Channel) {
    const id = channel.id ?? "";
    return {
        id,
        title: decodeHtml(channel.snippet?.title ?? ""),
        description: decodeHtml(channel.snippet?.description ?? ""),
        custom_url: channel.snippet?.customUrl,
        published_at: channel.snippet?.publishedAt ?? "",
        country: channel.snippet?.country,
        thumbnail_url: getThumbnail(channel.snippet?.thumbnails),
        banner_url: channel.brandingSettings?.image?.bannerExternalUrl,
        view_count: normalizeCount(channel.statistics?.viewCount),
        subscriber_count: normalizeCount(channel.statistics?.subscriberCount),
        hidden_subscriber_count: channel.statistics?.hiddenSubscriberCount ?? false,
        video_count: normalizeCount(channel.statistics?.videoCount),
        uploads_playlist_id: channel.contentDetails?.relatedPlaylists?.uploads,
        url: `https://www.youtube.com/channel/${id}`,
    };
}

function normalizeComment(comment?: Comment) {
    return {
        id: comment?.id ?? "",
        author: decodeHtml(comment?.snippet?.authorDisplayName ?? ""),
        author_channel_id: comment?.snippet?.authorChannelId?.value,
        text: decodeHtml(comment?.snippet?.textOriginal ?? ""),
        like_count: comment?.snippet?.likeCount ?? 0,
        published_at: comment?.snippet?.publishedAt ?? "",
        updated_at: comment?.snippet?.updatedAt ?? "",
    };
}

export default {
    search_videos: async (query: string, options?: SearchOptions) => {
        try {
            const result = await getClient().videos.search(searchParams(query, options));
            return {
                videos: ((result.items ?? []) as SearchItem[]).map(normalizeVideoSearch),
                next_page_token: result.nextPageToken,
                total_results: result.pageInfo?.totalResults ?? 0,
            };
        } catch (error) {
            throw normalizeError(error, "搜索视频");
        }
    },

    get_video_info: async (video: string) => {
        try {
            return normalizeVideo((await getClient().videos.get(video)) as Video);
        } catch (error) {
            throw normalizeError(error, "获取视频详情");
        }
    },

    search_channels: async (query: string, options?: SearchOptions) => {
        try {
            const result = await getClient().channels.search(searchParams(query, options));
            return {
                channels: ((result.items ?? []) as SearchItem[]).map(normalizeChannelSearch),
                next_page_token: result.nextPageToken,
                total_results: result.pageInfo?.totalResults ?? 0,
            };
        } catch (error) {
            throw normalizeError(error, "搜索频道");
        }
    },

    get_channel_info: async (channel: string) => {
        try {
            return normalizeChannel((await getClient().channels.get(channel)) as Channel);
        } catch (error) {
            throw normalizeError(error, "获取频道详情");
        }
    },

    get_video_comments: async (
        video: string,
        options?: { max_results?: number; page_token?: string; order?: "relevance" | "time" },
    ) => {
        try {
            const result = await getClient().videos.comments(video, {
                maxResults: String(maxResults(options?.max_results, 20)),
                textFormat: "plainText",
                ...(options?.page_token ? { pageToken: options.page_token } : {}),
                ...(options?.order ? { order: options.order } : {}),
            });

            return {
                comments: ((result.items ?? []) as CommentThread[]).map((thread) => ({
                    thread_id: thread.id ?? "",
                    comment: normalizeComment(thread.snippet?.topLevelComment),
                    reply_count:
                        thread.snippet?.totalReplyCount ?? thread.totalReplyCount ?? 0,
                    replies: (thread.replies?.comments ?? []).map(normalizeComment),
                })),
                next_page_token: (result as { nextPageToken?: string }).nextPageToken,
                total_results: result.pageInfo?.totalResults ?? 0,
            };
        } catch (error) {
            throw normalizeError(error, "获取视频评论");
        }
    },
};
