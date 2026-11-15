package xyz.jsdevexperiment.nextstop

import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "nextstop/app_identity")
            .setMethodCallHandler { call, result ->
                if (call.method == "getIdentity") {
                    try {
                        result.success(
                            mapOf("package" to packageName, "sha1" to signingSha1())
                        )
                    } catch (e: Exception) {
                        result.error("UNAVAILABLE", e.message, null)
                    }
                } else {
                    result.notImplemented()
                }
            }
    }

    /** SHA-1 of the certificate this build is signed with, e.g. "AB:CD:...". */
    private fun signingSha1(): String? {
        val signature: Signature? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val info = packageManager.getPackageInfo(
                packageName, PackageManager.GET_SIGNING_CERTIFICATES
            ).signingInfo ?: return null
            if (info.hasMultipleSigners()) info.apkContentsSigners.firstOrNull()
            else info.signingCertificateHistory.lastOrNull()
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                .signatures?.firstOrNull()
        }
        val digest = MessageDigest.getInstance("SHA-1").digest(signature?.toByteArray() ?: return null)
        return digest.joinToString(":") { "%02X".format(it) }
    }
}
