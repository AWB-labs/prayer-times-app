import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Shared Data

private let appGroup = "group.com.badry.prayertimes"

/// The five obligatory prayers that can be checked off. Mirrors STREAK_PRAYERS
/// in src/context/PrayerLogContext.tsx — Sunrise is shown but never tracked.
private let trackablePrayers: Set<String> = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

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
            let defaults = UserDefaults(suiteName: appGroup),
            let data = defaults.data(forKey: "prayerData")
        else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    static var placeholder: WidgetData {
        let now = Date().timeIntervalSince1970
        return WidgetData(
            prayers: [
                WidgetPrayer(name: "Fajr", arabicName: "الفجر", time: "05:03", timestamp: now),
                WidgetPrayer(name: "Sunrise", arabicName: "الشروق", time: "06:29", timestamp: now),
                WidgetPrayer(name: "Dhuhr", arabicName: "الظهر", time: "12:10", timestamp: now),
                WidgetPrayer(name: "Asr", arabicName: "العصر", time: "15:38", timestamp: now),
                WidgetPrayer(name: "Maghrib", arabicName: "المغرب", time: "17:51", timestamp: now),
                WidgetPrayer(name: "Isha", arabicName: "العشاء", time: "19:21", timestamp: now),
            ],
            nextPrayerIndex: 2,
            nextPrayerName: "Dhuhr",
            nextPrayerTimestamp: now + 3600,
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

/// One line of the schedule, resolved against the clock and the check-off log.
struct ScheduleRow: Identifiable {
    let id: String
    let name: String
    let arabicName: String
    let time: String
    let date: Date
    let isNext: Bool
    let isPast: Bool
    let isTrackable: Bool
    let isDone: Bool
}

extension WidgetData {
    private func occurrence(of time: String, on day: Date) -> Date? {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day)
    }

    /// Today's prayers paired with their wall-clock occurrence, in time order.
    private func todayOccurrences(now: Date) -> [(prayer: WidgetPrayer, date: Date)] {
        prayers
            .compactMap { p in occurrence(of: p.time, on: now).map { (prayer: p, date: $0) } }
            .sorted { $0.date < $1.date }
    }

    /// The interval currently being counted down: the prayer just gone through to
    /// the one coming up. `start` is what lets the progress strip show how much of
    /// the gap has elapsed rather than just how much time is left.
    func window(now: Date = Date()) -> (start: Date, next: ResolvedPrayer)? {
        let today = todayOccurrences(now: now)
        guard !today.isEmpty else { return nil }

        func resolve(_ p: WidgetPrayer, _ d: Date) -> ResolvedPrayer {
            ResolvedPrayer(name: p.name, arabicName: p.arabicName, time: p.time, date: d)
        }

        if let index = today.firstIndex(where: { $0.date > now }) {
            let upcoming = today[index]
            let start: Date
            if index > 0 {
                start = today[index - 1].date
            } else if
                let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now),
                let last = today.last.flatMap({ occurrence(of: $0.prayer.time, on: yesterday) }) {
                // Before the first prayer of the day, the gap opened last night.
                start = last
            } else {
                start = now
            }
            return (start, resolve(upcoming.prayer, upcoming.date))
        }

        // Every prayer for today has passed — wrap to tomorrow's first one.
        guard
            let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now),
            let first = today.first,
            let at = occurrence(of: first.prayer.time, on: tomorrow)
        else { return nil }
        return (today[today.count - 1].date, resolve(first.prayer, at))
    }

    /// The stored `nextPrayerIndex` is only accurate as of the last time the app
    /// ran, so the next prayer is always re-derived from the clock times instead.
    func nextUp(now: Date = Date()) -> ResolvedPrayer? {
        window(now: now)?.next
    }

    func rows(now: Date, log: [String: [String: Bool]], day: String) -> [ScheduleRow] {
        let today = todayOccurrences(now: now)
        let nextDate = today.first(where: { $0.date > now })?.date
        return today.map { entry in
            let trackable = trackablePrayers.contains(entry.prayer.name)
            return ScheduleRow(
                id: entry.prayer.name,
                name: entry.prayer.name,
                arabicName: entry.prayer.arabicName,
                time: entry.prayer.time,
                date: entry.date,
                isNext: entry.date == nextDate,
                isPast: entry.date <= now,
                isTrackable: trackable,
                isDone: trackable && (log[day]?[entry.prayer.name] ?? false)
            )
        }
    }
}

// MARK: - Check-off Log

/// Read/write access to the shared check-off log.
///
/// The app keeps this log in AsyncStorage, which is private to the app process,
/// so it is mirrored into the App Group for the widget to see. Both sides write
/// here: the app on every toggle, the widget through `TogglePrayerIntent`.
enum PrayerLogStore {
    private static let key = "prayerLog"

    /// Parsed leniently rather than through Codable: the app writes this via
    /// JSONSerialization across the JS bridge, where booleans can arrive as
    /// numbers. A strict decode would fail and silently blank every checkmark.
    static func load() -> [String: [String: Bool]] {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let data = defaults.data(forKey: key),
            let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }

        var log: [String: [String: Bool]] = [:]
        for (day, value) in raw {
            guard let entries = value as? [String: Any] else { continue }
            var completed: [String: Bool] = [:]
            for (prayer, flag) in entries {
                if let bool = flag as? Bool {
                    completed[prayer] = bool
                } else if let number = flag as? NSNumber {
                    completed[prayer] = number.boolValue
                }
            }
            log[day] = completed
        }
        return log
    }

    static func toggle(prayer: String, day: String) {
        var log = load()
        var completed = log[day] ?? [:]
        completed[prayer] = !(completed[prayer] ?? false)
        log[day] = completed

        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let data = try? JSONSerialization.data(withJSONObject: log)
        else { return }
        defaults.set(data, forKey: key)
    }

    static func doneCount(on day: String, log: [String: [String: Bool]]) -> Int {
        trackablePrayers.filter { log[day]?[$0] == true }.count
    }
}

/// Local calendar day key, matching getDateString() in src/hooks/useStreak.ts.
func dayKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

// MARK: - Toggle Intent

/// Flips one prayer's completed state straight from the home screen. Runs in the
/// widget process, so it writes to the App Group rather than going through the app.
struct TogglePrayerIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Prayer"
    static var description = IntentDescription("Marks a prayer as completed or not.")
    /// Keep it out of Shortcuts — it only makes sense as a widget tap.
    static var isDiscoverable: Bool = false

    @Parameter(title: "Prayer")
    var prayer: String

    @Parameter(title: "Day")
    var day: String

    init() {}

    init(prayer: String, day: String) {
        self.prayer = prayer
        self.day = day
    }

    func perform() async throws -> some IntentResult {
        PrayerLogStore.toggle(prayer: prayer, day: day)
        // The tapped widget refreshes itself; this pulls the other kinds along so
        // a check made on one widget shows up on all of them.
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Colors

extension Color {
    static let widgetGold    = Color(red: 201/255, green: 162/255, blue: 39/255)
    static let widgetSubtext = Color.white.opacity(0.55)
    static let widgetMuted   = Color.white.opacity(0.30)
    static let widgetHairline = Color.white.opacity(0.10)
}

// MARK: - Formatters

private func formatTime(_ timeStr: String) -> String {
    let parts = timeStr.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return timeStr }
    let h = parts[0], m = parts[1]
    let period = h >= 12 ? "PM" : "AM"
    let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
    return String(format: "%d:%02d %@", h12, m, period)
}

/// Widgets that list prayers only go stale at a prayer boundary or at midnight,
/// when the day's checkmarks reset.
private func nextRefresh(after now: Date, next: Date?) -> Date {
    let calendar = Calendar.current
    let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
        ?? now.addingTimeInterval(3600)
    if let next = next, next < midnight { return next.addingTimeInterval(1) }
    return midnight.addingTimeInterval(1)
}

// MARK: - Shared Components

/// Section label — the small tracked caps used across every widget.
struct WidgetLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 9, weight: .semibold))
            .tracking(2.5)
            .foregroundColor(.widgetMuted)
    }
}

/// Progress strip across the gap between the last prayer and the next one.
///
/// `ProgressView(timerInterval:)` is advanced by the system, so the bar creeps
/// forward on its own without the widget being reloaded.
struct CountdownStrip: View {
    let start: Date
    let end: Date
    var showsEndpoints: Bool = true

    private var range: ClosedRange<Date> {
        let safeStart = min(start, end.addingTimeInterval(-1))
        return safeStart...end
    }

    var body: some View {
        VStack(spacing: 4) {
            ProgressView(timerInterval: range, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.linear)
            .tint(.widgetGold)

            if showsEndpoints {
                HStack {
                    Text(formatTime(clockString(start)))
                    Spacer()
                    Text(formatTime(clockString(end)))
                }
                .font(.system(size: 9))
                .foregroundColor(.widgetMuted)
            }
        }
    }

    private func clockString(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }
}

/// The Lock Screen counterpart of `CountdownStrip`: same self-advancing bar,
/// without the gold tint or the endpoint labels. `.vibrant` flattens the tint
/// into the same wash as the text, and an accessory widget has no height to
/// spare for a row of endpoints.
struct AccessoryCountdownBar: View {
    let start: Date
    let end: Date

    private var range: ClosedRange<Date> {
        min(start, end.addingTimeInterval(-1))...end
    }

    var body: some View {
        ProgressView(timerInterval: range, countsDown: false) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
    }
}

/// Tappable check circle. Sunrise isn't a prayer to be completed, so it gets an
/// inert sun glyph instead — the column stays aligned without inviting a tap.
struct PrayerCheckButton: View {
    let row: ScheduleRow
    let day: String
    var size: CGFloat = 20

    var body: some View {
        if row.isTrackable {
            Button(intent: TogglePrayerIntent(prayer: row.name, day: day)) {
                Image(systemName: row.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: size, weight: .medium))
                    .foregroundStyle(row.isDone ? Color.widgetGold : Color.white.opacity(0.25))
            }
            .buttonStyle(.plain)
        } else {
            Image(systemName: "sun.max")
                .font(.system(size: size * 0.7))
                .foregroundStyle(Color.white.opacity(0.15))
                .frame(width: size, height: size)
        }
    }
}

/// One prayer line: name (and Arabic) on the left, time then check on the right.
struct PrayerRowView: View {
    let row: ScheduleRow
    let day: String
    var showsArabic: Bool = true
    var checkSize: CGFloat = 20

    private var nameColor: Color {
        if row.isNext { return .widgetGold }
        return row.isPast ? .widgetSubtext : .white
    }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text(row.name)
                    .font(.system(size: 14, weight: row.isNext ? .bold : .medium))
                    .foregroundColor(nameColor)
                if showsArabic {
                    Text(row.arabicName)
                        .font(.system(size: 9))
                        .foregroundColor(.widgetMuted)
                }
            }

            Spacer(minLength: 4)

            Text(formatTime(row.time))
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundColor(row.isNext ? .widgetGold : .widgetSubtext)

            PrayerCheckButton(row: row, day: day, size: checkSize)
        }
        .opacity(row.isPast && !row.isNext && !row.isDone ? 0.65 : 1)
    }
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

/// Lock Screen renditions of the next prayer.
///
/// These are deliberately colourless: the Lock Screen renders widgets in
/// `.vibrant` mode, which flattens every colour into a single monochrome mask,
/// so `.widgetGold` would come out the same wash of white as the body text.
/// Hierarchy comes from weight and `.secondary` instead.
struct NextPrayerAccessoryView: View {
    let entry: NextPrayerEntry
    let family: WidgetFamily

    var body: some View {
        switch family {
        case .accessoryInline:
            // One line, one optional glyph — anything richer is dropped silently.
            Label("\(entry.prayerName) \(formatTime(entry.prayerTime))",
                  systemImage: "moon.stars")

        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text(entry.prayerName)
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    // 24h here rather than the app's 12h: "12:10 PM" cannot be
                    // read at the size this circle allows.
                    Text(entry.prayerTime)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .padding(5)
            }
            .containerBackground(for: .widget) { Color.clear }

        default:
            VStack(alignment: .leading, spacing: 1) {
                Text("NEXT PRAYER")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(.secondary)
                Text(entry.prayerName)
                    .font(.system(size: 17, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(formatTime(entry.prayerTime))
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(for: .widget) { Color.clear }
        }
    }
}

struct NextPrayerView: View {
    let entry: NextPrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryInline, .accessoryCircular, .accessoryRectangular:
            NextPrayerAccessoryView(entry: entry, family: family)
        default:
            homeScreenView
        }
    }

    private var homeScreenView: some View {
        VStack(spacing: 4) {
            WidgetLabel(text: "NEXT PRAYER")

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
        .padding(12)
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
        .supportedFamilies([.systemSmall, .systemMedium,
                            .accessoryCircular, .accessoryRectangular, .accessoryInline])
        // The system's default content margins (~16pt a side) leave these dense
        // layouts too little height, which makes SwiftUI squeeze the text and clip
        // the glyph tops. Each view sets its own tighter padding instead.
        .contentMarginsDisabled()
    }
}

// MARK: - Countdown Widget

struct CountdownEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let start: Date
    let target: Date
    /// Whether more than an hour is left as of `date` — drives the h/m/s labelling.
    let showsHours: Bool
    /// The prayer's wall-clock time, carried through as the stored "HH:mm" and
    /// deliberately not passed through `formatTime`: "12:10 PM" is eight glyphs
    /// where "12:10" is five, and the accessory families are width-bound.
    let clock24: String

    /// Three letters is all that stays readable under a circular accessory's
    /// clock line. Every prayer name is still distinct at three: FAJ SUN DHU
    /// ASR MAG ISH.
    var abbrev: String { String(prayerName.prefix(3)).uppercased() }
}

struct CountdownProvider: TimelineProvider {
    func placeholder(in context: Context) -> CountdownEntry {
        let now = Date()
        return CountdownEntry(date: now, prayerName: "Dhuhr",
                              start: now.addingTimeInterval(-1800),
                              target: now.addingTimeInterval(3720), showsHours: true,
                              clock24: "12:10")
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

        // The timer text and the strip both advance by themselves, so the only
        // entry needed beyond "now" is where the h:m:s label collapses to m:s.
        var entries = [makeEntry(at: now)]
        let hourCrossing = next.date.addingTimeInterval(-3600)
        if hourCrossing > now {
            entries.append(makeEntry(at: hourCrossing))
        }

        completion(Timeline(entries: entries, policy: .after(next.date.addingTimeInterval(1))))
    }

    private func makeEntry(at date: Date) -> CountdownEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        guard let window = data.window(now: date) else {
            return CountdownEntry(date: date, prayerName: "—", start: date,
                                  target: date.addingTimeInterval(1), showsHours: false,
                                  clock24: "--:--")
        }
        return CountdownEntry(
            date: date,
            prayerName: window.next.name,
            start: window.start,
            target: window.next.date,
            // Strictly greater, not >=. The T-60 timeline entry is generated at
            // exactly `target - 3600`, so `>=` would still be true there and that
            // entry would be byte-identical to the "now" one — the label would
            // never collapse to m:s, and the circular Glance widget (which picks
            // its layout off this flag) would never show its countdown at all.
            showsHours: window.next.date.timeIntervalSince(date) > 3600,
            clock24: window.next.time
        )
    }
}

/// Lock Screen renditions of the countdown.
///
/// Both the ring and the digits are advanced by the system, so these stay live
/// on the Lock Screen without the widget being reloaded — which matters, since
/// accessory widgets draw from the same refresh budget as the home screen ones.
struct CountdownAccessoryView: View {
    let entry: CountdownEntry
    let family: WidgetFamily

    /// `Text(timerInterval:)` requires a non-empty range.
    private var remaining: ClosedRange<Date> {
        entry.date...max(entry.target, entry.date.addingTimeInterval(1))
    }

    /// The whole gap between prayers — what the ring fills across.
    private var window: ClosedRange<Date> {
        min(entry.start, entry.target.addingTimeInterval(-1))...entry.target
    }

    var body: some View {
        switch family {
        case .accessoryInline:
            Label {
                Text(timerInterval: remaining, countsDown: true, showsHours: entry.showsHours)
            } icon: {
                Image(systemName: "timer")
            }

        case .accessoryCircular:
            // The ring's own track reads well enough on its own, so no
            // AccessoryWidgetBackground plate behind it here.
            ProgressView(timerInterval: window, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                Text(timerInterval: remaining, countsDown: true, showsHours: entry.showsHours)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            .progressViewStyle(.circular)
            .containerBackground(for: .widget) { Color.clear }

        default:
            VStack(alignment: .leading, spacing: 2) {
                Text("TIME TO \(entry.prayerName.uppercased())")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(timerInterval: remaining, countsDown: true, showsHours: entry.showsHours)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)

                // Not CountdownStrip: that one tints gold, which `.vibrant`
                // flattens into the same wash as the text on the Lock Screen.
                AccessoryCountdownBar(start: entry.start, end: entry.target)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(for: .widget) { Color.clear }
        }
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
        switch family {
        case .accessoryInline, .accessoryCircular, .accessoryRectangular:
            CountdownAccessoryView(entry: entry, family: family)
        default:
            homeScreenView
        }
    }

    private var homeScreenView: some View {
        VStack(spacing: 4) {
            WidgetLabel(text: "TIME TO")

            Text(entry.prayerName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.widgetGold)

            Spacer().frame(height: 4)

            // Rendered and ticked by the system every second.
            Text(timerInterval: interval, countsDown: true, showsHours: entry.showsHours)
                .font(.system(size: family == .systemSmall ? 28 : 38,
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

            Spacer().frame(height: 2)

            CountdownStrip(start: entry.start, end: entry.target,
                           showsEndpoints: family != .systemSmall)
        }
        .padding(.horizontal, family == .systemSmall ? 12 : 16)
        .padding(.vertical, 10)
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
        .supportedFamilies([.systemSmall, .systemMedium,
                            .accessoryCircular, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

// MARK: - Glance Widget (name + clock + countdown together)

/// Lock Screen renditions that carry the prayer's name, its wall-clock time and
/// a live countdown at the same time — the thing neither "Next Prayer" nor
/// "Prayer Countdown" can do alone.
///
/// Colourless on purpose, like the other accessory views: `.vibrant` collapses
/// every colour into one monochrome mask, so weight and `.secondary` are the
/// only hierarchy available.
struct GlanceAccessoryView: View {
    let entry: CountdownEntry
    let family: WidgetFamily

    /// `Text(timerInterval:)` renders nothing at all for an empty or inverted
    /// range, so the end is forced past the start.
    private var remaining: ClosedRange<Date> {
        entry.date...max(entry.target, entry.date.addingTimeInterval(1))
    }

    /// The whole gap between prayers — what the ring and the bar fill across.
    private var window: ClosedRange<Date> {
        min(entry.start, entry.target.addingTimeInterval(-1))...entry.target
    }

    /// One string carrying both static and live content. `accessoryInline` draws
    /// a single `Text` and drops anything else in the hierarchy, so the countdown
    /// has to be spliced into the same string as the name and the clock — which
    /// only `LocalizedStringKey` interpolation can do, hence the explicit type.
    /// "Maghrib 17:51 · 1:23:45" is 23 of the ~26 characters this family renders.
    private var inlineSummary: LocalizedStringKey {
        "\(entry.prayerName) \(entry.clock24) · \(timerInterval: remaining, countsDown: true, showsHours: entry.showsHours)"
    }

    var body: some View {
        switch family {
        case .accessoryInline:
            // Name first: the system truncates the tail, not the head.
            Label {
                Text(inlineSummary)
            } icon: {
                Image(systemName: "moon.stars")
            }
            .containerBackground(for: .widget) { Color.clear }

        case .accessoryCircular:
            // The circle clips to its inscribed square, leaving roughly 40pt for
            // content. A full H:MM:SS needs 11.3pt there — exactly the size below
            // which HIG says accessory text stops being readable — and this app
            // hits H:MM:SS constantly (Isha 19:21 to Fajr 05:03 is 9h42m). So the
            // two halves take turns: while more than an hour is left the ring
            // carries the countdown and the digits carry the clock; inside the
            // final hour MM:SS is short enough to sit above the clock. The T-60min
            // entry CountdownProvider already emits is what flips this, for free.
            ZStack {
                ProgressView(timerInterval: window, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.circular)

                VStack(spacing: 0) {
                    if entry.showsHours {
                        Text(entry.clock24)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Text(entry.abbrev)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    } else {
                        Text(timerInterval: remaining, countsDown: true, showsHours: false)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Text(entry.clock24)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
                .lineLimit(1)
                // 0.8 x 14pt = 11.2pt. Any lower and SwiftUI would shrink the
                // digits under the 11pt floor rather than leave them alone.
                .minimumScaleFactor(0.8)
                .frame(width: 40, height: 40)
            }
            // No AccessoryWidgetBackground: the ring's own track already reads
            // as a plate, and a second one behind it muddies the vibrancy.
            .containerBackground(for: .widget) { Color.clear }

        default:
            // Three separate `Text`s rather than one wrapping string: a single
            // multi-line Text in this family truncates at two lines even when
            // there is room (FB20766506, open as of iOS 26).
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(entry.prayerName.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.8)
                    Spacer(minLength: 2)
                    Text(entry.clock24)
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                }
                .foregroundStyle(.secondary)
                .lineLimit(1)

                // 26pt x HH:MM:SS is about 108pt wide, inside the 153pt this
                // family gets on the narrowest supported screen.
                Text(timerInterval: remaining, countsDown: true, showsHours: entry.showsHours)
                    .font(.system(size: 26, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                AccessoryCountdownBar(start: entry.start, end: entry.target)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .containerBackground(for: .widget) { Color.clear }
        }
    }
}

struct GlanceView: View {
    let entry: CountdownEntry
    @Environment(\.widgetFamily) var family

    /// `Text(timerInterval:)` requires a non-empty range.
    private var remaining: ClosedRange<Date> {
        entry.date...max(entry.target, entry.date.addingTimeInterval(1))
    }

    var body: some View {
        switch family {
        case .accessoryInline, .accessoryCircular, .accessoryRectangular:
            GlanceAccessoryView(entry: entry, family: family)
        default:
            homeScreenView
        }
    }

    /// The home screen is not vibrant, so the clock can take the gold and read as
    /// the fixed fact while the countdown stays white and moving.
    private var homeScreenView: some View {
        VStack(spacing: 4) {
            WidgetLabel(text: "NEXT PRAYER")

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(entry.prayerName)
                    .font(.system(size: family == .systemSmall ? 17 : 21, weight: .bold))
                    .foregroundColor(.white)
                Text(formatTime(entry.clock24))
                    .font(.system(size: family == .systemSmall ? 13 : 15,
                                  weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(.widgetGold)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.6)

            Text(timerInterval: remaining, countsDown: true, showsHours: entry.showsHours)
                .font(.system(size: family == .systemSmall ? 30 : 40,
                              weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundColor(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)

            CountdownStrip(start: entry.start, end: entry.target,
                           showsEndpoints: family != .systemSmall)
        }
        .padding(.horizontal, family == .systemSmall ? 12 : 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(.black, for: .widget)
    }
}

struct NextPrayerCountdownWidget: Widget {
    let kind = "NextPrayerCountdownWidget"
    var body: some WidgetConfiguration {
        // CountdownProvider already emits exactly the timeline this needs — an
        // entry at "now", one at T-60min where the h:m:s label collapses and the
        // circular layout switches, and a reload a second after the prayer lands.
        // A second provider would re-derive the same window for no benefit.
        StaticConfiguration(kind: kind, provider: CountdownProvider()) { entry in
            GlanceView(entry: entry)
        }
        .configurationDisplayName("Prayer at a Glance")
        // Deliberately not promising digits "at once" everywhere: the circular
        // family has room for one numeric line, so outside the final hour it
        // carries the clock time and the ring carries the progress. The
        // rectangular and inline families do show both together.
        .description("The next prayer, its time and how long is left.")
        .supportedFamilies([.systemSmall, .systemMedium,
                            .accessoryCircular, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

// MARK: - Schedule Entry (shared by the checklist and schedule widgets)

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let day: String
    let rows: [ScheduleRow]
    let next: ResolvedPrayer?
    let windowStart: Date
    let doneCount: Int

    var trackedRows: [ScheduleRow] { rows.filter { $0.isTrackable } }
}

struct ScheduleProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleEntry {
        makeEntry(at: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (ScheduleEntry) -> Void) {
        completion(makeEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScheduleEntry>) -> Void) {
        let now = Date()
        let entry = makeEntry(at: now)

        // A second entry at T-60, matching CountdownProvider. `showsHours` is
        // derived from the entry's own date, so with a single entry it would be
        // frozen for the whole window and the last hour would render as
        // "0:03:00" instead of "03:00".
        var entries = [entry]
        if let next = entry.next {
            let hourCrossing = next.date.addingTimeInterval(-3600)
            if hourCrossing > now {
                entries.append(makeEntry(at: hourCrossing))
            }
        }

        completion(Timeline(entries: entries,
                            policy: .after(nextRefresh(after: now, next: entry.next?.date))))
    }

    private func makeEntry(at date: Date) -> ScheduleEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let log = PrayerLogStore.load()
        let day = dayKey(date)
        let window = data.window(now: date)
        return ScheduleEntry(
            date: date,
            day: day,
            rows: data.rows(now: date, log: log, day: day),
            next: window?.next,
            windowStart: window?.start ?? date,
            doneCount: PrayerLogStore.doneCount(on: day, log: log)
        )
    }
}

// MARK: - Checklist Widget

struct ChecklistView: View {
    let entry: ScheduleEntry
    @Environment(\.widgetFamily) var family

    private var isSmall: Bool { family == .systemSmall }

    var body: some View {
        VStack(alignment: .leading, spacing: isSmall ? 4 : 5) {
            HStack {
                WidgetLabel(text: "TODAY")
                Spacer()
                Text("\(entry.doneCount)/5")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(entry.doneCount == 5 ? .widgetGold : .widgetSubtext)
            }

            ForEach(entry.trackedRows) { row in
                if isSmall {
                    // No room for Arabic or a time column at this size.
                    HStack(spacing: 6) {
                        Text(row.name)
                            .font(.system(size: 13, weight: row.isNext ? .bold : .medium))
                            .foregroundColor(row.isNext ? .widgetGold : (row.isPast ? .widgetSubtext : .white))
                        Spacer(minLength: 2)
                        PrayerCheckButton(row: row, day: entry.day, size: 17)
                    }
                } else {
                    PrayerRowView(row: row, day: entry.day, showsArabic: false, checkSize: 19)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .containerBackground(.black, for: .widget)
    }
}

struct PrayerChecklistWidget: Widget {
    let kind = "PrayerChecklistWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScheduleProvider()) { entry in
            ChecklistView(entry: entry)
        }
        .configurationDisplayName("Prayer Checklist")
        .description("Tap to mark each prayer as done, straight from the home screen.")
        // Home screen only, on purpose: this widget is nothing but tap targets,
        // and a tap on a Lock Screen accessory widget unlocks into the app
        // rather than running the intent. See PrayerScheduleWidget too.
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Schedule Widget

/// Lock Screen rendition of the day's schedule.
///
/// No check circles here, unlike every home screen schedule layout: a tap on a
/// Lock Screen accessory widget unlocks into the app rather than running the
/// intent, so the column would be dead weight in space this family cannot spare.
struct ScheduleAccessoryView: View {
    let entry: ScheduleEntry
    let family: WidgetFamily

    /// `Text(timerInterval:)` requires a non-empty range.
    private var remaining: ClosedRange<Date>? {
        guard let next = entry.next else { return nil }
        return entry.date...max(next.date, entry.date.addingTimeInterval(1))
    }

    private var showsHours: Bool {
        guard let next = entry.next else { return false }
        return next.date.timeIntervalSince(entry.date) > 3600
    }

    /// The next four prayers, wrapping round to the top of the list once the day
    /// has run out — otherwise the widget would sit empty between Isha and
    /// midnight, which is exactly when someone checks when Fajr is.
    private var upcoming: [ScheduleRow] {
        let ahead = entry.rows.filter { !$0.isPast }
        if ahead.count >= 4 { return Array(ahead.prefix(4)) }
        return Array((ahead + entry.rows).prefix(4))
    }

    var body: some View {
        switch family {
        case .accessoryInline:
            // Names are cut to three letters. Spelled out, two prayers run to 26
            // characters and up to 29 for "Maghrib 17:51 · Sunrise 06:29", past
            // the ~22-24 the inline slot fits once the glyph is placed — and the
            // part that truncates is the second time, the only thing this widget
            // adds over the other inline layouts. Abbreviated it is 21.
            Label {
                Text(upcoming.prefix(2)
                    .map { "\($0.name.prefix(3)) \($0.time)" }
                    .joined(separator: " · "))
            } icon: {
                Image(systemName: "list.bullet")
            }
            .containerBackground(for: .widget) { Color.clear }

        default:
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text((entry.next?.name ?? "Today").uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.8)
                    Spacer(minLength: 2)
                    if let remaining = remaining {
                        Text(timerInterval: remaining, countsDown: true, showsHours: showsHours)
                            .font(.system(size: 11, weight: .semibold))
                            .monospacedDigit()
                    }
                }
                .foregroundStyle(.secondary)
                .lineLimit(1)

                // Four columns, not all six: the narrowest supported rectangular
                // accessory is 153pt, which divides into 38pt columns, and "17:51"
                // already wants 35pt of that at 13pt. Six columns would force
                // 9.6pt type, well under the 11pt legibility floor.
                // Indexed rather than keyed off ScheduleRow.id: the wrap into
                // tomorrow can repeat a name, and a duplicated ForEach id makes
                // SwiftUI drop the row.
                HStack(alignment: .top, spacing: 2) {
                    ForEach(upcoming.indices, id: \.self) { index in
                        let row = upcoming[index]
                        VStack(spacing: 0) {
                            Text(String(row.name.prefix(3)).uppercased())
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.secondary)
                            // 24h rather than the app's 12h: "5:38 PM" is half
                            // again as wide as "17:38" and the column has no slack.
                            Text(row.time)
                                .font(.system(size: 13,
                                              weight: index == 0 ? .bold : .medium,
                                              design: .rounded))
                                .monospacedDigit()
                        }
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .frame(maxWidth: .infinity)
                    }
                }

                AccessoryCountdownBar(start: entry.windowStart,
                                      end: entry.next?.date ?? entry.date.addingTimeInterval(1))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .containerBackground(for: .widget) { Color.clear }
        }
    }
}

struct ScheduleView: View {
    let entry: ScheduleEntry
    @Environment(\.widgetFamily) var family

    /// `Text(timerInterval:)` requires a non-empty range.
    private var interval: ClosedRange<Date>? {
        guard let next = entry.next else { return nil }
        return entry.date...max(next.date, entry.date.addingTimeInterval(1))
    }

    private var showsHours: Bool {
        guard let next = entry.next else { return false }
        return next.date.timeIntervalSince(entry.date) > 3600
    }

    var body: some View {
        switch family {
        case .accessoryInline, .accessoryRectangular:
            ScheduleAccessoryView(entry: entry, family: family)
        default:
            homeScreenView
        }
    }

    private var homeScreenView: some View {
        Group {
            if family == .systemLarge {
                largeLayout
            } else {
                mediumLayout
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .containerBackground(.black, for: .widget)
    }

    // Wide: countdown banner on top, the whole day spread across the bottom.
    private var mediumLayout: some View {
        VStack(spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    WidgetLabel(text: "NEXT")
                    Text(entry.next?.name ?? "—")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.widgetGold)
                }

                Spacer(minLength: 4)

                if let interval = interval {
                    Text(timerInterval: interval, countsDown: true, showsHours: showsHours)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                }
            }

            CountdownStrip(start: entry.windowStart,
                           end: entry.next?.date ?? entry.date.addingTimeInterval(1),
                           showsEndpoints: false)

            Divider().overlay(Color.widgetHairline)

            // Six columns — the day at a glance without needing to scroll.
            HStack(alignment: .top, spacing: 0) {
                ForEach(entry.rows) { row in
                    VStack(spacing: 2) {
                        Text(row.name)
                            .font(.system(size: 10, weight: row.isNext ? .bold : .medium))
                            .foregroundColor(row.isNext ? .widgetGold : .widgetSubtext)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)

                        Text(formatTime(row.time))
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .foregroundColor(row.isNext ? .white : .widgetSubtext)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)

                        // Tappable here too — the column is wide enough to hit.
                        PrayerCheckButton(row: row, day: entry.day, size: 15)
                    }
                    .frame(maxWidth: .infinity)
                    .opacity(row.isPast && !row.isNext ? 0.6 : 1)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    // Big square: full countdown header, then every prayer as a checkable row.
    private var largeLayout: some View {
        VStack(spacing: 6) {
            VStack(spacing: 2) {
                WidgetLabel(text: "TIME TO \(entry.next?.name.uppercased() ?? "PRAYER")")

                if let interval = interval {
                    Text(timerInterval: interval, countsDown: true, showsHours: showsHours)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                }

                Text(entry.next?.arabicName ?? "")
                    .font(.system(size: 13))
                    .foregroundColor(.widgetSubtext)
            }

            CountdownStrip(start: entry.windowStart,
                           end: entry.next?.date ?? entry.date.addingTimeInterval(1))

            Divider().overlay(Color.widgetHairline)

            VStack(spacing: 4) {
                ForEach(entry.rows) { row in
                    PrayerRowView(row: row, day: entry.day)
                }
            }

            Spacer(minLength: 0)

            HStack(spacing: 5) {
                Image(systemName: entry.doneCount == 5 ? "checkmark.seal.fill" : "checkmark.circle")
                    .font(.system(size: 11))
                    .foregroundStyle(entry.doneCount == 5 ? Color.widgetGold : Color.widgetMuted)
                Text("\(entry.doneCount) of 5 completed today")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(entry.doneCount == 5 ? .widgetGold : .widgetMuted)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

struct PrayerScheduleWidget: Widget {
    let kind = "PrayerScheduleWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScheduleProvider()) { entry in
            ScheduleView(entry: entry)
        }
        .configurationDisplayName("Prayer Schedule")
        .description("Every prayer time for today with a countdown to the next one.")
        // No .accessoryCircular: the ~40pt square inside the ring holds one
        // prayer at best, which is what "Prayer at a Glance" is already for.
        .supportedFamilies([.systemMedium, .systemLarge,
                            .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

// MARK: - Bundle Entry Point

@main
struct PrayerTimesWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        CountdownWidget()
        NextPrayerCountdownWidget()
        PrayerChecklistWidget()
        PrayerScheduleWidget()
    }
}
