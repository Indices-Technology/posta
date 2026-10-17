/**
 * WhatsApp Cloud API, same call shape and env names as MarketX (server/queues/whatsapp.queue.ts),
 * so Posta can share MarketX's number by copying WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN.
 */
const GRAPH_API_VERSION = 'v21.0'

export const whatsappConfigured = () => !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN)

/** Nigerian numbers written 0803… become 234803…; anything else keeps its digits. */
export function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits
}

export async function sendWhatsappTemplate(to: string, templateName: string, bodyParams: string[]) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toWhatsappNumber(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US' },
        components: bodyParams.length
          ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
          : undefined,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`)
}
