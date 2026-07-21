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
            let defaults = UserDefaults(suiteName: "group.com.badry.prayertimes"),
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

/// The prayer a widget should currently be pointing at.
struct ResolvedPrayer {
    let name: String
    let arabicName: String
    let time: String
    let date: Date
}

extension WidgetData {
    /// Re-derives the upcoming prayer from the stored clock times. The persisted
    /// `nextPrayerIndex` is only accurate as of the last time the app ran, so relying
    /// on it leaves the widget pointing at a prayer that has already passed.
    func nextUp(now: Date = Date()) -> ResolvedPrayer? {
        guard !prayers.isEmpty else { return nil }
        let calendar = Calendar.current

        func occurrence(of time: String, on day: Date) -> Date? {
            let parts = time.split(separator: ":").compactMap { Int($0) }
            guard parts.count >= 2 else { return nil }
            return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day)
        }

        let upcoming = prayers.compactMap { prayer -> ResolvedPrayer? in
            guard let at = occurrence(of: prayer.time, on: now), at > now else { return nil }
            return ResolvedPrayer(name: prayer.name, arabicName: prayer.arabicName,
                                  time: prayer.time, date: at)
        }.min { $0.date < $1.date }

        if let upcoming = upcoming { return upcoming }

        // Every prayer for today has passed — wrap to tomorrow's first one.
        guard
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: now),
            let first = prayers.first,
            let at = occurrence(of: first.time, on: tomorrow)
        else { return nil }
        return ResolvedPrayer(name: first.name, arabicName: first.arabicName,
                              time: first.time, date: at)
    }
}

// MARK: - Colors

extension Color {
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
    let nextDate: Date
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
        // Reload just after this prayer arrives, when the next one takes over.
        completion(Timeline(entries: [entry], policy: .after(entry.nextDate.addingTimeInterval(1))))
    }

    private func makeEntry() -> NextPrayerEntry {
        let now = Date()
        let data = WidgetData.load() ?? WidgetData.placeholder
        let next = data.nextUp(now: now)
        return NextPrayerEntry(
            date: now,
            prayerName: next?.name ?? "—",
            arabicName: next?.arabicName ?? "",
            prayerTime: next?.time ?? "",
            nextDate: next?.date ?? now.addingTimeInterval(3600)
        )
    }
}

struct NextPrayerView: View {
    let entry: NextPrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
    let target: Date
    /// Whether more than an hour is left as of `date` — drives the h/m/s labelling.
    let showsHours: Bool
}

struct CountdownProvider: TimelineProvider {
    func placeholder(in context: Context) -> CountdownEntry {
        let now = Date()
        return CountdownEntry(date: now, prayerName: "Dhuhr",
                              target: now.addingTimeInterval(3720), showsHours: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
        completion(makeEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
        let now = Date()
        let data = WidgetData.load() ?? WidgetData.placeholder

        guard let next = data.nextUp(now: now) else {
            completion(Timeline(entries: [makeEntry(at: now)], policy: .after(now.addingTimeInterval(900))))
            return
        }

        // The timer text ticks by itself once a second, so the only entry that has to
        // exist beyond "now" is the moment the h:m:s label collapses to m:s.
        var entries = [makeEntry(at: now)]
        let hourCrossing = next.date.addingTimeInterval(-3600)
        if hourCrossing > now {
            entries.append(makeEntry(at: hourCrossing))
        }

        completion(Timeline(entries: entries, policy: .after(next.date.addingTimeInterval(1))))
    }

    private func makeEntry(at date: Date) -> CountdownEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        guard let next = data.nextUp(now: date) else {
            return CountdownEntry(date: date, prayerName: "—",
                                  target: date.addingTimeInterval(1), showsHours: false)
        }
        return CountdownEntry(
            date: date,
            prayerName: next.name,
            target: next.date,
            showsHours: next.date.timeIntervalSince(date) >= 3600
        )
    }
}

struct CountdownView: View {
    let entry: CountdownEntry
    @Environment(\.widgetFamily) var family

    /// `Text(timerInterval:)` requires a non-empty range.
    private var interval: ClosedRange<Date> {
        entry.date...max(entry.target, entry.date.addingTimeInterval(1))
    }

    var body: some View {
        VStack(spacing: 4) {
            Text("TIME TO")
                .font(.system(size: 9, weight: .semibold))
                .tracking(2.5)
                .foregroundColor(.widgetMuted)

            Text(entry.prayerName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.widgetGold)

            Spacer().frame(height: 6)

            // Rendered and ticked by the system every second.
            Text(timerInterval: interval, countsDown: true, showsHours: entry.showsHours)
                .font(.system(size: family == .systemSmall ? 30 : 40,
                              weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundColor(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .multilineTextAlignment(.center)

            Text(entry.showsHours ? "h  :  m  :  s" : "m  :  s")
                .font(.system(size: 10))
                .tracking(1)
                .foregroundColor(.widgetMuted)
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        .description("Counts down to the next prayer, second by second.")
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
