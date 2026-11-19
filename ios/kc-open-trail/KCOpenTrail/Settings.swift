import WebKit

struct Cookie {
    var name: String
    var value: String
}

// The game. "?src=ios" tells the game it is inside the App Store app (site/games/kc-open-trail/js/channel.js),
// so it shows no real-money store, no prices and nothing about buying anywhere else.
let rootUrl = URL(string: "https://dewclaw-app.netlify.app/games/kc-open-trail/?src=ios")!

// Pages on this host open inside the app. It must also be listed under WKAppBoundDomains in Info.plist.
let allowedOrigins: [String] = ["dewclaw-app.netlify.app"]

// Sites that would open inside the app with a Done bar. KC: Open Trail has none: every outside site
// opens in the in-app Safari sheet (SFSafariViewController), never inside the game's web view.
let authOrigins: [String] = []

// Outside sites handed straight to iOS instead of the Safari sheet. None for the game.
let systemHandledHosts: [String] = []

// Non-web links passed to iOS (a support email address, for example). Anything else is ignored.
let systemHandledSchemes: [String] = ["mailto"]

// Same cookie the Dewclaw iOS app sets, so the website can tell it is inside an App Store app.
let platformCookie = Cookie(name: "app-platform", value: "iOS App Store")

// UI options
let displayMode = "fullscreen" // standalone / fullscreen. The game draws edge to edge and uses the safe-area insets itself.
let adaptiveUIStyle = true     // Change the app theme on the fly to dark/light from the page's theme colour.
let overrideStatusBar = false
let statusBarTheme = "dark"
let pullToRefresh = false      // Off: a downward swipe is a game control, not a reload.
