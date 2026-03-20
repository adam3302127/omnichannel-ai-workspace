#!/usr/bin/env npx tsx
/**
 * Playwright CLI - Browser automation from the command line.
 *
 * Usage:
 *   npm run playwright-cli -- open <url>
 *   npm run playwright-cli -- screenshot <url> [output.png]
 *   npm run playwright-cli -- scrape <url> [output.html]
 *   npm run playwright-cli -- install
 *
 * Or: npx tsx scripts/playwright-cli.ts <command> [args]
 */
import { Command } from "commander";
import { chromium } from "playwright";

const program = new Command();

program
  .name("playwright-cli")
  .description("Playwright CLI for browser automation")
  .version("1.0.0");

program
  .command("open")
  .description("Open a URL in a browser (headed by default)")
  .argument("<url>", "URL to open")
  .option("-h, --headless", "Run in headless mode")
  .option("-w, --wait <ms>", "Wait N ms after load", "3000")
  .action(async (url: string, opts: { headless?: boolean; wait?: string }) => {
    const browser = await chromium.launch({ headless: opts.headless ?? false });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const waitMs = parseInt(opts.wait ?? "3000", 10);
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      console.log(`Opened ${url} (waited ${waitMs}ms)`);
    } finally {
      await browser.close();
    }
  });

program
  .command("screenshot")
  .description("Capture a screenshot of a URL")
  .argument("<url>", "URL to capture")
  .argument("[output]", "Output file path (default: screenshot.png)")
  .option("-h, --headless", "Run in headless mode", true)
  .option("-f, --full-page", "Capture full scrollable page")
  .option("-w, --wait <ms>", "Wait N ms after load", "1000")
  .action(
    async (
      url: string,
      output: string | undefined,
      opts: {
        headless?: boolean;
        fullPage?: boolean;
        wait?: string;
      }
    ) => {
      const out = output ?? "screenshot.png";
      const browser = await chromium.launch({
        headless: opts.headless ?? true,
      });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle" });
        const waitMs = parseInt(opts.wait ?? "1000", 10);
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        await page.screenshot({
          path: out,
          fullPage: opts.fullPage ?? false,
        });
        console.log(`Screenshot saved: ${out}`);
      } finally {
        await browser.close();
      }
    }
  );

program
  .command("scrape")
  .description("Fetch HTML from a JS-rendered page")
  .argument("<url>", "URL to scrape")
  .argument("[output]", "Output file (omit to print to stdout)")
  .option("-h, --headless", "Run in headless mode", true)
  .option("-s, --selector <sel>", "Extract only this selector's innerHTML")
  .option("-w, --wait <ms>", "Wait N ms after load", "2000")
  .action(
    async (
      url: string,
      output: string | undefined,
      opts: {
        headless?: boolean;
        selector?: string;
        wait?: string;
      }
    ) => {
      const browser = await chromium.launch({
        headless: opts.headless ?? true,
      });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle" });
        const waitMs = parseInt(opts.wait ?? "2000", 10);
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

        let html: string;
        if (opts.selector) {
          const el = await page.$(opts.selector);
          if (!el) {
            console.error(`Selector not found: ${opts.selector}`);
            process.exit(1);
          }
          html = await el.innerHTML();
          await el.dispose();
        } else {
          html = await page.content();
        }

        if (output) {
          const fs = await import("fs");
          fs.writeFileSync(output, html);
          console.log(`HTML saved: ${output}`);
        } else {
          console.log(html);
        }
      } finally {
        await browser.close();
      }
    }
  );

program
  .command("install")
  .description("Install Playwright browsers (chromium)")
  .action(async () => {
    const { execSync } = await import("child_process");
    console.log("Installing Playwright Chromium...");
    execSync("npx playwright install chromium", { stdio: "inherit" });
    console.log("Done.");
  });

program.parse();
