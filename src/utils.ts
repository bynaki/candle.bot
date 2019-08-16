import {
  ErrorWithStatusCode,
} from './errors'
import {
  readFileSync,
  readFile,
} from 'fs'
import {
  CrawlHost,
} from 'cryptocurrency-crawler.client'
import {
  MockHost,
} from 'cryptocurrency-mock.client'


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
  mockHost: MockHost
  bithumb: {
    connectKey: string
    secretKey: string
  }
} {
  return JSON.parse(readFileSync(path).toString())
}

export async function getVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile('./package.json', (err, data) => {
      if(err) {
        reject(err)
        return
      }
      const json = JSON.parse(data.toString())
      resolve(json.version)
    })
  })
}
