import {
  Socket,
  Namespace,
  On,
  Use,
} from 'socket.io-decorator'
import {
  ErrorUnauthorized,
  ErrorNotFound,
  ErrorBadRequest,
  ErrorWithStatusCode
} from '../errors'
import {
  OnWrapped,
  grantPermission,
} from '../wrappers'
import {
  decodeToken,
} from '../middlewares/authentication'
import {
  LogSpace,
} from './log.space'
import {
  BitfinexCandleCrawler,
  BithumbCandleCrawler,
  TimeFrame,
  BithumbCC,
  BitfinexCC,
  CrawlHost,
  Market,
  CandleData,
  BithumbCandleData,
  ICandleCrawlerClient,
} from 'cryptocurrency-crawler.client'
import {
  Mock,
  CandleResponse,
  CandleBotConfig,
} from '../candle.bot'
import {
  last
} from 'lodash'
import p from 'fourdollar.promisify'
import * as cf from '../config'


type BotData = {
  config: CandleBotConfig
  crawlers: Array<BithumbCandleCrawler|BitfinexCandleCrawler>
  haveToStop: boolean
  noticeInterval: number
}


export function templateBtoB(money: number) {
  const mock = new Mock(money)
  const history: {bitfinex: CandleData, bithumb: CandleData}[] = []
  return async (self: CandleBotSpace<Mock>, res: CandleResponse): Promise<Mock> => {
    const bitfinex = res['bitfinex']
    const bithumb = res['bithumb']
    if(mock.bought) {
      mock.sell(bithumb)
    } else if(history.length !== 0 
      && bitfinex.close > last(history).bitfinex.close
      && bithumb.close <= last(history).bithumb.close) {
      mock.buy(bithumb)
    }
    history.push({bitfinex, bithumb})
    return mock
  }
}

const OnAckLevel01 = OnWrapped.next(grantPermission('level01')).on()
const OnLevel01 = On.next(grantPermission('level01')).on()


@Use((socket, next, ctx) => {
  decodeToken(socket, next, ctx)
})
export class CandleBotSpace<M> extends LogSpace {
  private _botDatas: {[index: string]: BotData} = {}

  constructor(namespace: Namespace
    , public readonly template: (...args: any[]) => (self: CandleBotSpace<M>, res: CandleResponse) => Promise<M>) {
    super(namespace)
  }

  @OnAckLevel01(':ids')
  async onIds(socket: Socket, name?: string): Promise<string[]> {
    let room: Namespace
    if(name) {
      room = this.namespace.in(name)
    } else {
      room = this.namespace
    }
    return p(room.clients, room)()
  }

  @OnAckLevel01(':be.bot')
  OnBeBot(socket: Socket, name: string): boolean {
    return !!this._botDatas[name]
  }

  @OnAckLevel01(':get.bot')
  async onGetBot(socket: Socket, name: string) {
    if((!this._botDatas[name]) && (name !== 'master')) {
      throw Error(`'${name}' 이름의 Bot이 존재하지 않는다.`)
    }
    await p(socket.join, socket)(name)
    return 'ok'
  }

  @OnAckLevel01(':new.bot')
  async onNewBot(socket: Socket, {name, config}: {name: string, config: CandleBotConfig}) {
    if(name === 'master') {
      throw Error('master는 일반 bot이 될 수 없다.')
    }
    if(this._botDatas[name]) {
      throw Error(`이미 '${name}'의 이름으로 봇이 존재하므로 다시 config할 수 없다.`)
    }
    const key = socket['token']
    const {timeFrame, markets} = config
    const host: CrawlHost = Object.assign({}, cf.crawlerHost, {key})
    this._botDatas[name] = {
      noticeInterval: 0,
      config,
      crawlers: markets.map(market => {
        switch(market.name) {
          case Market.Bithumb: {
            return new BithumbCandleCrawler(market.currency, timeFrame, host)
            break
          }
          case Market.Bitfinex: {
            return new BitfinexCandleCrawler(market.currency, timeFrame, host)
            break
          }
          default: {
            throw new ErrorWithStatusCode('지원하지 않는 market 이다.')
          }
        }
      }),
      haveToStop: false,
    }
    const {crawlers} = this._botDatas[name]
    await Promise.all(crawlers.map(c => c.open()))
    await p(socket.join, socket)(name)
    return 'ok'
  }

  // @OnWrapped(':config')
  // async onConfig(socket: Socket, config: CandleBotConfig) {
  //   if(socket['user']) {
  //     throw new ErrorWithStatusCode('config는 이미 세팅 됐다.')
  //   }
  //   const {key, timeFrame, markets} = config
  //   const host: CrawlHost = Object.assign({}, cf.crawlerHost, {key})
  //   socket['user'] = {
  //     config,
  //     crawlers: markets.map(market => {
  //       switch(market.name) {
  //         case Market.Bithumb: {
  //           return new BithumbCandleCrawler(market.currency, timeFrame, host)
  //           break
  //         }
  //         case Market.Bitfinex: {
  //           return new BitfinexCandleCrawler(market.currency, timeFrame, host)
  //           break
  //         }
  //         default: {
  //           throw new ErrorWithStatusCode('지원하지 않는 market 이다.')
  //         }
  //       }
  //     }),
  //     haveToStop: false,
  //   }
  //   const {crawlers} = this._getUserData(socket)
  //   await Promise.all(crawlers.map(c => c.open()))
  //   return 'ok'
  // }

  // @OnWrapped(':start')
  // async onStart(socket: Socket) {
  //   const user = this._getUserData(socket)
  //   if(!user) {
  //     throw new ErrorWithStatusCode('먼저 Config를 세팅해야 한다.')
  //   }
  //   if(user.haveToStop) {
  //     throw Error('이미 stop 했다.')
  //   }
  //   const {config, crawlers} = user
  //   let promised: CandleData[]
  //   if(user.config.startTime) {
  //     const ps = crawlers.map(c => c.crawlAtTime(config.startTime))
  //     promised = await Promise.all(ps)
  //   } else {
  //     promised = await Promise.all(crawlers.map(c => this._getCandle(c)))
  //   }
  //   const max = Math.max(...promised.map(c => c.mts))
  //   promised = await Promise.all(promised.map(async (p, idx) => {
  //     let pp = Object.assign({}, p)
  //     while(pp.mts < max) {
  //       pp = await this._getCandle(crawlers[idx], p)
  //     }
  //     return pp
  //   }))
  //   let mock: M = null
  //   while(true) {
  //     const res = config.markets.reduce((res: CandleResponse, market, idx) => {
  //       res[market.id] = promised[idx]
  //       return res
  //     }, {})
  //     mock = await this.process(mock, res)
  //     if(mock.history.length % 100 === 0) {
  //       const h = mock.history.slice(mock.history.length - 100)
  //       socket.emit(':process', h)
  //     }
  //     if(user.haveToStop || 
  //       config.endTime && promised[0].mts + (config.timeFrame * 60 * 1000) >= config.endTime) {
  //       break
  //     }
  //     promised = await Promise.all(crawlers.map((c, i) => this._getCandle(c, promised[i])))
  //   }
  //   return mock
  // }

  // @OnWrapped(':stop')
  // onStop(socket: Socket): void {
  //   const user = this._getUserData(socket)
  //   user.haveToStop = true
  // }

  @OnWrapped('*')
  notFound() {
    throw new ErrorNotFound('not found event')
  }

  @On('error')
  onError(socket: Socket, err: Error) {
    console.error(`error in a socket(${socket.id}): `, err.message)
  }

  private async _getCandle<C extends ICandleCrawlerClient<any>>
    (crawler: C, pre?: CandleData): Promise<CandleData> {
    if(!pre) {
      return crawler.crawl()
    }
    const candle = await crawler.crawl((pre as any).realPre || pre)
    if(candle.mts !== pre.mts + crawler.timeFrame * 60 * 1000) {
      // console.log('candle.mts: ', candle.mts,  'pre.mts: ', pre.mts)
      switch(crawler.spaceName) {
        case 'bithumb': {
          return {
            mts: pre.mts + crawler.timeFrame * 60 * 1000,
            open: pre.close,
            close: pre.close,
            hight: pre.close,
            low: pre.close,
            volume: 0,
            cont_no: null,
            last_cont_no: null,
            next_cont_no: null,
            realPre: (pre as any).realPre || pre,
          } as CandleData
        }
        case 'bitfinex': {
          return {
            mts: pre.mts + crawler.timeFrame * 60 * 1000,
            open: pre.close,
            close: pre.close,
            hight: pre.close,
            low: pre.close,
            volume: 0,
          } as CandleData
        }
        default: {
          throw '지원하지 않는 crawler 이다.'
        }
      }
    } else {
      return candle
    }
  }
}