import {
  CandleData,
} from 'cryptocurrency-crawler.client'
import {
  last,
  ceil,
} from 'lodash'
import * as dayjs from 'dayjs'



export class TestMock {
  readonly money: number
  readonly history: {buy: CandleData, sell: CandleData}[] = []
  bought: CandleData = null

  constructor(money: number)
  constructor(ref: TestMock)
  constructor(arg: any) {
    if(typeof arg === 'number') {
      this.money = arg
    } else if(arg.money && arg.history && arg.bought !== undefined) {
      this.money = arg.money
      this.history = arg.history
      this.bought = arg.bought
    } else {
      throw Error('원하는 인수 타입이 아니다.')
    }
  }

  buy(candle: CandleData) {
    if(this.bought) {
      throw Error('또 살수 없다.')
    }
    this.bought = candle
  }

  sell(candle: CandleData): {buy: CandleData, sell: CandleData} {
    if(!this.bought) {
      throw Error('팔게 없다.')
    }
    this.history.push({buy: this.bought, sell: candle})
    this.bought = null
    return last(this.history)
  }

  print() {
    this._print(...this.history)
  }

  printLast() {
    this._print(last(this.history))
  }

  private _print(...history: {buy: CandleData, sell: CandleData}[]) {
    history.forEach(h => {
      console.log('-------------------------------')
      console.log(`buy      : ${h.buy.close}`)
      console.log(`sell     : ${h.sell.close}`)
      console.log(`profit   : ${ceil(h.sell.close / h.buy.close * this.money - this.money, 2)}`)
      const buyTime = dayjs(h.buy.mts)
      const sellTime = dayjs(h.sell.mts)
      console.log(`time     : ${buyTime.format('YYYY.MM.DD HH:mm:ss')}`)
      console.log(`takenTime: ${sellTime.diff(buyTime, 'minute')}m`)
    })
  }

  printTotal() {
    let gainVal: number = 0
    let lossVal: number = 0
    let gainCount: number = 0
    let lossCount: number = 0
    this.history.forEach(h => {
      const pp = h.sell.close / h.buy.close * this.money - this.money
      if(pp > 0) {
        gainVal += pp
        gainCount++
      } else {
        lossVal += pp
        lossCount++
      }
    })
    console.log('total ---------------------------------')
    console.log(`profit     : ${ceil(gainVal + lossVal, 2)}`)
    console.log(`profitAver : ${ceil((gainVal + lossVal) / this.history.length, 2)}`)
    console.log(`gain       : ${ceil(gainVal, 2)}`)
    console.log(`loss       : ${ceil(lossVal, 2)}`)
    console.log(`gainAver   : ${ceil(gainVal / gainCount, 2)}`)
    console.log(`lossAver   : ${ceil(lossVal / lossCount, 2)}`)
    console.log(`gainCount  : ${gainCount}`)
    console.log(`lossCount  : ${lossCount}`)
    console.log(`winRate    : ${ceil(gainCount / (gainCount + lossCount) * 100, 2)}%`)
    console.log(`count      : ${this.history.length}`)
  }

  printWithTotal() {
    this.print()
    this.printTotal()
  }
}