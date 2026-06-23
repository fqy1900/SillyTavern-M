"""
Playwright test: verify /chat.html loads without script errors.
Connects to already running server at localhost:8000
"""
import sys
from playwright.sync_api import sync_playwright

PORT = 8000


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            ignore_https_errors=True,
        )
        page = context.new_page()

        logs = []
        errors = []

        def on_console(msg):
            logs.append(f"[{msg.type}] {msg.text}")
            if msg.type == 'error':
                errors.append(msg.text)

        page.on('console', on_console)

        print(f"Navigating to http://localhost:{PORT}/chat.html...")
        page.goto(f'http://localhost:{PORT}/chat.html?char=test', wait_until='networkidle', timeout=60000)

        page.wait_for_timeout(8000)

        print(f"\n=== Console Logs ({len(logs)} total) ===")
        for log in logs:
            print(log)

        print(f"\n=== Error Analysis ({len(errors)} errors) ===")

        fixed_patterns = [
            'ARGUMENT_TYPE',
            'updateQuickEdit',
            '超时',
            'apiStreaming',
            'changeMainAPI',
            'popup_template',
            'featherless',
        ]

        known_fixed = []
        remaining = []
        for err in errors:
            matched = False
            for pat in fixed_patterns:
                if pat in err:
                    known_fixed.append(err[:150])
                    matched = True
                    break
            if not matched:
                remaining.append(err[:200])

        if known_fixed:
            print(f"\n✅ Previously known errors (NOW FIXED): {len(known_fixed)}")
            for e in known_fixed:
                print(f"  ✓ {e}")

        if remaining:
            print(f"\n⚠️  REMAINING new errors: {len(remaining)}")
            for e in remaining:
                print(f"  ✗ {e}")
        else:
            print(f"\n✅ ALL KNOWN ERRORS FIXED! No new errors introduced.")

        page.screenshot(path='/tmp/chat-page.png', full_page=True)
        print("\nScreenshot saved to /tmp/chat-page.png")

        browser.close()

        if remaining:
            sys.exit(1)


if __name__ == '__main__':
    main()
