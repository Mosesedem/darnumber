import { NextRequest } from 'next/server'
import { json, error } from '@/lib/server/utils/response'
import { PaymentService } from '@/lib/server/services/payment.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const signature = req.headers.get('verif-hash')
    const svc = new PaymentService()
    const result = await svc.handleFlutterwaveWebhook(raw, signature)
    if (!result.ok) return new Response('unauthorized', { status: result.status || 401 })
    return json({ ok: true })
  } catch {
    return error('Invalid payload', 400)
  }
}
