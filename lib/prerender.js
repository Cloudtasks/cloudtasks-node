var request = require('request');
var url = require('url');

var prerender = module.exports = function (token, options) {

    if (!token) throw new Error('token must be set');

    var options = prerender.options = options || {},
        baseUrl = (options.apiEndPoint || 'http://prerender.cloudtasks.io/') + token,
        prerenderRequest = request.defaults({
            followRedirect: false
        });
    if (typeof options.sitemap === 'undefined') options.sitemap = true;

    return function (req, res, next) {
        if(!prerender.shouldShowPrerenderedPage(req)) return next();

        var parsedUrl, xForwardedFor, requestStream;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        if (prerender.shouldShowPrerenderedPage(req)) {
            parsedUrl = url.parse(req.url, true);
            xForwardedFor = req.headers['x-forwarded-for'];
            if (xForwardedFor) {
                xForwardedFor = req.connection.remoteAddress + ', ' + xForwardedFor;
            } else {
                xForwardedFor = req.connection.remoteAddress;
            }
            req.headers['x-forwarded-for'] = xForwardedFor;
            req.pipe(prerenderRequest.get(baseUrl + parsedUrl.path)).pipe(res);
        } else {
            next();
        }

    }
}

// googlebot, yahoo, and bingbot are not in this list because
// we support _escaped_fragment_ and want to ensure people aren't
// penalized for cloaking.
prerender.crawlerUserAgents = [
  // 'googlebot',
  // 'yahoo',
  // 'bingbot',
  'baiduspider',
  'facebookexternalhit',
  'twitterbot',
  'rogerbot',
  'linkedinbot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest',
  'developers.google.com/+/web/snippet',
  'slackbot'
];


prerender.extensionsToIgnore = [
  '.js',
  '.css',
  '.xml',
  '.less',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.pdf',
  '.doc',
  '.txt',
  '.ico',
  '.rss',
  '.zip',
  '.mp3',
  '.rar',
  '.exe',
  '.wmv',
  '.doc',
  '.avi',
  '.ppt',
  '.mpg',
  '.mpeg',
  '.tif',
  '.wav',
  '.mov',
  '.psd',
  '.ai',
  '.xls',
  '.mp4',
  '.m4a',
  '.swf',
  '.dat',
  '.dmg',
  '.iso',
  '.flv',
  '.m4v',
  '.torrent'
];


prerender.whitelisted = function(whitelist) {
  prerender.whitelist = typeof whitelist === 'string' ? [whitelist] : whitelist;
  return this;
};


prerender.blacklisted = function(blacklist) {
  prerender.blacklist = typeof blacklist === 'string' ? [blacklist] : blacklist;
  return this;
};


prerender.shouldShowPrerenderedPage = function(req) {
  var userAgent = req.headers['user-agent']
    , bufferAgent = req.headers['x-bufferbot']
    , isRequestingPrerenderedPage = false;

  if(!userAgent) return false;
  if(req.method != 'GET' && req.method != 'HEAD') return false;

  //if it is requesting a sitemap file, proxy to cloudtasks.io
  if (prerender.options.sitemap && /(sitemap[0-9]{0,3}?\.xml|sitemap\/)$/.test(req.url)) return true;
  //if it contains _escaped_fragment_, show prerendered page
  var parsedQuery = url.parse(req.url, true).query;
  if(parsedQuery && parsedQuery.hasOwnProperty('_escaped_fragment_')) isRequestingPrerenderedPage = true;

  //if it is a bot...show prerendered page
  if(prerender.crawlerUserAgents.some(function(crawlerUserAgent){ return userAgent.toLowerCase().indexOf(crawlerUserAgent.toLowerCase()) !== -1;})) isRequestingPrerenderedPage = true;

  //if it is BufferBot...show prerendered page
  if(bufferAgent) isRequestingPrerenderedPage = true;

  //if it is a bot and is requesting a resource...dont prerender
  if(prerender.extensionsToIgnore.some(function(extension){return req.url.indexOf(extension) !== -1;})) return false;

  //if it is a bot and not requesting a resource and is not whitelisted...dont prerender
  if(Array.isArray(this.whitelist) && this.whitelist.every(function(whitelisted){return (new RegExp(whitelisted)).test(req.url) === false;})) return false;

  //if it is a bot and not requesting a resource and is not blacklisted(url or referer)...dont prerender
  if(Array.isArray(this.blacklist) && this.blacklist.some(function(blacklisted){
    var blacklistedUrl = false
      , blacklistedReferer = false
      , regex = new RegExp(blacklisted);

    blacklistedUrl = regex.test(req.url) === true;
    if(req.headers['referer']) blacklistedReferer = regex.test(req.headers['referer']) === true;

    return blacklistedUrl || blacklistedReferer;
  })) return false;

  return isRequestingPrerenderedPage;
};