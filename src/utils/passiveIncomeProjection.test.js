import { DEFAULT_PROJECTION_SETTINGS, projectPassiveIncome } from "./passiveIncomeProjection";

const startDate = new Date("2026-08-01T00:00:00Z");

function settings(overrides = {}) {
  return {
    ...DEFAULT_PROJECTION_SETTINGS,
    projectionYears: 1,
    monthlyGoal: 200,
    inflationRate: 0,
    scenarios: {
      safe: { dividendGrowthRate: 0, incomeYield: 0, wheelGrowthRate: 0 },
      base: { dividendGrowthRate: 0, incomeYield: 0, wheelGrowthRate: 0 },
      aggressive: { dividendGrowthRate: 0, incomeYield: 0, wheelGrowthRate: 0 },
    },
    ...overrides,
  };
}

test("projects distinct scenario assumptions and editable goal dates", () => {
  const result = projectPassiveIncome({
    currentMonthlyDividends: 100,
    currentMonthlyWheelIncome: 0,
    startDate,
    settings: settings({
      projectionYears: 10,
      monthlyGoal: 150,
      scenarios: {
        safe: { dividendGrowthRate: 0.01, incomeYield: 0, wheelGrowthRate: 0 },
        base: { dividendGrowthRate: 0.05, incomeYield: 0, wheelGrowthRate: 0 },
        aggressive: { dividendGrowthRate: 0.1, incomeYield: 0, wheelGrowthRate: 0 },
      },
    }),
  });
  expect(result.scenarios.aggressive.points.at(-1).income).toBeGreaterThan(result.scenarios.base.points.at(-1).income);
  expect(result.scenarios.base.points.at(-1).income).toBeGreaterThan(result.scenarios.safe.points.at(-1).income);
  expect(result.scenarios.aggressive.goalDate).not.toBeNull();
  expect(result.scenarios.safe.goalDate).toBeNull();
});

test("contributions and reinvestment each increase future income without affecting month zero", () => {
  const base = settings({ monthlyContribution: 100, reinvestIncome: false, continueContributions: false });
  const noCapital = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: base, startDate });
  const contributions = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: { ...base, continueContributions: true, scenarios: { safe: { dividendGrowthRate: 0, incomeYield: 0.12, wheelGrowthRate: 0 }, base: { dividendGrowthRate: 0, incomeYield: 0.12, wheelGrowthRate: 0 }, aggressive: { dividendGrowthRate: 0, incomeYield: 0.12, wheelGrowthRate: 0 } } }, startDate });
  const reinvested = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: { ...base, reinvestIncome: true, scenarios: { safe: { dividendGrowthRate: 0, incomeYield: 0.12, wheelGrowthRate: 0 }, base: { dividendGrowthRate: 0, incomeYield: 0.12, wheelGrowthRate: 0 }, aggressive: { dividendGrowthRate: 0, incomeYield: 0.12, wheelGrowthRate: 0 } } }, startDate });
  expect(contributions.scenarios.base.points[0].income).toBe(100);
  expect(contributions.scenarios.base.points.at(-1).income).toBeGreaterThan(noCapital.scenarios.base.points.at(-1).income);
  expect(reinvested.scenarios.base.points.at(-1).income).toBeGreaterThan(noCapital.scenarios.base.points.at(-1).income);
});

test("Include Wheel Income controls the starting value and Wheel growth", () => {
  const included = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 50, settings: settings({ includeWheelIncome: true }), startDate });
  const excluded = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 50, settings: settings({ includeWheelIncome: false }), startDate });
  expect(included.currentMonthlyIncome).toBe(150);
  expect(excluded.currentMonthlyIncome).toBe(100);
});

test("today-dollar mode deflates income and keeps the goal constant", () => {
  const result = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: settings({ inflationRate: 0.12, displayMode: "today" }), startDate });
  const last = result.scenarios.base.points.at(-1);
  expect(last.income).toBeLessThan(100);
  expect(last.goal).toBe(200);
});

test("future-dollar mode keeps nominal income and inflates the goal", () => {
  const result = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: settings({ inflationRate: 0.12, displayMode: "future" }), startDate });
  const last = result.scenarios.base.points.at(-1);
  expect(last.income).toBeCloseTo(100);
  expect(last.goal).toBeGreaterThan(200);
});

test("no goal produces an explicit unset state and milestones follow an edited goal", () => {
  const unset = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: settings({ monthlyGoal: null }), startDate });
  expect(unset.goal).toBeNull();
  expect(unset.goalProgress).toBeNull();
  expect(unset.scenarios.base.goalDate).toBeNull();

  const set = projectPassiveIncome({ currentMonthlyDividends: 100, currentMonthlyWheelIncome: 0, settings: settings({ monthlyGoal: 100 }), startDate });
  expect(set.goalProgress).toBe(100);
  expect(set.scenarios.base.milestones.map((milestone) => milestone.amount)).toEqual([25, 50, 75, 100]);
  expect(set.scenarios.base.milestones.every((milestone) => milestone.date === "2026-08")).toBe(true);
});

