import test from 'ava'
import { BithumbMock } from '../src/mocks/bithumb.mock'
import {
  getConfig,
} from '../src/utils'
import {
  BithumbCC,
} from '../src/interface'


const cf = getConfig('./config.json')
const mock = new BithumbMock(1000000, cf.bithumb)


test('BithumbMock > getBalanceInfo(ALL)', async t => {
  const res = await mock.getBalanceInfo(BithumbCC.ALL)
  t.is(res.status, '0000')
  const data = res.transType().data
  const krw = data.find(b => b.currency === 'KRW')
  t.is(krw.currency, 'KRW')
  t.is(krw.total, 1000000)
  t.is(krw.available, 1000000)
  t.is(krw.in_use, 0)
  t.is(krw.xcoin_last, null)
})


test('BithumbMock > getBalanceInfo(ETC)', async t => {
  const res = await mock.getBalanceInfo()
  t.is(res.status, '0000')
  const data = res.transType().data
  t.is(data.length, 2)
  const krw = data.find(b => b.currency === 'KRW')
  t.is(krw.currency, 'KRW')
  t.is(krw.total, 1000000)
  t.is(krw.available, 1000000)
  t.is(krw.in_use, 0)
  t.is(krw.xcoin_last, null)
  const etc = data.find(b => b.currency === 'BTC')
  t.is(etc.currency, 'BTC')
  t.is(etc.total, 0)
  t.is(etc.available, 0)
  t.is(etc.in_use, 0)
})
