"""Smoke-test ForgeRoster across Chromium, Firefox and WebKit.

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
        engine = os.environ.get("FORGEROSTER_BROWSER", "chromium")
        browser = getattr(playwright, engine).launch(
            executable_path=os.environ.get("FORGEROSTER_CHROMIUM") if engine == "chromium" else None
        )
        width = int(os.environ.get("FORGEROSTER_WIDTH", "390"))
        context = browser.new_context(
            viewport={"width": width, "height": 844}, has_touch=width < 768
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
        page.go_back()
        expect(page.locator("#frRosterUnits")).to_contain_text("Hearthkyn Warriors")
        page.go_forward()
        expect(page.get_by_role("heading", name="Rules & Keywords Library")).to_be_visible()
        page.get_by_role("button", name="Combat calculator").click()
        page.locator("#combat-attacker").select_option(label="My Army · Hearthkyn Warriors")
        page.locator("#combat-weapon").select_option(label="Autoch-pattern bolter")
        page.get_by_role("button", name="Remove one remaining model").click()
        page.get_by_role("spinbutton", name="Total surviving weapons (optional override)").fill("9")
        expect(page.locator("#combat-strength-summary")).to_contain_text("9 remaining")
        expect(page.locator("#combat-results")).to_contain_text("18.00")
        page.get_by_role("button", name="Advanced Mode").click()
        page.get_by_role("combobox", name="Model 1 status", exact=True).select_option("destroyed")
        page.get_by_role("button", name="Undo Last Casualty").click()
        expect(page.locator("#combat-identity")).to_contain_text("Identify 1 more")
        page.get_by_role("button", name="Quick Mode").click()
        expect(page.locator("#combat-strength-summary")).to_contain_text("9 remaining")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.get_by_text("Multiple weapons, target comparison & saved scenarios", exact=True).click()
        page.get_by_role("spinbutton", name="Total surviving weapons (optional override)").fill("9")
        page.get_by_role("button", name="Queue current weapon against this target").click()
        queue = page.locator("#combat-queue")
        page.get_by_role("spinbutton", name="Toughness", exact=True).fill("8")
        expect(queue).not_to_contain_text("Outdated")
        page.get_by_role("button", name="Edit target B").click()
        page.get_by_role("spinbutton", name="Toughness", exact=True).fill("5")
        expect(queue).not_to_contain_text("Outdated")
        page.get_by_role("button", name="Edit target A").click()
        expect(page.get_by_role("spinbutton", name="Toughness", exact=True)).to_have_value("8")
        page.get_by_role("button", name="Remove one remaining model").click()
        expect(page.locator("#combat-queue")).to_contain_text("Outdated")
        expect(page.locator("#combat-error")).to_contain_text("Review outdated queued attacks")
        page.get_by_role("spinbutton", name="Total surviving weapons (optional override)").fill("8")
        page.get_by_role("button", name="Recalculate Pending Attack").click()
        expect(page.locator("#combat-results")).to_contain_text("16.00")
        expect(page.locator("#combat-queue")).not_to_contain_text("Outdated")
        page.get_by_role("button", name="Live dice").click()
        page.get_by_role("button", name="Roll entire attack sequence").click()
        history = page.locator("#combat-results details").filter(
            has=page.get_by_text("Roll history", exact=True)
        )
        rolled = history.inner_text()
        assert "Hits" in rolled, rolled
        page.get_by_role("textbox", name="Scenario name").fill("Resolved dice QA")
        page.get_by_role("button", name="Save scenario").click()
        page.get_by_role("button", name="Load example").click()
        expect(page.get_by_text("Roll history", exact=True)).to_have_count(0)
        page.get_by_role("button", name="Probability", exact=True).click()
        page.get_by_role("combobox", name="Saved scenarios").select_option(label="Resolved dice QA")
        page.get_by_role("button", name="Load scenario", exact=True).click()
        page.get_by_text("Roll history", exact=True).click()
        assert history.inner_text() == rolled
        page.get_by_role("button", name="Report a bug").click()
        expect(page.get_by_role("heading", name="Report a bug")).to_be_visible()
        page.goto(url + "#admin")
        expect(page.locator("#frAdminStatus")).to_contain_text("Sign in with an administrator")
        page.get_by_role("button", name="Army builder").click()
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        if engine == "chromium":
            context.set_offline(True)
        page.reload(wait_until="domcontentloaded")
        page.get_by_placeholder("Search faction units").fill("Hearthkyn Warriors")
        expect(page.locator("#frRosterUnits")).to_contain_text("Hearthkyn Warriors")
        expect(page.get_by_role("button", name="Add Hearthkyn Warriors")).to_be_visible()
        assert not errors, errors
        print(f"{engine} {width}px smoke passed.")


if __name__ == "__main__":
    with server() as address:
        verify(address)
