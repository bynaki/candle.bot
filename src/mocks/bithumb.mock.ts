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



export class BithumbMock {
  private _bithumb: Bithumb
  private _balances: IBalanceInfoType[] = []
  private _orders: IOrdersInfoType[] = []
  private _krw: number

  constructor(krw: number, keys: {
    connectKey: string
    secretKey: string
  }) {
    this._bithumb = new Bithumb(keys)
    this._krw = krw
  }

  private async _init() {
    if(this._balances.length === 0) {
      const res = await this._bithumb.getBalanceInfo('ALL')
      if(res.status === '0000') {
        this._balances = res.transType().data
        this._balances.forEach(b => {
          if(b.currency === 'KRW') {
            b.total = this._krw
            b.available = this._krw
            b.in_use = 0
          } else {
            b.total = 0
            b.available = 0
            b.in_use = 0
          }
        })
      }
    }
  }

  async getBalanceInfo(currency?: string): Promise<IBalanceInfoResponse> {
    await this._init()
    const res = await this._bithumb.getBalanceInfo(currency)
    if(res.status !== '0000') {
      return res
    }
    res.data = res.data.map(b => {
      const v = this._balances.find(bb => bb.currency === b.currency)
      b.available = v.available.toString()
      b.in_use = v.in_use.toString()
      b.total = v.total.toString()
      v.xcoin_last = b.xcoin_last
      return b
    })
    return res
  }

  async place(orderCurrency: string, paymentCurrency: string, params: IPlaceParams)
  : Promise<ITradeResponse> {
    const now = new Date().getTime()
    const order: IOrdersInfoType = {
      order_id: now,
      order_currency: orderCurrency,
      payment_currency: paymentCurrency,
      order_date: now,
      type: params.type,
      status: 'placed',
      units: params.units,
      units_remaining: params.units,
      price: params.price,
      fee: null,
      total: null,
      date_completed: null,
    }
    this._orders.push(order)
    return this._bindTransType({
      status: '0000',
      order_id: order.order_id.toString(),
      data: []
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
