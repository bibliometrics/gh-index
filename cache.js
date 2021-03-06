const path = require('path');
const fs = require('fs').promises;
const { gzip, ungzip } = require('node-gzip');
const mkdirp = require('mkdirp');
const debug = require('debug')('gh-index');

let cacheDir = process.env.GH_INDEX_CACHE_DIR;
if (!cacheDir) cacheDir = path.join(process.env.HOME, '.cache', 'gh-index');
let maxAge = process.env.GH_INDEX_CACHE_AGE;
if (!maxAge) maxAge = 8 * 60 * 60 * 1000;
else maxAge = +maxAge;

module.exports = (f) => async (req) => {
  if (Object.keys(req).length !== 2) return f(req);
  if (req.method !== 'get') return f(req);
  const url = req.url.replace(/\//g, '%').replace(/\?/g, '@');
  const p = path.join(cacheDir, url);
  try {
    const stat = await fs.stat(p);
    if (new Date() - stat.mtime < maxAge) {
      const b = await ungzip(await fs.readFile(p));
      debug(`Cache hit ${req.url}`);
      return JSON.parse(b.toString('utf-8'));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') debug(e);
  }

  const res = await f(req);
  try {
    const { headers, data } = res;
    const b = await gzip(JSON.stringify({ headers, data }));
    await mkdirp(cacheDir);
    await fs.writeFile(p, b);
    debug(`Written to cache ${req.url}`);
  } catch (e) {
    debug(e);
  }

  return res;
};
