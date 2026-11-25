import { describe, expect, it } from "vitest";
import { cleanOcrText, languageOptions, wordCount } from "./logic";

const RAW =
  "The quick brown rab-\nbit jumps over\nthe lazy dog.   \n\n\n\n- first item\n- second item\f\n";

describe("cleanOcrText", () => {
  it("keeps lines but trims noise", () => {
    expect(cleanOcrText(RAW, "lines")).toBe(
      "The quick brown rab-\nbit jumps over\nthe lazy dog.\n\n- first item\n- second item",
    );
  });

  it("joins paragraphs and hyphenation, keeps list items", () => {
    expect(cleanOcrText(RAW, "paragraphs")).toBe(
      "The quick brown rabbit jumps over the lazy dog.\n\n- first item\n- second item",
    );
  });

  it("doesn't merge real hyphenated words before capitals", () => {
    expect(cleanOcrText("Built with Tauri-\nReact", "paragraphs")).toBe("Built with Tauri- React");
  });
});

describe("helpers", () => {
  it("counts words", () => {
    expect(wordCount("hello, burrow — 42 !")).toBe(3);
  });

  it("offers a combined language when both are installed", () => {
    expect(languageOptions(["ben", "eng"]).map((o) => o.value)).toEqual(["ben", "eng", "eng+ben"]);
    expect(languageOptions(["eng"])).toEqual([{ value: "eng", label: "English" }]);
  });
});
