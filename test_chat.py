"""
测试 chat.html 页面，检查控制台错误
"""
from playwright.sync_api import sync_playwright
import time

errors = []
warnings = []
logs = []

def handle_console(msg):
    if msg.type == 'error':
        errors.append(msg.text)
    elif msg.type == 'warning':
        warnings.append(msg.text)
    else:
        logs.append(msg.text)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # 监听控制台消息
    page.on('console', handle_console)

    # 导航到 chat.html
    print("Navigating to chat.html...")
    page.goto('http://localhost:8000/chat.html?t=playwright-test')

    # 等待页面加载
    print("Waiting for page to load...")
    time.sleep(12)

    # 获取页面标题
    title = page.title()
    print(f"Page title: {title}")

    # 检查页面状态
    heading = page.locator('h2').first
    if heading:
        print(f"Page heading: {heading.text_content()}")

    # 打印错误
    print("\n=== ERRORS ===")
    for err in errors:
        print(f"ERROR: {err[:200]}")

    print(f"\nTotal errors: {len(errors)}")
    print(f"Total warnings: {len(warnings)}")

    # 截图
    page.screenshot(path='temp/chat-test.png', full_page=True)
    print("\nScreenshot saved to temp/chat-test.png")

    browser.close()
