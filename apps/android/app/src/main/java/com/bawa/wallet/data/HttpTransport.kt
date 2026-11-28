package com.bawa.wallet.data

import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

// Thin suspend HTTP transport behind the live repositories (Step 5,
// Lane B). The repositories only ever see this interface, so unit tests
// inject a fake instead of touching the network; the production
// implementation is one small OkHttp wrapper. Read-only GET/POST calls
// only — nothing here signs, sends or broadcasts anything.
interface HttpTransport {
    @Throws(Exception::class)
    suspend fun get(url: String): String

    @Throws(Exception::class)
    suspend fun postJson(url: String, body: String): String
}

/** Thrown by OkHttpTransport for a non-2xx HTTP status. */
class HttpStatusException(val statusCode: Int, val responseBody: String?) :
    Exception("HTTP $statusCode")

class OkHttpTransport(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()
) : HttpTransport {

    override suspend fun get(url: String): String {
        val request = Request.Builder().url(url).get().build()
        return execute(request)
    }

    override suspend fun postJson(url: String, body: String): String {
        val request = Request.Builder().url(url)
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        return execute(request)
    }

    private fun execute(request: Request): String {
        client.newCall(request).execute().use { response ->
            val body = response.body?.string()
            if (!response.isSuccessful) {
                throw HttpStatusException(response.code, body)
            }
            return body
                ?: throw IllegalStateException("Empty response body from ${request.url}")
        }
    }
}
