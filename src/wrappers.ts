import {
  Socket,
  On,
  SocketWrapper,
} from 'socket.io-decorator'
import {
  sendingErrorData,
} from './utils'
import {
  getDecodedToken,
} from './middlewares/authentication'
import {
  ErrorUnauthorized,
} from './errors'


export const OnWrapped = On.next(async (socket, args, next) => {
  try {
    await next()
  } catch(err) {
    const ack = args[args.length -1]
    if(typeof ack === 'function') {
      ack(sendingErrorData(err))
    }
  }
}).next(async (socket, args, next) => {
  const res = await next()
  const ack = args[args.length - 1]
  if(typeof ack === 'function') {
    ack(null, res)
  }
}).on()

export function grantPermission(permission: string): SocketWrapper {
  return (socket, args, next) => {
    try {
      const pers = getDecodedToken(socket).permissions
      if(!pers.includes(permission)) {
        throw new ErrorUnauthorized('denied')
      }
    } catch(err) {
      throw new ErrorUnauthorized('denied')
    }
    return next()
  }
}