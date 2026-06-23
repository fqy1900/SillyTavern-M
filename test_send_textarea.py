from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    print("=== Checking send_textarea Status ===")

    # Navigate to chat.html
    page.goto('http://localhost:8000/chat.html')
    page.wait_for_load_state('networkidle')

    # Check send_textarea placeholder
    send_textarea = page.locator('#send_textarea')
    print(f"send_textarea exists: {send_textarea.count() > 0}")

    if send_textarea.count() > 0:
        placeholder = send_textarea.get_attribute('placeholder')
        print(f"send_textarea placeholder: {placeholder}")

        no_connection_text = send_textarea.get_attribute('no_connection_text')
        connected_text = send_textarea.get_attribute('connected_text')
        print(f"no_connection_text attr: {no_connection_text}")
        print(f"connected_text attr: {connected_text}")

    # Check send_form classes
    send_form = page.locator('#send_form')
    if send_form.count() > 0:
        classes = send_form.get_attribute('class')
        print(f"send_form classes: {classes}")

    # Check online_status
    try:
        online_status = page.evaluate("() => window.online_status")
        print(f"window.online_status: {online_status}")
    except Exception as e:
        print(f"Cannot get window.online_status: {e}")

    # Check if connected
    try:
        ctx = page.evaluate("() => globalThis.SillyTavern?.getContext()?.online_status")
        print(f"ctx.online_status: {ctx}")
    except Exception as e:
        print(f"Cannot get ctx.online_status: {e}")

    print("=== Check Complete ===")

    browser.close()
