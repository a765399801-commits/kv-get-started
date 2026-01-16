export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const url = new URL(request.url)
      const pathname = url.pathname

      // ===== GET 查询 =====
      if (request.method === 'GET' && pathname === '/api/wechat') {
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return json({ error: 'userId is required' }, 400)
        }

        const raw = await env.USER_NOTIFICATION.get(userId)
      // 4️⃣ 读取 KV
      //const raw = await env.USER_NOTIFICATION.get(value)
      const finalWidgets = raw ? JSON.parse(raw) : []
        
        if (raw === null) {
          return json({ error: 'not found' }, 404)
        }
         return json({
        widgets: finalWidgets
      })
        
      //   return json({ userId, value })
      //  return json(finalWidgets)
      }
        // 浏览器调试写入（GET）
        if (pathname === '/debug/set') {
          const userId = url.searchParams.get('userId')
          const status = url.searchParams.get('status')
        
          if (!userId || !status) {
            return json({ error: 'missing params' }, 400)
          }
        
          await env.USER_NOTIFICATION.put(
            `${userId}`,
            status
          )
        
          return json({ success: true })
        }
       // ===== 微信登录 =====
    if (request.method !== 'POST' || url.pathname !== '/auth/wechat') {
      return new Response('Not Found', { status: 404 })
    }

    try {
      const body = await request.json()
      const { code, nickname, widgets } = body

      if (!code || !nickname) {
        return json({ error: 'code & nickname required' }, 400)
      }

      // 1️⃣ 微信登录（只用于合法性）
      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session` +
          `?appid=${env.WX_APPID}` +
          `&secret=${env.WX_SECRET}` +
          `&js_code=${code}` +
          `&grant_type=authorization_code`
      )

      const wxData: any = await wxRes.json()
      if (!wxData.openid) {
        return json({ error: 'wx login failed', wxData }, 401)
      }
      const openid = wxData.openid
      // 2️⃣ 生成 KV Key
      const name = `微信昵称:${nickname}`
      const wxKey = `key:${openid}`
      // 3️⃣ 写入 widgets（如果客户端有）
      if (name&&wxKey) {
        await env.USER_NOTIFICATION.put(
          name,
          wxKey
        )
      }
      const kvKey = `${openid}`

      // 3️⃣ 写入 widgets（如果客户端有）
      if (Array.isArray(widgets)) {
        await env.USER_NOTIFICATION.put(
          kvKey,
          JSON.stringify(widgets)
        )
      }
      // 4️⃣ 读取 KV
      const raw = await env.USER_NOTIFICATION.get(kvKey)
      const finalWidgets = raw ? JSON.parse(raw) : []

      return json({
        key: kvKey,
        widgets: finalWidgets
      })
    } catch (err) {
      console.error(err)
      return json({ error: 'server error' }, 500)
    }

      // ===== POST 设置 =====
      if (request.method === 'POST' && pathname === '/api/wechat') {
        const body = await request.json()
        const { userId, status } = body

        if (!userId || !status) {
          return json({ error: 'userId and status are required' }, 400)
        }
      
         if (Array.isArray(status)) {
        await env.USER_NOTIFICATION.put(
          `${userId}`,
          JSON.stringify(status)
        )}
         else if(status){
            await env.USER_NOTIFICATION.put(
            `${userId}`,
            status
          ) 
         }
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
