import {
  Socket,
  Namespace,
  On,
  Use,
} from 'socket.io-decorator'
import {
  ErrorNotFound,
} from './errors'
import {
  OnWrapped,
  grantPermission,
} from './wrappers'
import {
  decodeToken,
} from './middlewares/authentication'
import {
  LogSpace,
} from './log.space'
import {
  BitfinexCandleCrawler,
  BithumbCandleCrawler,
  CrawlHost,
  Market,
  BithumbCC,
  BitfinexCC,
  CandleData,
  BithumbCandleData,
  ICandleCrawlerClient,
} from 'cryptocurrency-crawler.client'
import {
  CandleBotConfig,
  BotStatus,
  ProcessStatus,
} from './client'
import p from 'fourdollar.promisify'



export interface CandleResponse {
  [id: string]: {
    currency: BithumbCC|BitfinexCC
    data: CandleData|BithumbCandleData
  }
}

type BotData = {
  config: CandleBotConfig
  crawlers: Array<BithumbCandleCrawler|BitfinexCandleCrawler>
  haveToStop: boolean
  status: BotStatus
}


const OnAckLevel01 = OnWrapped.next(grantPermission('level01')).on()
const OnLevel01 = On.next(grantPermission('level01')).on()


@Use((socket, next, ctx) => {
  decodeToken(socket, next, ctx)
})
export class CandleBotSpace extends LogSpace {
  private _botDatas: {[index: string]: BotData} = {}
  private _crawlHost: CrawlHost

  constructor(namespace: Namespace, crawlHost: CrawlHost
    , public readonly processTemplate: (arg: any) => Promise<(self: Namespace, res: CandleResponse) => Promise<void>>) {
    super(namespace)
    this._crawlHost = Object.assign({}, crawlHost)
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
    config = Object.assign({progressInterval: 100}, config)
    const key = socket['token']
    const {timeFrame, markets} = config
    const host: CrawlHost = Object.assign({}, this._crawlHost, {key})
    this._botDatas[name] = {
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
            throw Error('지원하지 않는 market 이다.')
          }
        }
      }),
      haveToStop: false,
      status: {
        progress: 0,
        process: ProcessStatus.yet,
      },
    }
    const {crawlers} = this._botDatas[name]
    await Promise.all(crawlers.map(c => c.open()))
    await p(socket.join, socket)(name)
    return 'ok'
  }

  private async _validBotData(socket: Socket, name: string): Promise<BotData> {
    const botData = this._botDatas[name]
    if(!botData) {
      throw Error('먼저 Config를 세팅해야 한다.')
    }
    const belong = await this.onIds(socket, name)
    if(!belong.includes(socket.id)) {
      throw Error(`'${name}'에 속해있지 않은 socket이 자격없는 요청을 했다.`)
    }
    return botData
  }

  @OnAckLevel01(':start')
  async onStart(socket: Socket, name: string): Promise<any> {
    const botData: BotData = await this._validBotData(socket, name)
    if(botData.haveToStop) {
      throw Error('이미 stop 했다.')
    }
    const {config, crawlers} = botData
    let promised: CandleData[]
    if(botData.config.startTime) {
      const ps = crawlers.map(c => c.crawlAtTime(config.startTime))
      promised = await Promise.all(ps)
    } else {
      promised = await Promise.all(crawlers.map(c => this._getCandle(c)))
    }
    const max = Math.max(...promised.map(c => c.mts))
    promised = await Promise.all(promised.map(async (p, idx) => {
      let pp = Object.assign({}, p)
      while(pp.mts < max) {
        pp = await this._getCandle(crawlers[idx], p)
      }
      return pp
    }))
    const process = await this.processTemplate(config.processArg)
    const namespace = this.namespace.to(name)
    const status = botData.status
    status.process = ProcessStatus.doing
    namespace.emit(':started')
    while(true) {
      const res = config.markets.reduce((res: CandleResponse, market, idx) => {
        res[market.id] = {
          currency: market.currency,
          data: promised[idx],
        }
        return res
      }, {})
      await process(namespace, res)
      if(++status.progress % config.progressInterval % 100 === 0) {
        namespace.emit(':progress', status.progress)
      }
      if(botData.haveToStop || 
        config.endTime && promised[0].mts + (config.timeFrame * 60 * 1000) >= config.endTime) {
        break
      }
      promised = await Promise.all(crawlers.map((c, i) => this._getCandle(c, promised[i])))
    }
    if(status.progress % config.progressInterval % 100 !== 0) {
      namespace.emit(':progress', status.progress)
    }
    status.process = ProcessStatus.done 
    namespace.emit(':stoped')
    // return botData.mock
  }

  @OnAckLevel01(':stop')
  async onStop(socket: Socket, name: string): Promise<string> {
    const botData = await this._validBotData(socket, name)
    const status = botData.status
    switch(status.process) {
      case ProcessStatus.yet: {
        throw Error('아직 start하지 않았다.')
      }
      case ProcessStatus.doing: {
        botData.haveToStop = true
        return 'ok'
      }
      case ProcessStatus.done: {
        return 'done'
      }
    }
  }

  @OnAckLevel01(':status')
  async onStatus(socket: Socket, name: string): Promise<BotStatus> {
    const botData = await this._validBotData(socket, name)
    return botData.status
  }

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