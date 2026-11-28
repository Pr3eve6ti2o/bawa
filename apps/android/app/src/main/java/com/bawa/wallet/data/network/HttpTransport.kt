package com.bawa.wallet.data.network

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

// Minimal HTTP transport for the Step 5 network stack (Android Step 5,
// Lane A) — unified in Step 6 (was two interfaces: this one, GET-only
// with a result type, and data.HttpTransport, GET + POST-JSON throwing
// Strings). The unified transport is this one: every call returns an
// HttpResult, never throws for a transport or status failure, and the
// repositories that need the old throwing shape use getText /
// postJsonText below. The repositories talk only to this interface, so
// unit tests substitute a fake and no test ever touches the network.
// All price/balance/history sources are keyless public APIs; no secret
// or API key is sent here. Read-only GET/POST calls only — nothing here
// signs, sends or broadcasts anything.
sealed interface HttpResult {
    /** An HTTP response came back; the body may be empty. */
    data class Response(val statusCode: Int, val body: String) : HttpResult

    /** No HTTP response at all (DNS, connect, TLS, timeout, bad URL). */
    data class Failure(val message: String) : HttpResult
}

interface HttpTransport {
    suspend fun get(url: String): HttpResult

    suspend fun postJson(url: String, body: String): HttpResult
}

/** Thrown by [getText] / [postJsonText] for a non-2xx HTTP status. */
class HttpStatusException(val statusCode: Int, val responseBody: String?) :
    Exception("HTTP $statusCode")

/**
 * Throwing text view of a GET: 200 -> the body, any other status ->
 * [HttpStatusException], no response at all -> [IOException]. Lets the
 * live balance/history repositories keep their try/catch shape (every
 * failure becomes an honest Unavailable) on the unified transport.
 */
suspend fun HttpTransport.getText(url: String): String = textOf(get(url))

/** Throwing text view of a POST-JSON, same contract as [getText]. */
suspend fun HttpTransport.postJsonText(url: String, body: String): String =
    textOf(postJson(url, body))

private fun textOf(result: HttpResult): String = when (result) {
    is HttpResult.Response ->
        if (result.statusCode == 200) result.body
        else throw HttpStatusException(result.statusCode, result.body)
    is HttpResult.Failure -> throw IOException(result.message)
}

/** OkHttp-backed transport with short timeouts (web: 10 s price fetch). */
class OkHttpHttpTransport(
    private val client: OkHttpClient = defaultClient()
) : HttpTransport {

    override suspend fun get(url: String): HttpResult = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .build()
            client.newCall(request).execute().use { response ->
                HttpResult.Response(response.code, response.body?.string().orEmpty())
            }
        } catch (e: IOException) {
            HttpResult.Failure(e.message ?: "network error")
        } catch (e: IllegalArgumentException) {
            HttpResult.Failure(e.message ?: "invalid url")
        }
    }

    override suspend fun postJson(url: String, body: String): HttpResult =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url(url)
                    .header("Accept", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                client.newCall(request).execute().use { response ->
                    HttpResult.Response(response.code, response.body?.string().orEmpty())
                }
            } catch (e: IOException) {
                HttpResult.Failure(e.message ?: "network error")
            } catch (e: IllegalArgumentException) {
                HttpResult.Failure(e.message ?: "invalid url")
            }
        }

    companion object {
        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()

        const val TIMEOUT_SECONDS: Long = 10
    }
}
