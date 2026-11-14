"""Smoke-test ForgeRoster in Chromium with a mobile viewport.

Run with Python Playwright from the repository root. By default the test
serves the repository locally. Pass the GitHub Pages URL to test deployment.
"""
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import os
import sys

from playwright.sync_api import expect, sync_playwright


@contextmanager
def server():
    if len(sys.argv) > 1:
        yield sys.argv[1]
        return
    with ThreadingHTTPServer(("127.0.0.1", 0), SimpleHTTPRequestHandler) as http:
        thread = Thread(target=http.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{http.server_port}/"
        finally:
            http.shutdown()
            thread.join()


def verify(url):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("FORGEROSTER_CHROMIUM")
        )
        context = browser.new_context(
            viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
        )
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url, wait_until="load")
        expect(page).to_have_title("ForgeRoster")
        guest = page.get_by_role("button", name="Continue on this device")
        if guest.is_visible():
            guest.click()
        page.get_by_role("button", name="Leagues of Votann", exact=True).click()
        page.get_by_role("button", name="Create roster").click()
        page.get_by_role("searchbox", name="Search units").or_(
            page.get_by_placeholder("Search faction units")
        ).fill("Hearthkyn Warriors")
        add = page.get_by_role("button", name="Add Hearthkyn Warriors", exact=True)
        expect(add).to_be_enabled()
        add.click()
        expect(page.locator("#frRosterUnits")).to_contain_text("Hearthkyn Warriors")
        expect(page.locator("#frArmyTotal")).not_to_have_text("0 / 2000 pts")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.get_by_role("button", name="Rules & datasheets").click()
        expect(page.get_by_role("heading", name="Rules & Keywords Library")).to_be_visible()
        page.get_by_role("button", name="Army builder").click()
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        context.set_offline(True)
        page.reload(wait_until="domcontentloaded")
        page.get_by_placeholder("Search faction units").fill("Hearthkyn Warriors")
        expect(page.locator("#frRosterUnits")).to_contain_text("Hearthkyn Warriors")
        expect(page.get_by_role("button", name="Add Hearthkyn Warriors")).to_be_visible()
        assert not errors, errors
        print("Mobile builder, catalog, navigation, persistence and offline reload passed.")


if __name__ == "__main__":
    with server() as address:
        verify(address)
