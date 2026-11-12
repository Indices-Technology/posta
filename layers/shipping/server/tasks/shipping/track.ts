import { shipmentService } from '../../services/shipment.service'

// Every 15 minutes (layers/shipping/nuxt.config.ts). GIG has no webhooks, so this is the only
// thing that notices a scan; each change is sent to the client as a signed webhook.
export default defineTask({
  meta: { name: 'shipping:track', description: 'Read carrier scans for shipments on the road' },
  async run() {
    return { result: await shipmentService.trackDue() }
  },
})
