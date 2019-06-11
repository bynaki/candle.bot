import {
  Bithumb,
  IBithumbBalanceInfoType as IBalanceInfoType,
  IBithumbBalanceInfoResponse as IBalanceInfoResponse,
  IBithumbOrdersInfoType as IOrdersInfoType,
  IBithumbOrdersInfoParams as IOrdersInfoParams,
  IBithumbOrdersInfoResponse as IOrdersInfoResponse,
  IBithumbPlaceParams as IPlaceParams,
  IBithumbTradeResponse as ITradeResponse,
} from 'cryptocurrency.api'
import {
  clone,
} from 'lodash'
import isInteger from 'fourdollar.isinteger'
import isFloat from 'fourdollar.isfloat'
import {
  CandleData,
} from '../interface'



let api: Bithumb
let balances: IBalanceInfoType[] = []
let orders: IOrdersInfoType[] = []
let lastCandles: {
  [currency: string]: CandleData
} = {}


function newOrderId() {
  const keys = Object.keys(lastCandles)
  if(keys.length === 0) {
    throw Error('아직 process 하지 않은것 같다.')
  }
  let id = lastCandles[keys[0]].mts * 1000
  const f = (o: IOrdersInfoType) => {
    if(o.order_id === id) {
      id += 1
      orders.forEach(f)
    }
  }
  orders.forEach(f)
  return id
}

let contId = 0
function newContId() {
  return ++contId
}

export class BithumbMock {
  static async init(krw: number, keys: {
    connectKey: string
    secretKey: string
  }) {
    balances = []
    orders = []
    if(!api) {
      api = new Bithumb(keys)
    }
    const res = await api.getBalanceInfo('ALL')
    if(res.status !== '0000') {
      throw Error(`status: ${res.status}, ${res['message']}`)
    }
    balances.push(...res.transType().data)
    balances.forEach(b => {
      if(b.currency === 'KRW') {
        b.total = krw
        b.available = krw
        b.in_use = 0
      } else {
        b.total = 0
        b.available = 0
        b.in_use = 0
      }
    })
  }

  constructor() {
  }

  async getBalanceInfo(currency?: string): Promise<IBalanceInfoResponse> {
    currency = currency || 'BTC'
    const res = {
      status: '0000',
      data: balances.filter(b => currency === 'ALL' || b.currency === 'KRW' || b.currency === currency)
      .map(b => {
        return {
          currency: b.currency,
          available: b.available.toString(),
          in_use: b.in_use.toString(),
          total: b.total.toString(),
          xcoin_last: null,
        }
      })
    }
    return this._bindTransType(res)
  }

  async getOrdersInfo(currency: string, params: IOrdersInfoParams = {})
  : Promise<IOrdersInfoResponse> {
    if(params.order_id || params.type) {
      if(!(params.order_id && params.type)) {
        return {
          status: '5500',
          message: 'Invalid Parameter'
        } as any
      }
    }
    const filtered = orders.filter(o => currency === 'ALL' || o.order_currency === currency)
    .filter(o => {
      if(params.order_id) {
        return o.order_id === params.order_id && o.type === params.type
      } else {
        return true
      }
    }).filter(o => {
      if(params.after) {
        return Math.round(o.order_date / 1000) >= params.after
      } else {
        return true
      }
    })
    const count = params.count || 100
    return this._bindTransType({
      status: '0000',
      data: filtered.slice(0, count).map(f => toString(f)).map(f => {
        f['order_date'] = Number.parseInt(f['order_date'])
        return f
      }),
    })
  }

  async place(orderCurrency: string, paymentCurrency: string, params: IPlaceParams)
  : Promise<ITradeResponse> {
    if(!lastCandles[orderCurrency]) {
      throw Error(`'${orderCurrency}' process하지 않았다.`)
    }
    if(paymentCurrency !== 'KRW') {
      throw Error('paymentCurrency은 KRW만 지원한다.')
    }
    if(params.type === 'bid') {
      const inUse = params.price * params.units
      const krw = balances.find(b => b.currency === 'KRW')
      if(krw.available < inUse) {
        return {
          status: '5600',
          message: 'xxxxxxxxxxxxxxxxxxxxx',
        } as any
      }
      krw.available -= inUse
      krw.in_use += inUse
    } else if(params.type === 'ask') {
      const bal = balances.find(b => b.currency === orderCurrency)
      if(bal.available < params.units) {
        return {
          status: '5600',
          message: 'xxxxxxxxxxxxxxx',
        } as any
      }
      bal.available -= params.units
      bal.in_use += params.units
    } else {
      return {
        status: '5500',
        message: 'Invalid Parameter',
      } as any
    }
    const id = newOrderId()
    const order: IOrdersInfoType = {
      order_id: id,
      order_currency: orderCurrency,
      payment_currency: paymentCurrency,
      order_date: id,
      type: params.type,
      status: 'placed',
      units: params.units,
      units_remaining: null,
      price: params.price,
      fee: null,
      total: null,
      date_completed: null,
    }
    orders.unshift(order)
    return this._bindTransType({
      status: '0000',
      order_id: order.order_id.toString(),
      data: []
    })
  }

  async marketBuy(currency: string, units: number)
  : Promise<ITradeResponse> {
    const candle = lastCandles[currency]
    if(!candle) {
      throw Error(`'${currency}' process하지 않았다.`)
    }
    const krw = balances.find(b => b.currency === 'KRW')
    if(krw.available < (candle.close * units)) {
      return {
        status: '5600',
        message: 'xxxxxxxxxxxxxxx',
      } as any
    }
    krw.total -= candle.close * units
    krw.available = krw.total - krw.in_use
    const coin = balances.find(b => b.currency === currency)
    coin.total += units
    coin.available = coin.total - coin.in_use
    const id = newOrderId()
    const order: IOrdersInfoType = {
      order_id: id,
      order_currency: currency,
      payment_currency: 'KRW',
      order_date: id,
      type: 'bid',
      status: 'placed', // todo: 뭐라고 해야하나.
      units: units,
      units_remaining: 0,
      price: candle.close,
      fee: null,
      total: candle.close * units,
      date_completed: candle.mts,
    }
    orders.unshift(order)
    return this._bindTransType({
      status: '0000',
      order_id: id.toString(),
      data: [
        {
          cont_id: newContId().toString(),
          units: units.toString(),
          price: candle.close.toString(),
          total: candle.close * units,
          fee: null,
        }
      ]
    })
  }

  async marketSell(currency: string, units: number)
  : Promise<ITradeResponse> {
    const candle = lastCandles[currency]
    if(!candle) {
      throw Error(`'${currency}' process하지 않았다.`)
    }
    const cc = balances.find(b => b.currency === currency)
    if(cc.available < units) {
      return {
        status: '5600',
        message: 'xxxxxxxxxxxxxxx',
      } as any
    }
    cc.total -= units
    cc.available = cc.total - cc.in_use
    const krw = balances.find(b => b.currency === 'KRW')
    krw.total += candle.close * units
    krw.available = krw.total - krw.in_use
    const id = newOrderId()
    const order: IOrdersInfoType = {
      order_id: id,
      order_currency: currency,
      payment_currency: 'KRW',
      order_date: id,
      type: 'ask',
      status: 'placed', // 뭐라고 해야하나
      units: units,
      units_remaining: 0,
      price: candle.close,
      fee: null,
      total: candle.close * units,
      date_completed: candle.mts,
    }
    orders.unshift(order)
    return this._bindTransType({
      status: '0000',
      order_id: id.toString(),
      data: [
        {
          cont_id: newContId().toString(),
          units: units.toString(),
          price: candle.close.toString(),
          total: candle.close * units,
          fee: null,
        }
      ]
    })
  }

  process(currency: string, candle: CandleData) {
    if(Object.keys(lastCandles).some(c => lastCandles[c].mts !== candle.mts)) {
      lastCandles = {}
    }
    lastCandles[currency] = candle
    const krw = balances.find(b => b.currency === 'KRW')
    orders.filter(o => !o.date_completed && o.order_currency === currency)
    .forEach(o => {
      const coin = balances.find(b => b.currency === currency)
      if(o.type === 'bid') {
        if(o.price >= candle.close) {
          o.units_remaining = 0
          o.total = o.price * o.units
          o.date_completed = candle.mts * 1000
          coin.total += o.units
          coin.available = coin.total - coin.in_use
          krw.total -= o.total
          krw.in_use -= o.total
          krw.available = krw.total - krw.in_use
        }
      } else if(o.type === 'ask') {
        if(o.price <= candle.close) {
          o.units_remaining = 0
          o.total = o.price * o.units
          o.date_completed = candle.mts * 1000
          coin.total -= o.units
          coin.in_use -= o.units
          coin.available = coin.total - coin.in_use
          krw.total += o.total
          krw.available = krw.total - krw.in_use
        }
      } else {
        throw Error("'bid'나 'ask' 둘중 하나여야 한다.")
      }
    })
  }

  private _bindTransType(res: any) {
    res.transType = transType.bind(res)
    return res
  }

}


/**
 * bithumb에서 받은 데이터의 숫자형 데이터를 number형으로 변환
 * @param data bithumb에서 받은 데이터
 */
function transType(data) {
  if(!data) {
    data = this
  }
  let cpData = clone(data)
  cpData && cpData.transType && delete cpData.transType
  if(cpData) {
    for(let key in cpData) {
      if(key !== 'status' && cpData[key] !== null && cpData[key] !== undefined) {
        if(typeof cpData[key] === 'object') {
          cpData[key] = transType(cpData[key])
        } else {
          if(isInteger(cpData[key])) {
            cpData[key] = parseInt(cpData[key])
          } else if(isFloat(cpData[key])) {
            cpData[key] = parseFloat(cpData[key])
          }
        }
      }
    }
  }
  return cpData
}

function toString<T>(data: T) {
  const dd = {}
  Object.keys(data).forEach(key => {
    if(data[key] === null || data[key] === undefined) {
      dd[key] = data[key]
    } else if(typeof data[key] === 'object') {
      dd[key] = toString(data[key])
    } else {
      dd[key] = data[key].toString()
    }
  })
  return dd
}