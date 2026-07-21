#!/usr/bin/env bash
#
# One-shot: build the Prayer Times app in the cloud and push it to TestFlight.
# Everything is already configured (bundle id com.badry.prayertimes, widget,
# App Group, EAS). You only need to type your passwords when prompted.
#
# Run it with:   bash ship-to-testflight.sh
#
set -uo pipefail
cd "$(dirname "$0")"
export PATH="/usr/local/bin:$PATH"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

echo ""
echo "==> 1/3  Expo login  (your free expo.dev account — email + password)"
npx eas whoami 2>/dev/null || npx eas login || { echo "Expo login failed"; exit 1; }

echo ""
echo "==> 2/3  Linking a fresh EAS project to your account"
npx eas init || { echo "eas init failed"; exit 1; }
# keep the git tree clean so the build doesn't stop to ask about the new projectId
git add -A && git commit -q -m "chore: link eas project id" 2>/dev/null || true

echo ""
echo "==> 3/3  Cloud build + auto-submit to TestFlight"
echo "         >>> You'll be asked to LOG IN TO APPLE here (Apple ID + password + 2FA). <<<"
echo "         EAS then creates your App IDs, App Group, certificates & profiles automatically."
npx eas build --platform ios --profile production --auto-submit || { echo "build/submit failed — paste the output to Claude"; exit 1; }

echo ""
echo "✅ Uploaded. In a few minutes it'll appear in App Store Connect → TestFlight,"
echo "   where you add yourself as an internal tester."
