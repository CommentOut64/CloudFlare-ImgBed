import { fetchOthersConfig } from "./sysConfig";
import {
    buildPublicFileListCacheKey,
    buildRandomFileListCacheKey,
    expandDirAncestors,
} from "./publicListCacheKey.js";

let othersConfig = {};
let cfZoneId = "";
let cfEmail = "";
let cfApiKey = "";

export async function purgeCFCache(env, cdnUrl) {
    try {
        // 读取其他设置
        othersConfig = await fetchOthersConfig(env);
        cfZoneId = othersConfig.cloudflareApiToken.CF_ZONE_ID;
        cfEmail = othersConfig.cloudflareApiToken.CF_EMAIL;
        cfApiKey = othersConfig.cloudflareApiToken.CF_API_KEY;

        // 如果没有配置Cloudflare API，跳过缓存清除
        if (!cfZoneId || !cfEmail || !cfApiKey) {
            return;
        }

        // 清除CDN缓存
        const options = {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Auth-Email': `${cfEmail}`, 'X-Auth-Key': `${cfApiKey}`},
            body: `{"files":["${ cdnUrl }"]}`
        };
        await fetch(`https://api.cloudflare.com/client/v4/zones/${ cfZoneId }/purge_cache`, options);
    } catch (error) {
        console.error('Failed to purge CF cache:', error.message || error);
    }
}

// cache.delete 有 bug，通过写入一个 max-age=0 的 response 来清除缓存
// 注意：Response 只能被消费一次，每次 put 都要新建一个
function createPurgeMarker() {
    return new Response(null, {
        headers: { 'Cache-Control': 'max-age=0' },
    });
}

async function putPurgeMarkers(keys) {
    const cache = caches.default;
    await Promise.all(Array.from(keys).map((key) => cache.put(key, createPurgeMarker())));
}

export async function purgeRandomFileListCache(origin, ...dirs) {
    try {
        // 随机图接口是递归查询，子目录变化同样会让祖先目录的列表失效
        const keys = new Set();
        for (const dir of dirs) {
            for (const target of expandDirAncestors(dir)) {
                keys.add(buildRandomFileListCacheKey(origin, target));
            }
        }

        await putPurgeMarkers(keys);
    } catch (error) {
        console.error('Failed to clear randomFileList cache:', error);
    }
}

export async function purgePublicFileListCache(origin, ...dirs) {
    try {
        // 递归和非递归两种缓存都要清；并且必须连同所有祖先目录一起清，
        // 否则往 gallery/sub/ 上传文件时，gallery（递归）的列表会一直是旧的。
        const keys = new Set();
        for (const dir of dirs) {
            for (const target of expandDirAncestors(dir)) {
                keys.add(buildPublicFileListCacheKey(origin, target, false));
                keys.add(buildPublicFileListCacheKey(origin, target, true));
            }
        }

        await putPurgeMarkers(keys);
    } catch (error) {
        console.error('Failed to clear publicFileList cache:', error);
    }
}
