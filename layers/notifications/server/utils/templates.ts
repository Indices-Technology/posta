/**
 * Every message Posta sends, in one place.
 *   text      what the in-app inbox shows (and the logged text when WhatsApp isn't set up)
 *   icon      AppIcon name for the inbox row
 *   whatsapp  the Meta-approved template and which params fill {{1}}, {{2}}, … in order.
 *             Business-started WhatsApp messages MUST use an approved template; the names
 *             below have to be created and approved in Meta Business Manager before they send.
 */
type Params = Record<string, unknown>

export interface Template {
  icon: string
  text: (p: Params) => string
  whatsapp?: { name: string; params: string[] }
}

export const TEMPLATES = {
  // To carriers
  'job.assigned': {
    icon: 'trips',
    text: (p) => `New Posta job ${p.ref}: ${p.from} to ${p.to}. Open ${p.link}`,
    whatsapp: { name: 'posta_job_assigned', params: ['carrier', 'ref', 'from', 'to', 'link'] },
  },
  'trip.parcel_added': {
    icon: 'parcel',
    text: (p) => `A parcel joined your trip to ${p.to}: ${p.contents}.`,
  },

  'offer.new': {
    icon: 'bike',
    text: (p) => `New job near you: ${p.ref}, collect at ${p.from}. Accept within 2 minutes: ${p.link}`,
    whatsapp: { name: 'posta_job_offer', params: ['carrier', 'ref', 'from', 'link'] },
  },
  'offer.taken': { icon: 'check', text: (p) => `${p.carrier} is collecting ${p.ref}. Show them the QR on the parcel page.` },

  // To recipients
  'collection.ready': {
    icon: 'hubs',
    text: (p) => `Your parcel is ready at ${p.hub}. Show your code there: ${p.link}`,
    whatsapp: { name: 'posta_ready_for_collection', params: ['recipient', 'hub', 'link'] },
  },
  'tracking.sent': {
    icon: 'road',
    text: (p) => `Your parcel from ${p.fromCity} is on its way. Delivery code ${p.code}. Track it: ${p.link}`,
    whatsapp: { name: 'posta_parcel_on_its_way', params: ['recipient', 'fromCity', 'code', 'link'] },
  },

  // To senders
  'parcel.matched': { icon: 'trips', text: (p) => `${p.ref} is on ${p.driver}'s trip.` },
  'parcel.collected': { icon: 'road', text: (p) => `${p.ref} was collected and is on the road.` },
  'parcel.picked_up': { icon: 'bike', text: (p) => `${p.carrier} picked up ${p.ref}.` },
  'parcel.at_origin': { icon: 'hubs', text: (p) => `${p.ref} is at ${p.hub}, waiting for its trip.` },
  'parcel.at_hub': { icon: 'hubs', text: (p) => `${p.ref} reached ${p.hub}.` },
  'parcel.delivered': {
    icon: 'done',
    text: (p) => `${p.ref} was delivered to ${p.recipient}.`,
    whatsapp: { name: 'posta_parcel_delivered', params: ['ref', 'recipient'] },
  },

  // To staff
  'staff.no_courier': { icon: 'alert', text: (p) => `${p.ref} is at ${p.hub} with no courier in ${p.city}.` },
  'staff.job_locked': { icon: 'lock', text: (p) => `${p.ref} locked after 5 wrong codes (${p.carrier}).` },
  'staff.application': { icon: 'staff', text: (p) => `New ${p.what} to review: ${p.name}, ${p.city}.` },

  // To applicants
  'partner.reviewed': { icon: 'check', text: (p) => `Your ${p.what} application was ${p.decision}.` },
} satisfies Record<string, Template>

export type TemplateKey = keyof typeof TEMPLATES

export function renderText(key: string, params: Params) {
  const t = (TEMPLATES as Record<string, Template>)[key]
  return t ? t.text(params) : key
}
