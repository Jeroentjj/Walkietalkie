plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.wlky.sidekey"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.wlky.sidekey"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }
    // Same release key as WLKY (CI secrets); without them (local builds) the debug key.
    val keystore = System.getenv("WALKIE_KEYSTORE")?.let { file(it) }?.takeIf { it.exists() }
    signingConfigs {
        if (keystore != null) create("walkie") {
            storeFile = keystore
            storePassword = System.getenv("WALKIE_KEYSTORE_PASSWORD")
            keyAlias = "walkie"
            keyPassword = System.getenv("WALKIE_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("walkie") ?: signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // One small app per action: the key's app list shows every app once, so each action gets its own app.
    flavorDimensions += "act"
    buildFeatures { buildConfig = true; resValues = true }
    productFlavors {
        create("torch") {
            dimension = "act"
            applicationIdSuffix = ".torch"
            buildConfigField("String", "ACTION", "\"torch\"")
            resValue("string", "app_name", "Zijknop Zaklamp")
            manifestPlaceholders["icon"] = "@drawable/ic_torch"
        }
        create("sound") {
            dimension = "act"
            applicationIdSuffix = ".sound"
            buildConfigField("String", "ACTION", "\"sound\"")
            resValue("string", "app_name", "Zijknop Geluid")
            manifestPlaceholders["icon"] = "@drawable/ic_sound"
        }
        create("camera") {
            dimension = "act"
            applicationIdSuffix = ".camera"
            buildConfigField("String", "ACTION", "\"camera\"")
            resValue("string", "app_name", "Zijknop Camera")
            manifestPlaceholders["icon"] = "@drawable/ic_camera"
        }
        create("location") {
            dimension = "act"
            applicationIdSuffix = ".location"
            buildConfigField("String", "ACTION", "\"location\"")
            resValue("string", "app_name", "Zijknop Locatie")
            manifestPlaceholders["icon"] = "@drawable/ic_location"
        }
        create("call") {
            dimension = "act"
            applicationIdSuffix = ".call"
            buildConfigField("String", "ACTION", "\"call\"")
            resValue("string", "app_name", "Zijknop Bel favoriet")
            manifestPlaceholders["icon"] = "@drawable/ic_call"
        }
        create("assist") {
            dimension = "act"
            applicationIdSuffix = ".assist"
            buildConfigField("String", "ACTION", "\"assist\"")
            resValue("string", "app_name", "Zijknop Assistent")
            manifestPlaceholders["icon"] = "@drawable/ic_assist"
        }
        create("smart") {
            dimension = "act"
            applicationIdSuffix = ".smart"
            buildConfigField("String", "ACTION", "\"smart\"")
            resValue("string", "app_name", "Zijknop Slim")
            manifestPlaceholders["icon"] = "@drawable/ic_smart"
        }
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.core:core-ktx:1.13.1")
}
