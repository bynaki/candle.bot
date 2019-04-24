import * as Socket from 'socket.io-client'
import {
  TimeFrame,
  Market,
  BithumbCC,
  BitfinexCC,
  CandleData,
  BithumbCandleData,
} from 'cryptocurrency-crawler.client'
import p from 'fourdollar.promisify'
import {
  last,
  ceil,
} from 'lodash'
import * as dayjs from 'dayjs'
import { hostname } from 'os';
import { on } from 'cluster';


export type CandleResponse = {
  [id: string]: CandleData|BithumbCandleData
}


export class Mock {
  readonly money: number
  readonly history: {buy: CandleData, sell: CandleData}[] = []
  bought: CandleData = null

  constructor(money: number)
  constructor(ref: Mock)
  constructor(arg: any) {
    if(typeof arg === 'number') {
      this.money = arg
    } else if(arg.money && arg.history && arg.bought !== undefined) {
      this.money = arg.money
      this.history = arg.history
      this.bought = arg.bought
    } else {
      throw Error('원하는 인수 타입이 아니다.')
    }
  }

  buy(candle: CandleData) {
    if(this.bought) {
      throw Error('또 살수 없다.')
    }
    this.bought = candle
  }

  sell(candle: CandleData): {buy: CandleData, sell: CandleData} {
    if(!this.bought) {
      throw Error('팔게 없다.')
    }
    this.history.push({buy: this.bought, sell: candle})
    this.bought = null
    return last(this.history)
  }

  print() {
    this._print(...this.history)
  }

  printLast() {
    this._print(last(this.history))
  }

  private _print(...history: {buy: CandleData, sell: CandleData}[]) {
    history.forEach(h => {
      console.log('-------------------------------')
      console.log(`buy      : ${h.buy.close}`)
      console.log(`sell     : ${h.sell.close}`)
      console.log(`profit   : ${ceil(h.sell.close / h.buy.close * this.money - this.money, 2)}`)
      const buyTime = dayjs(h.buy.mts)
      const sellTime = dayjs(h.sell.mts)
      console.log(`time     : ${buyTime.format('YYYY.MM.DD HH:mm:ss')}`)
      console.log(`takenTime: ${sellTime.diff(buyTime, 'minute')}m`)
    })
  }

  printTotal() {
    let gainVal: number = 0
    let lossVal: number = 0
    let gainCount: number = 0
    let lossCount: number = 0
    this.history.forEach(h => {
      const pp = h.sell.close / h.buy.close * this.money - this.money
      if(pp > 0) {
        gainVal += pp
        gainCount++
      } else {
        lossVal += pp
        lossCount++
      }
    })
    console.log('total ---------------------------------')
    console.log(`profit     : ${ceil(gainVal + lossVal, 2)}`)
    console.log(`profitAver : ${ceil((gainVal + lossVal) / this.history.length, 2)}`)
    console.log(`gain       : ${ceil(gainVal, 2)}`)
    console.log(`loss       : ${ceil(lossVal, 2)}`)
    console.log(`gainAver   : ${ceil(gainVal / gainCount, 2)}`)
    console.log(`lossAver   : ${ceil(lossVal / lossCount, 2)}`)
    console.log(`gainCount  : ${gainCount}`)
    console.log(`lossCount  : ${lossCount}`)
    console.log(`winRate    : ${ceil(gainCount / (gainCount + lossCount) * 100, 2)}%`)
    console.log(`count      : ${this.history.length}`)
  }

  printWithTotal() {
    this.print()
    this.printTotal()
  }
}


export interface CandleBotConfig {
  timeFrame: TimeFrame
  startTime?: number
  endTime?: number
  progressInterval?: number
  processArg?: any
  markets: ({
    id: string
    name: Market.Bithumb
    currency: BithumbCC
  }|{
    id: string
    name: Market.Bitfinex
    currency: BitfinexCC
  })[]
}


export type BotHost = {
  url: string
  version: string
  key: string
}


function newSocket(host: BotHost): SocketIOClient.Socket {
  return Socket(host.url, {
    path: '/' + host.version,
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': host.key,
        },
      },
    },
    autoConnect: false,
  })
}

async function openSocket(socket: SocketIOClient.Socket, name: string, config?: CandleBotConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', async () => {
      try {
        const res = (config)?
          (await p(socket.emit, socket)(':new.bot', {name, config})) :
          (await p(socket.emit, socket)(':get.bot', name))
        if(res === 'ok') {
          resolve()
        } else {
          throw Error(`':new.bot'에서 '${name}' 이름으로 'ok'하지 않았다.`)
        }
      } catch(err) {
        socket.close()
        reject(err)
      }
    })
    socket.once('connect_error', reject)
    socket.once('connect_timeout', reject)
    socket.once('error', reject)
    socket.open()
  })
}


class BaseBot {
  protected readonly _ack: (evt: string, ...any: any[]) => Promise<any>

  constructor(public readonly name: string
    , public readonly socket: SocketIOClient.Socket) {
    this._ack = p(socket.emit, socket)
  }

  get id(): string {
    return this.socket.id
  }

  get connected(): boolean {
    return this.socket.connected
  }

  get disconnected(): boolean {
    return this.socket.disconnected
  }

  close(): void {
    this.socket.close()
  }

  on(event: string, fn: Function): SocketIOClient.Emitter {
    return this.socket.on(event, fn)
  }

  once(event: string, fn: Function): SocketIOClient.Emitter {
    return this.socket.on(event, fn)
  }
}


export class CandleMasterBot extends BaseBot {
  constructor(public readonly host: BotHost) {
    super('master', newSocket(host))
  }

  open(): Promise<void> {
    return openSocket(this.socket, 'master')
  }

  async ids(name?: string): Promise<string[]> {
    return this._ack(':ids', name)
  }

  async beBot(name: string): Promise<boolean> {
    return this._ack(':be.bot', name)
  }

  async getBot(name: string): Promise<CandleBot> {
    return this.newBot(name)
  }

  async newBot(name: string, config?: CandleBotConfig): Promise<CandleBot> {
    if(name === 'master') {
      throw Error('master는 일반 bot이 될 수 없다.')
    }
    const socket = newSocket(this.host)
    await openSocket(socket, name, config)
    return new CandleBot(name, socket)
  }
}


interface IMockConstructor<M> {
  new (ref: M): M
}

export class CandleBot extends BaseBot {
  constructor(name: string, socket: SocketIOClient.Socket) {
    super(name, socket)
  }

  on(evt: ':progress', cb: (count: number) => void): SocketIOClient.Emitter
  on(evt: ':started', cb: () => void): SocketIOClient.Emitter
  on(evt: ':stoped', cb: () => void): SocketIOClient.Emitter
  on<M>(evt: ':sold', cb: (mock: M) => void): SocketIOClient.Emitter
  on<M>(evt: ':bought', cb: (mock: M) => void): SocketIOClient.Emitter
  on(evt: string, cb: (res: any) => void): SocketIOClient.Emitter {
    return super.on(evt, cb)
  }

  async start<M>(constructor: IMockConstructor<M>): Promise<M> {
    const ref = await this._ack(':start', this.name)
    return new constructor(ref)
  }

  stop(): Promise<void> {
    return this._ack(':stop', this.name)
  }
}
