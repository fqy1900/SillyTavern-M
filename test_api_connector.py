"""
Test script for the API Connector feature in chat.html
"""
from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 60)
        print("Testing API Connector Feature")
        print("=" * 60)

        # 1. Navigate to chat.html
        print("\n[1] Navigating to /chat.html?char=Seraphina ...")
        page.goto('http://localhost:8000/chat.html?char=Seraphina')

        # Wait for page to load
        page.wait_for_load_state('networkidle')
        print(f"    Page title: {page.title()}")

        # 2. Check for the API connector toggle button
        print("\n[2] Checking for API Connector Toggle ...")
        api_toggle = page.query_selector('#apiConnectorToggle')
        if api_toggle:
            print(f"    ✓ #apiConnectorToggle found")
            print(f"      Title: {api_toggle.get_attribute('title')}")
            print(f"      Class: {api_toggle.get_attribute('class')}")
        else:
            print("    ✗ #apiConnectorToggle NOT found")

        # 3. Check for the dropdown container
        print("\n[3] Checking for API Connector Dropdown ...")
        api_dropdown = page.query_selector('#apiConnectorDropdown')
        if api_dropdown:
            print(f"    ✓ #apiConnectorDropdown found")
            display_style = api_dropdown.evaluate("el => window.getComputedStyle(el).display")
            print(f"      Display (should be 'none' initially): {display_style}")
        else:
            print("    ✗ #apiConnectorDropdown NOT found")

        # 4. Click the toggle button
        print("\n[4] Clicking toggle button ...")
        if api_toggle:
            api_toggle.click()
            time.sleep(1)

            # Check if dropdown is now visible
            if api_dropdown:
                display_style = api_dropdown.evaluate("el => window.getComputedStyle(el).display")
                print(f"    Dropdown display style: {display_style}")
                if display_style != 'none':
                    print(f"    ✓ Dropdown is visible")
                else:
                    print(f"    (Dropdown still hidden)")

        # 5. Check the dropdown items
        print("\n[5] Checking API dropdown items ...")
        items = page.query_selector_all('.api-dropdown-item')
        if items:
            print(f"    ✓ Found {len(items)} API items")
            for i, item in enumerate(items):
                api_key = item.get_attribute('data-api-key')
                text_span = item.query_selector('span')
                text = text_span.inner_text() if text_span else "N/A"
                print(f"      [{i}] data-api-key='{api_key}' -> {text}")
        else:
            print("    ✗ No API items found")

        # 6. Check send_textarea placeholder
        print("\n[6] Checking send_textarea placeholder ...")
        send_textarea = page.query_selector('#send_textarea')
        if send_textarea:
            placeholder = send_textarea.get_attribute('placeholder')
            print(f"    Placeholder: {placeholder}")
        else:
            print("    ✗ #send_textarea NOT found")

        # 7. Check send_form status (should have 'no-connection' class initially)
        print("\n[7] Checking send_form classes ...")
        send_form = page.query_selector('#send_form')
        if send_form:
            classes = send_form.get_attribute('class')
            print(f"    Classes: {classes}")
            if 'no-connection' in classes:
                print(f"    ✓ Form has 'no-connection' class (as expected before connecting)")
            else:
                print(f"    Form does not have 'no-connection' class (already connected?)")
        else:
            print("    ✗ #send_form NOT found")

        # 8. Try clicking on an API item to test connection
        print("\n[8] Testing API item click ...")
        if items and len(items) > 0:
            first_item = items[0]
            api_key = first_item.get_attribute('data-api-key')
            print(f"    Clicking on first API item: '{api_key}'")
            first_item.click()
            time.sleep(3)

            # Check if 'no-connection' class was removed
            send_form = page.query_selector('#send_form')
            if send_form:
                classes = send_form.get_attribute('class')
                print(f"    Form classes after click: {classes}")
                if 'no-connection' not in classes:
                    print(f"    ✓ API connection successful!")
                else:
                    print(f"    (Still showing 'no-connection' - API may not be configured)")

            # Check send_textarea placeholder after click
            send_textarea = page.query_selector('#send_textarea')
            if send_textarea:
                placeholder = send_textarea.get_attribute('placeholder')
                print(f"    Updated placeholder: {placeholder}")

        print("\n" + "=" * 60)
        print("Test completed - keeping browser open for 10 seconds")
        print("=" * 60)

        time.sleep(10)
        browser.close()

if __name__ == '__main__':
    main()
