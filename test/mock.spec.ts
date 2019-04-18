/**
 * Test
 */

import test from 'ava'
import * as IO from 'socket.io'
import * as Socket from 'socket.io-client'
import {
  MockSpace,
} from '../src/namespaces'
import p from 'fourdollar.promisify'
import { ErrorWithStatusCode } from '../src/errors';
import {
  Authorizer,
} from 'bynaki.auth'

const io = IO(8110, {
  path: '/test',
})
const mock = new MockSpace(io.of('mock'))
const auth = new Authorizer('./jwtconfig.base.json')

test.after(() => {
  io.close()
})

test.cb('mock > namespace is /mock', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  let connected = false
  socket.on('connect', () => {
    connected = true
  })
  socket.on('message', msg => {
    t.is(connected, true)
    t.is(msg, 'Hello in mock')
    socket.close()
    t.end()
  })
})

test.cb('mock > echo to each socket', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  socket.on('connect', () => {
    socket.emit(':echo', 'Hello World!!')
  })
  socket.on(':echo', (...args) => {
    t.deepEqual(args, ['Hello World!!'])
    socket.close()
    t.end()
  })
})

test('mock > ack', async t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  const msg = await p(socket.emit, socket)(':ack', 'Hello World!!')
  t.is(msg, 'Hello World!!')
  socket.close()
})

test('mock > ack.async', async t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  const msg = await p(socket.emit, socket)(':ack.async', 'Hello World!!')
  t.is(msg, 'Hello World!!')
  socket.close()
})

test.cb('mock > auth > on and off level01', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': auth.sign({user: 'naki', permissions: ['level01']})
        },
      },
    },
  })
  socket.emit(':auth.level01', 'on', async (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      socket.close()
      t.fail()
    } else {
      t.is(msg, 'ok')
      const level01Room = mock.namespace.in('level01')
      const clients: string[] = await p(level01Room.clients, level01Room)()
      t.not(clients.indexOf(socket.id), -1)
      socket.on(':auth.level01', res => {
        t.is(res, 'level01')
        socket.emit(':auth.level01', 'off', async (err: Error, msg: string) => {
          if(err) {
            console.log(err.message)
            t.fail()
          } else {
            t.is(msg, 'ok')
            const level01Room = mock.namespace.in('level01')
            const clients: string[] = await p(level01Room.clients, level01Room)()
            t.is(clients.indexOf(socket.id), -1)
          }
          socket.close()
          t.end()
        })
      })
    }
  })
  socket.on('error', msg => {
    console.log(msg)
    socket.close()
    t.fail()
    t.end()
  })
})

test.cb('mock > auth > on and off level02', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': auth.sign({user: 'naki', permissions: ['level02']})
        },
      },
    },
  })
  socket.emit(':auth.level01', 'on', async (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      socket.close()
      t.end()
    } else {
      t.is(msg, 'ok')
      const level01Room = mock.namespace.in('level01')
      const clients: string[] = await p(level01Room.clients, level01Room)()
      t.not(clients.indexOf(socket.id), -1)
    }
  })
  socket.emit(':auth.level02', 'on', async (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      socket.close()
      t.fail()
      t.end()
    } else {
      t.is(msg, 'ok')
      const level02Room = mock.namespace.in('level02')
      const clients: string[] = await p(level02Room.clients, level02Room)()
      t.not(clients.indexOf(socket.id), -1)
    }
  })
  let receivedLevel01 = true
  let receivedLevel02 = true
  socket.on(':auth.level01', res => {
    t.is(res, 'level01')
    socket.emit(':auth.level01', 'off', async (err: Error, msg: string) => {
      if(err) {
        console.log(err.message)
        socket.close()
        t.fail()
        t.end()
      } else {
        t.is(msg, 'ok')
        const level01Room = mock.namespace.in('level01')
        const clients: string[] = await p(level01Room.clients, level01Room)()
        t.is(clients.indexOf(socket.id), -1)
        if(receivedLevel01 = true && receivedLevel02) {
          socket.close()
          t.end()
        }
      }
    })
  })
  socket.on(':auth.level02', res => {
    t.is(res, 'level02')
    socket.emit(':auth.level02', 'off', async (err: Error, msg: string) => {
      if(err) {
        console.log(err.message)
        socket.close()
        t.fail()
        t.end()
      } else {
        t.is(msg, 'ok')
        const level02Room = mock.namespace.in('level02')
        const clients: string[] = await p(level02Room.clients, level02Room)()
        t.is(clients.indexOf(socket.id), -1)
        if(receivedLevel02 = true && receivedLevel01) {
          socket.close()
          t.end()
        }
      }
    })
  })
  socket.on('error', msg => {
    console.log(msg)
    socket.close()
    t.fail()
    t.end()
  })
})

test.cb('mock > @Use() order', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  socket.emit(':use.order', (err: Error, ...track: string[]) => {
    if(err) {
      t.fail()
    } else {
      t.deepEqual(track, [ 'use00', 'use01', 'use02', 'use03', 'use04', 'use05' ])
    }
    socket.close()
    t.end()
  })
})

test.cb('mock > error > in @Use()', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': 'bad token',
        },
      },
    },
  })
  socket.on('error', (err: string) => {
    t.is(err, 'Unauthorized: jwt malformed')
    socket.close()
    t.end()
  })
})

test('mock > error > in @On()', async t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  try {
    const res = await p(socket.emit, socket)(':ack', 'error')
  } catch(e) {
    const err = e as ErrorWithStatusCode
    t.is(err.status, 500)
    t.is(err.message, 'error')
  }
  socket.close()
})

test('mock > error > in @On() async', async t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  try {
    const res = await p(socket.emit, socket)(':ack.async', 'error')
  } catch(e) {
    const err: ErrorWithStatusCode = e as ErrorWithStatusCode
    t.is(err.status, 500)
    t.is(err.message, 'error')
  }
  socket.close()
})

test('mock > error > unauthorized 401', async t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  try {
    const res = await p(socket.emit, socket)(':auth.level01', 'on')
  } catch(e) {
    const err: ErrorWithStatusCode = e as ErrorWithStatusCode
    t.is(err.status, 401)
    t.is(err.message, 'Unauthorized: denied')
  }
})

test.cb('mock > error > bad request 400', t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': auth.sign({user: 'naki', permissions: ['level01']}),
        },
      },
    },
  })
  socket.emit(':auth.level01', 'wrong', (err: ErrorWithStatusCode, msg: string) => {
    socket.close()
    if(err) {
      t.is(err.message, 'Bad Request: bad query')
      t.is(err.status, 400)
    } else {
      t.fail()
    }
    t.end()
  })
  socket.on('error', msg => {
    console.log(msg)
    socket.close()
    t.fail()
    t.end()
  })
})

test('mock > error > not found 404', async t => {
  const socket = Socket('http://localhost:8110/mock', {
    path: '/test',
  })
  try {
    const res = await p(socket.emit, socket)(':notfound')
  } catch(e) {
    const err: ErrorWithStatusCode = e as ErrorWithStatusCode
    t.is(err.status, 404)
    t.is(err.message, 'Not Found: not found event')
  }
  socket.close()
})
