/**
 * Test
 */

import test from 'ava'
import * as IO from 'socket.io'
import {
  Authorizer,
} from 'bynaki.auth'
import {
  Namespace,
  CandleBotSpace,
  CandleResponse,
} from '../src'
import {
  CandleBot,
  CandleMasterBot,
  TimeFrame,
  Market,
  BitfinexCC,
  BithumbCC,
  ProcessStatus,
  CandleData,
  BotHost,
  ErrorWithStatusCode,
} from '../src/client'
import {
  last,
  floor,
} from 'lodash'
import {
  getConfig,
} from '../src/utils'
import {
  BithumbMock,
  IBithumbTransactionsInfoType as ITransactionsInfoType,
} from 'cryptocurrency-mock.client'
import { Binance } from 'cryptocurrency.api';
import { BinanceCC } from 'cryptocurrency-crawler.client';



const io = IO(4001, {
  path: '/test',
})
const auth = new Authorizer('./jwtconfig.json')
const key = auth.sign({user: 'naki', permissions: ['level01']})
const cf = getConfig('./config.dev.json')
const botSpace = new CandleBotSpace(io.of('candlebot'), cf.crawlHost, ptBtoB)



BithumbMock.host = Object.assign(cf.mockHost, {key})
async function ptBtoB(opt: {krw: number, fee: number}) {
  const mock = new BithumbMock('BtoB', opt)
  const history: {bitfinex: CandleData, bithumb: CandleData, binance: CandleData}[] = []
  return async (self: Namespace, res: CandleResponse): Promise<void> => {
    const bitfinex = res['bitfinex']
    const bithumb = res['bithumb']
    const binance = res['binance']
    await mock.process(bithumb.currency, bithumb.data)
    const bal = await mock.getBalanceInfo(bithumb.currency)
    const coin = bal.transType().data.find(b => b.currency === bithumb.currency)
    const krw = bal.transType().data.find(b => b.currency === 'KRW')
    if(coin.available > 0) {
      await mock.marketSell(bithumb.currency, coin.available)
      const t = (await mock.getTransactionsInfo(bithumb.currency, {count: 1})).transType().data
      self.emit(':transacted', t[0])
    } else if(history.length !== 0 
      && bitfinex.data.close > last(history).bitfinex.close
      && binance.data.close > last(history).binance.close
      && bithumb.data.close <= last(history).bithumb.close) {
      const units = floor(krw.available / bithumb.data.close, 2)
      if(units !== 0) {
        await mock.marketBuy(bithumb.currency, units)
        const t = (await mock.getTransactionsInfo(bithumb.currency, {count: 1})).transType().data
        self.emit(':transacted', t[0])
      }
    }
    history.push({bitfinex: bitfinex.data, bithumb: bithumb.data, binance: binance.data})
  }
}



const host: BotHost = {
  url: 'http://localhost:4001/candlebot',
  version: 'test',
  key,
}
let bot01: CandleBot
let bot01_1: CandleBot



test.serial('CandleMasterBot > init(): error', async t => {
  const badHost = Object.assign({}, host, {
    key: 'badkey',
  })
  try {
    await CandleMasterBot.init(badHost)
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, 'Unauthorized: jwt malformed')
    t.is(err.status, 500)
  }
})

test.serial('CandleMasterBot > unauthorized', async t => {
  const badHost = Object.assign({}, host, {
    key: auth.sign({user: 'naki', permissions: ['badlevel']}),
  })
  try {
    await CandleMasterBot.init(badHost)
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, 'Unauthorized: denied')
    t.is(err.status, 401)
  }
})

test.serial('CandleMasterBot > init()', async t => {
  await CandleMasterBot.init(host)
  bot01 = await CandleMasterBot.newBot('bot01', {
    startTime: new Date('2019.01.01 12:00').getTime(),
    endTime: new Date('2019.01.01 14:05').getTime(),
    timeFrame: TimeFrame.t1m,
    processArg: {
      krw: 1000000,
      fee: 0,
    },
    progressInterval: 10,
    markets: [{
      id: 'bitfinex',
      name: Market.Bitfinex,
      currency: BitfinexCC.BTCUSD,
    }, {
      id: 'bithumb',
      name: Market.Bithumb,
      currency: BithumbCC.BTC,
    }, {
      id: 'binance',
      name: Market.Binance,
      currency: BinanceCC.BTCUSDT,
    }]
  })
  bot01_1 = await CandleMasterBot.getBot('bot01')
  t.pass()
})

test.after(() => {
  io.close()
})

test.serial('CandleMasterBot > :version', async t => {
  const version = await CandleMasterBot.version()
  t.is(version, '0.5.0')
})

test.serial('CandleMasterBot > :ids', async t => {
  const ids = await CandleMasterBot.ids()
  t.is(ids[0], CandleMasterBot.id)
})

test.serial('CandleMasterBot > :beBot', async t => {
  t.false(await CandleMasterBot.beBot('foobar'))
})

test.serial('CandleMasterBot > :new.bot', async t => {
  t.false(await CandleMasterBot.beBot('foobar'))
  const bot = await CandleMasterBot.newBot('foobar', {
    timeFrame: TimeFrame.t1m,
    markets: [{
      id: 'bitfinex',
      name: Market.Bitfinex,
      currency: BitfinexCC.BTCUSD,
    }, {
      id: 'bithumb',
      name: Market.Bithumb,
      currency: BithumbCC.BTC,
    }, {
      id: 'binance',
      name: Market.Binance,
      currency: BinanceCC.BTCUSDT,
    }]
  })
  t.is(bot.name, 'foobar')
  t.true(await CandleMasterBot.beBot('foobar'))
  t.is((await CandleMasterBot.ids('foobar')).length, 1)
  t.is(bot.id, (await CandleMasterBot.ids('foobar'))[0])
})

test.serial('CandleMasterBot > :new.bot > error: master는 일반 bot이 될 수 없다.', async t => {
  try {
    await CandleMasterBot.newBot('master', {
      timeFrame: TimeFrame.t1m,
      markets: [{
        id: 'bitfinex',
        name: Market.Bitfinex,
        currency: BitfinexCC.BTCUSD,
      }, {
        id: 'bithumb',
        name: Market.Bithumb,
        currency: BithumbCC.BTC,
      }, {
        id: 'binance',
        name: Market.Binance,
        currency: BinanceCC.BTCUSDT,
      }]
    })
  } catch(e) {
    const err: Error = e
    t.is(err.message, 'master는 일반 bot이 될 수 없다.')
  }
})

test.serial('CandleMasterBot > :new.bot > error: 이미 \'foobar\'의 이름으로 봇이 존재하므로 다시 config할 수 없다.', async t => {
  try {
    const bot = await CandleMasterBot.newBot('foobar', {
      timeFrame: TimeFrame.t1m,
      markets: [{
        id: 'bitfinex',
        name: Market.Bitfinex,
        currency: BitfinexCC.BTCUSD,
      }, {
        id: 'bithumb',
        name: Market.Bithumb,
        currency: BithumbCC.BTC,
      }, {
        id: 'binance',
        name: Market.Binance,
        currency: BinanceCC.BTCUSDT,
      }]
    })
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, '이미 \'foobar\'의 이름으로 봇이 존재하므로 다시 config할 수 없다.')
    t.is(err.status, 500)
  }
})

test.serial('CandleMasterBot > :get.bot', async t => {
  const bot = await CandleMasterBot.getBot('foobar')
  t.is(bot.name, 'foobar')
  t.is((await CandleMasterBot.ids('foobar')).length, 2)
  t.true((await CandleMasterBot.ids('foobar')).includes(bot.id))
})

test.serial('CandleMasterBot > :get.bot > error: \'none\' 이름의 Bot이 존재하지 않는다.', async t => {
  try {
    await CandleMasterBot.getBot('none')
  } catch(e) {
    const err: ErrorWithStatusCode = e
    t.is(err.message, '\'none\' 이름의 Bot이 존재하지 않는다.')
    t.is(err.status, 500)
  }
})

test('CandleBot > :start', async t => {
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
  // :transacted
  let transes: ITransactionsInfoType[] = []
  bot01.on<ITransactionsInfoType>(':transacted', res => {
    transes.unshift(res)
  })
  bot01_1.on<ITransactionsInfoType>(':transacted', res => {
    t.deepEqual(res, transes[0])
  })
  await bot01.start()
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
  // transactions
  const mock = new BithumbMock('BtoB')
  const got = (await mock.getTransactionsInfo('BTC', {count: 100})).transType().data
  t.deepEqual(got, transes)
  console.log(got)
})
