import { VercelRequest, VercelResponse } from '@vercel/node'
import url from 'url'
import { send } from 'micro'
import Middleware, { noop } from './corsProxy/_middleware'

const middleware = Middleware({ origin: '*', insecure_origins: [], authorization: noop, urlParamName: 'url' })

// eslint-disable-next-line import/no-anonymous-default-export
export default async function (request: VercelRequest, response: VercelResponse) {
  middleware(request, response, () => {
    const u = url.parse(request.url!, true)

    if (u.pathname === 'api/cors.ts') {
      response.setHeader('content-type', 'text/html')
      const html = '<h1>CORS Proxy</h1><p><strong>Usage:</strong>/api/cors-proxy.ts?url=url-to-proxy</p>'
      return send(response, 400, html);
    }

    // Don't waste my precious bandwidth
    return send(response, 403, '');
  })
}
