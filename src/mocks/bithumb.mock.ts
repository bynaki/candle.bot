import {
  Bithumb,
  IBithumbBalanceInfoType as IBalanceInfoType,
  IBithumbBalanceInfoResponse as IBalanceInfoResponse,
  IBithumbOrdersInfoType as IOrdersInfoType,
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
let lastMts: number



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

  async place(orderCurrency: string, paymentCurrency: string, params: IPlaceParams)
  : Promise<ITradeResponse> {
    if(!lastMts) {
      throw Error('한번도 process하지 않았다.')
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
      const inUse = params.price * params.units
      if(bal.available < inUse) {
        return {
          status: '5600',
          message: 'xxxxxxxxxxxxxxx',
        } as any
      }
      bal.available -= inUse
      bal.in_use += inUse
    } else {
      return {
        status: '5500',
        message: 'Invalid Parameter',
      } as any
    }
    let id = lastMts
    const f = (o: IOrdersInfoType) => {
      if(o.order_id === id) {
        id += 1
        orders.forEach(f)
      }
    }
    orders.forEach(f)
    const order: IOrdersInfoType = {
      order_id: id,
      order_currency: orderCurrency,
      payment_currency: paymentCurrency,
      order_date: id,
      type: params.type,
      status: 'placed',
      units: params.units,
      units_remaining: params.units,
      price: params.price,
      fee: null,
      total: null,
      date_completed: null,
    }
    orders.push(order)
    return this._bindTransType({
      status: '0000',
      order_id: order.order_id.toString(),
      data: []
    })
  }

  process(currency: string, candle: CandleData) {
    const krw = balances.find(b => b.currency === 'KRW')
    orders.filter(o => o.date_completed && o.order_currency === currency)
    .forEach(o => {
      const coin = balances.find(b => b.currency === currency)
      if(o.type === 'bid') {
        if(o.price <= candle.close) {
          o.units_remaining = 0
          o.total = o.price * o.units
          o.date_completed = candle.mts
          coin.total += o.units
          coin.available = coin.total - coin.in_use
          krw.total -= o.total
          krw.in_use -= o.total
          krw.available = krw.total - krw.in_use
        }
      } else if(o.type === 'ask') {
        if(o.price >= candle.close) {
          o.units_remaining = 0
          o.total = o.price * o.units
          o.date_completed = candle.mts
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
    lastMts = candle.mts
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
