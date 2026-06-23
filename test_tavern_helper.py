# Test script to check if TavernHelper (酒馆助手) is loaded in chat.html
import sys
sys.path.insert(0, 'scripts')

from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
        
        # Navigate to chat.html with character parameter
        page.goto('http://localhost:8000/chat.html?char=95%E5%90%8E%E5%AD%A6%E7%94%9F%E6%97%B6%E4%BB%A3%E6%A8%A1%E6%8B%9F%E5%99%A8')
        
        # Wait for SillyTavern to initialize
        page.wait_for_timeout(6000)
        
        # Check if TavernHelper is loaded
        tavern_helper = page.evaluate("() => typeof window.TavernHelper")
        print(f"TavernHelper type: {tavern_helper}")
        
        # Check if TavernHelper has any methods
        tavern_keys = page.evaluate("() => window.TavernHelper ? Object.keys(window.TavernHelper) : []")
        print(f"TavernHelper keys: {tavern_keys[:10]}")
        
        # Check if TavernHelper is an object with content
        tavern_helper_obj = page.evaluate("() => window.TavernHelper ? JSON.stringify(Object.keys(window.TavernHelper)) : 'null'")
        print(f"TavernHelper object keys: {tavern_helper_obj}")
        
        # Check console messages for TavernHelper
        tavern_console = [m for m in console_messages if 'tavern' in m.lower() or 'helper' in m.lower() or '酒馆' in m]
        print(f"\nConsole messages related to TavernHelper:")
        for msg in tavern_console[:10]:
            print(f"  {msg}")
        
        # Check for extension loading
        extension_console = [m for m in console_messages if 'extension' in m.lower() or '酒馆助手' in m.lower() or 'JS-Slash' in m]
        print(f"\nConsole messages related to extensions:")
        for msg in extension_console[:10]:
            print(f"  {msg}")
        
        # Check if TavernHelper Vue app is mounted
        tavern_vue = page.evaluate("() => document.querySelector('#tavern_helper') ? document.querySelector('#tavern_helper').innerHTML.slice(0, 200) : 'NOT FOUND'")
        print(f"\n#tavern_helper content: {tavern_vue[:200]}")
        
        # Check if TavernHelper has the slash command runner API
        has_runner = page.evaluate("() => window.TavernHelper && window.TavernHelper.Runner ? true : false")
        print(f"\nTavernHelper.Runner exists: {has_runner}")
        
        # Check chat messages for any rendered content
        messages = page.query_selector_all('.mes')
        print(f"\nChat messages count: {len(messages)}")
        if messages:
            last_msg = messages[-1]
            mes_text = last_msg.query_selector('.mes_text')
            if mes_text:
                print(f"Last message text: {mes_text.inner_text()[:100]}")
        
        browser.close()

if __name__ == '__main__':
    main()
