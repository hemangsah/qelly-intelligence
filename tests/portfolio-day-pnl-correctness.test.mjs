import test from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioService, deriveDayPnlFromCurrentValue } from '../src/portfolio/portfolio-service.mjs';

test('day P&L primitive inverts provider percentage returns against prior value',()=>{
  assert.ok(Math.abs(deriveDayPnlFromCurrentValue(110,10)-10)<1e-10);
  assert.ok(Math.abs(deriveDayPnlFromCurrentValue(50,-50)+50)<1e-10);
  assert.equal(deriveDayPnlFromCurrentValue(100,0),0);
});

test('day P&L primitive fails closed on non-invertible or non-finite domains',()=>{
  for(const [currentValue,change24h] of [[100,-100],[100,-120],[-1,5],[Number.NaN,5],[100,Number.NaN],[Number.POSITIVE_INFINITY,5],[100,Number.NEGATIVE_INFINITY]]){
    assert.throws(()=>deriveDayPnlFromCurrentValue(currentValue,change24h),error=>error.code==='portfolio_day_pnl_domain_invalid');
  }
});

test('portfolio day P&L uses prior-value denominator implied by 24h percentage change',()=>{
  const service=new PortfolioService();
  const holdings=service.holdings().items;
  const overview=service.overview();
  const expected=holdings.reduce((sum,item)=>{
    assert.ok(Number.isFinite(item.marketValue));
    assert.ok(Number.isFinite(item.change24h));
    assert.ok(item.change24h>-100);
    const priorValue=item.marketValue/(1+item.change24h/100);
    return sum+(item.marketValue-priorValue);
  },0);
  const oldCurrentValueApproximation=holdings.reduce((sum,item)=>sum+(item.marketValue*item.change24h/100),0);
  assert.equal(overview.dayPnl,Number(expected.toFixed(2)));
  assert.notEqual(overview.dayPnl,Number(oldCurrentValueApproximation.toFixed(2)));
  assert.equal(overview.methodologyVersion,'portfolio-overview-day-pnl-v2');
  assert.match(overview.dayPnlMethodology,/implied prior value/i);
  assert.equal(overview.dayPnlPct,Number((overview.dayPnl/overview.totalValue*100).toFixed(2)));
});

test('portfolio fixture valuation is single-currency before base-currency aggregation',()=>{
  const service=new PortfolioService();
  const holdings=service.holdings();
  assert.equal(holdings.cash.currency,'USD');
  assert.ok(holdings.items.length>0);
  assert.ok(holdings.items.every(item=>item.currency==='USD'));
  assert.equal(service.overview().baseCurrency,'USD');
});
