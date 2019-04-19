/**
 * Test
 */

import test from 'ava'
import * as IO from 'socket.io'
import { CandleBotSpace, templateBtoB } from '../src/namespaces'
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
} from '../src'


const io = IO(4001, {
  path: '/v1',
})
const auth = new Authorizer('./jwtconfig.json')
const key = auth.sign({user: 'naki', permissions: ['level01']})
const botSpace = new CandleBotSpace(io.of('candlebot'), templateBtoB)
const master = new CandleMasterBot<Mock>({
  url: 'http://localhost:4001/candlebot',
  version: 'v1',
  key,
})
let bot01: CandleBot<Mock>

test.before(async () => {
  await master.open()
  bot01 = await master.newBot('bot01', {
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
})

test.after(() => {
  io.close()
})

test.serial('CandleMasterBot > :ids', async t => {
  const ids = await master.ids()
  t.is(ids[0], master.id)
})

test.serial('CandleMasterBot > :beBot', async t => {
  t.false(await master.beBot('foobar'))
})

test.serial('CandleMasterBot > :new.bot', async t => {
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
