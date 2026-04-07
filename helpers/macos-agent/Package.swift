// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "MacOSAgent",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "clockedin-agent", targets: ["MacOSAgent"])
    ],
    targets: [
        .executableTarget(
            name: "MacOSAgent",
            path: "Sources/MacOSAgent"
        )
    ]
)
