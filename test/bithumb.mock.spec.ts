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



const sample: CandleData[] = [
  { mts: 1551409200000,
    open: 4251000,
    close: 4252000,
    hight: 4256000,
    low: 4251000,
    volume: 3.74254933,
  },
  { mts: 1551409500000,
    open: 4253000,
    close: 4253000,
    hight: 4255000,
    low: 4251000,
    volume: 3.87529835,
  },
  { mts: 1551409800000,
    open: 4252000,
    close: 4253000,
    hight: 4253000,
    low: 4251000,
    volume: 5.325951280000001,
  },
  { mts: 1551410100000,
    open: 4253000,
    close: 4257000,
    hight: 4258000,
    low: 4250000,
    volume: 8.12388765,
  },
  { mts: 1551410400000,
    open: 4253000,
    close: 4254000,
    hight: 4257000,
    low: 4250000,
    volume: 13.00565258,
  },
  { mts: 1551410700000,
    open: 4256000,
    close: 4255000,
    hight: 4256000,
    low: 4252000,
    volume: 4.130999999999999,
  },
  { mts: 1551411000000,
    open: 4255000,
    close: 4256000,
    hight: 4256000,
    low: 4250000,
    volume: 8.52591916,
  },
  { mts: 1551411300000,
    open: 4251000,
    close: 4249000,
    hight: 4256000,
    low: 4249000,
    volume: 8.18647516,
  },
  { mts: 1551411600000,
    open: 4250000,
    close: 4249000,
    hight: 4255000,
    low: 4247000,
    volume: 8.472000000000001,
  },
  { mts: 1551411900000,
    open: 4249000,
    close: 4247000,
    hight: 4254000,
    low: 4247000,
    volume: 6.084899999999999,
  },
  { mts: 1551412200000,
    open: 4247000,
    close: 4246000,
    hight: 4252000,
    low: 4246000,
    volume: 3.6203279999999998,
  },
]


test.before(async t => {
  const cf = getConfig('./config.json')
  await BithumbMock.init(1000000, cf.bithumb)
})


// test('test', async t => {
//   const auth = new Authorizer('./jwtconfig.json')
//   const key = auth.sign({user: 'naki', permissions: ['level01']})
//   const cf = getConfig('./config.json')
//   const host = Object.assign({key}, cf.crawlHost, {key})
//   const crawler = new BithumbCandleCrawler(BithumbCC.BTC, TimeFrame.t5m, host)
//   await crawler.open()
//   let c = await crawler.crawlAtTime(new Date('2019.03.01 12:00').getTime())
//   console.log(c)
//   for(let i = 0 ; i < 10 ; i++) {
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


test.serial('BithumbMock > getBalanceInfo(ETC)', async t => {
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
  const etc = data.find(b => b.currency === 'BTC')
  t.is(etc.currency, 'BTC')
  t.is(etc.total, 0)
  t.is(etc.available, 0)
  t.is(etc.in_use, 0)
})



test.serial('BithumbMock > place()', async t => {
  const mock = new BithumbMock()
  mock.process('BTC', sample[0])
  const res = await mock.place('BTC', 'KRW', {
    price: 4249000,
    type: 'bid',
    units: 0.1,
  })
  t.is(res.status, '0000')
  const bals = (await mock.getBalanceInfo()).transType().data
  const krw = bals.find(b => b.currency === 'KRW')
  const etc = bals.find(b => b.currency === 'ETC')
  t.is(krw.in_use, 4249000 * 0.1)
  t.is(krw.available, 1000000 - krw.in_use)
  t.is(krw.total, 1000000)
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