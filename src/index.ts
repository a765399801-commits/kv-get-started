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
       // ===== 微信登录 =====
// ===== 微信登录 =====
        if (request.method === 'POST' && pathname === '/auth/wechat') {
          const { code } = await request.json()
        
          if (!code) {
            return json({ error: 'code is required' }, 400)
          }
        
          console.log('WX_APPID =', env.WX_APPID)
          console.log('CODE =', code)
        
          // 1️⃣ 调微信 code2Session（只调一次）
          const wxRes = await fetch(
            `https://api.weixin.qq.com/sns/jscode2session` +
              `?appid=${env.WX_APPID}` +
              `&secret=${env.WX_SECRET}` +
              `&js_code=${code}` +
              `&grant_type=authorization_code`
          )
        
          const wxData: any = await wxRes.json()
          console.log('WX RESPONSE =', wxData)
        
          if (!wxData.openid) {
            return json(
              {
                error: 'wx login failed',
                wxData
              },
              401
            )
          }
        
          const openid = wxData.openid
        
          // 2️⃣ openid → userId 映射
          let userId = await env.USER_NOTIFICATION.get(`wxmap:${openid}`)
        
          if (!userId) {
            userId = crypto.randomUUID()
            await env.USER_NOTIFICATION.put(`wxmap:${openid}`, userId)
          }
        
          // 3️⃣ 返回给小程序
          return json({ openid })
        }

        // if (request.method === 'POST' && pathname === '/auth/wechat') {
        //   const { code } = await request.json()

        //   console.log('=== DEBUG WECHAT LOGIN ===')
        //   console.log('WX_APPID =', env.WX_APPID)
        //   console.log('CODE =', code)

        //   const wxRes = await fetch(
        //     `https://api.weixin.qq.com/sns/jscode2session` +
        //       `?appid=${env.WX_APPID}` +
        //       `&secret=${env.WX_SECRET}` +
        //       `&js_code=${code}` +
        //       `&grant_type=authorization_code`
        //   )

        //   const text = await wxRes.text()
        //   console.log('WX RAW RESPONSE =', text)

        //   return new Response(text, {
        //     headers: { 'Content-Type': 'application/json' }
        //   })
        // }

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
