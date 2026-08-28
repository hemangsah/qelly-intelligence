const SOURCE_NOTE='Candidate supplied for the 2026-08-28 global-data expansion. Inclusion is discovery metadata, not an entitlement or endorsement.';

const slug=(value)=>String(value||'provider').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const entry=(name,category,integration,url=null,note=SOURCE_NOTE,aliases=[])=>(
  {id:slug(name),name,category,integration,url,note,aliases,source:'user-supplied-2026-08-28'}
);

const active=[
  entry('TradingView','multi-asset','official-embed','https://www.tradingview.com/widget-docs/','Official widgets are isolated, lazy-loaded and never consumed as Qelly analytical inputs.'),
  entry('CoinMarketCap','crypto','official-embed','https://coinmarketcap.com/widget/','Official website widget only; Qelly does not read or persist widget values.'),
  entry('Alternative.me','crypto','live-public','https://alternative.me/crypto/api/','Public API terms permit commercial projects; displayed data retains source attribution.'),
  entry('Hyperliquid','crypto','live-public','https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api','Official read-only public market stream; no wallet, custody or execution.'),
  entry('European Central Bank','fx-macro','governed-reference','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','Daily working-day reference rates with governed ingestion and attribution.', ['ECB']),
  entry('World Bank','macro','reference-public','https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information','Official annual macro reference data; not a live market quote.'),
  entry('US Treasury','macro','delivery-review','https://fiscaldata.treasury.gov/api-documentation/','Official Fiscal Data open-data API; production fetch is disabled while the canonical Cloudflare edge receives an upstream TLS 525 response.'),
  entry('IMF Data API','macro','reference-public','https://www.imf.org/external/datamapper/api/','Official IMF statistical reference data with source attribution.'),
  entry('BLS (Bureau of Labor Statistics)','macro','reference-public','https://www.bls.gov/developers/','Official public API; displayed as delayed economic reference data with access-date disclosure.')
];

const publicReview=[
  ['Frankfurter','https://frankfurter.dev/'],['Yahoo Finance','https://finance.yahoo.com/'],['SEC EDGAR','https://www.sec.gov/search-filings/edgar-application-programming-interfaces'],['OECD API','https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html'],
  ['Fama-French','https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html'],['AQR','https://www.aqr.com/Insights/Datasets'],['NASDAQ ITCH','https://www.nasdaqtrader.com/Trader.aspx?id=DPSpecs'],
  ['WikiPrices','https://www.quandl.com/databases/WIKIP'],['Cboe','https://www.cboe.com/us/equities/market_statistics/'],['CoinCap','https://coincap.io/'],['Coinlore','https://www.coinlore.com/cryptocurrency-data-api'],
  ['Kraken Public','https://docs.kraken.com/api/docs/rest-api/get-ticker-information'],['Binance Public','https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints'],
  ['DefiLlama','https://defillama.com/docs/api'],['Chainlink Data Feeds','https://docs.chain.link/data-feeds'],['Polymarket','https://docs.polymarket.com/'],['goldprice.dev','https://goldprice.dev/'],
  ['Indian Stock Market API',null],['QOS Quote API',null],['finance-agent-mcp-server',null],['publicfinance-mcp',null],['open-market-data',null],['ml4t-data',null],['fin-data-mcp',null],
  ['nse-bse-api (npm)','https://www.npmjs.com/package/nse-bse-api'],['forex-centuries (GitHub)',null],['gold-price-api (GitHub)',null],['public-apis (GitHub)','https://github.com/public-apis/public-apis'],
  ['free-crypto-apis (GitHub)',null],['Kalshi','https://docs.kalshi.com/'],['CoinPaprika','https://api.coinpaprika.com/'],['CoinGecko','https://www.coingecko.com/en/api'],
  ['Exchangerate.host','https://exchangerate.host/'],['DexPaprika','https://docs.dexpaprika.com/']
].map(([name,url])=>entry(name,'public-api-candidate','terms-review',url,'Technically discoverable public/free surface; production display remains disabled until current commercial, redistribution, attribution, rate-limit and geographic terms are approved.'));

const keyed=[
  ['AllRatesToday','fx'],['AllTick','multi-asset'],['Alpha Vantage','multi-asset'],['Brave New Coin','crypto'],['CoinAPI','crypto'],['CoinGlass','crypto'],['Coinlayer','crypto'],['Coinranking','crypto'],
  ['CoinStats','crypto'],['CommodityPriceAPI','commodities'],['Covalent','on-chain'],['CurrencyAPI','fx'],['Currencylayer','fx'],['EODHD','multi-asset'],['ExchangeRate-API','fx'],
  ['FCS API','multi-asset'],['Finnhub','multi-asset'],['Fixer.io','fx'],['FRED (Federal Reserve)','macro'],['GetBlock','on-chain'],['IEX Cloud','stocks'],['Marketstack','stocks'],
  ['Metals-API','commodities'],['NOWNodes','on-chain'],['Open Exchange Rates','fx'],['OANDA API','fx'],['Polygon.io','multi-asset'],['StockTV API','india-markets'],['Tiingo','stocks'],
  ['Twelve Data','multi-asset'],['CoinMarketCap API','crypto'],['CoinGecko API','crypto'],['CoinGlass API','crypto'],['Commodity Price Monitor (Apify)','commodities'],['Global Stock Screener (Apify)','stocks'],
  ['DhanHQ','india-markets'],['5paisa Xstream','india-markets'],['AliceBlue ANT API','india-markets'],['Kotak Neo API','india-markets'],['INDstocks API','india-markets']
].map(([name,category])=>entry(name,category,'key-required',null,'A key, account or provider configuration is required. No credential is shipped to the browser and no live claim is made until rights and quota checks pass.'));

const contracted=[
  ['Amberdata','crypto'],['Bloomberg Terminal','institutional'],['Chainalysis','on-chain'],['CoinDesk Data (CCData)','crypto'],['dxFeed','multi-asset'],['GlobalDataFeeds (GFDL)','india-markets'],
  ['Kaiko','crypto'],['LSEG (London Stock Exchange Group)','multi-asset'],['LSEG Commodities','commodities'],['Massive','commodities'],['NSE Data & Analytics','india-markets'],
  ['Parameta Solutions','fx'],['Pyth Network (Pyth Pro X)','multi-asset'],['Reuters Eikon','institutional'],['TickDB','multi-asset'],['TrueData','india-markets'],
  ['XE Currency Data API','fx'],['CoinAPI Institutional','crypto'],['FCS API Enterprise','multi-asset']
].map(([name,category])=>entry(name,category,'paid-or-contract',null,'Paid, institutional, exchange-certified or contract-gated data. Listed for coverage planning; no unlicensed embedding or redistribution.'));

const research=[
  ['Arkham Intelligence','on-chain','https://intel.arkm.com/'],['Artemis Analytics','on-chain','https://app.artemisanalytics.com/'],['BabyPips','fx','https://www.babypips.com/'],
  ['Commodity Prices Live App','commodities',null],['CryptoQuant','crypto','https://cryptoquant.com/'],['DailyFX','fx','https://www.dailyfx.com/'],['Dune Analytics','on-chain','https://dune.com/'],
  ['EconoCal','macro',null],['Econoday','macro','https://us.econoday.com/'],['Flipside Crypto','on-chain','https://flipsidecrypto.xyz/'],['Forex Factory','fx','https://www.forexfactory.com/calendar'],
  ['ForexLive','fx','https://www.forexlive.com/'],['FXMacroData','fx',null],['FXMacroData MCP','fx',null],['Glassnode','crypto','https://glassnode.com/'],['GoCharting','india-markets','https://gocharting.com/'],
  ['IntoTheBlock','crypto','https://www.intotheblock.com/'],['Investing.com','multi-asset','https://www.investing.com/'],['Messari','crypto','https://messari.io/'],['Moneycontrol','india-markets','https://www.moneycontrol.com/'],
  ['Nansen','on-chain','https://www.nansen.ai/'],['Santiment','crypto','https://santiment.net/'],['Token Terminal','crypto','https://tokenterminal.com/'],['Trading Economics','macro','https://tradingeconomics.com/'],
  ['WorldStock App','stocks',null],['Etherscan / BscScan / Polygonscan / Arbiscan / Solscan','on-chain','https://etherscan.io/'],['CommodityPriceAPI MCP','commodities',null],['Provider Audit Report','governance',null]
].map(([name,category,url])=>entry(name,category,'external-research',url,'External research destination. Framing, scraping and content republication are disabled unless an official embed or written permission exists.'));

const venues=[
  ['1inch','exchange','https://1inch.io/'],['AvaTrade','broker','https://www.avatrade.com/'],['BDSwiss','broker','https://global.bdswiss.com/'],['Binance','exchange','https://www.binance.com/'],
  ['Binance.US','exchange','https://www.binance.us/'],['Bitget','exchange','https://www.bitget.com/'],['Bitpanda','exchange','https://www.bitpanda.com/'],['Bitstamp','exchange','https://www.bitstamp.net/'],
  ['Bybit','exchange','https://www.bybit.com/'],['Capital.com','broker','https://capital.com/'],['CEX.io','exchange','https://cex.io/'],['CMC Markets','broker','https://www.cmcmarkets.com/'],
  ['Coinbase','exchange','https://www.coinbase.com/explore'],['CoinDCX','exchange','https://coindcx.com/markets'],['Crypto.com','exchange','https://crypto.com/'],['eToro','broker','https://www.etoro.com/'],
  ['Exness','broker','https://www.exness.com/'],['FP Markets','broker','https://www.fpmarkets.com/'],['FXTM','broker','https://www.forextime.com/'],['Gate.io','exchange','https://www.gate.com/'],
  ['Gemini','exchange','https://www.gemini.com/'],['HFM (HotForex)','broker','https://www.hfm.com/'],['IC Markets','broker','https://www.icmarkets.com/'],['IG','broker','https://www.ig.com/'],
  ['Interactive Brokers','broker','https://www.interactivebrokers.com/'],['Interactive Brokers India','broker','https://www.interactivebrokers.co.in/'],['Kraken','exchange','https://www.kraken.com/'],['KuCoin','exchange','https://www.kucoin.com/'],
  ['Markets.com','broker','https://www.markets.com/'],['MEXC','exchange','https://www.mexc.com/'],['OANDA','broker','https://www.oanda.com/'],['OKX','exchange','https://www.okx.com/'],
  ['Pepperstone','broker','https://pepperstone.com/'],['Robinhood','broker','https://robinhood.com/'],['Saxo Bank','broker','https://www.home.saxo/'],['SuperForex','broker','https://superforex.com/'],
  ['Tickmill','broker','https://www.tickmill.com/'],['Uphold','exchange','https://uphold.com/'],['WazirX','exchange','https://wazirx.com/'],['XM','broker','https://www.xm.com/'],
  ['Bitget Exchange','exchange','https://www.bitget.com/'],['Coinbase India','exchange','https://www.coinbase.com/'],['Hyperliquid Exchange','exchange','https://app.hyperliquid.xyz/']
].map(([name,category,url])=>entry(name,category,'broker-or-exchange',url,'Official venue/broker destination only. Qelly does not embed account, wallet, order-routing, leveraged-trading or execution surfaces.'));

const other=[
  ['AllRatesToday SDKs','software'],['Brave New Coin Sandbox','software'],['Finmap.io','multi-asset'],['IEX Cloud Legacy','software'],['Pyth Pro X','multi-asset'],
  ['QOS Quote API WebSocket','software'],['TickDB WebSocket','software'],['finance-agent-mcp-server Global','software'],['CoinStats Portfolio API','software'],['Global Stock Screener','software']
].map(([name,category])=>entry(name,category,'software-or-directory',null,'Developer, SDK, directory or MCP surface. It is catalogued separately from end-user data display and requires its own security and licensing review.'));

const aliasMap=Object.freeze({
  'ExchangeRate‑API':'exchange-rate-api',
  'Pyth Network / Pyth Pro X':'pyth-network-pyth-pro-x',
  'Pyth Pro X':'pyth-network-pyth-pro-x',
  'OANDA API':'oanda-api',
  'Binance Public':'binance-public',
  'Kraken Public':'kraken-public'
});

const all=[...active,...publicReview,...keyed,...contracted,...research,...venues,...other];
const deduplicated=[];
const ids=new Set();
for(const item of all){
  if(ids.has(item.id))continue;
  ids.add(item.id);
  deduplicated.push(Object.freeze(item));
}

export const providerDirectory=()=>deduplicated.map((item)=>({...item,aliases:[...item.aliases]}));
export const providerDirectorySummary=()=>{
  const providers=providerDirectory();
  const byIntegration={};
  const byCategory={};
  for(const item of providers){byIntegration[item.integration]=(byIntegration[item.integration]||0)+1;byCategory[item.category]=(byCategory[item.category]||0)+1;}
  return {total:providers.length,byIntegration,byCategory,nonProviderRowsExcluded:['No API Key Required','Free API Key Required','Quick Summary by Need','India NSE/BSE data','India MCX commodities','Global forex (all currencies)','Global stocks (US/UK/Japan/India/etc.)','Gold & commodities','One API for everything','India forex broker (compliant)','India crypto'],aliases:{...aliasMap}};
};

export const __providerDirectoryTest=Object.freeze({slug,aliasMap});
