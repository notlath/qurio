package expo.modules.managedconfig

import android.content.Context
import android.content.RestrictionsManager
import android.os.Bundle
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val RESTRICTION_KEYS = listOf("tenantHost", "clientId", "assistantId", "agenticAssistantId", "biometricTimeoutMs")

// Single responsibility: read managed restrictions and expose them to JS. Never touches
// auth or UI (ticket 14) — src/config/managed.ts owns turning this into a TenantConfig.
class ManagedConfigModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ManagedConfig")

    AsyncFunction("getManagedConfigAsync") {
      readRestrictions()
    }
  }

  // A key declared in res/xml/app_restrictions.xml but absent at runtime is simply
  // missing from this map, not an error — normalizeManagedConfig decides what's usable.
  private fun readRestrictions(): Map<String, Any?> {
    val manager = context.getSystemService(Context.RESTRICTIONS_SERVICE) as RestrictionsManager
    val bundle: Bundle = manager.applicationRestrictions
    return RESTRICTION_KEYS.associateWith { key ->
      when {
        !bundle.containsKey(key) -> null
        key == "biometricTimeoutMs" -> bundle.getInt(key)
        else -> bundle.getString(key)
      }
    }
  }
}
