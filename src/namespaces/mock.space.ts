import {
  On,
  Use,
  OnConnect,
  Socket,
  SocketWrapper,
  Namespace,
} from 'socket.io-decorator'
import {
  ErrorUnauthorized,
  ErrorNotFound,
  ErrorBadRequest
} from '../errors'
import {
  OnWrapped,
} from '../wrappers'
import {
  decodeToken,
  getDecodedToken,
} from '../middlewares/authentication'
import {
  LogSpace,
} from './log.space'


function found(target: any[], searchElement: any) {
  return target.indexOf(searchElement) !== -1
}

function level(level: string): SocketWrapper {
  return (socket, args, next) => {
    try {
      const permissions = getDecodedToken(socket).permissions
      switch(level) {
        case 'level01': {
          if(found(permissions, 'level01') || found(permissions, 'level02')) {
            break
          }
        }
        case 'level02': {
          if(found(permissions, 'level02')) {
            break
          }
        }
        default: {
          throw new ErrorUnauthorized('denied')
        }
      }
    } catch(err) {
      throw new ErrorUnauthorized('denied')
    }
    return next()
  }
}

const OnLevel01 = OnWrapped.next(level('level01')).on()
const OnLevel02 = OnWrapped.next(level('level02')).on()

function track(socket: Socket, index: string) {
  const track: string[]= socket['track'] || []
  track.push(index)
  socket['track'] = track
}

// use는 socket이 처음 connect 될때만 한번 실행 된다.
@Use(0, (socket, next, ctx) => {
  track(socket, 'use00')
  next()
})

@Use((socket, next, ctx) => {
  // track
  track(socket, 'use04')
  decodeToken(socket, next, ctx)
})

@Use((socket, next, ctx) => {
  track(socket, 'use03')
  next()
})

export class MockSpace extends LogSpace {
  sayHello = 'Hello in mock'

  constructor(namespace: Namespace) {
    super(namespace)
    setInterval(() => {
      this.to('level01').emit(':auth.level01', 'level01')
    }, 200)
    setInterval(() => {
      this.to('level02').emit(':auth.level02', 'level02')
    }, 200)
  }

  @OnConnect()
  onConnect(socket: Socket) {
    socket.send(this.sayHello)
  }

  @Use()
  use01(socket: Socket, next: (err?: Error) => void, ctx: MockSpace) {
    track(socket, 'use01')
    next()
  }

  @Use()
  use02(socket: Socket, next: (err?: Error) => void, ctx: MockSpace) {
    track(socket, 'use02')
    next()
  }

  @Use(101)
  use03(socket: Socket, next: (err?: Error) => void, ctx: MockSpace) {
    track(socket, 'use05')
    next()
  }

  @On(':echo')
  echo(socket: Socket, ...args: any[]) {
    socket.emit(':echo', ...args)
  }

  @OnWrapped(':ack')
  ack(socket: Socket, echo: string) {
    if(echo === 'error') {
      throw new Error('error')
    }
    return echo
  }

  @OnWrapped(':ack.async')
  async asyncAck(socket: Socket, echo: string) {
    const res = await mockAsync(echo)
    return res[0]
  }

  @On(':use.order')
  order(socket: Socket, ack: (err: Error, ...track: string[]) => void) {
    return ack(null, ...socket['track'])
  }

  @OnLevel01(':auth.level01')
  allowLevel01(socket: Socket, onoff: string) {
    switch(onoff) {
      case 'on': {
        socket.join('level01')
        return 'ok'
      }
      case 'off': {
        socket.leave('level01')
        return 'ok'
      }
      default: {
        throw new ErrorBadRequest('bad query')
      }
    }
  }

  @OnLevel02(':auth.level02')
  allowLevel02(socket: Socket, onoff: string) {
    this.allowLevel01(socket, onoff)
    switch(onoff) {
      case 'on': {
        socket.join('level02')
        return 'ok'
      }
      case 'off': {
        socket.leave('level02')
        return 'ok'
      }
      default: {
        throw new ErrorBadRequest('bad query')
      }
    }
  }

  @OnWrapped('*')
  notFound() {
    throw new ErrorNotFound('not found event')
  }
}

function mockAsync(...args: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    process.nextTick((...args: any[]) => {
      if(args[0] === 'error') {
        reject(new Error('error'))
        return
      }
      resolve(args)
    }, ...args)
  })
}