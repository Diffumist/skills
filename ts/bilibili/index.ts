import { Client } from "@renmu/bili-api";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const decodeHtml = require("he").decode as (text: string) => string;
const client = new Client();

type RawSearchVideo = {
    aid?: number;
    bvid?: string;
    title?: string;
    description?: string;
    author?: string;
    mid?: number;
    pic?: string;
    arcurl?: string;
    duration?: string;
    pubdate?: number;
    play?: number;
    favorites?: number;
    review?: number;
    video_review?: number;
    tag?: string;
};

type RawVideoInfo = {
    aid?: number;
    bvid?: string;
    title?: string;
    desc?: string;
    pic?: string;
    duration?: number;
    pubdate?: number;
    tname?: string;
    tid?: number;
    owner?: {
        mid?: number;
        name?: string;
        face?: string;
    };
    stat?: {
        view?: number;
        danmaku?: number;
        reply?: number;
        favorite?: number;
        coin?: number;
        share?: number;
        like?: number;
    };
    pages?: Array<{
        cid?: number;
        page?: number;
        part?: string;
        duration?: number;
        first_frame?: string;
    }>;
};

type RawRecommendation = {
    id?: number;
    bvid?: string;
    title?: string;
    pic?: string;
    duration?: number;
    pubdate?: number;
    uri?: string;
    owner?: {
        mid?: number;
        name?: string;
        face?: string;
    };
    stat?: {
        view?: number;
        like?: number;
        danmaku?: number;
    };
    rcmd_reason?: {
        content?: string;
        reason_type?: number;
    } | null;
};

type SearchOptions = {
    page?: number;
    order?: "totalrank" | "click" | "pubdate" | "dm" | "stow" | "scores";
    duration?: "0" | "1" | "2" | "3" | "4";
    category_id?: number;
};

function cleanText(text?: string): string {
    return decodeHtml((text ?? "").replace(/<[^>]*>/g, ""));
}

function imageUrl(url?: string): string {
    if (!url) return "";
    return url.startsWith("//") ? `https:${url}` : url.replace(/^http:/, "https:");
}

function webUrl(url?: string): string {
    if (!url) return "";
    return url.replace(/^http:/, "https:");
}

function positiveInteger(value: number | undefined, fallback: number): number {
    const result = Math.trunc(value ?? fallback);
    return Number.isFinite(result) ? Math.max(1, result) : fallback;
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
    return Math.min(positiveInteger(value, fallback), maximum);
}

function videoId(value: string | number): { aid: number } | { bvid: string } {
    if (typeof value === "number") {
        if (!Number.isSafeInteger(value) || value <= 0) {
            throw new Error("[bilibili skill] 视频 aid 必须是正整数。");
        }
        return { aid: value };
    }

    const input = value.trim();
    const bvid = input.match(/BV[0-9A-Za-z]{10}/i)?.[0];
    if (bvid) return { bvid };

    const aid = input.match(/(?:^|\/)av(\d+)(?:[/?#]|$)/i)?.[1] ?? input.match(/^\d+$/)?.[0];
    if (aid) return { aid: Number(aid) };

    throw new Error("[bilibili skill] 请提供有效的 BV 号、AV 号、aid 或视频 URL。");
}

function normalizeError(error: unknown, action: string): Error {
    if (error instanceof Error && error.message.startsWith("[bilibili skill]")) {
        return error;
    }

    const message =
        typeof error === "object" && error !== null
            ? ((error as { message?: string }).message ?? "请求失败")
            : String(error);
    return new Error(`[bilibili skill] ${action}失败：${message}`);
}

export default {
    /**
     * 搜索 Bilibili 视频。
     */
    search_videos: async (query: string, options?: SearchOptions) => {
        if (!query.trim()) {
            throw new Error("[bilibili skill] 搜索关键词不能为空。");
        }

        try {
            const result = await client.search.type({
                keyword: query.trim(),
                search_type: "video",
                page: positiveInteger(options?.page, 1),
                ...(options?.order ? { order: options.order } : {}),
                ...(options?.duration ? { duration: options.duration } : {}),
                ...(options?.category_id ? { tids: options.category_id } : {}),
            });
            const videos = (result.result ?? []) as RawSearchVideo[];

            return {
                videos: videos.map((video) => ({
                    aid: video.aid ?? 0,
                    bvid: video.bvid ?? "",
                    title: cleanText(video.title),
                    description: cleanText(video.description),
                    author: cleanText(video.author),
                    author_id: video.mid ?? 0,
                    cover_url: imageUrl(video.pic),
                    duration: video.duration ?? "",
                    published_at: video.pubdate ?? 0,
                    view_count: video.play ?? 0,
                    favorite_count: video.favorites ?? 0,
                    comment_count: video.review ?? 0,
                    danmaku_count: video.video_review ?? 0,
                    tags: (video.tag ?? "")
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    url:
                        webUrl(video.arcurl) ||
                        `https://www.bilibili.com/video/${video.bvid ?? ""}`,
                })),
                page: result.page ?? positiveInteger(options?.page, 1),
                total_results: result.numResults ?? 0,
                total_pages: result.numPages ?? 0,
            };
        } catch (error) {
            throw normalizeError(error, "搜索视频");
        }
    },

    /**
     * 获取 Bilibili 视频详情，包括点赞量、收藏量和封面。
     */
    get_video_info: async (idOrUrl: string | number) => {
        try {
            const video = (await client.video.getInfo(videoId(idOrUrl))) as RawVideoInfo;

            return {
                aid: video.aid ?? 0,
                bvid: video.bvid ?? "",
                title: cleanText(video.title),
                description: cleanText(video.desc),
                cover_url: imageUrl(video.pic),
                duration_seconds: video.duration ?? 0,
                published_at: video.pubdate ?? 0,
                category: video.tname ?? "",
                category_id: video.tid ?? 0,
                author: {
                    id: video.owner?.mid ?? 0,
                    name: cleanText(video.owner?.name),
                    avatar_url: imageUrl(video.owner?.face),
                },
                view_count: video.stat?.view ?? 0,
                like_count: video.stat?.like ?? 0,
                favorite_count: video.stat?.favorite ?? 0,
                coin_count: video.stat?.coin ?? 0,
                share_count: video.stat?.share ?? 0,
                comment_count: video.stat?.reply ?? 0,
                danmaku_count: video.stat?.danmaku ?? 0,
                pages: (video.pages ?? []).map((page) => ({
                    cid: page.cid ?? 0,
                    page: page.page ?? 0,
                    title: cleanText(page.part),
                    duration_seconds: page.duration ?? 0,
                    first_frame_url: imageUrl(page.first_frame),
                })),
                url: `https://www.bilibili.com/video/${video.bvid ?? ""}`,
            };
        } catch (error) {
            throw normalizeError(error, "获取视频详情");
        }
    },

    /**
     * 获取 Bilibili 首页视频推荐。设置 BILIBILI_COOKIE 后返回登录用户的个性化推荐。
     */
    get_recommendations: async (options?: { limit?: number }) => {
        try {
            const cookie = process.env.BILIBILI_COOKIE?.trim();
            const result = (await client.video.request.get(
                "https://api.bilibili.com/x/web-interface/index/top/feed/rcmd",
                {
                    params: {
                        ps: boundedInteger(options?.limit, 20, 50),
                        fresh_type: 3,
                    },
                    ...(cookie ? { headers: { cookie } } : {}),
                },
            )) as { item?: RawRecommendation[] };

            return {
                personalized: Boolean(cookie),
                videos: (result.item ?? [])
                    .filter((video) => video.bvid)
                    .map((video) => ({
                        aid: video.id ?? 0,
                        bvid: video.bvid ?? "",
                        title: cleanText(video.title),
                        cover_url: imageUrl(video.pic),
                        duration_seconds: video.duration ?? 0,
                        published_at: video.pubdate ?? 0,
                        author: {
                            id: video.owner?.mid ?? 0,
                            name: cleanText(video.owner?.name),
                            avatar_url: imageUrl(video.owner?.face),
                        },
                        view_count: video.stat?.view ?? 0,
                        like_count: video.stat?.like ?? 0,
                        danmaku_count: video.stat?.danmaku ?? 0,
                        recommendation_reason: cleanText(video.rcmd_reason?.content),
                        url:
                            webUrl(video.uri) ||
                            `https://www.bilibili.com/video/${video.bvid ?? ""}`,
                    })),
            };
        } catch (error) {
            throw normalizeError(error, "获取视频推荐");
        }
    },
};
