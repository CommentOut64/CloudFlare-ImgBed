/**
 * 公开文件列表缓存键
 *
 * 缓存键的格式在“写入方”（api/public/list.js）和“清理方”（utils/purgeCache.js）之间
 * 共用同一份实现，避免两边各拼一份字符串导致清缓存清不掉（历史上就是这样漏掉祖先目录的）。
 */

// 缓存键版本号：缓存内容结构变化、或需要让历史脏缓存立即失效时，把这个值 +1
export const PUBLIC_LIST_CACHE_VERSION = 1;

/**
 * 规范化目录：统一斜杠、去掉首尾斜杠
 * @param {string} dir
 * @returns {string}
 */
export function normalizeCacheDir(dir) {
    if (dir === undefined || dir === null) return '';
    return String(dir)
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

/**
 * 目录自身 + 所有祖先目录 + 根目录
 *
 * 递归列表（recursive=true）会把子目录里的文件一起列出来，所以子目录的增删改
 * 同样会让祖先目录的缓存失效。上传/删除/移动时只清“文件所在目录”是无效的，
 * 必须一路清到根。
 *
 * @param {string} dir
 * @returns {string[]} 传入 undefined/null 时返回空数组（不产生任何清理动作）
 */
export function expandDirAncestors(dir) {
    if (dir === undefined || dir === null) return [];

    const normalized = normalizeCacheDir(dir);
    const result = [normalized];
    const segments = normalized.split('/').filter(Boolean);
    while (segments.length > 0) {
        segments.pop();
        result.push(segments.join('/'));
    }
    return Array.from(new Set(result));
}

/**
 * 公开列表缓存键
 * @param {string} origin - 请求来源，如 https://img.co64.top
 * @param {string} dir - 目录（带不带首尾斜杠都可以）
 * @param {boolean|string} recursive - 是否递归
 * @returns {string}
 */
export function buildPublicFileListCacheKey(origin, dir, recursive) {
    const recursiveKey = recursive === true || recursive === 'true' ? 'true' : 'false';
    return `${origin}/api/publicFileList?v=${PUBLIC_LIST_CACHE_VERSION}&dir=${normalizeCacheDir(dir)}&recursive=${recursiveKey}`;
}

/**
 * 随机图列表缓存键（该接口本身也是递归查询，同样需要清祖先目录）
 * @param {string} origin
 * @param {string} dir
 * @returns {string}
 */
export function buildRandomFileListCacheKey(origin, dir) {
    return `${origin}/api/randomFileList?dir=${normalizeCacheDir(dir)}`;
}
