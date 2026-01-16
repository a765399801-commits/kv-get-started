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
    if (request.method !== 'POST' || url.pathname !== '/auth/wechat') {
      return new Response('Not Found', { status: 404 })
    }

    try {
      const body = await request.json()
      const { code, profile, widgets } = body

      if (!code) {
        return json({ error: 'code is required' }, 400)
      }

      // ===============================
      // 1️⃣ 微信 code → openid
      // ===============================
      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session` +
          `?appid=${env.WX_APPID}` +
          `&secret=${env.WX_SECRET}` +
          `&js_code=${code}` +
          `&grant_type=authorization_code`
      )

      const wxData: any = await wxRes.json()

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

      // ===============================
      // 2️⃣ openid → userId（匿名）
      // ===============================
      const wxKey = `wx:${openid}`
      let userId = await env.USER_NOTIFICATION.get(wxKey)

      if (!userId) {
        userId = crypto.randomUUID()
        await env.USER_NOTIFICATION.put(wxKey, userId)
      }

      // ===============================
      // 3️⃣ 用户 Profile（昵称 / 头像）
      // ===============================
      const profileKey = `user:${userId}:profile`
      const oldProfileRaw = await env.USER_NOTIFICATION.get(profileKey)
      const oldProfile = oldProfileRaw
        ? JSON.parse(oldProfileRaw)
        : {}

      const mergedProfile = {
        ...oldProfile,
        ...(profile || {})
      }

      await env.USER_NOTIFICATION.put(
        profileKey,
        JSON.stringify(mergedProfile)
      )

      // ===============================
      // 4️⃣ Widgets（设备 / 组件）
      // ===============================
      const widgetsKey = `user:${userId}:widgets`

      if (widgets) {
        await env.USER_NOTIFICATION.put(
          widgetsKey,
          JSON.stringify(widgets)
        )
      }

      const finalWidgets =
        widgets ||
        JSON.parse(
          (await env.USER_NOTIFICATION.get(widgetsKey)) || '[]'
        )

      // ===============================
      // 5️⃣ 返回给小程序
      // ===============================
      return json({
        userId,
        profile: mergedProfile,
        widgets: finalWidgets
      })
    }catch (err) {
      console.error('AUTH ERROR', err)
      return json({ error: 'server error' }, 500)
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
