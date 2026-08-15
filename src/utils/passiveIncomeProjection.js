export const DEFAULT_PROJECTION_SETTINGS = {
  monthlyGoal: null,
  monthlyContribution: 0,
  inflationRate: 0.02,
  projectionYears: 20,
  continueContributions: true,
  reinvestIncome: true,
  includeWheelIncome: true,
  displayMode: "today",
  scenarios: {
    safe: { dividendGrowthRate: 0.02, incomeYield: 0.03, wheelGrowthRate: 0 },
    base: { dividendGrowthRate: 0.04, incomeYield: 0.04, wheelGrowthRate: 0.02 },
    aggressive: { dividendGrowthRate: 0.06, incomeYield: 0.05, wheelGrowthRate: 0.04 },
  },
};

export const PROJECTION_SCENARIOS = [
  { id: "safe", label: "Safe", accent: "🛡️" },
  { id: "base", label: "Base", accent: "📈" },
  { id: "aggressive", label: "Aggressive", accent: "🚀" },
];

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function monthLabel(date) {
  return date.toISOString().slice(0, 7);
}

function annualToMonthlyRate(rate) {
  return Math.pow(1 + rate, 1 / 12) - 1;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function projectPassiveIncome({
  currentMonthlyDividends,
  currentMonthlyWheelIncome,
  settings,
  startDate = new Date(),
}) {
  const merged = {
    ...DEFAULT_PROJECTION_SETTINGS,
    ...settings,
    scenarios: {
      ...DEFAULT_PROJECTION_SETTINGS.scenarios,
      ...(settings?.scenarios || {}),
    },
  };
  const goal = positiveNumber(merged.monthlyGoal) || null;
  const months = Math.max(1, Math.round(positiveNumber(merged.projectionYears) * 12));
  const inflationRate = Math.max(0, Number(merged.inflationRate) || 0);
  const monthlyInflation = annualToMonthlyRate(inflationRate);
  const startingDividendAnnual = Math.max(0, Number(currentMonthlyDividends) || 0) * 12;
  const startingWheelMonthly = merged.includeWheelIncome
    ? Math.max(0, Number(currentMonthlyWheelIncome) || 0)
    : 0;
  const milestoneAmounts = goal ? [0.25, 0.5, 0.75, 1].map((fraction) => goal * fraction) : [];

  const scenarios = Object.fromEntries(PROJECTION_SCENARIOS.map(({ id }) => {
    const assumptions = merged.scenarios[id];
    const dividendMonthlyGrowth = annualToMonthlyRate(Number(assumptions.dividendGrowthRate) || 0);
    const wheelMonthlyGrowth = annualToMonthlyRate(Number(assumptions.wheelGrowthRate) || 0);
    const incomeYield = Math.max(0, Number(assumptions.incomeYield) || 0);
    let dividendAnnual = startingDividendAnnual;
    let wheelMonthly = startingWheelMonthly;
    const points = [];

    for (let month = 0; month <= months; month += 1) {
      const inflationFactor = Math.pow(1 + monthlyInflation, month);
      const nominalIncome = dividendAnnual / 12 + wheelMonthly;
      const income = merged.displayMode === "today" ? nominalIncome / inflationFactor : nominalIncome;
      const displayedGoal = goal == null
        ? null
        : merged.displayMode === "future" ? goal * inflationFactor : goal;
      points.push({
        month,
        date: monthLabel(addMonths(startDate, month)),
        income,
        nominalIncome,
        goal: displayedGoal,
      });

      if (month === months) break;
      dividendAnnual *= 1 + dividendMonthlyGrowth;
      wheelMonthly *= 1 + wheelMonthlyGrowth;
      const contribution = merged.continueContributions
        ? Math.max(0, Number(merged.monthlyContribution) || 0)
        : 0;
      const reinvestedIncome = merged.reinvestIncome ? nominalIncome : 0;
      dividendAnnual += (contribution + reinvestedIncome) * incomeYield;
    }

    const goalPoint = goal == null ? null : points.find((point) => point.income >= point.goal) || null;
    const milestones = milestoneAmounts.map((amount, index) => {
      const reached = points.find((point) => {
        const inflationFactor = Math.pow(1 + monthlyInflation, point.month);
        const displayedMilestone = merged.displayMode === "future" ? amount * inflationFactor : amount;
        return point.income >= displayedMilestone;
      });
      return {
        amount,
        fraction: (index + 1) * 0.25,
        date: reached?.date || null,
        month: reached?.month ?? null,
      };
    });

    return [id, { points, goalDate: goalPoint?.date || null, milestones }];
  }));

  const currentMonthlyIncome = Math.max(0, Number(currentMonthlyDividends) || 0) + startingWheelMonthly;
  return {
    settings: merged,
    currentMonthlyIncome,
    goal,
    goalProgress: goal ? Math.min(100, (currentMonthlyIncome / goal) * 100) : null,
    scenarios,
  };
}
