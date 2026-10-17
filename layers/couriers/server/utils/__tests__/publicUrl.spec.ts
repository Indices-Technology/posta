import { describe, expect, it } from 'vitest'
import { isPublicHttpsUrl } from '../publicUrl'

describe('isPublicHttpsUrl', () => {
  it('accepts a normal company endpoint', () => {
    expect(isPublicHttpsUrl('https://api.swiftriders.ng/posta/webhook')).toBe(true)
  })

  it.each([
    'http://api.swiftriders.ng/hook', // not https
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://10.0.0.5/hook',
    'https://192.168.1.10/hook',
    'https://172.20.0.1/hook',
    'https://169.254.169.254/latest/meta-data', // cloud metadata
    'https://[::1]/hook',
    'https://user:pass@api.example.com/hook',
    'https://intranet/hook',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isPublicHttpsUrl(url)).toBe(false)
  })
})
