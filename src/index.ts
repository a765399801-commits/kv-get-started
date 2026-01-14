export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const url = new URL(request.url)
      const pathname = url.pathname

      // ===== GET 查询 =====
      if (request.method === 'GET' && pathname === '/api/notification') {
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return json({ error: 'userId is required' }, 400)
        }

        const value = await env.USER_NOTIFICATION.get(`notification:${userId}`)

        if (value === null) {
          return json({ error: 'not found' }, 404)
        }

        return json({ userId, status: value })
      }
        // 浏览器调试写入（GET）
        if (pathname === '/debug/set') {
          const userId = url.searchParams.get('userId')
          const status = url.searchParams.get('status')
        
          if (!userId || !status) {
            return json({ error: 'missing params' }, 400)
          }
        
          await env.USER_NOTIFICATION.put(
            `notification:${userId}`,
            status
          )
        
          return json({ success: true })
        }

      // ===== POST 设置 =====
      if (request.method === 'POST' && pathname === '/api/notification') {
        const body = await request.json()
        const { userId, status } = body

        if (!userId || !status) {
          return json({ error: 'userId and status are required' }, 400)
        }

        if (!['enabled', 'disabled'].includes(status)) {
          return json({ error: 'status must be enabled or disabled' }, 400)
        }

        await env.USER_NOTIFICATION.put(
          `notification:${userId}`,
          status
        )

        return json({ success: true })
      }

      return new Response('Not Found', { status: 404 })

    } catch (err) {
      console.error('KV error:', err)
      const msg =
        err instanceof Error
          ? err.message
          : 'Unknown KV error'

      return new Response(msg, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }
}

// ===== 工具函数 =====
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
