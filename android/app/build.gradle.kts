plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "cn.beaubird.app"
  compileSdk = 34

  defaultConfig {
    applicationId = "cn.beaubird.app"
    minSdk = 26
    targetSdk = 34
    versionCode = 4
    versionName = "1.0.3"
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
    }
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  sourceSets {
    getByName("main") {
      assets.srcDir(file("../.."))
      assets.include("index.html")
      assets.include("style.css")
      assets.include("script.js")
      assets.include("vendor/jquery.min.js")
      assets.include("vendor/crypto-js.min.js")
      assets.include("vendor/jqueryAjax.js")
      assets.include("vendor/aes.util.js")
      assets.include("data/zhejiang-birdreport-species.json")
      assets.include("data/zhejiang-birdreport-species.js")
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-ktx:1.9.1")
}
