import { IncomingMessage } from 'http'
import url from 'url'

function isPreflightInfoRefs (req: IncomingMessage, u: url.UrlWithParsedQuery) {
  return req.method === 'OPTIONS' && u.pathname?.endsWith('/info/refs') && (u.query.service === 'git-upload-pack' || u.query.service === 'git-receive-pack')
}

function isInfoRefs (req: IncomingMessage, u: url.UrlWithParsedQuery) {
  return req.method === 'GET' && u.pathname?.endsWith('/info/refs') && (u.query.service === 'git-upload-pack' || u.query.service === 'git-receive-pack')
}

function isPreflightPull (req: IncomingMessage, u: url.UrlWithParsedQuery) {
  return req.method === 'OPTIONS' && req.headers['access-control-request-headers']?.includes('content-type') && u.pathname?.endsWith('git-upload-pack')
}

function isPull (req: IncomingMessage, u: url.UrlWithParsedQuery) {
  return req.method === 'POST' && req.headers['content-type'] === 'application/x-git-upload-pack-request' && u.pathname?.endsWith('git-upload-pack')
}

function isPreflightPush (req: IncomingMessage, u: url.UrlWithParsedQuery) {
  return req.method === 'OPTIONS' && req.headers['access-control-request-headers']?.includes('content-type') && u.pathname?.endsWith('git-receive-pack')
}

function isPush (req: IncomingMessage, u: url.UrlWithParsedQuery) {
  return req.method === 'POST' && req.headers['content-type'] === 'application/x-git-receive-pack-request' && u.pathname?.endsWith('git-receive-pack')
}

export default function allow (req: IncomingMessage, u: url.UrlWithParsedQuery): boolean {
  return (
    isPreflightInfoRefs(req, u) ||
    isInfoRefs(req, u) ||
    isPreflightPull(req, u) ||
    isPull(req, u) ||
    isPreflightPush(req, u) ||
    isPush(req, u)
  ) || false
}
