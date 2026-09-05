import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

const API_URL = "http://localhost:5000";

const availableStocks = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "ITC", name: "ITC Limited" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel" },
];

const demoPreviousPrices = {
  RELIANCE: 1350,
  TCS: 3825,
  INFY: 1580,
  HDFCBANK: 1665,
  ICICIBANK: 1270,
  SBIN: 820,
  ITC: 463,
  BHARTIARTL: 1780,
};

function getAttention(change) {
  const absoluteChange = Math.abs(change);

  if (absoluteChange >= 5) {
    return {
      level: "HIGH",
      label: "HIGH ATTENTION",
      reason:
        "Large price movement detected since your previous visit.",
    };
  }

  if (absoluteChange >= 3) {
    return {
      level: "WATCH",
      label: "WORTH WATCHING",
      reason:
        "Meaningful price movement detected since your previous visit.",
    };
  }

  if (absoluteChange >= 1) {
    return {
      level: "WATCH",
      label: "WORTH WATCHING",
      reason:
        "Noticeable price movement detected since your previous visit.",
    };
  }

  return {
    level: "NORMAL",
    label: "NORMAL",
    reason:
      "No meaningful price change detected since your previous visit.",
  };
}

function App() {
  // =========================
  // AUTH
  // =========================

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // =========================
  // WATCHLIST
  // =========================

  const [watchlist, setWatchlist] = useState([]);
  const [watchlistLoading, setWatchlistLoading] =
    useState(false);

  // =========================
  // MARKET DATA
  // =========================

  const [marketData, setMarketData] = useState({});
  const [marketLoading, setMarketLoading] =
    useState(false);

  // =========================
  // UI
  // =========================

  const [errorMessage, setErrorMessage] =
    useState("");

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [search, setSearch] = useState("");

  // =========================
  // PREVIOUS VISIT
  // =========================

  const [previousSnapshot, setPreviousSnapshot] =
    useState({});

  const [previousVisitTime, setPreviousVisitTime] =
    useState(null);

  // =========================
  // AUTH SESSION
  // =========================

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error(
            "SESSION ERROR:",
            error
          );

          setAuthError(error.message);
        }

        setSession(session);
      } catch (error) {
        console.error(error);

        if (mounted) {
          setAuthError(
            error.message ||
              "Could not load login session."
          );
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =========================
  // LOAD USER WATCHLIST
  // =========================

  useEffect(() => {
    if (!session?.user) {
      setWatchlist([]);
      return;
    }

    const loadWatchlist = async () => {
      try {
        setWatchlistLoading(true);
        setErrorMessage("");

        const { data, error } =
          await supabase
            .from("watchlists")
            .select(
              "id, symbol, created_at"
            )
            .eq(
              "user_id",
              session.user.id
            )
            .order("created_at", {
              ascending: true,
            });

        if (error) {
          console.error(
            "WATCHLIST LOAD ERROR:",
            error
          );

          throw error;
        }

        setWatchlist(
          (data || []).map(
            (item) => item.symbol
          )
        );
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error.message ||
            "Could not load your watchlist."
        );
      } finally {
        setWatchlistLoading(false);
      }
    };

    loadWatchlist();
  }, [session]);

  // =========================
  // LOAD PREVIOUS SNAPSHOT
  // =========================

  useEffect(() => {
    if (!session?.user) {
      setPreviousSnapshot({});
      setPreviousVisitTime(null);
      return;
    }

    const storageKey =
      `marketpulse_snapshot_${session.user.id}`;

    const saved =
      localStorage.getItem(storageKey);

    if (!saved) {
      setPreviousSnapshot(
        demoPreviousPrices
      );
      setPreviousVisitTime(null);
      return;
    }

    try {
      const parsed = JSON.parse(saved);

      if (
        parsed &&
        parsed.prices &&
        typeof parsed.prices ===
          "object"
      ) {
        setPreviousSnapshot(
          parsed.prices
        );

        setPreviousVisitTime(
          parsed.timestamp || null
        );
      } else {
        setPreviousSnapshot(
          parsed || demoPreviousPrices
        );

        setPreviousVisitTime(null);
      }
    } catch (error) {
      console.error(
        "SNAPSHOT LOAD ERROR:",
        error
      );

      setPreviousSnapshot(
        demoPreviousPrices
      );

      setPreviousVisitTime(null);
    }
  }, [session]);

  // =========================
  // FETCH ONE STOCK
  // =========================

  const fetchOneStock = async (
    symbol
  ) => {
    const url =
      `${API_URL}/api/market/${encodeURIComponent(
        symbol
      )}`;

    const response =
      await fetch(url);

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          `Could not fetch ${symbol}`
      );
    }

    const normalized = {
      ...result,
      price: Number(result.price),
      volume: Number(result.volume),
      previousClose: Number(
        result.previousClose
      ),
      changePercent: Number(
        result.changePercent
      ),
    };

    if (
      !Number.isFinite(
        normalized.price
      ) ||
      normalized.price <= 0
    ) {
      throw new Error(
        `Invalid price received for ${symbol}`
      );
    }

    return normalized;
  };

  // =========================
  // FETCH REAL MARKET DATA
  // =========================

  useEffect(() => {
    if (!watchlist.length) {
      setMarketData({});
      setMarketLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAllMarketData =
      async () => {
        setMarketLoading(true);

        const freshData = {};

        for (
          const symbol of watchlist
        ) {
          if (cancelled) return;

          let success = false;

          // First attempt
          try {
            const data =
              await fetchOneStock(
                symbol
              );

            freshData[symbol] =
              data;

            success = true;
          } catch (error) {
            console.warn(
              `First attempt failed for ${symbol}:`,
              error.message
            );
          }

          // Retry once if needed
          if (!success) {
            try {
              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    800
                  )
              );

              const data =
                await fetchOneStock(
                  symbol
                );

              freshData[symbol] =
                data;

              success = true;
            } catch (error) {
              console.error(
                `Second attempt failed for ${symbol}:`,
                error.message
              );
            }
          }

          /*
            Store a successful result immediately.
            This prevents one failed stock from
            affecting the other stocks.
          */
          if (
            success &&
            freshData[symbol]
          ) {
            const cacheKey =
              `marketpulse_market_${symbol}`;

            localStorage.setItem(
              cacheKey,
              JSON.stringify(
                freshData[symbol]
              )
            );

            if (!cancelled) {
              setMarketData(
                (current) => ({
                  ...current,
                  [symbol]:
                    freshData[symbol],
                })
              );
            }
          } else {
            /*
              If API temporarily fails,
              use last successfully cached
              market value.
            */
            const cacheKey =
              `marketpulse_market_${symbol}`;

            const cached =
              localStorage.getItem(
                cacheKey
              );

            if (cached) {
              try {
                const cachedData =
                  JSON.parse(
                    cached
                  );

                if (!cancelled) {
                  setMarketData(
                    (current) => ({
                      ...current,
                      [symbol]:
                        cachedData,
                    })
                  );
                }
              } catch {
                console.warn(
                  `Cached data invalid for ${symbol}`
                );
              }
            } else {
              console.warn(
                `No market data available for ${symbol}`
              );
            }
          }

          /*
            Small delay helps avoid sending
            multiple requests simultaneously.
          */
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                500
              )
          );
        }

        if (!cancelled) {
          setMarketLoading(false);
        }
      };

    fetchAllMarketData();

    return () => {
      cancelled = true;
    };
  }, [watchlist]);

  // =========================
  // SAVE CURRENT VISIT
  // =========================

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const saveSnapshot = () => {
      if (
        !Object.keys(
          marketData
        ).length
      ) {
        return;
      }

      const prices = {};

      Object.entries(
        marketData
      ).forEach(
        ([symbol, data]) => {
          const price = Number(
            data?.price
          );

          if (
            Number.isFinite(price) &&
            price > 0
          ) {
            prices[symbol] =
              price;
          }
        }
      );

      if (
        !Object.keys(prices).length
      ) {
        return;
      }

      const storageKey =
        `marketpulse_snapshot_${session.user.id}`;

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          timestamp:
            new Date().toISOString(),
          prices,
        })
      );
    };

    window.addEventListener(
      "pagehide",
      saveSnapshot
    );

    return () => {
      window.removeEventListener(
        "pagehide",
        saveSnapshot
      );
    };
  }, [
    session,
    marketData,
  ]);

  // =========================
  // LOGIN / SIGNUP
  // =========================

  const handleAuth = async (
    event
  ) => {
    event.preventDefault();

    setAuthError("");
    setAuthMessage("");

    const cleanEmail =
      email.trim();

    if (
      !cleanEmail ||
      !password
    ) {
      setAuthError(
        "Please enter email and password."
      );

      return;
    }

    if (password.length < 6) {
      setAuthError(
        "Password must contain at least 6 characters."
      );

      return;
    }

    try {
      setAuthSubmitting(true);

      if (isLogin) {
        const { error } =
          await supabase.auth.signInWithPassword(
            {
              email: cleanEmail,
              password,
            }
          );

        if (error) {
          throw error;
        }

        setAuthMessage(
          "Login successful."
        );
      } else {
        const {
          data,
          error,
        } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          setAuthMessage(
            "Account created successfully."
          );
        } else {
          setAuthMessage(
            "Account created. Please check your email and confirm your account."
          );
        }
      }
    } catch (error) {
      console.error(error);

      setAuthError(
        error.message ||
          "Authentication failed."
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = async () => {
    if (
      session?.user &&
      Object.keys(
        marketData
      ).length
    ) {
      const prices = {};

      Object.entries(
        marketData
      ).forEach(
        ([symbol, data]) => {
          const price = Number(
            data?.price
          );

          if (
            Number.isFinite(price) &&
            price > 0
          ) {
            prices[symbol] =
              price;
          }
        }
      );

      if (
        Object.keys(prices).length
      ) {
        const storageKey =
          `marketpulse_snapshot_${session.user.id}`;

        localStorage.setItem(
          storageKey,
          JSON.stringify({
            timestamp:
              new Date().toISOString(),
            prices,
          })
        );
      }
    }

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSession(null);
    setWatchlist([]);
    setMarketData({});
    setPreviousSnapshot({});
    setPreviousVisitTime(null);
    setShowAddModal(false);
    setSearch("");
  };

  // =========================
  // ADD STOCK
  // =========================

  const addStock = async (
    symbol
  ) => {
    if (!session?.user) {
      return;
    }

    const cleanSymbol =
      symbol.toUpperCase().trim();

    if (
      watchlist.includes(
        cleanSymbol
      )
    ) {
      return;
    }

    try {
      setErrorMessage("");

      const {
        data,
        error,
      } =
        await supabase
          .from("watchlists")
          .insert({
            user_id:
              session.user.id,
            symbol:
              cleanSymbol,
          })
          .select()
          .single();

      if (error) {
        console.error(
          "ADD STOCK ERROR:",
          error
        );

        throw error;
      }

      setWatchlist(
        (current) => [
          ...current,
          data.symbol,
        ]
      );

      setShowAddModal(false);
      setSearch("");
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          "Could not add stock."
      );
    }
  };

  // =========================
  // REMOVE STOCK
  // =========================

  const removeStock = async (
    symbol
  ) => {
    if (!session?.user) {
      return;
    }

    const cleanSymbol =
      symbol.toUpperCase().trim();

    try {
      setErrorMessage("");

      const { error } =
        await supabase
          .from("watchlists")
          .delete()
          .eq(
            "user_id",
            session.user.id
          )
          .eq(
            "symbol",
            cleanSymbol
          );

      if (error) {
        console.error(
          "REMOVE STOCK ERROR:",
          error
        );

        throw error;
      }

      setWatchlist(
        (current) =>
          current.filter(
            (item) =>
              item !==
              cleanSymbol
          )
      );

      setMarketData(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            cleanSymbol
          ];

          return next;
        }
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          "Could not remove stock."
      );
    }
  };

  // =========================
  // CALCULATE STOCKS
  // =========================

  const stocks = useMemo(() => {
    return watchlist
      .map((symbol) => {
        const baseStock =
          availableStocks.find(
            (stock) =>
              stock.symbol ===
              symbol
          );

        if (!baseStock) {
          return null;
        }

        const data =
          marketData[symbol];

        if (!data) {
          const cachedPrice =
            previousSnapshot[
              symbol
            ];

          return {
            ...baseStock,
            price:
              cachedPrice || null,
            volume: null,
            previousPrice:
              cachedPrice || null,
            previousPriceLabel:
              previousVisitTime
                ? "Previous visit"
                : "Previous close",
            changeSinceLastVisit: 0,
            trend: "FLAT",
            attention: "NORMAL",
            attentionLabel:
              marketLoading
                ? "LOADING"
                : "DATA UNAVAILABLE",
            reason: marketLoading
              ? "Fetching the latest market data."
              : "Market data is temporarily unavailable.",
          };
        }

        const currentPrice =
          Number(data.price);

        const currentVolume =
          Number(data.volume);

        const apiPreviousClose =
          Number(
            data.previousClose
          );

        const savedPreviousPrice =
          Number(
            previousSnapshot[
              symbol
            ]
          );

        const validSavedPrice =
          Number.isFinite(
            savedPreviousPrice
          ) &&
          savedPreviousPrice > 0;

        const validPreviousClose =
          Number.isFinite(
            apiPreviousClose
          ) &&
          apiPreviousClose > 0;

        const previousPrice =
          validSavedPrice
            ? savedPreviousPrice
            : validPreviousClose
            ? apiPreviousClose
            : currentPrice;

        const previousPriceLabel =
          validSavedPrice
            ? "Previous visit"
            : "Previous close";

        const changeSinceLastVisit =
          previousPrice > 0
            ? ((currentPrice -
                previousPrice) /
                previousPrice) *
              100
            : 0;

        const attention =
          getAttention(
            changeSinceLastVisit
          );

        const trend =
          changeSinceLastVisit >
          0.05
            ? "UP"
            : changeSinceLastVisit <
              -0.05
            ? "DOWN"
            : "FLAT";

        return {
          ...baseStock,
          price: currentPrice,
          volume: currentVolume,
          previousPrice,
          previousPriceLabel,
          changeSinceLastVisit,
          trend,
          attention:
            attention.level,
          attentionLabel:
            attention.label,
          reason:
            attention.reason,
        };
      })
      .filter(Boolean);
  }, [
    watchlist,
    marketData,
    previousSnapshot,
    previousVisitTime,
    marketLoading,
  ]);

  // =========================
  // FORMATTERS
  // =========================

  const formatPrice = (
    price
  ) => {
    if (
      price === null ||
      price === undefined ||
      !Number.isFinite(
        Number(price)
      )
    ) {
      return "—";
    }

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    ).format(
      Number(price)
    );
  };

  const formatVolume = (
    volume
  ) => {
    if (
      volume === null ||
      volume === undefined ||
      !Number.isFinite(
        Number(volume)
      )
    ) {
      return "—";
    }

    return Number(
      volume
    ).toLocaleString("en-IN");
  };

  // =========================
  // GROUPS
  // =========================

  const highAttention =
    stocks.filter(
      (stock) =>
        stock.attention ===
        "HIGH"
    );

  const watchAttention =
    stocks.filter(
      (stock) =>
        stock.attention ===
        "WATCH"
    );

  const normalAttention =
    stocks.filter(
      (stock) =>
        stock.attention ===
        "NORMAL"
    );

  const meaningfulChanges =
    highAttention.length +
    watchAttention.length;

  // =========================
  // SEARCH
  // =========================

  const filteredStocks =
    availableStocks.filter(
      (stock) =>
        stock.symbol
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        stock.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );

  // =========================
  // LOADING SCREEN
  // =========================

  if (authLoading) {
    return (
      <div className="app">
        <div className="main-container">
          <section className="summary">
            <div className="summary-icon">
              M
            </div>

            <div>
              <h3>
                Loading MarketPulse...
              </h3>

              <p>
                Checking your login session.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // =========================
  // LOGIN / SIGNUP
  // =========================

  if (!session) {
    return (
      <div className="app">
        <div
          className="main-container"
          style={{
            minHeight:
              "100vh",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
          }}
        >
          <div
            className="modal"
            style={{
              width:
                "100%",
              maxWidth:
                "440px",
            }}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  MARKETPULSE
                </p>

                <h2>
                  {isLogin
                    ? "Welcome back"
                    : "Create your account"}
                </h2>

                <p
                  style={{
                    marginTop:
                      "8px",
                  }}
                >
                  {isLogin
                    ? "Sign in to access your personal watchlist."
                    : "Create an account to save your personal watchlist."}
                </p>
              </div>
            </div>

            <form
              onSubmit={
                handleAuth
              }
            >
              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    "8px",
                  fontWeight:
                    "600",
                }}
              >
                Email
              </label>

              <input
                className="search-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  boxSizing:
                    "border-box",
                }}
              />

              <label
                style={{
                  display:
                    "block",
                  marginTop:
                    "16px",
                  marginBottom:
                    "8px",
                  fontWeight:
                    "600",
                }}
              >
                Password
              </label>

              <input
                className="search-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  boxSizing:
                    "border-box",
                }}
              />

              {authError && (
                <p
                  style={{
                    marginTop:
                      "14px",
                    color:
                      "#b91c1c",
                  }}
                >
                  {authError}
                </p>
              )}

              {authMessage && (
                <p
                  style={{
                    marginTop:
                      "14px",
                    color:
                      "#166534",
                  }}
                >
                  {authMessage}
                </p>
              )}

              <button
                className="add-btn"
                type="submit"
                disabled={
                  authSubmitting
                }
                style={{
                  width:
                    "100%",
                  marginTop:
                    "20px",
                }}
              >
                {authSubmitting
                  ? "Please wait..."
                  : isLogin
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>

            <div
              style={{
                textAlign:
                  "center",
                marginTop:
                  "20px",
              }}
            >
              <span>
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </span>

              <button
                type="button"
                onClick={() => {
                  setIsLogin(
                    !isLogin
                  );

                  setAuthError("");
                  setAuthMessage(
                    ""
                  );
                }}
                style={{
                  border:
                    "none",
                  background:
                    "transparent",
                  cursor:
                    "pointer",
                  fontWeight:
                    "700",
                }}
              >
                {isLogin
                  ? "Sign Up"
                  : "Login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // DASHBOARD
  // =========================

  const userEmail =
    session.user?.email ||
    "User";

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <div className="logo-mark">
            M
          </div>

          <div>
            <h1>
              MarketPulse
            </h1>

            <span>
              Know what changed. Know what matters.
            </span>
          </div>
        </div>

        <div className="user-area">
          <button
            className="add-btn"
            onClick={() =>
              setShowAddModal(
                true
              )
            }
          >
            + Add Stock
          </button>

          <span
            style={{
              fontSize:
                "13px",
              marginRight:
                "10px",
            }}
          >
            {userEmail}
          </span>

          <button
            onClick={
              handleLogout
            }
            style={{
              border:
                "1px solid #ddd",
              background:
                "#fff",
              borderRadius:
                "8px",
              padding:
                "8px 12px",
              cursor:
                "pointer",
            }}
          >
            Logout
          </button>

          <div className="avatar">
            {userEmail
              .charAt(0)
              .toUpperCase()}
          </div>
        </div>
      </header>

      <main className="main-container">
        {errorMessage && (
          <div
            className="summary"
            style={{
              marginBottom:
                "20px",
              background:
                "#fff1f2",
              color:
                "#991b1b",
            }}
          >
            <div className="summary-icon">
              !
            </div>

            <div>
              <h3>
                Something went wrong
              </h3>

              <p
                style={{
                  color:
                    "#991b1b",
                }}
              >
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        <section className="welcome">
          <div>
            <p className="eyebrow">
              YOUR MARKET DASHBOARD
            </p>

            <h2>
              Welcome back,{" "}
              {
                userEmail.split(
                  "@"
                )[0]
              }{" "}
              👋
            </h2>

            <p className="subtitle">
              Here’s what meaningfully changed
              while you were away.
            </p>
          </div>

          <div className="last-checked">
            Last checked

            <strong>
              {previousVisitTime
                ? new Date(
                    previousVisitTime
                  ).toLocaleString(
                    "en-IN",
                    {
                      dateStyle:
                        "medium",
                      timeStyle:
                        "short",
                    }
                  )
                : "First visit"}
            </strong>
          </div>
        </section>

        <section className="summary">
          <div className="summary-icon">
            !
          </div>

          <div>
            <h3>
              {meaningfulChanges} meaningful{" "}
              {meaningfulChanges ===
              1
                ? "change"
                : "changes"}{" "}
              detected
            </h3>

            <p>
              We compared current market prices
              with your previous visit.
            </p>
          </div>
        </section>

        {watchlistLoading && (
          <section className="summary">
            <div className="summary-icon">
              M
            </div>

            <div>
              <h3>
                Loading watchlist...
              </h3>

              <p>
                Fetching your saved stocks.
              </p>
            </div>
          </section>
        )}

        {marketLoading &&
          !watchlistLoading && (
            <section className="summary">
              <div className="summary-icon">
                M
              </div>

              <div>
                <h3>
                  Updating market data...
                </h3>

                <p>
                  Fetching the latest prices and
                  trading volume.
                </p>
              </div>
            </section>
          )}

        {highAttention.length >
          0 && (
          <section className="section">
            <div className="section-title">
              <div>
                <h2>
                  🔴 Needs Attention
                </h2>

                <p>
                  Significant changes worth
                  looking at now.
                </p>
              </div>
            </div>

            <div className="stock-grid">
              {highAttention.map(
                (stock) => (
                  <StockCard
                    key={
                      stock.symbol
                    }
                    stock={stock}
                    onRemove={
                      removeStock
                    }
                    formatPrice={
                      formatPrice
                    }
                    formatVolume={
                      formatVolume
                    }
                  />
                )
              )}
            </div>
          </section>
        )}

        {watchAttention.length >
          0 && (
          <section className="section">
            <div className="section-title">
              <div>
                <h2>
                  🟠 Worth Watching
                </h2>

                <p>
                  Some noticeable movement
                  was detected.
                </p>
              </div>
            </div>

            <div className="stock-grid">
              {watchAttention.map(
                (stock) => (
                  <StockCard
                    key={
                      stock.symbol
                    }
                    stock={stock}
                    onRemove={
                      removeStock
                    }
                    formatPrice={
                      formatPrice
                    }
                    formatVolume={
                      formatVolume
                    }
                  />
                )
              )}
            </div>
          </section>
        )}

        {normalAttention.length >
          0 && (
          <section className="section">
            <div className="section-title">
              <div>
                <h2>
                  🟢 No Significant Changes
                </h2>

                <p>
                  Your other watchlist stocks
                  are relatively stable.
                </p>
              </div>
            </div>

            <div className="stock-grid">
              {normalAttention.map(
                (stock) => (
                  <StockCard
                    key={
                      stock.symbol
                    }
                    stock={stock}
                    onRemove={
                      removeStock
                    }
                    formatPrice={
                      formatPrice
                    }
                    formatVolume={
                      formatVolume
                    }
                  />
                )
              )}
            </div>
          </section>
        )}

        {!watchlistLoading &&
          stocks.length === 0 && (
            <section className="summary">
              <div className="summary-icon">
                +
              </div>

              <div>
                <h3>
                  Your watchlist is empty
                </h3>

                <p>
                  Click “Add Stock” to start
                  tracking companies.
                </p>
              </div>
            </section>
          )}
      </main>

      {showAddModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowAddModal(
              false
            )
          }
        >
          <div
            className="modal"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  WATCHLIST
                </p>

                <h2>
                  Add a stock
                </h2>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowAddModal(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <input
              className="search-input"
              type="text"
              placeholder="Search stock or company..."
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              autoFocus
            />

            <div className="search-results">
              {filteredStocks.map(
                (stock) => {
                  const alreadyAdded =
                    watchlist.includes(
                      stock.symbol
                    );

                  return (
                    <div
                      className="search-result"
                      key={
                        stock.symbol
                      }
                    >
                      <div>
                        <strong>
                          {
                            stock.symbol
                          }
                        </strong>

                        <span>
                          {
                            stock.name
                          }
                        </span>
                      </div>

                      <button
                        className={
                          alreadyAdded
                            ? "already-added"
                            : "add-result-btn"
                        }
                        disabled={
                          alreadyAdded
                        }
                        onClick={() =>
                          addStock(
                            stock.symbol
                          )
                        }
                      >
                        {alreadyAdded
                          ? "Added"
                          : "Add"}
                      </button>
                    </div>
                  );
                }
              )}

              {filteredStocks.length ===
                0 && (
                <p className="no-results">
                  No stocks found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockCard({
  stock,
  onRemove,
  formatPrice,
  formatVolume,
}) {
  const isPositive =
    stock.changeSinceLastVisit >=
    0;

  const trendLabel =
    stock.trend === "UP"
      ? "↑ Upward"
      : stock.trend ===
        "DOWN"
      ? "↓ Downward"
      : "→ Stable";

  return (
    <div className="stock-card">
      <div className="stock-top">
        <div>
          <h3>
            {stock.symbol}
          </h3>

          <p>
            {stock.name}
          </p>
        </div>

        <span
          className={`badge ${stock.attention.toLowerCase()}`}
        >
          {
            stock.attentionLabel
          }
        </span>
      </div>

      <div className="price-row">
        <div className="price">
          {formatPrice(
            stock.price
          )}
        </div>

        <div
          className={
            isPositive
              ? "positive"
              : "negative"
          }
        >
          {stock.price !==
          null
            ? `${
                isPositive
                  ? "▲"
                  : "▼"
              } ${Math.abs(
                stock.changeSinceLastVisit
              ).toFixed(2)}%`
            : "—"}
        </div>
      </div>

      <div className="change-box">
        <div>
          <span>
            {
              stock.previousPriceLabel ||
              "Previous visit"
            }
          </span>

          <strong>
            {formatPrice(
              stock.previousPrice
            )}
          </strong>
        </div>

        <div>
          <span>
            Change since visit
          </span>

          <strong
            className={
              isPositive
                ? "positive"
                : "negative"
            }
          >
            {stock.price !==
            null
              ? `${
                  isPositive
                    ? "+"
                    : ""
                }${stock.changeSinceLastVisit.toFixed(
                  2
                )}%`
              : "—"}
          </strong>
        </div>
      </div>

      <div className="change-box">
        <div>
          <span>
            Current price
          </span>

          <strong>
            {formatPrice(
              stock.price
            )}
          </strong>
        </div>

        <div>
          <span>
            Trading volume
          </span>

          <strong>
            {formatVolume(
              stock.volume
            )}
          </strong>
        </div>
      </div>

      <div className="change-box">
        <div>
          <span>
            Trend
          </span>

          <strong
            className={
              stock.trend ===
              "DOWN"
                ? "negative"
                : stock.trend ===
                  "UP"
                ? "positive"
                : ""
            }
          >
            {trendLabel}
          </strong>
        </div>

        <div>
          <span>
            Market status
          </span>

          <strong>
            Live
          </strong>
        </div>
      </div>

      <div className="reason">
        <strong>
          Why it matters
        </strong>

        <p>
          {stock.reason}
        </p>
      </div>

      <div className="stock-footer">
        <span>
          ● Live market data
        </span>

        <button
          className="remove-btn"
          onClick={() =>
            onRemove(
              stock.symbol
            )
          }
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default App;