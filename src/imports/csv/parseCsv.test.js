import { MAX_CSV_ROWS, parseCsvFile, parseCsvText } from "./parseCsv";

const header = "Ticker,Shares,Dividend Per Share,Frequency,Currency,Account,Next Payment Date,Notes";

test("parses BOM, CRLF, quoted commas and quoted newlines", () => {
  const parsed = parseCsvText(`\uFEFF${header}\r\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,"Core, income\nposition"\r\n`);
  expect(parsed.errors).toEqual([]);
  expect(parsed.headers[0]).toBe("Ticker");
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0].Notes).toBe("Core, income\nposition");
});

test("skips empty rows for LF files", () => {
  const parsed = parseCsvText(`${header}\n\nRY,5,1,Annual,USD,RRSP,2026-10-01,\n`);
  expect(parsed.rows).toHaveLength(1);
});

test("allows a harmless empty trailing column", () => {
  const parsed = parseCsvText(`${header},\r\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income\r\n`);
  expect(parsed.headers).toEqual([...header.split(","), ""]);
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(1);
});

test("reports Papa Parse duplicate-header renaming", () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  const parsed = parseCsvText(`${header},Ticker\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income,ENB`);
  expect(parsed.renamedHeaders).toEqual({ Ticker_1: "Ticker" });
  warning.mockRestore();
});

test("reports malformed CSV without exposing row contents", () => {
  const parsed = parseCsvText(`${header}\n"ENB,10,1,Monthly,CAD,TFSA,2026-09-01,notes`);
  expect(parsed.errors.length).toBeGreaterThan(0);
  expect(parsed.errors[0].message).toBe("The CSV could not be read. Check its formatting and try again.");
  expect(parsed.errors[0].message).not.toContain("ENB");
});

test("enforces file type and file-size limits", async () => {
  await expect(parseCsvFile({ name: "holdings.txt", size: 1, text: async () => header }))
    .rejects.toThrow("Choose a .csv file.");
  await expect(parseCsvFile({ name: "holdings.csv", size: 6 * 1024 * 1024, text: async () => header }))
    .rejects.toThrow("5 MB or smaller");
});

test("enforces the row-count limit", () => {
  const lines = Array.from({ length: MAX_CSV_ROWS + 1 }, () => "ENB,1,1,Annual,CAD,TFSA,2026-09-01,");
  const parsed = parseCsvText(`${header}\n${lines.join("\n")}`);
  expect(parsed.rows).toHaveLength(MAX_CSV_ROWS);
  expect(parsed.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "TooManyRows" })]));
});
