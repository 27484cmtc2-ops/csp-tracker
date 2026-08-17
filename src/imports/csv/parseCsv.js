import Papa from "papaparse";

export const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 10000;

export function parseCsvText(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });

  const errors = result.errors
    .filter((error) => {
      if (error.code === "UndetectableDelimiter") return false;
      if (error.code !== "TooFewFields" || !Number.isInteger(error.row)) return true;
      const nonEmptyHeaders = (result.meta.fields ?? []).filter((header) => header.trim()).length;
      return Object.keys(result.data[error.row] ?? {}).length < nonEmptyHeaders;
    })
    .map((error) => ({
      code: error.code,
      row: Number.isInteger(error.row) ? error.row + 2 : null,
      message: "The CSV could not be read. Check its formatting and try again.",
    }));

  if (result.data.length > MAX_CSV_ROWS) {
    errors.push({
      code: "TooManyRows",
      row: null,
      message: `CSV files are limited to ${MAX_CSV_ROWS.toLocaleString()} data rows.`,
    });
  }

  return {
    headers: result.meta.fields ?? [],
    renamedHeaders: result.meta.renamedHeaders ?? {},
    rows: result.data.slice(0, MAX_CSV_ROWS),
    errors,
  };
}

export function parseCsvMatrixText(text) {
  const result = Papa.parse(text, {
    header: false,
    skipEmptyLines: "greedy",
  });
  const [headerRow = [], ...dataRows] = result.data;
  const headers = headerRow.map((header) =>
    String(header ?? "").replace(/^\uFEFF/, "").trim()
  );
  const errors = result.errors
    .filter((error) => error.code !== "UndetectableDelimiter")
    .map((error) => ({
      code: error.code,
      row: Number.isInteger(error.row) ? error.row + 1 : null,
      message: "The CSV could not be read. Check its formatting and try again.",
    }));

  if (dataRows.length > MAX_CSV_ROWS) {
    errors.push({
      code: "TooManyRows",
      row: null,
      message: `CSV files are limited to ${MAX_CSV_ROWS.toLocaleString()} data rows.`,
    });
  }

  return {
    headers,
    rows: dataRows.slice(0, MAX_CSV_ROWS),
    errors,
    positional: true,
  };
}

export async function parseCsvFile(file, { positional = false } = {}) {
  if (!file) throw new Error("Choose a CSV file to continue.");
  if (file.size > MAX_CSV_FILE_SIZE) {
    throw new Error("CSV files must be 5 MB or smaller.");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Choose a .csv file.");
  }
  const text = await file.text();
  return positional ? parseCsvMatrixText(text) : parseCsvText(text);
}
