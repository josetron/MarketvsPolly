const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Helper to fetch data via HTTPS (returns Promise)
function fetchHttps(url, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...customHeaders
    };

    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Kalshi in-memory cache
let kalshiSeriesCache = null;
let kalshiSeriesCacheTime = 0;

// Sector in-memory cache
const sectorCache = {}; // key: ticker (uppercase), value: { sector, industry, etf }

function getSectorEtf(sectorName) {
  const mapping = {
    'Technology': 'XLK',
    'Consumer Cyclical': 'XLY',
    'Financial Services': 'XLF',
    'Financial': 'XLF',
    'Healthcare': 'XLV',
    'Consumer Defensive': 'XLP',
    'Energy': 'XLE',
    'Basic Materials': 'XLB',
    'Industrials': 'XLI',
    'Utilities': 'XLU',
    'Real Estate': 'XLRE',
    'Communication Services': 'XLC'
  };
  return mapping[sectorName] || 'SPY';
}

function getGoogleFinanceExchange(exchangeName) {
  const mapping = {
    'NMS': 'NASDAQ',
    'NGM': 'NASDAQ',
    'NCM': 'NASDAQ',
    'NYQ': 'NYSE',
    'ASE': 'AMEX'
  };
  return mapping[exchangeName] || 'NASDAQ';
}

function calculateTwoWeekReturn(chartResult) {
  if (!chartResult || !chartResult.indicators || !chartResult.indicators.quote || !chartResult.indicators.quote[0]) {
    return 0;
  }
  const prices = chartResult.indicators.quote[0].close;
  const currentPrice = chartResult.meta.regularMarketPrice;
  const prevClose = chartResult.meta.chartPreviousClose;

  if (prices && prices.length >= 10) {
    const price10DaysAgo = prices[prices.length - 10] || prices[0];
    return ((currentPrice - price10DaysAgo) / price10DaysAgo) * 100;
  } else if (prices && prices.length > 0) {
    const startPrice = prices[0] || prevClose || currentPrice;
    return ((currentPrice - startPrice) / startPrice) * 100;
  }
  return 0;
}

async function getKalshiSeries() {
  const now = Date.now();
  // Cache for 1 hour
  if (kalshiSeriesCache && (now - kalshiSeriesCacheTime < 3600000)) {
    return kalshiSeriesCache;
  }

  try {
    console.log('Fetching Kalshi series list (Mentions category)...');
    const url = 'https://external-api.kalshi.com/trade-api/v2/series?limit=1000&category=Mentions';
    const result = await fetchHttps(url);
    const data = JSON.parse(result.body);
    if (data && data.series) {
      kalshiSeriesCache = data.series;
      kalshiSeriesCacheTime = now;
      console.log(`Successfully cached ${kalshiSeriesCache.length} Kalshi mention series.`);
      return kalshiSeriesCache;
    }
  } catch (error) {
    console.error('Failed to fetch Kalshi series, using fallback:', error.message);
  }
  return kalshiSeriesCache || [];
}

async function findKalshiSeriesForTicker(ticker, companyName) {
  const seriesList = await getKalshiSeries();
  
  const tickerUpper = ticker.toUpperCase();
  const nameLower = (companyName || '').toLowerCase();

  // Try 1: Exact mapping for ticker
  const exactTickerSeries = seriesList.find(s => 
    s.ticker === `KXEARNINGSMENTION${tickerUpper}` || 
    s.ticker === `KXMENTIONEARN${tickerUpper}`
  );
  if (exactTickerSeries) return exactTickerSeries;

  // Try 2: Known common mappings for specific symbols
  const knownMappings = {
    'DOCU': 'DOCUSIGN',
    'CBRL': 'CBRL',
    'RBRK': 'RUBRIK',
    'IOT': 'SAMSARA',
    'LULU': 'LULU'
  };
  const mappedName = knownMappings[tickerUpper];
  if (mappedName) {
    const mappedSeries = seriesList.find(s => 
      s.ticker === `KXEARNINGSMENTION${mappedName}` || 
      s.ticker === `KXMENTIONEARN${mappedName}`
    );
    if (mappedSeries) return mappedSeries;
  }

  // Try 3: Ticker substring matching (if ticker length > 1)
  if (tickerUpper.length > 1) {
    const containingTickerSeries = seriesList.find(s => 
      s.ticker.includes(`EARNINGSMENTION${tickerUpper}`) || 
      s.ticker.includes(`MENTIONEARN${tickerUpper}`) ||
      s.ticker.endsWith(tickerUpper)
    );
    if (containingTickerSeries) return containingTickerSeries;
  }

  // Try 4: Match on company name keywords
  if (nameLower.length > 2) {
    const cleanName = nameLower
      .replace(/\b(inc|corp|co|ltd|corporation|incorporated|class a|class b)\b\.?/gi, '')
      .trim();
    
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const matchByTitle = seriesList.find(s => {
        const titleLower = s.title.toLowerCase();
        return words.some(w => titleLower.includes(w));
      });
      if (matchByTitle) return matchByTitle;
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // Set no-cache for API routes to prevent stale browser caching
  if (pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }

  // API Route: Polymarket
  if (pathname === '/api/polymarket') {
    try {
      // Query 100 active earnings markets
      const polyUrl = 'https://gamma-api.polymarket.com/markets?tag_id=1013&active=true&limit=100';
      const result = await fetchHttps(polyUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result.body);
    } catch (error) {
      console.error('Polymarket Proxy Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch Polymarket data', details: error.message }));
    }
    return;
  }

  // API Route: Nasdaq
  if (pathname === '/api/nasdaq') {
    const dateParam = parsedUrl.searchParams.get('date');
    
    // Default to today's date if not provided (server local time, formatted as YYYY-MM-DD)
    let date = dateParam;
    if (!date) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      date = `${yyyy}-${mm}-${dd}`;
    }

    try {
      const nasdaqUrl = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`;
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.nasdaq.com/'
      };
      const result = await fetchHttps(nasdaqUrl, headers);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result.body);
    } catch (error) {
      console.error('Nasdaq Proxy Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch Nasdaq earnings data', details: error.message }));
    }
    return;
  }

  // API Route: Yahoo Finance Quote & History
  if (pathname === '/api/quote') {
    const symbol = parsedUrl.searchParams.get('symbol');
    if (!symbol) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing symbol parameter' }));
      return;
    }

    try {
      const tickerUpper = symbol.toUpperCase();
      let sectorInfo = sectorCache[tickerUpper];
      
      if (!sectorInfo) {
        try {
          const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${tickerUpper}`;
          const searchResult = await fetchHttps(searchUrl);
          const searchData = JSON.parse(searchResult.body);
          const firstQuote = searchData.quotes && searchData.quotes[0];
          const sector = firstQuote ? firstQuote.sector : null;
          const industry = firstQuote ? firstQuote.industry : null;
          const etf = getSectorEtf(sector);
          sectorInfo = { sector, industry, etf };
          sectorCache[tickerUpper] = sectorInfo;
        } catch (searchErr) {
          console.error(`Failed to lookup sector for ${tickerUpper}:`, searchErr.message);
          sectorInfo = { sector: null, industry: null, etf: 'SPY' };
        }
      }

      // Fetch company chart and sector ETF chart in parallel
      const companyChartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${tickerUpper}?interval=1d&range=1mo`;
      const etfChartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sectorInfo.etf}?interval=1d&range=1mo`;

      const [companyRes, etfRes] = await Promise.all([
        fetchHttps(companyChartUrl),
        fetchHttps(etfChartUrl)
      ]);

      const companyData = JSON.parse(companyRes.body);
      const etfData = JSON.parse(etfRes.body);

      const etfReturn = calculateTwoWeekReturn(etfData.chart.result[0]);

      const chartMeta = companyData.chart && companyData.chart.result && companyData.chart.result[0] && companyData.chart.result[0].meta;
      const exchangeName = chartMeta ? chartMeta.exchangeName : null;
      const googleExchange = getGoogleFinanceExchange(exchangeName);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        chart: companyData.chart,
        sector: sectorInfo.sector,
        industry: sectorInfo.industry,
        sectorEtf: sectorInfo.etf,
        sectorEtfReturn: etfReturn,
        googleExchange: googleExchange
      }));
    } catch (error) {
      console.error(`Yahoo Quote Error for ${symbol}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to fetch quote for ${symbol}`, details: error.message }));
    }
    return;
  }

  // API Route: Kalshi Prediction Markets for Ticker
  if (pathname === '/api/kalshi') {
    const ticker = parsedUrl.searchParams.get('ticker');
    const company = parsedUrl.searchParams.get('company') || '';
    if (!ticker) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ticker parameter' }));
      return;
    }

    try {
      const series = await findKalshiSeriesForTicker(ticker, company);
      if (!series) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ markets: [], series: null }));
        return;
      }

      // Fetch active markets for the matched series
      const marketsUrl = `https://external-api.kalshi.com/trade-api/v2/markets?status=open&series_ticker=${series.ticker}`;
      const result = await fetchHttps(marketsUrl);
      const data = JSON.parse(result.body);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        series: series,
        markets: data.markets || []
      }));
    } catch (error) {
      console.error(`Kalshi Proxy Error for ${ticker}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to fetch Kalshi data for ${ticker}`, details: error.message }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Safe path check to prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
