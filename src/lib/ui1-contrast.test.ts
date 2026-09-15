import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const theme = css.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const tokens = new Map(
  [...theme.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [match[1], match[2]]),
);

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function ratio(foreground: string, background: string) {
  const a = tokens.get(foreground);
  const b = tokens.get(background);
  assert.ok(a && b, `Missing UI1 colour token: ${foreground} / ${background}`);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

test("UI1 working text and navigation meet AA using the shipped CSS tokens", () => {
  for (const background of ["paper", "raised", "paper-2", "work", "reply"]) {
    for (const foreground of ["ink", "ink-2", "stone"]) {
      assert.ok(ratio(foreground, background) >= 4.5, `${foreground} on ${background}`);
    }
  }
  assert.ok(ratio("sidebar-muted", "sidebar") >= 4.5);
  assert.ok(ratio("mark-fg", "mark") >= 4.5);
  assert.ok(ratio("mark", "reply") >= 4.5);
  assert.ok(ratio("nav-active-fg", "nav-active") >= 4.5);
  for (const semantic of ["warn", "ok", "danger"]) {
    assert.ok(ratio(semantic, `${semantic}-bg`) >= 4.5, `${semantic} chip`);
  }
});

test("UI1 input boundaries remain distinguishable on working surfaces", () => {
  for (const surface of ["paper", "raised"]) {
    assert.ok(ratio("line-control", surface) >= 3, `Input boundary on ${surface}`);
  }
});

test("Entry-page supporting text meets AA on both the shell and form", () => {
  const authCss = readFileSync(new URL("../auth.css", import.meta.url), "utf8");
  const root = authCss.match(/\.auth-page\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const muted = root.match(/--auth-muted:\s*(#[\da-f]{6});/i)?.[1];
  const shell = root.match(/background:\s*(#[\da-f]{6});/i)?.[1];
  assert.ok(muted && shell, "Read the actual entry-page colours");
  for (const background of [shell, tokens.get("raised")!]) {
    const values = [luminance(muted), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0]! + 0.05) / (values[1]! + 0.05) >= 4.5);
  }
});

test("Public-site body text and primary action meet AA on their shipped surfaces", () => {
  const publicCss = readFileSync(new URL("../public-site.css", import.meta.url), "utf8");
  const foregrounds = ["#1c1b1f", "#68656d", "#69519d", "#543aab"];
  const backgrounds = ["#fff", "#f8f8f7", "#f8f8fa", "#f1edf7"];
  for (const color of [...foregrounds, ...backgrounds, "#654ac2"]) {
    assert.ok(publicCss.includes(color), `The checked colour must exist in public CSS: ${color}`);
  }
  for (const foreground of foregrounds) {
    for (const background of backgrounds) {
      const values = [
        luminance(foreground),
        luminance(background === "#fff" ? "#ffffff" : background),
      ].sort((a, b) => b - a);
      assert.ok((values[0]! + 0.05) / (values[1]! + 0.05) >= 4.5, `${foreground} on ${background}`);
    }
  }
  assert.ok((luminance("#ffffff") + 0.05) / (luminance("#654ac2") + 0.05) >= 4.5);
});

test("Brand hero copy and opaque primary action meet AA on their base surfaces", () => {
  const heroCss = readFileSync(new URL("../brand-hero.css", import.meta.url), "utf8");
  for (const [foreground, background] of [
    ["#292136", "#f0eef5"],
    ["#64586d", "#f0eef5"],
    ["#ffffff", "#30213f"],
  ]) {
    assert.ok(heroCss.includes(foreground === "#ffffff" ? "#fff" : foreground));
    assert.ok(heroCss.includes(background));
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0]! + 0.05) / (values[1]! + 0.05) >= 4.5);
  }
});
