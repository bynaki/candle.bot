/**
 * Test
 */

import test from 'ava'
import * as IO from 'socket.io'
import { CandleBotSpace, ptBtoB } from '../src/namespaces'
import p from 'fourdollar.promisify'
import { ErrorWithStatusCode } from '../src/errors';
import {
  Authorizer,
} from 'bynaki.auth'
import {
  CandleBot,
  CandleMasterBot,
  Mock,
  TimeFrame,
  Market,
  BitfinexCC,
  BithumbCC,
  ProcessStatus,
} from '../src'


const io = IO(4001, {
  path: '/v1',
})
const auth = new Authorizer('./jwtconfig.json')
const key = auth.sign({user: 'naki', permissions: ['level01']})
const botSpace = new CandleBotSpace(io.of('candlebot'), ptBtoB)
const master = new CandleMasterBot({
  url: 'http://localhost:4001/candlebot',
  version: 'v1',
  key,
})
let bot01: CandleBot
let bot01_1: CandleBot

test.before(async () => {
  await master.open()
  bot01 = await master.newBot('bot01', {
    startTime: new Date('2019.01.01 12:00').getTime(),
    endTime: new Date('2019.01.01 14:05').getTime(),
    timeFrame: TimeFrame.t1m,
    processArg: 1000000,
    progressInterval: 10,
    markets: [{
      id: 'bitfinex',
      name: Market.Bitfinex,
      currency: BitfinexCC.BTCUSD,
    }, {
      id: 'bithumb',
      name: Market.Bithumb,
      currency: BithumbCC.BTC,
    }]
  })
  bot01_1 = await master.getBot('bot01')
})

test.after(() => {
  io.close()
})

test.serial('CandleMasterBot > unauthorized', async t => {
  const master = new CandleMasterBot({
    url: 'http://localhost:4001/candlebot',
    version: 'v1',
    key: auth.sign({user: 'naki', permissions: ['badlevel']}),
  })
  try {
    await master.open()
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, 'Unauthorized: denied')
    t.is(err.status, 401)
  }
})

test.serial('CandleMasterBot > :ids', async t => {
  const ids = await master.ids()
  t.is(ids[0], master.id)
})

test.serial('CandleMasterBot > :beBot', async t => {
  t.false(await master.beBot('foobar'))
})

test.serial('CandleMasterBot > :new.bot', async t => {
  t.false(await master.beBot('foobar'))
  const bot = await master.newBot('foobar', {
    timeFrame: TimeFrame.t1m,
    markets: [{
      id: 'bitfinex',
      name: Market.Bitfinex,
      currency: BitfinexCC.BTCUSD,
    }, {
      id: 'bithumb',
      name: Market.Bithumb,
      currency: BithumbCC.BTC,
    }]
  })
  t.is(bot.name, 'foobar')
  t.true(await master.beBot('foobar'))
  t.is((await master.ids('foobar')).length, 1)
  t.is(bot.id, (await master.ids('foobar'))[0])
})

test.serial('CandleMasterBot > :new.bot > error: master는 일반 bot이 될 수 없다.', async t => {
  try {
    await master.newBot('master', {
      timeFrame: TimeFrame.t1m,
      markets: [{
        id: 'bitfinex',
        name: Market.Bitfinex,
        currency: BitfinexCC.BTCUSD,
      }, {
        id: 'bithumb',
        name: Market.Bithumb,
        currency: BithumbCC.BTC,
      }]
    })
  } catch(e) {
    const err: Error = e
    t.is(err.message, 'master는 일반 bot이 될 수 없다.')
  }
})

test.serial('CandleMasterBot > :new.bot > error: 이미 \'foobar\'의 이름으로 봇이 존재하므로 다시 config할 수 없다.', async t => {
  try {
    const bot = await master.newBot('foobar', {
      timeFrame: TimeFrame.t1m,
      markets: [{
        id: 'bitfinex',
        name: Market.Bitfinex,
        currency: BitfinexCC.BTCUSD,
      }, {
        id: 'bithumb',
        name: Market.Bithumb,
        currency: BithumbCC.BTC,
      }]
    })
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, '이미 \'foobar\'의 이름으로 봇이 존재하므로 다시 config할 수 없다.')
    t.is(err.status, 500)
  }
})

test.serial('CandleMasterBot > :get.bot', async t => {
  const bot = await master.getBot('foobar')
  t.is(bot.name, 'foobar')
  t.is((await master.ids('foobar')).length, 2)
  t.true((await master.ids('foobar')).includes(bot.id))
})

test.serial('CandleMasterBot > :get.bot > error: \'none\' 이름의 Bot이 존재하지 않는다.', async t => {
  try {
    await master.getBot('none')
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, '\'none\' 이름의 Bot이 존재하지 않는다.')
    t.is(err.status, 500)
  }
})

test.only('CandleBot > :start', async t => {
  // :status 초기
  t.deepEqual(await bot01.status(), {
    progress: 0,
    process: ProcessStatus.yet,
  })
  t.deepEqual(await bot01_1.status(), {
    progress: 0,
    process: ProcessStatus.yet,
  })
  // :progress
  let cc = 0
  bot01.on(':progress', count => {
    if(count !== 125) {
      t.is(count, cc + 10)
    }
    cc = count
  })
  let ccc = 0
  bot01_1.on(':progress', count => {
    if(count !== 125) {
      t.is(count, ccc + 10)
    }
    ccc = count
  })
  // :started
  let ss = false
  bot01.on(':started', async () => {
    ss = true
    // ProcessStatus.doing
    const status = await bot01.status()
    t.is(status.process, ProcessStatus.doing)
  })
  let sss = false
  bot01.on(':started', async () => {
    sss = true
    // ProcessStatus.doing
    const status = await bot01_1.status()
    t.is(status.process, ProcessStatus.doing)
  })
  // :stoped
  let st = false
  bot01.on(':stoped', async () => {
    st = true
    // ProcessStatus.done
    const status = await bot01.status()
    t.is(status.process, ProcessStatus.done)
  })
  let sst = false
  bot01.on(':stoped', async () => {
    sst = true
    // ProcessStatus.done
    const status = await bot01_1.status()
    t.is(status.process, ProcessStatus.done)
  })
  let bMock: Mock
  // :bought
  let bc = 0
  bot01.on<Mock>(':bought', mock => {
    t.is(mock.history.length, bc++)
  })
  let bbc = 0
  bot01_1.on<Mock>(':bought', mock => {
    t.is(mock.history.length, bbc++)
  })
  // :sold
  let sc = 0
  bot01.on<Mock>(':sold', mock => {
    t.is(mock.history.length, ++sc)
    bMock = mock
  })
  let ssc = 0
  bot01_1.on<Mock>(':sold', mock => {
    t.is(mock.history.length, ++ssc)
  })
  const mock = await bot01.start(Mock)
  // ProcessStatus.done
  t.is((await bot01.status()).process, ProcessStatus.done)
  t.is((await bot01_1.status()).process, ProcessStatus.done)
  // :progress
  t.is(cc, 125)
  t.is(ccc, 125)
  // :started
  t.true(ss)
  t.true(sss)
  // :stoped
  t.true(st)
  t.true(sst)
  // :bought
  t.is(bc, 18)
  t.is(bbc, 18)
  // :sold
  t.is(sc, 18)
  t.is(ssc, 18)
  // mock
  const mm = await bot01_1.mock<Mock>()
  t.deepEqual(mock.history, mm.history)
  t.is(mock.money, mm.money)
  t.is(mock.bought, mm.bought)
  t.deepEqual(mock.history, bMock.history)
  t.is(mock.money, bMock.money)
  t.is(mock.bought, bMock.bought)
  t.is(mock.history.length, 18)
  mock.printTotal()
})
