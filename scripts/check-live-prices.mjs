/*
 * Manual live CoinGecko freshness/no-price check (not part of vitest).
 * Exactly 2 HTTPS requests on the same origin: one real quote fetch and one
 * forced 404/no-price probe (unknown id may return HTTP 200 with {} instead).
 * Never writes or commits anything.
 */

const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";
const MAX_QUOTE_AGE_MS = 600_000;
const coins = [
  ["bitcoin", "BTC"],
  ["ethereum", "ETH"],
  ["tron", "TRX"],
  ["the-open-network", "TON"],
];

function request(url) {
  return fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    redirect: "manual",
  });
}

function describe(error) {
  return String(error instanceof Error ? error.message : error).replace(/\s+/g, " ");
}

function isNetworkError(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return true;
  if (error?.name !== "TypeError") return false;
  if (error.message === "fetch failed") return true;
  const code = String(error.cause?.code ?? "");
  return error.message === "terminated" &&
    (code.startsWith("UND_ERR_") || ["ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(code));
}

async function checkLiveQuotes() {
  try {
    const response = await request(
      `${ENDPOINT}?ids=bitcoin,ethereum,tron,the-open-network&vs_currencies=usd&include_last_updated_at=true`,
    );
    if (response.status !== 200) throw new Error(`expected HTTP 200, got HTTP ${response.status}`);
    const data = await response.json();
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("expected a JSON object containing all four coin ids");
    }
    const now = Date.now();
    const lines = [];
    for (const [id, symbol] of coins) {
      const label = `${symbol} (${id})`;
      if (!Object.hasOwn(data, id)) throw new Error(`${label}: missing quote`);
      const quote = data[id];
      if (quote === null || typeof quote !== "object" || Array.isArray(quote)) {
        throw new Error(`${label}: quote must be an object`);
      }
      if (!Number.isFinite(quote.usd) || quote.usd <= 0) {
        throw new Error(`${label}: usd must be a finite number greater than 0`);
      }
      if (!Number.isFinite(quote.last_updated_at)) {
        throw new Error(`${label}: last_updated_at must be a finite number in seconds`);
      }
      const updatedMs = quote.last_updated_at * 1000;
      const ageMs = now - updatedMs;
      if (ageMs > MAX_QUOTE_AGE_MS) {
        throw new Error(`${label}: last_updated_at is older than 10 minutes`);
      }
      if (ageMs < -60_000) {
        throw new Error(`${label}: last_updated_at is more than 60 seconds in the future`);
      }
      lines.push(
        `${symbol} $${quote.usd} (CoinGecko, updated ${new Date(updatedMs).toISOString()}, age ${Math.floor(ageMs / 1000)}s)`,
      );
    }
    for (const line of lines) console.log(line);
    console.log("LIVE QUOTES OK: 4/4 fresh");
    return true;
  } catch (error) {
    console.error(`LIVE QUOTES FAILED: ${describe(error)}`);
    return false;
  }
}

async function checkForcedFailure() {
  try {
    const response = await request(
      `${ENDPOINT}?ids=definitely-not-a-coin&vs_currencies=usd`,
    );
    if (response.status < 200 || response.status >= 300) {
      console.log(`FORCED FAILURE OK: HTTP ${response.status}, no price shown`);
      return true;
    }
    if (response.status !== 200) throw new Error(`HTTP ${response.status}: expected HTTP 200 with an empty object`);
    const data = await response.json();
    if (data !== null && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0) {
      console.log(
        "FORCED FAILURE OK: unknown id returns no price (empty object, never $0.00)",
      );
      return true;
    }
    throw new Error("HTTP 200 returned something other than an empty object; no price shown");
  } catch (error) {
    if (isNetworkError(error)) {
      console.log("FORCED FAILURE OK: network error, no price shown");
      return true;
    }
    const reason = error?.name === "SyntaxError" ? "invalid JSON response, no price shown" : describe(error);
    console.error(`FORCED FAILURE UNEXPECTED: ${reason}`);
    return false;
  }
}

// Run both checks even if the first fails; never retry either request.
const livePassed = await checkLiveQuotes();
const forcedFailurePassed = await checkForcedFailure();
process.exitCode = livePassed && forcedFailurePassed ? 0 : 1;
