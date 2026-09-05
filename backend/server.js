require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const ALPHA_VANTAGE_API_KEY =
  process.env.ALPHA_VANTAGE_API_KEY;

// ======================================
// HOME
// ======================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MarketPulse backend is running!",
  });
});

// ======================================
// HEALTH CHECK
// ======================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "MarketPulse backend is working!",
  });
});

// ======================================
// MARKET DATA
// ======================================

app.get("/api/market/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol
      .toUpperCase()
      .trim();

    // Check API key
    if (!ALPHA_VANTAGE_API_KEY) {
      return res.status(500).json({
        success: false,
        message:
          "Alpha Vantage API key is missing. Check backend/.env",
      });
    }

    // --------------------------------------
    // Alpha Vantage symbol
    // --------------------------------------

    const avSymbol = `${symbol}.BSE`;

    // --------------------------------------
    // 1. GLOBAL QUOTE
    // --------------------------------------

    const quoteUrl =
      `https://www.alphavantage.co/query` +
      `?function=GLOBAL_QUOTE` +
      `&symbol=${encodeURIComponent(avSymbol)}` +
      `&apikey=${ALPHA_VANTAGE_API_KEY}`;

    const quoteResponse =
      await fetch(quoteUrl);

    if (!quoteResponse.ok) {
      return res.status(502).json({
        success: false,
        message:
          "Unable to connect to Alpha Vantage.",
      });
    }

    const quoteData =
      await quoteResponse.json();

    // Debug output
    console.log(
      `GLOBAL_QUOTE response for ${symbol}:`,
      quoteData
    );

    // API rate limit
    if (quoteData.Note) {
      return res.status(429).json({
        success: false,
        message:
          "Alpha Vantage request limit reached. Please try again later.",
      });
    }

    // API error
    if (quoteData["Error Message"]) {
      console.log(
        `GLOBAL_QUOTE failed for ${symbol}:`,
        quoteData["Error Message"]
      );
    }

    const quote =
      quoteData["Global Quote"];

    // --------------------------------------
    // GLOBAL QUOTE SUCCESS
    // --------------------------------------

    if (
      quote &&
      quote["05. price"]
    ) {
      const currentPrice =
        Number(
          quote["05. price"]
        );

      const volume =
        Number(
          quote["06. volume"]
        );

      const previousClose =
        Number(
          quote["08. previous close"]
        );

      const changePercent =
        Number(
          String(
            quote["10. change percent"]
          ).replace("%", "")
        );

      return res.json({
        success: true,
        symbol,
        price: currentPrice,
        volume,
        previousClose,
        changePercent,
        source: "GLOBAL_QUOTE",
      });
    }

    // --------------------------------------
    // 2. FALLBACK - DAILY DATA
    // --------------------------------------

    console.log(
      `GLOBAL_QUOTE unavailable for ${symbol}. Trying daily data...`
    );

    const dailyUrl =
      `https://www.alphavantage.co/query` +
      `?function=TIME_SERIES_DAILY` +
      `&symbol=${encodeURIComponent(avSymbol)}` +
      `&outputsize=compact` +
      `&apikey=${ALPHA_VANTAGE_API_KEY}`;

    const dailyResponse =
      await fetch(dailyUrl);

    if (!dailyResponse.ok) {
      return res.status(502).json({
        success: false,
        message:
          "Unable to fetch daily market data.",
      });
    }

    const dailyData =
      await dailyResponse.json();

    console.log(
      `TIME_SERIES_DAILY response for ${symbol}:`,
      dailyData
    );

    // Rate limit
    if (dailyData.Note) {
      return res.status(429).json({
        success: false,
        message:
          "Alpha Vantage request limit reached. Please try again later.",
      });
    }

    // API error
    if (dailyData["Error Message"]) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid or unsupported stock symbol: ${symbol}.`,
      });
    }

    const timeSeries =
      dailyData[
        "Time Series (Daily)"
      ];

   if (!timeSeries) {
  const fallbackStocks = {
    RELIANCE: {
      price: 1322,
      previousClose: 1305,
      changePercent: 1.3,
      volume: 459976
    },
    TCS: {
      price: 4125,
      previousClose: 4090,
      changePercent: 0.86,
      volume: 180000
    },
    INFY: {
      price: 1880,
      previousClose: 1865,
      changePercent: 0.8,
      volume: 220000
    },
    HDFCBANK: {
      price: 1715,
      previousClose: 1698,
      changePercent: 1.0,
      volume: 250000
    },
    ICICIBANK: {
      price: 1450,
      previousClose: 1438,
      changePercent: 0.83,
      volume: 240000
    },
    SBIN: {
      price: 820,
      previousClose: 812,
      changePercent: 0.99,
      volume: 300000
    },
    ITC: {
      price: 410,
      previousClose: 406,
      changePercent: 0.99,
      volume: 350000
    }
  };

  const fallback = fallbackStocks[symbol];

  if (fallback) {
    return res.json({
      success: true,
      symbol,
      ...fallback,
      source: "Demo fallback data",
      demo: true
    });
  }

  return res.json({
    success: true,
    symbol,
    price: 1000,
    previousClose: 990,
    changePercent: 1.01,
    volume: 100000,
    source: "Demo fallback data",
    demo: true
  });
}
    // --------------------------------------
    // Get latest and previous trading day
    // --------------------------------------

    const dates =
      Object.keys(timeSeries).sort(
        (a, b) =>
          new Date(b) -
          new Date(a)
      );

    if (!dates.length) {
      return res.status(404).json({
        success: false,
        message:
          `No daily market data available for ${symbol}.`,
      });
    }

    const latestDate =
      dates[0];

    const previousDate =
      dates[1] || dates[0];

    const latest =
      timeSeries[latestDate];

    const previous =
      timeSeries[previousDate];

    const currentPrice =
      Number(
        latest["4. close"]
      );

    const volume =
      Number(
        latest["5. volume"]
      );

    const previousClose =
      Number(
        previous["4. close"]
      );

    const changePercent =
      previousClose > 0
        ? Number(
            (
              ((currentPrice -
                previousClose) /
                previousClose) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.json({
      success: true,
      symbol,
      price: currentPrice,
      volume,
      previousClose,
      changePercent,
      date: latestDate,
      source: "TIME_SERIES_DAILY",
    });
  } catch (error) {
    console.error(
      "MARKET DATA ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch market data.",
      error: error.message,
    });
  }
});

// ======================================
// START SERVER
// ======================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `MarketPulse backend running on http://localhost:${PORT}`
  );
});