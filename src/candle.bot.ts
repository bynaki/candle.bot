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



export type CandleResponse = {
  [id: string]: {
    currency: BithumbCC|BitfinexCC
    data: CandleData|BithumbCandleData
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


// interface IMockConstructor<M> {
//   new (ref: M): M
// }

export class CandleBot extends BaseBot {
  constructor(name: string, socket: SocketIOClient.Socket) {
    super(name, socket)
  }

  on(evt: ':progress', cb: (count: number) => void): SocketIOClient.Emitter
  on(evt: ':started', cb: () => void): SocketIOClient.Emitter
  on(evt: ':stoped', cb: () => void): SocketIOClient.Emitter
  on<T>(evt: ':transacted', cb: (result: T) => void): SocketIOClient.Emitter
  // on<M>(evt: ':sold', cb: (mock: M) => void): SocketIOClient.Emitter
  // on<M>(evt: ':bought', cb: (mock: M) => void): SocketIOClient.Emitter
  on(evt: string, cb: (res: any) => void): SocketIOClient.Emitter {
    return super.on(evt, cb)
  }

  // async start<M>(constructor: IMockConstructor<M>): Promise<M> {
  //   const ref = await this._ack(':start', this.name)
  //   return new constructor(ref)
  // }
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
