plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.dopimo.walkie"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.dopimo.walkie"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }
    // Fixed release key from CI secrets, so every new APK installs as an update over the old one.
    // Without the secrets (local builds) it falls back to the debug key.
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
    // The web UI (../../public) is bundled as assets/www.
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/www"))
}

val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.file("../public"))
    into(layout.buildDirectory.dir("generated/www/www"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.fragment:fragment-ktx:1.8.2") // Nearby pulls an old Fragment; ActivityResult needs >= 1.3
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.google.android.gms:play-services-nearby:19.3.0")
}
