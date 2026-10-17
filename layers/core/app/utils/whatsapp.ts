/** WhatsApp link for a Nigerian number written either 0803… or +234803… */
export function whatsappLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `234${digits.slice(1)}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
