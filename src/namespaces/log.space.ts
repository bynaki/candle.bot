import {
  BaseNamespace,
  OnConnect,
  OnDisconnect,
  Socket,
  SocketWrapper,
  Namespace,
  On
} from 'socket.io-decorator'
import Logger from '../log'


export class LogSpace extends BaseNamespace {
  private _l: Logger

  constructor(namespace: Namespace) {
    super(namespace)
    this._l = new Logger(namespace.name)
  }

  log(...msgs: string[]) {
    this._l.log(...msgs)
  }

  error(...msgs: string[]) {
    this._l.error(msgs)
  }

  @OnConnect()
  onConnected(socket: Socket) {
    this.log(`a socket(${socket.id}) connected`)
  }

  @OnDisconnect()
  onDisconnected(reason: string, socketId: string) {
    this.log(`a socket(${socketId}) disconnected: `, reason)
  }

  @OnConnect()
  triggerEvent(socket: Socket) {
    socket['use']((packet: any[], next: (err?: Error) => void) => {
      this.log(`emited event in the socket(${socket.id}): '${packet[0]}'`)
      next()
    })
  }

  @On('error')
  onError(socket: Socket, err: Error) {
    this.error(`error in a socket(${socket.id}): `, err.message)
  }
}