import * as jwt from 'jsonwebtoken'
import {
  Authorizer,
  Payload,
} from 'bynaki.auth'
import {
  ErrorUnauthorized,
} from '../errors'
import {
  Socket,
  Middleware,
} from 'socket.io-decorator'

const auth = new Authorizer('./jwtconfig.json')



export function getToken(socket: Socket): string {
  return socket.handshake.headers['x-access-token'] || socket.handshake.query.token
}

export const decodeToken: Middleware = (socket, next, ctx) => {
  try {
    const token = getToken(socket)
    if(token) {
      socket['token'] = token
      socket['_decoded'] = auth.verify(token)
    }
    next()
  } catch(err) {
    next(new ErrorUnauthorized(err.message))
  }
}

export function getDecodedToken(socket: Socket): Payload {
  return socket['_decoded']
}