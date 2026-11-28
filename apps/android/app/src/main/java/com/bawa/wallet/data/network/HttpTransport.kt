package com.bawa.wallet.data.network

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

// Minimal HTTP transport for the Step 5 network stack (Android Step 5,
// Lane A). The repository talks only to this interface, so unit tests
// substitute a fake and no test ever touches the network. All price
// sources are keyless public APIs; no secret or API key is sent here.
sealed interface HttpResult {
    /** An HTTP response came back; the body may be empty. */
    data class Response(val statusCode: Int, val body: String) : HttpResult

    /** No HTTP response at all (DNS, connect, TLS, timeout, bad URL). */
    data class Failure(val message: String) : HttpResult
}

interface HttpTransport {
    suspend fun get(url: String): HttpResult
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

    companion object {
        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()

        const val TIMEOUT_SECONDS: Long = 10
    }
}
