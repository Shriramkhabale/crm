const { URL } = require('url');

const analytics = {
  totalRequests: 0,
  endpointCounts: new Map(),
  perMinute: new Map(),
  uaCounts: {
    browser: 0,
    androidWebView: 0,
    androidBrowser: 0,
    other: 0,
  },
  loginAttempts: 0,
  authFailures: 0,
  redirectResponses: 0,
  socketConnections: 0,
  socketDisconnections: 0,
  socketAuthEvents: 0,
  socketAuthPerMinute: new Map(),
  socketAuthBySocket: new Map(),
  socketUsages: new Map(),
};

function getMinuteKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function classifyUserAgent(ua = '') {
  const lower = ua.toLowerCase();
  if (/wv|webview/.test(lower)) return 'androidWebView';
  if (/android/.test(lower)) return 'androidBrowser';
  if (/iphone|ipad|macintosh|windows|linux/.test(lower)) return 'browser';
  return 'other';
}

function ensureMinuteBucket(minuteKey) {
  if (!analytics.perMinute.has(minuteKey)) {
    analytics.perMinute.set(minuteKey, {
      totalRequests: 0,
      endpointCounts: new Map(),
      uaCounts: {
        browser: 0,
        androidWebView: 0,
        androidBrowser: 0,
        other: 0,
      },
      loginAttempts: 0,
      authFailures: 0,
      redirectResponses: 0,
      socketConnections: 0,
      socketDisconnections: 0,
      socketAuthEvents: 0,
    });
  }
  return analytics.perMinute.get(minuteKey);
}

function recordRequest({ endpoint, userAgent, ip, method, statusCode }) {
  const minuteKey = getMinuteKey();
  const bucket = ensureMinuteBucket(minuteKey);
  const clientType = classifyUserAgent(userAgent);

  analytics.totalRequests += 1;
  analytics.endpointCounts.set(endpoint, (analytics.endpointCounts.get(endpoint) || 0) + 1);
  analytics.uaCounts[clientType] += 1;

  bucket.totalRequests += 1;
  bucket.endpointCounts.set(endpoint, (bucket.endpointCounts.get(endpoint) || 0) + 1);
  bucket.uaCounts[clientType] += 1;

  if (endpoint === '/api/auth/login' && method === 'POST') {
    analytics.loginAttempts += 1;
    bucket.loginAttempts += 1;
  }
  if (statusCode >= 300 && statusCode < 400) {
    analytics.redirectResponses += 1;
    bucket.redirectResponses += 1;
  }
  if (statusCode === 401) {
    analytics.authFailures += 1;
    bucket.authFailures += 1;
  }
}

function requestAnalyticsMiddleware(req, res, next) {
  const start = Date.now();
  const endpoint = req.path || req.url || req.originalUrl || '/';
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  res.on('finish', () => {
    recordRequest({
      endpoint,
      userAgent,
      ip,
      method: req.method,
      statusCode: res.statusCode,
    });
  });

  next();
}

function registerSocketConnection(socket) {
  analytics.socketConnections += 1;
  const minuteKey = getMinuteKey();
  const bucket = ensureMinuteBucket(minuteKey);
  bucket.socketConnections += 1;

  const ua = socket.handshake.headers['user-agent'] || '';
  const ip = socket.handshake.address || socket.handshake.headers['x-forwarded-for'] || 'unknown';
  analytics.socketUsages.set(socket.id, { connectedAt: Date.now(), userAgent: ua, ip });

  socket.on('authenticate', () => {
    analytics.socketAuthEvents += 1;
    bucket.socketAuthEvents += 1;
    analytics.socketAuthPerMinute.set(minuteKey, (analytics.socketAuthPerMinute.get(minuteKey) || 0) + 1);
    analytics.socketAuthBySocket.set(socket.id, (analytics.socketAuthBySocket.get(socket.id) || 0) + 1);
  });

  socket.on('disconnect', () => {
    analytics.socketDisconnections += 1;
    const disconnectBucket = ensureMinuteBucket(getMinuteKey());
    disconnectBucket.socketDisconnections += 1;
    analytics.socketUsages.delete(socket.id);
  });
}

function getRequestAnalyticsReport(req, res) {
  const endpointCountsArray = Array.from(analytics.endpointCounts.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const requestsPerMinute = Array.from(analytics.perMinute.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([minute, bucket]) => ({
      minute,
      totalRequests: bucket.totalRequests,
      loginAttempts: bucket.loginAttempts,
      authFailures: bucket.authFailures,
      redirectResponses: bucket.redirectResponses,
      socketConnections: bucket.socketConnections,
      socketDisconnections: bucket.socketDisconnections,
      socketAuthEvents: bucket.socketAuthEvents,
    }));

  res.json({
    timestamp: new Date().toISOString(),
    totalRequests: analytics.totalRequests,
    endpointCounts: endpointCountsArray,
    requestsPerMinute,
    userAgentCounts: analytics.uaCounts,
    loginAttempts: analytics.loginAttempts,
    authFailures: analytics.authFailures,
    redirectResponses: analytics.redirectResponses,
    socketConnections: analytics.socketConnections,
    socketDisconnections: analytics.socketDisconnections,
    socketAuthEvents: analytics.socketAuthEvents,
    socketAuthBySocket: Array.from(analytics.socketAuthBySocket.entries())
      .map(([socketId, count]) => ({ socketId, authenticateEvents: count }))
      .sort((a, b) => b.authenticateEvents - a.authenticateEvents)
      .slice(0, 20),
  });
}

module.exports = {
  requestAnalyticsMiddleware,
  registerSocketConnection,
  getRequestAnalyticsReport,
};
