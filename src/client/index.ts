export {
  TimeFrame,
  Market,
  BithumbCC,
  BitfinexCC,
  CandleData,
  BithumbCandleData,
} from 'cryptocurrency-crawler.client'
export * from './candle.bot'


export class ErrorWithStatusCode extends Error {
  constructor(message: string, public status: number = 500) {
    super(message)
  }
}
