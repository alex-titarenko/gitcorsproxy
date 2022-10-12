import url from 'url'
import { send, RequestHandler } from 'micro'
import microCors from 'micro-cors'
import fetch from 'node-fetch'
import { IncomingMessage, ServerResponse } from 'http'
import allow from './_allow-request'

const allowHeaders = [
  'accept-encoding',
  'accept-language',
  'accept',
  'access-control-allow-origin',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'dnt',
  'git-protocol',
  'pragma',
  'range',
  'referer',
  'user-agent',
  'x-authorization',
  'x-http-method-override',
  'x-requested-with',
]

const exposeHeaders = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'location',
  'pragma',
  'server',
  'transfer-encoding',
  'vary',
  'x-github-request-id',
  'x-redirected-url',
]

const allowMethods = [
  'POST',
  'GET',
  'OPTIONS'
]

type Predicate = (req: IncomingMessage, res?: ServerResponse) => boolean
type Next = (err?: string) => void
type Middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => void
type MiddlewareParams = {
  origin: string
  insecure_origins: string[]
  authorization: Middleware
  urlParamName?: string
}

const getProxyUrlFromParam = (u: url.UrlWithParsedQuery, paramName: string) => {
  const decodedProxyUrl = decodeURIComponent(u.query[paramName] as string)
  return url.parse(decodedProxyUrl, true)
}

const filter = (predicate: Predicate, middleware: Middleware) => {
  function corsProxyMiddleware (req: IncomingMessage, res: ServerResponse, next: Next) {
    if (predicate(req, res)) {
      middleware(req, res, next)
    } else {
      next()
    }
  }

  return corsProxyMiddleware
}

const compose = (...handlers: Middleware[]) => {
  const composeTwo = (handler1: Middleware, handler2: Middleware) => {
    function composed (req: IncomingMessage, res: ServerResponse, next: Next) {
      handler1(req, res, (err) => {
        if (err) {
          return next(err)
        } else {
          return handler2(req, res, next)
        }
      })
    }
    return composed
  }

  let result = handlers.pop()

  while(handlers.length) {
    result = composeTwo(handlers.pop()!, result!)
  }

  return result
}

export function noop (_req: IncomingMessage, _res: ServerResponse, next: Next) {
  next()
}

// eslint-disable-next-line import/no-anonymous-default-export
export default function ({ origin, insecure_origins, authorization, urlParamName }: MiddlewareParams) {
  function predicate (req: IncomingMessage) {
    let u = url.parse(req.url!, true)
    if (urlParamName) {
      u = getProxyUrlFromParam(u, urlParamName)
    }
    // Not a git request, skip
    return allow(req, u)
  }

  function sendCorsOK (req: IncomingMessage, res: ServerResponse, next: Next) {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
      return send(res, 200, '')
    } else {
      next()
    }
  }

  function middleware (req: IncomingMessage, res: ServerResponse) {
    let headers = {}
    for (let h of allowHeaders) {
      if (req.headers[h]) {
        headers[h] = req.headers[h]
      }
    }

    // GitHub uses user-agent sniffing for git/* and changes its behavior which is frustrating
    if (!headers['user-agent'] || !headers['user-agent'].startsWith('git/')) {
      headers['user-agent'] = 'git/noteshub'
    }

    const u = url.parse(req.url!, true)
    let proxyUrl: string
    if (urlParamName) {
      proxyUrl = getProxyUrlFromParam(u, urlParamName).href
    } else {
      let p = u.path!
      let parts = p.match(/\/([^/]*)\/(.*)/)!
      let pathdomain = parts[1]
      let remainingpath = parts[2]
      let protocol = insecure_origins.includes(pathdomain) ? 'http' : 'https'
      proxyUrl = `${protocol}://${pathdomain}/${remainingpath}`
    }

    console.log(`Fetching response for Url: ${proxyUrl}`)
    fetch(proxyUrl, {
      method: req.method,
      redirect: 'manual',
      headers,
      body: (req.method !== 'GET' && req.method !== 'HEAD') ? req : undefined
    }).then(f => {
      if (f.headers.has('location')) {
        // Modify the location so the client continues to use the proxy
        let newUrl = f.headers.get('location')?.replace(/^https?:\//, '')
        f.headers.set('location', newUrl!)
      }

      res.statusCode = f.status
      for (let h of exposeHeaders) {
        if (h === 'content-length') continue
        if (f.headers.has(h)) {
          res.setHeader(h, f.headers.get(h)!)
        }
      }

      if (f.redirected) {
        res.setHeader('x-redirected-url', f.url)
      }
      f.body.pipe(res)
    })
  }

  const cors = microCors({
    allowHeaders,
    exposeHeaders,
    allowMethods,
    allowCredentials: false,
    origin
  })

  return filter(predicate, cors(compose(sendCorsOK, authorization, middleware) as RequestHandler))
}
