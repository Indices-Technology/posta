import { dispatchService } from '../../services/dispatch.service'
import { matchService } from '../../services/match.service'

// Every minute: move unanswered courier offers on, free seats on trips that left without their
// parcel, and try matching again (new trips may have been posted).
export default defineTask({
  meta: { name: 'delivery:sweep', description: 'Expire courier offers, release missed trips, re-match' },
  async run() {
    const expired = await dispatchService.expireDue()
    const released = await matchService.releaseMissed()
    const matched = (await matchService.run()).length
    return { result: { expired, released, matched } }
  },
})
