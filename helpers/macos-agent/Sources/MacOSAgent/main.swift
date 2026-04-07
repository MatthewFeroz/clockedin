import AppKit
import Foundation

struct RuntimeConfigEnvelope: Codable {
    let type: String
    let payload: RuntimePayload
}

struct RuntimePayload: Codable {
    let blockedTargets: [BlockedTarget]
    let sessionActive: Bool
    let sessionId: String?
}

struct BlockedTarget: Codable {
    let id: String
    let kind: String
    let label: String
    let enabled: Bool
    let match: Match
}

struct Match: Codable {
    let domains: [String]?
    let bundleIds: [String]?
    let processNames: [String]?
}

struct RuntimeMessage<T: Codable>: Codable {
    let type: String
    let source: String
    let payload: T
}

struct AttemptPayload: Codable {
    let targetId: String
    let targetLabel: String
    let platform: String
    let context: AttemptContext
}

struct AttemptContext: Codable {
    let appName: String?
    let processName: String?
    let bundleId: String?
}

final class Agent {
    private let runtimeBaseUrl: URL
    private let notificationCenter = NSWorkspace.shared.notificationCenter
    private var blockedTargets: [BlockedTarget] = []
    private var sessionActive = false

    init(runtimeBaseUrl: URL) {
        self.runtimeBaseUrl = runtimeBaseUrl
    }

    func run() {
        syncConfig()
        sendHello()

        notificationCenter.addObserver(
            self,
            selector: #selector(handleWorkspaceNotification(_:)),
            name: NSWorkspace.didLaunchApplicationNotification,
            object: nil
        )

        notificationCenter.addObserver(
            self,
            selector: #selector(handleWorkspaceNotification(_:)),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )

        Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            self?.syncConfig()
            self?.sendPing()
        }

        RunLoop.main.run()
    }

    @objc private func handleWorkspaceNotification(_ notification: Notification) {
        guard sessionActive else {
            return
        }

        guard
            let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
        else {
            return
        }

        let bundleId = app.bundleIdentifier?.lowercased()
        let processName = app.localizedName?.lowercased()

        guard let target = blockedTargets.first(where: { target in
            guard target.kind == "app", target.enabled else {
                return false
            }

            let bundleMatch = target.match.bundleIds?.contains(where: { $0.lowercased() == bundleId }) ?? false
            let processMatch = target.match.processNames?.contains(where: { $0.lowercased() == processName }) ?? false
            return bundleMatch || processMatch
        }) else {
            return
        }

        _ = app.terminate()

        sendAttempt(target: target, app: app)
    }

    private func syncConfig() {
        let url = runtimeBaseUrl.appendingPathComponent("runtime/config")

        URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
            guard error == nil, let data else {
                return
            }

            guard
                let envelope = try? JSONDecoder().decode(RuntimeConfigEnvelope.self, from: data)
            else {
                return
            }

            self?.blockedTargets = envelope.payload.blockedTargets
            self?.sessionActive = envelope.payload.sessionActive
        }.resume()
    }

    private func sendHello() {
        sendMessage(["type": "HELLO", "source": "native-helper"])
    }

    private func sendPing() {
        sendMessage(["type": "HEALTH_PING", "source": "native-helper"])
    }

    private func sendAttempt(target: BlockedTarget, app: NSRunningApplication) {
        let payload = RuntimeMessage(
            type: "ATTEMPT_DETECTED",
            source: "native-helper",
            payload: AttemptPayload(
                targetId: target.id,
                targetLabel: target.label,
                platform: "macos",
                context: AttemptContext(
                    appName: app.localizedName,
                    processName: app.localizedName,
                    bundleId: app.bundleIdentifier
                )
            )
        )

        guard let body = try? JSONEncoder().encode(payload) else {
            return
        }

        post(body: body)
    }

    private func sendMessage(_ object: [String: String]) {
        guard let body = try? JSONSerialization.data(withJSONObject: object) else {
            return
        }

        post(body: body)
    }

    private func post(body: Data) {
        var request = URLRequest(url: runtimeBaseUrl.appendingPathComponent("runtime/message"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        URLSession.shared.dataTask(with: request).resume()
    }
}

let runtimeUrl = ProcessInfo.processInfo.environment["CLOCKEDIN_RUNTIME_URL"] ?? "http://127.0.0.1:48123"
guard let url = URL(string: runtimeUrl) else {
    fputs("Invalid CLOCKEDIN_RUNTIME_URL\n", stderr)
    exit(1)
}

let agent = Agent(runtimeBaseUrl: url)
agent.run()
