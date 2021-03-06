import * as Socket from 'socket.io-client'
import {
  TimeFrame,
  Market,
  BithumbCC,
  BitfinexCC,
  BinanceCC,
} from 'cryptocurrency-crawler.client'
import p from 'fourdollar.promisify'



export class ErrorWithStatusCode extends Error {
  constructor(message: string, public status: number = 500) {
    super(message)
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
  }|{
    id: string
    name: Market.Binance
    currency: BinanceCC
  })[]
}

export interface BotHost {
  url: string
  version: string
  key: string
}

export interface BotStatus {
  progress: number
  process: ProcessStatus
}

export enum ProcessStatus {
  yet = 'yet',
  doing = 'doing',
  done = 'done',
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


export class CandleMasterBot {
  private static _host: BotHost
  private static _socket: SocketIOClient.Socket
  private static _ack: (evt: string, ...any: any[]) => Promise<any>

  static async init(host: BotHost): Promise<void> {
    try {
      const socket = newSocket(host)
      await openSocket(socket, 'master')
      this._host = host
      this._socket = socket
      this._ack = p(socket.emit, socket)
    } catch(e) {
      if(typeof(e) === 'string') {
        throw new ErrorWithStatusCode(e, 500)
      } else {
        throw e
      }
    }
  }

  static get host(): BotHost {
    return this._host
  }

  static get socket(): SocketIOClient.Socket {
    return this._socket
  }

  static get id(): string {
    return this.socket.id
  }

  static get connected(): boolean {
    return this.socket.connected
  }

  static get disconnected(): boolean {
    return this.socket.disconnected
  }

  static close(): void {
    this.socket.close()
  }

  static on(event: string, fn: Function): SocketIOClient.Emitter {
    return this.socket.on(event, fn)
  }

  static once(event: string, fn: Function): SocketIOClient.Emitter {
    return this.socket.on(event, fn)
  }

  static version(): Promise<string> {
    return this._ack(':version')
  }

  static ids(name?: string): Promise<string[]> {
    return this._ack(':ids', name)
  }

  static beBot(name: string): Promise<boolean> {
    return this._ack(':be.bot', name)
  }

  static getBot(name: string): Promise<CandleBot> {
    return this.newBot(name)
  }

  static async newBot(name: string, config?: CandleBotConfig): Promise<CandleBot> {
    if(name === 'master') {
      throw Error('master는 일반 bot이 될 수 없다.')
    }
    const socket = newSocket(this.host)
    await openSocket(socket, name, config)
    return new CandleBot(name, socket)
  }
}



export class CandleBot extends BaseBot {
  constructor(name: string, socket: SocketIOClient.Socket) {
    super(name, socket)
  }

  on(evt: ':progress', cb: (count: number) => void): SocketIOClient.Emitter
  on(evt: ':started', cb: () => void): SocketIOClient.Emitter
  on(evt: ':stoped', cb: () => void): SocketIOClient.Emitter
  on<T>(evt: ':transacted', cb: (result: T) => void): SocketIOClient.Emitter
  on(evt: string, cb: (res: any) => void): SocketIOClient.Emitter {
    return super.on(evt, cb)
  }

  async start(): Promise<void> {
    return this._ack(':start', this.name)
  }

  stop(): Promise<void> {
    return this._ack(':stop', this.name)
  }

  async status(): Promise<BotStatus> {
    return this._ack(':status', this.name)
  }
}
