import {
  ErrorWithStatusCode,
} from './errors'
import {
  readFile, readFileSync,
} from 'fs'
import p from 'fourdollar.promisify'
import {
  CrawlHost,
} from './interface'


export function sendingErrorData(err: ErrorWithStatusCode): {
  message: string
  name: string
  stack: string
  status: number
} {
  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
    status: err.status || 500
  }
}


export function getConfig(path: string): {
  crawlHost: CrawlHost
  bithumb: {
    connectKey: string
    secretKey: string
  }
} {
  return JSON.parse(readFileSync(path).toString())
}
