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

test.before(async () => {
  await master.open()
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
  console.log(bot.name)
})
