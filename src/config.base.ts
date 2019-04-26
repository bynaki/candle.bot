/**
 * configure
 * 보안이 필요한 정보나 설정을 저장한다.
 * 사용하려면 이 파일을 복사해 config.ts 파일을 만들어야 한다.
 */

import {
  CrawlHost,
} from 'cryptocurrency-crawler.client'


export const crawlerHost: CrawlHost = {
  url: 'http://your.host.com',
  version: 'test',
  resCount: 100,
}