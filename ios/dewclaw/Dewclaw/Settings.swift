import WebKit

struct Cookie {
    var name: String
    var value: String
}

// URL for first launch
let rootUrl = URL(string: "https://dewclaw-app.netlify.app/index.html")!

// allowed origin is for what we are sticking to pwa domain
// This should also appear in Info.plist
let allowedOrigins: [String] = ["dewclaw-app.netlify.app"]

// auth origins will open in modal and show toolbar for back into the main origin.
// These should also appear in Info.plist
// Dewclaw has none: Stripe, PayPal and every other outside site open in the
// in-app Safari sheet (SFSafariViewController), never inside the web view.
let authOrigins: [String] = []
// allowedOrigins + authOrigins <= 10

// Outside sites that should be handed to the system (so the Maps app can take them)
// instead of the in-app Safari sheet.
let systemHandledHosts: [String] = ["maps.apple.com"]

// Non-web links the app passes to iOS: phone calls (poison control lines), email, texts, maps.
let systemHandledSchemes: [String] = ["tel", "telprompt", "mailto", "sms", "facetime", "facetime-audio", "maps"]

let platformCookie = Cookie(name: "app-platform", value: "iOS App Store")

// UI options
let displayMode = "standalone" // standalone / fullscreen.
let adaptiveUIStyle = true     // iOS 15+ only. Change app theme on the fly to dark/light related to WebView background color.
let overrideStatusBar = false   // iOS 13-14 only. if you don't support dark/light system theme.
let statusBarTheme = "dark"    // dark / light, related to override option.
let pullToRefresh = true    // Enable/disable pull down to refresh page
