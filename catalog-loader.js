import {catalogConfig} from './catalog-config.js?v=0.8.4';
import {uniqueSongCount} from './core.js?v=0.8.3';

export function validateCatalog(data) {
  const codes = ['mandarin', 'english', 'japanese', 'korean'];
  if (!Array.isArray(data?.categories) || data.categories.length !== codes.length) throw Error('題庫必須包含四種語言。');
  for (const code of codes) {
    const category = data.categories.find(c => c?.code === code);
    if (!category || typeof category.name !== 'string' || !Array.isArray(category.artists) || !category.artists.length || !category.artists.every(a => typeof a === 'string' && a.trim()) || !Array.isArray(category.songs)) throw Error('題庫分類格式錯誤。');
    for (const song of category.songs) {
      if (!song || !Number.isSafeInteger(song.id) || typeof song.title !== 'string' || !song.title.trim() || typeof song.artist !== 'string' || !category.artists.includes(song.catalogArtist || song.artist) || song.language !== code) throw Error('歌曲資料格式錯誤。');
      for (const field of ['previewUrl', 'storeUrl']) {
        try { if (new URL(song[field]).protocol !== 'https:') throw Error(); }
        catch { throw Error('歌曲網址必須是有效的 HTTPS 網址。'); }
      }
    }
    if (uniqueSongCount(category.songs) < 10) throw Error('每種語言至少需要十個不同歌名。');
  }
  return data;
}

export async function loadCatalog(config = catalogConfig, fetcher = globalThis.fetch) {
  async function read(url) {
    const response = await fetcher(url, {cache: 'no-store', signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('題庫下載失敗。');
    return validateCatalog(await response.json());
  }
  if (config.remoteUrl) {
    try {
      const url = new URL(config.remoteUrl);
      if (url.protocol !== 'https:') throw Error('遠端題庫必須使用 HTTPS。');
      // A fresh query also avoids an older CDN response after replacing the file.
      url.searchParams.set('updated', String(Date.now()));
      return await read(url.href);
    } catch (error) { console.warn('遠端題庫無法使用，改用網站內建題庫。', error); }
  }
  return read(config.fallbackUrl);
}
