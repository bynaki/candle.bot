import test from 'ava'
import { BithumbMock } from '../src/mocks/bithumb.mock'
import {
  getConfig,
} from '../src/utils'
import {
  BithumbCandleCrawler,
  BithumbCC,
  TimeFrame,
  CandleData,
} from 'cryptocurrency-crawler.client'
import {
  Authorizer,
} from 'bynaki.auth'
import { Bithumb, IBithumbErrorResponse } from 'cryptocurrency.api';



test.before(async t => {
  const cf = getConfig('./config.json')
  await BithumbMock.init(1000000, cf.bithumb)
})


// test.only('test', async t => {
//   const auth = new Authorizer('./jwtconfig.json')
//   const key = auth.sign({user: 'naki', permissions: ['level01']})
//   const cf = getConfig('./config.json')
//   const host = Object.assign({key}, cf.crawlHost, {key})
//   const crawler = new BithumbCandleCrawler(BithumbCC.BTC, TimeFrame.t5m, host)
//   await crawler.open()
//   let c = await crawler.crawlAtTime(new Date('2019.03.01 12:00').getTime())
//   console.log(c)
//   for(let i = 0 ; i < 50 ; i++) {
//     c = await crawler.crawl(c)
//     console.log(c)
//   }
// })

test.serial('BithumbMock > getBalanceInfo(ALL)', async t => {
  const mock = new BithumbMock()
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

test.serial('BithumbMock > getBalanceInfo(BTC)', async t => {
  const mock = new BithumbMock()
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
  const btc = data.find(b => b.currency === 'BTC')
  t.is(btc.currency, 'BTC')
  t.is(btc.total, 0)
  t.is(btc.available, 0)
  t.is(btc.in_use, 0)
})


let orderId = null
test.serial('BithumbMock > place(): bid', async t => {
  const mock = new BithumbMock()
  process(0)
  const res = await mock.place('BTC', 'KRW', {
    price: 4249000,
    type: 'bid',
    units: 0.1,
  })
  t.is(res.status, '0000')
  orderId = sample[0].mts * 1000
  t.is(res.transType().order_id, orderId)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(krw.in_use, 4249000 * 0.1)
  t.is(krw.available, 1000000 - krw.in_use)
  t.is(krw.total, 1000000)
  const resOrd = await mock.getOrdersInfo('BTC', {order_id: orderId, type: 'bid'})
  const ords = resOrd.transType().data
  t.is(ords.length, 1)
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'bid',
    status: 'placed',
    units: 0.1,
    units_remaining: null,
    price: 4249000,
    fee: null,
    total: null,
    date_completed: null,
  })
})

test.serial('BithumbMock > place(): bid transaction', async t => {
  const mock = new BithumbMock()
  process(7)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(krw.total, 1000000 - (4249000 * 0.1))
  t.is(krw.available, krw.total)
  t.is(krw.in_use, 0)
  t.is(btc.total, 0.1)
  t.is(btc.available, 0.1)
  t.is(btc.in_use, 0)
  const resOrd = await mock.getOrdersInfo('BTC', {order_id: orderId, type: 'bid'})
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'bid',
    status: 'placed', // todo: placed가 아닐 텐데.
    units: 0.1,
    units_remaining: 0,
    price: 4249000,
    fee: null,
    total: 4249000 * 0.1,
    date_completed: 1551411300000 * 1000,
  })
})

test.serial('BithumbMock > place(): bid2', async t => {
  const mock = new BithumbMock()
  process(8)
  const res = await mock.place('BTC', 'KRW', {
    price: 4247000,
    type: 'bid',
    units: 0.1,
  })
  t.is(res.status, '0000')
  orderId = sample[8].mts * 1000
  t.is(res.transType().order_id, orderId)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(krw.in_use, 4247000 * 0.1)
  t.is(krw.available, 1000000 - (4249000 * 0.1) - krw.in_use)
  t.is(krw.total, 1000000 - (4249000 * 0.1))
  const resOrd = await mock.getOrdersInfo('BTC')
  const ords = resOrd.transType().data
  t.is(ords.length, 2)
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'bid',
    status: 'placed',
    units: 0.1,
    units_remaining: null,
    price: 4247000,
    fee: null,
    total: null,
    date_completed: null,
  })
})

test.serial('BithumbMock > place(): bid2 transaction', async t => {
  const mock = new BithumbMock()
  process(9)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(krw.total, 1000000 - (4249000 * 0.1) - (4247000 * 0.1))
  t.is(krw.available, krw.total)
  t.is(krw.in_use, 0)
  t.is(btc.total, 0.2)
  t.is(btc.available, 0.2)
  t.is(btc.in_use, 0)
  const resOrd = await mock.getOrdersInfo('BTC', {order_id: orderId, type: 'bid'})
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'bid',
    status: 'placed', // todo: placed가 아닐 텐데.
    units: 0.1,
    units_remaining: 0,
    price: 4247000,
    fee: null,
    total: 4247000 * 0.1,
    date_completed: 1551411900000 * 1000,
  })
})

test.serial('BithumbMock > place(): ask', async t => {
  const mock = new BithumbMock()
  const res = await mock.place('BTC', 'KRW', {
    price: 4250000,
    type: 'ask',
    units: 0.1,
  })
  t.is(res.status, '0000')
  orderId = sample[9].mts * 1000
  t.is(res.transType().order_id, orderId)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(btc.in_use, 0.1)
  t.is(btc.available, 0.1)
  t.is(btc.total, 0.2)
  const resOrd = await mock.getOrdersInfo('BTC')
  const ords = resOrd.transType().data
  t.is(ords.length, 3)
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'ask',
    status: 'placed',
    units: 0.1,
    units_remaining: null,
    price: 4250000,
    fee: null,
    total: null,
    date_completed: null,
  })
})

test.serial('BithumbMock > place(): ask transaction', async t => {
  const mock = new BithumbMock()
  process(11)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(krw.total, 1000000 - (4249000 * 0.1) - (4247000 * 0.1) + (4250000 * 0.1))
  t.is(krw.available, krw.total)
  t.is(krw.in_use, 0)
  t.is(btc.total, 0.1)
  t.is(btc.available, 0.1)
  t.is(btc.in_use, 0)
  const resOrd = await mock.getOrdersInfo('BTC', {order_id: orderId, type: 'ask'})
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'ask',
    status: 'placed', // todo: placed가 아닐 텐데.
    units: 0.1,
    units_remaining: 0,
    price: 4250000,
    fee: null,
    total: 4250000 * 0.1,
    date_completed: 1551412500000 * 1000,
  })
})

test.serial('BithumbMock > place() bid too much', async t => {
  const mock = new BithumbMock()
  const res = await mock.place('BTC', 'KRW', {
    price: 1111111,
    type: 'bid',
    units: 2,
  })
  t.is(res.status,'5600')
})

test.serial('BithumbMock > cancel()', async t => {
  const mock = new BithumbMock()
  const krw = (await mock.getBalanceInfo('BTC')).transType().data.find(b => b.currency === 'KRW')
  const plRes = (await mock.place('BTC', 'KRW', {
    price: 1,
    type: 'bid',
    units: 2,
  })).transType()
  const krw2 = (await mock.getBalanceInfo('BTC')).transType().data.find(b => b.currency === 'KRW')
  t.is(krw2.in_use, krw.in_use + 2)
  t.is(krw2.available, krw.available - 2)
  const ordRes = await mock.getOrdersInfo('ALL')
  t.is(ordRes.data.length, 4)
  const ordRes2 = await mock.getOrdersInfo('BTC', {
    order_id: plRes.order_id,
    type: 'bid',
  })
  t.is(ordRes2.status, '0000')
  t.is(ordRes2.data.length, 1)
  const cclRes = await mock.cancel('BTC', {
    order_id: plRes.order_id,
    type: 'bid',
  })
  t.is(cclRes.status, '0000')
  const krw3 = (await mock.getBalanceInfo('BTC')).transType().data.find(b => b.currency === 'KRW')
  t.deepEqual(krw3, krw)
  const ordRes3 = await mock.getOrdersInfo('ALL')
  t.is(ordRes3.data.length, 3)
  const ordRes4 = await mock.getOrdersInfo('BTC', {
    order_id: plRes.order_id,
    type: 'bid',
  })
  t.is(ordRes4.status, '5600')
})

test.serial.skip('BithumbMock > marketBuy()', async t => {
  const mock = new BithumbMock()
  const res = await mock.place('BTC', 'KRW', {
    price: 4250000,
    type: 'ask',
    units: 0.1,
  })
  t.is(res.status, '0000')
  orderId = sample[9].mts * 1000
  t.is(res.transType().order_id, orderId)
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const btc = bals.find(b => b.currency === 'BTC')
  t.is(btc.in_use, 0.1)
  t.is(btc.available, 0.1)
  t.is(btc.total, 0.2)
  const resOrd = await mock.getOrdersInfo('BTC')
  const ords = resOrd.transType().data
  t.is(ords.length, 3)
  const ord = resOrd.transType().data[0]
  t.deepEqual(ord, {
    order_id: orderId,
    order_currency: 'BTC',
    order_date: orderId,
    payment_currency: 'KRW',
    type: 'ask',
    status: 'placed',
    units: 0.1,
    units_remaining: null,
    price: 4250000,
    fee: null,
    total: null,
    date_completed: null,
  })
})

test.serial('BithumbMock > getOrdersInfo()', async t => {
  const mock = new BithumbMock()
  const res = await mock.getOrdersInfo('BTC')
  t.is(res.status, '0000')
  console.log(res)
})

test.serial('BithumbMock > getOrdersInfo(): error', async t => {
  const mock = new BithumbMock()
  const res: IBithumbErrorResponse = (await mock.getOrdersInfo('ETH')) as any
  t.is(res.status, '5600')
  t.is(res.message, '거래 진행중인 내역이 존재하지 않습니다.')
})


let start = 0
function process(idx: number) {
  const mock = new BithumbMock()
  sample.slice(start, idx + 1).forEach(c => mock.process('BTC', c))
  start = idx
}

// test.only('test', t => {
//   console.log('idx: ', sample.findIndex(c => {
//     return c.close < 4251000
//   }))
// })


const sample = [
  // 0
  { mts: 1551409200000,
    open: 4251000,
    close: 4252000,
    hight: 4256000,
    low: 4251000,
    volume: 3.74254933,
    cont_no: 33493263,
    last_cont_no: 33493296,
    next_cont_no: 33493297 },
  // 1
  { mts: 1551409500000,
    open: 4253000,
    close: 4253000,
    hight: 4255000,
    low: 4251000,
    volume: 3.87529835,
    cont_no: 33493297,
    last_cont_no: 33493336,
    next_cont_no: 33493337 },
  // 2
  { mts: 1551409800000,
    open: 4252000,
    close: 4253000,
    hight: 4253000,
    low: 4251000,
    volume: 5.325951280000001,
    cont_no: 33493337,
    last_cont_no: 33493386,
    next_cont_no: 33493387 },
  // 3
  { mts: 1551410100000,
    open: 4253000,
    close: 4257000,
    hight: 4258000,
    low: 4250000,
    volume: 8.12388765,
    cont_no: 33493387,
    last_cont_no: 33493485,
    next_cont_no: 33493486 },
  // 4
  { mts: 1551410400000,
    open: 4253000,
    close: 4254000,
    hight: 4257000,
    low: 4250000,
    volume: 13.00565258,
    cont_no: 33493486,
    last_cont_no: 33493589,
    next_cont_no: 33493590 },
  // 5
  { mts: 1551410700000,
    open: 4256000,
    close: 4255000,
    hight: 4256000,
    low: 4252000,
    volume: 4.130999999999999,
    cont_no: 33493590,
    last_cont_no: 33493654,
    next_cont_no: 33493655 },
  // 6
  { mts: 1551411000000,
    open: 4255000,
    close: 4256000,
    hight: 4256000,
    low: 4250000,
    volume: 8.52591916,
    cont_no: 33493655,
    last_cont_no: 33493779,
    next_cont_no: 33493780 },
  // 7
  { mts: 1551411300000,
    open: 4251000,
    close: 4249000,
    hight: 4256000,
    low: 4249000,
    volume: 8.18647516,
    cont_no: 33493780,
    last_cont_no: 33493839,
    next_cont_no: 33493840 },
  // 8
  { mts: 1551411600000,
    open: 4250000,
    close: 4249000,
    hight: 4255000,
    low: 4247000,
    volume: 8.472000000000001,
    cont_no: 33493840,
    last_cont_no: 33493921,
    next_cont_no: 33493922 },
  // 9
  { mts: 1551411900000,
    open: 4249000,
    close: 4247000,
    hight: 4254000,
    low: 4247000,
    volume: 6.084899999999999,
    cont_no: 33493922,
    last_cont_no: 33493988,
    next_cont_no: 33493989 },
  // 10
  { mts: 1551412200000,
    open: 4247000,
    close: 4246000,
    hight: 4252000,
    low: 4246000,
    volume: 3.6203279999999998,
    cont_no: 33493989,
    last_cont_no: 33494068,
    next_cont_no: 33494069 },
  // 11
  { mts: 1551412500000,
    open: 4246000,
    close: 4250000,
    hight: 4252000,
    low: 4245000,
    volume: 8.178248839999998,
    cont_no: 33494069,
    last_cont_no: 33494143,
    next_cont_no: 33494144 },
  // 12
  { mts: 1551412800000,
    open: 4246000,
    close: 4250000,
    hight: 4251000,
    low: 4246000,
    volume: 5.03651663,
    cont_no: 33494144,
    last_cont_no: 33494194,
    next_cont_no: 33494195 },
  // 13
  { mts: 1551413100000,
    open: 4246000,
    close: 4247000,
    hight: 4251000,
    low: 4245000,
    volume: 3.36805294,
    cont_no: 33494195,
    last_cont_no: 33494250,
    next_cont_no: 33494251 },
  // 14
  { mts: 1551413400000,
    open: 4247000,
    close: 4246000,
    hight: 4253000,
    low: 4244000,
    volume: 9.36256985,
    cont_no: 33494251,
    last_cont_no: 33494344,
    next_cont_no: 33494345 },
  // 15
  { mts: 1551413700000,
    open: 4247000,
    close: 4248000,
    hight: 4251000,
    low: 4246000,
    volume: 4.45220089,
    cont_no: 33494345,
    last_cont_no: 33494373,
    next_cont_no: 33494374 },
  // 16
  { mts: 1551414000000,
    open: 4247000,
    close: 4250000,
    hight: 4252000,
    low: 4246000,
    volume: 4.5605,
    cont_no: 33494374,
    last_cont_no: 33494410,
    next_cont_no: 33494411 },
  // 17 
  { mts: 1551414300000,
    open: 4252000,
    close: 4244000,
    hight: 4252000,
    low: 4244000,
    volume: 2.5239823799999996,
    cont_no: 33494411,
    last_cont_no: 33494441,
    next_cont_no: 33494442 },
  // 18
  { mts: 1551414600000,
    open: 4245000,
    close: 4247000,
    hight: 4249000,
    low: 4244000,
    volume: 8.52796989,
    cont_no: 33494442,
    last_cont_no: 33494453,
    next_cont_no: 33494454 },
  // 19
  { mts: 1551414960000,
    open: 4249000,
    close: 4249000,
    hight: 4250000,
    low: 4246000,
    volume: 1.26230588,
    cont_no: 33494454,
    last_cont_no: 33494462,
    next_cont_no: 33494463 },
  // 20
  { mts: 1551415200000,
    open: 4250000,
    close: 4245000,
    hight: 4252000,
    low: 4244000,
    volume: 8.2749,
    cont_no: 33494463,
    last_cont_no: 33494536,
    next_cont_no: 33494537 },
  // 21
  { mts: 1551415500000,
    open: 4245000,
    close: 4248000,
    hight: 4249000,
    low: 4243000,
    volume: 8.8841,
    cont_no: 33494537,
    last_cont_no: 33494568,
    next_cont_no: 33494569 },
  // 22
  { mts: 1551415800000,
    open: 4245000,
    close: 4242000,
    hight: 4250000,
    low: 4242000,
    volume: 6.6728000000000005,
    cont_no: 33494569,
    last_cont_no: 33494620,
    next_cont_no: 33494621 },
  // 23
  { mts: 1551416100000,
    open: 4247000,
    close: 4242000,
    hight: 4248000,
    low: 4242000,
    volume: 9.0376,
    cont_no: 33494621,
    last_cont_no: 33494654,
    next_cont_no: 33494655 },
  // 24
  { mts: 1551416400000,
    open: 4243000,
    close: 4242000,
    hight: 4245000,
    low: 4242000,
    volume: 3.4086,
    cont_no: 33494655,
    last_cont_no: 33494674,
    next_cont_no: 33494675 },
  // 25
  { mts: 1551416700000,
    open: 4242000,
    close: 4242000,
    hight: 4250000,
    low: 4242000,
    volume: 11.63285969,
    cont_no: 33494675,
    last_cont_no: 33494709,
    next_cont_no: 33494710 },
  // 26
  { mts: 1551417000000,
    open: 4246000,
    close: 4243000,
    hight: 4249000,
    low: 4241000,
    volume: 7.65089575,
    cont_no: 33494710,
    last_cont_no: 33494734,
    next_cont_no: 33494735 },
  // 27
  { mts: 1551417360000,
    open: 4241000,
    close: 4241000,
    hight: 4245000,
    low: 4241000,
    volume: 3.4158999999999997,
    cont_no: 33494735,
    last_cont_no: 33494758,
    next_cont_no: 33494759 },
  // 28
  { mts: 1551417600000,
    open: 4243000,
    close: 4242000,
    hight: 4246000,
    low: 4241000,
    volume: 12.5429,
    cont_no: 33494759,
    last_cont_no: 33494837,
    next_cont_no: 33494838 },
  // 29
  { mts: 1551417900000,
    open: 4242000,
    close: 4240000,
    hight: 4248000,
    low: 4240000,
    volume: 5.50968311,
    cont_no: 33494838,
    last_cont_no: 33494919,
    next_cont_no: 33494920 },
  // 30
  { mts: 1551418200000,
    open: 4241000,
    close: 4240000,
    hight: 4244000,
    low: 4240000,
    volume: 4.395956820000001,
    cont_no: 33494920,
    last_cont_no: 33494948,
    next_cont_no: 33494949 },
  // 31
  { mts: 1551418500000,
    open: 4244000,
    close: 4245000,
    hight: 4245000,
    low: 4240000,
    volume: 7.41994899,
    cont_no: 33494949,
    last_cont_no: 33495001,
    next_cont_no: 33495002 },
  // 32
  { mts: 1551418800000,
    open: 4245000,
    close: 4245000,
    hight: 4245000,
    low: 4244000,
    volume: 11.9581492,
    cont_no: 33495002,
    last_cont_no: 33495055,
    next_cont_no: 33495056 },
  // 33
  { mts: 1551419100000,
    open: 4244000,
    close: 4248000,
    hight: 4248000,
    low: 4241000,
    volume: 8.837266239999998,
    cont_no: 33495056,
    last_cont_no: 33495109,
    next_cont_no: 33495110 },
  // 34
  { mts: 1551419400000,
    open: 4248000,
    close: 4247000,
    hight: 4248000,
    low: 4242000,
    volume: 8.082500000000001,
    cont_no: 33495110,
    last_cont_no: 33495183,
    next_cont_no: 33495184 },
  // 35
  { mts: 1551419700000,
    open: 4242000,
    close: 4246000,
    hight: 4248000,
    low: 4241000,
    volume: 8.30130564,
    cont_no: 33495184,
    last_cont_no: 33495263,
    next_cont_no: 33495264 },
  // 36
  { mts: 1551420000000,
    open: 4246000,
    close: 4242000,
    hight: 4248000,
    low: 4242000,
    volume: 8.578700000000001,
    cont_no: 33495264,
    last_cont_no: 33495347,
    next_cont_no: 33495348 },
  // 37
  { mts: 1551420300000,
    open: 4242000,
    close: 4246000,
    hight: 4247000,
    low: 4242000,
    volume: 2.35400901,
    cont_no: 33495348,
    last_cont_no: 33495383,
    next_cont_no: 33495384 },
  // 38
  { mts: 1551420600000,
    open: 4246000,
    close: 4242000,
    hight: 4247000,
    low: 4242000,
    volume: 2.3376,
    cont_no: 33495384,
    last_cont_no: 33495405,
    next_cont_no: 33495406 },
  // 39
  { mts: 1551420900000,
    open: 4247000,
    close: 4248000,
    hight: 4248000,
    low: 4243000,
    volume: 6.92223181,
    cont_no: 33495406,
    last_cont_no: 33495418,
    next_cont_no: 33495419 },
  // 40
  { mts: 1551421200000,
    open: 4244000,
    close: 4248000,
    hight: 4248000,
    low: 4243000,
    volume: 5.6987,
    cont_no: 33495419,
    last_cont_no: 33495439,
    next_cont_no: 33495440 },
  // 41
  { mts: 1551421500000,
    open: 4243000,
    close: 4246000,
    hight: 4248000,
    low: 4243000,
    volume: 6.872121460000001,
    cont_no: 33495440,
    last_cont_no: 33495484,
    next_cont_no: 33495485 },
  // 42
  { mts: 1551421800000,
    open: 4246000,
    close: 4248000,
    hight: 4248000,
    low: 4246000,
    volume: 4.741684879999999,
    cont_no: 33495485,
    last_cont_no: 33495536,
    next_cont_no: 33495537 },
  // 43
  { mts: 1551422100000,
    open: 4248000,
    close: 4246000,
    hight: 4248000,
    low: 4246000,
    volume: 4.356605449999999,
    cont_no: 33495537,
    last_cont_no: 33495582,
    next_cont_no: 33495583 },
  // 44
  { mts: 1551422400000,
    open: 4248000,
    close: 4245000,
    hight: 4248000,
    low: 4245000,
    volume: 17.140900000000002,
    cont_no: 33495583,
    last_cont_no: 33495642,
    next_cont_no: 33495643 },
  // 45
  { mts: 1551422700000,
    open: 4245000,
    close: 4244000,
    hight: 4248000,
    low: 4243000,
    volume: 8.606300000000001,
    cont_no: 33495643,
    last_cont_no: 33495675,
    next_cont_no: 33495676 },
  // 46
  { mts: 1551423000000,
    open: 4244000,
    close: 4245000,
    hight: 4246000,
    low: 4244000,
    volume: 4.83199705,
    cont_no: 33495676,
    last_cont_no: 33495698,
    next_cont_no: 33495699 },
  // 47
  { mts: 1551423300000,
    open: 4245000,
    close: 4244000,
    hight: 4246000,
    low: 4244000,
    volume: 8.34767126,
    cont_no: 33495699,
    last_cont_no: 33495748,
    next_cont_no: 33495749 },
  // 48
  { mts: 1551423600000,
    open: 4246000,
    close: 4246000,
    hight: 4246000,
    low: 4244000,
    volume: 10.41613456,
    cont_no: 33495749,
    last_cont_no: 33495783,
    next_cont_no: 33495784 },
  // 49
  { mts: 1551423900000,
    open: 4246000,
    close: 4247000,
    hight: 4248000,
    low: 4246000,
    volume: 10.970851170000001,
    cont_no: 33495784,
    last_cont_no: 33495855,
    next_cont_no: 33495856 },
  // 50
  { mts: 1551424200000,
    open: 4248000,
    close: 4245000,
    hight: 4248000,
    low: 4244000,
    volume: 11.8688,
    cont_no: 33495856,
    last_cont_no: 33495911,
    next_cont_no: 33495912 },
]