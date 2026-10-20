/**
 * A fulfilment centre's dashboard. A centre only sees its own part: parcels coming in (scan them
 * when they arrive) and parcels on its shelf with who takes them next (show the QR, or scan the
 * recipient's). Never the sender's address, never the rest of the journey.
 */
import type { PostaUser } from '~~/layers/core/server/types/user'
import { formatRef } from '~~/shared/utils/posta'
import { handoverRepository, type HandoverFull } from '~~/layers/delivery/server/repositories/handover.repository'
import { sideOf } from '~~/layers/delivery/server/services/handover.service'
import { confirmer, type Party } from '~~/layers/delivery/server/utils/chain'
import { hubRepository } from '../repositories/hub.repository'

/** Parcel statuses meaning "sitting on a centre's shelf". */
const ON_SHELF = ['AT_ORIGIN', 'AT_HUB', 'READY_FOR_COLLECTION']

const row = (h: HandoverFull, other: 'from' | 'to', hubId: string) => {
  const s = sideOf(h, other)
  const centreScans = confirmer(h.fromParty as Party, h.toParty as Party) === (other === 'from' ? 'to' : 'from')
  return {
    id: h.id,
    ref: formatRef(h.parcel.number),
    contents: h.parcel.description,
    weightKg: h.parcel.weightKg,
    who: { party: s.party, name: s.party === 'RECIPIENT' ? s.name.split(' ')[0] : s.name, phone: s.leg?.carrierPhone ?? null },
    status: h.status,
    when: (other === 'from' ? h.fromLeg : h.toLeg)?.trip?.departAt ?? null,
    /** scan: the centre scans their QR. show: they scan the centre's (handed out only when ready). */
    action: centreScans ? ('scan' as const) : ('show' as const),
    qr: !centreScans && h.status === 'READY' ? { token: h.token, code: h.code } : null,
    hubId,
  }
}

export const centreService = {
  async dashboard(user: PostaUser) {
    const hubs = await hubRepository.listOwnedBy(user.id)
    const centres = []
    for (const hub of hubs) {
      if (hub.status !== 'APPROVED') {
        centres.push({ hub: { id: hub.id, name: hub.name, city: hub.city, status: hub.status }, incoming: [], shelf: [] })
        continue
      }
      const handovers = await handoverRepository.listForHub(hub.id, ['READY', 'WAITING'])
      const incoming = handovers.filter((h) => h.toHubId === hub.id).map((h) => row(h, 'from', hub.id))
      // On the shelf = the parcel is at this centre now, whatever happens next.
      const shelf = handovers
        .filter((h) => h.fromHubId === hub.id)
        .filter((h) => ON_SHELF.includes(h.parcel.status) && (h.parcel.status === 'AT_ORIGIN' ? h.parcel.originHubId : h.parcel.destHubId) === hub.id)
        .map((h) => row(h, 'to', hub.id))
      centres.push({ hub: { id: hub.id, name: hub.name, city: hub.city, status: hub.status }, incoming, shelf })
    }
    return { centres }
  },
}
