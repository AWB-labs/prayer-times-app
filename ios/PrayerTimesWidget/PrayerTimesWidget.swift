import WidgetKit
import SwiftUI

// MARK: - Shared Data

struct WidgetPrayer: Codable {
    let name: String
    let arabicName: String
    let time: String
    let timestamp: TimeInterval
}

struct WidgetData: Codable {
    let prayers: [WidgetPrayer]
    let nextPrayerIndex: Int
    let nextPrayerName: String
    let nextPrayerTimestamp: TimeInterval
    let date: String

    static func load() -> WidgetData? {
        guard
            let defaults = UserDefaults(suiteName: "group.com.prayertimes.app"),
            let data = defaults.data(forKey: "prayerData")
        else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    static var placeholder: WidgetData {
        WidgetData(
            prayers: [WidgetPrayer(name: "Dhuhr", arabicName: "الظهر", time: "12:10", timestamp: Date().timeIntervalSince1970 + 3600)],
            nextPrayerIndex: 0,
            nextPrayerName: "Dhuhr",
            nextPrayerTimestamp: Date().timeIntervalSince1970 + 3600,
            date: "2026-01-01"
        )
    }
}

// MARK: - Colors

extension Color {
    static let widgetBg      = Color(red: 0,       green: 0,       blue: 0)
    static let widgetGold    = Color(red: 201/255, green: 162/255, blue: 39/255)
    static let widgetSubtext = Color.white.opacity(0.55)
    static let widgetMuted   = Color.white.opacity(0.30)
}

// MARK: - Time Formatter

private func formatTime(_ timeStr: String) -> String {
    let parts = timeStr.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return timeStr }
    let h = parts[0], m = parts[1]
    let period = h >= 12 ? "PM" : "AM"
    let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
    return String(format: "%d:%02d %@", h12, m, period)
}

// MARK: - Next Prayer Widget

struct NextPrayerEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let arabicName: String
    let prayerTime: String
    let nextTimestamp: TimeInterval
}

struct NextPrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextPrayerEntry {
        makeEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (NextPrayerEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextPrayerEntry>) -> Void) {
        let entry = makeEntry()
        // Reload exactly when this prayer time arrives
        let refreshDate = Date(timeIntervalSince1970: entry.nextTimestamp)
        completion(Timeline(entries: [entry], policy: .after(refreshDate)))
    }

    private func makeEntry() -> NextPrayerEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let prayer = data.prayers[data.nextPrayerIndex]
        return NextPrayerEntry(
            date: Date(),
            prayerName: data.nextPrayerName,
            arabicName: prayer.arabicName,
            prayerTime: prayer.time,
            nextTimestamp: data.nextPrayerTimestamp
        )
    }
}

struct NextPrayerView: View {
    let entry: NextPrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color.widgetBg
            VStack(spacing: 4) {
                Text("NEXT PRAYER")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(2.5)
                    .foregroundColor(.widgetMuted)

                Text(entry.prayerName)
                    .font(.system(size: family == .systemSmall ? 22 : 30, weight: .bold))
                    .foregroundColor(.white)

                Text(entry.arabicName)
                    .font(.system(size: 13))
                    .foregroundColor(.widgetSubtext)

                Spacer().frame(height: 6)

                Text(formatTime(entry.prayerTime))
                    .font(.system(size: family == .systemSmall ? 18 : 24, weight: .semibold, design: .rounded))
                    .foregroundColor(.widgetGold)
            }
            .padding()
        }
        .containerBackground(.black, for: .widget)
    }
}

struct NextPrayerWidget: Widget {
    let kind = "NextPrayerWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextPrayerProvider()) { entry in
            NextPrayerView(entry: entry)
        }
        .configurationDisplayName("Next Prayer")
        .description("Shows the next upcoming prayer and its time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Countdown Widget

struct CountdownEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let arabicName: String
    let hoursLeft: Int
    let minutesLeft: Int
    let nextTimestamp: TimeInterval
}

struct CountdownProvider: TimelineProvider {
    func placeholder(in context: Context) -> CountdownEntry {
        CountdownEntry(date: Date(), prayerName: "Dhuhr", arabicName: "الظهر",
                       hoursLeft: 1, minutesLeft: 2,
                       nextTimestamp: Date().timeIntervalSince1970 + 3720)
    }

    func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
        completion(makeEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let nextDate = Date(timeIntervalSince1970: data.nextPrayerTimestamp)
        let prayer = data.prayers[data.nextPrayerIndex]
        let now = Date()

        // Pre-generate one entry per minute for up to 60 minutes ahead
        var entries: [CountdownEntry] = []
        for i in 0..<60 {
            let entryDate = now.addingTimeInterval(Double(i) * 60)
            if entryDate >= nextDate { break }
            let remaining = nextDate.timeIntervalSince(entryDate)
            entries.append(CountdownEntry(
                date: entryDate,
                prayerName: data.nextPrayerName,
                arabicName: prayer.arabicName,
                hoursLeft: Int(remaining) / 3600,
                minutesLeft: (Int(remaining) % 3600) / 60,
                nextTimestamp: data.nextPrayerTimestamp
            ))
        }

        if entries.isEmpty { entries.append(makeEntry(at: now)) }
        // After all entries expire, reload immediately after the prayer time
        completion(Timeline(entries: entries, policy: .after(nextDate)))
    }

    private func makeEntry(at date: Date) -> CountdownEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let prayer = data.prayers[data.nextPrayerIndex]
        let nextDate = Date(timeIntervalSince1970: data.nextPrayerTimestamp)
        let remaining = max(0, nextDate.timeIntervalSince(date))
        return CountdownEntry(
            date: date,
            prayerName: data.nextPrayerName,
            arabicName: prayer.arabicName,
            hoursLeft: Int(remaining) / 3600,
            minutesLeft: (Int(remaining) % 3600) / 60,
            nextTimestamp: data.nextPrayerTimestamp
        )
    }
}

struct CountdownView: View {
    let entry: CountdownEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color.widgetBg
            VStack(spacing: 4) {
                Text("TIME TO")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(2.5)
                    .foregroundColor(.widgetMuted)

                Text(entry.prayerName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.widgetGold)

                Spacer().frame(height: 6)

                if entry.hoursLeft > 0 {
                    HStack(alignment: .lastTextBaseline, spacing: 3) {
                        Text("\(entry.hoursLeft)")
                            .font(.system(size: family == .systemSmall ? 30 : 40, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("h")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.widgetSubtext)
                        Text("\(entry.minutesLeft)")
                            .font(.system(size: family == .systemSmall ? 30 : 40, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("m")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.widgetSubtext)
                    }
                } else {
                    HStack(alignment: .lastTextBaseline, spacing: 3) {
                        Text("\(entry.minutesLeft)")
                            .font(.system(size: family == .systemSmall ? 38 : 50, weight: .bold, design: .rounded))
                            .foregroundColor(.widgetGold)
                        Text("min")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.widgetSubtext)
                    }
                }

                Text("remaining")
                    .font(.system(size: 10))
                    .foregroundColor(.widgetMuted)
            }
            .padding()
        }
        .containerBackground(.black, for: .widget)
    }
}

struct CountdownWidget: Widget {
    let kind = "CountdownWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CountdownProvider()) { entry in
            CountdownView(entry: entry)
        }
        .configurationDisplayName("Prayer Countdown")
        .description("Counts down to the next prayer, updating every minute.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Bundle Entry Point

@main
struct PrayerTimesWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        CountdownWidget()
    }
}
