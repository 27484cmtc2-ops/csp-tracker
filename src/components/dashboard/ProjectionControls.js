import { PROJECTION_SCENARIOS } from "../../utils/passiveIncomeProjection";

const RATE_FIELDS = [
  ["dividendGrowthRate", "Dividend growth"],
  ["incomeYield", "Income yield on new capital"],
  ["wheelGrowthRate", "Wheel income growth"],
];

function NumericControl({ label, ariaLabel = label, value, onChange, min = 0, max, step = "any", suffix }) {
  return (
    <label className="projection-control-field">
      <span>{label}</span>
      <div><input aria-label={ariaLabel} type="number" min={min} max={max} step={step} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />{suffix && <b>{suffix}</b>}</div>
    </label>
  );
}

export default function ProjectionControls({ settings, onChange }) {
  const update = (field, value) => onChange({ ...settings, [field]: value });
  const updateScenario = (scenario, field, value) => onChange({
    ...settings,
    scenarios: {
      ...settings.scenarios,
      [scenario]: { ...settings.scenarios[scenario], [field]: Number(value) / 100 },
    },
  });

  return (
    <section className="projection-controls" aria-label="Session-only projection assumptions">
      <header><div><span>PROJECTION CONTROLS</span><small>Session only · assumptions are not saved</small></div></header>
      <div className="projection-primary-controls">
        <NumericControl label="Monthly passive-income goal" value={settings.monthlyGoal} onChange={(value) => update("monthlyGoal", value === "" ? null : Number(value))} step="50" suffix="CAD" />
        <NumericControl label="Monthly contribution" value={settings.monthlyContribution} onChange={(value) => update("monthlyContribution", Number(value))} step="50" suffix="CAD" />
        <NumericControl label="Inflation rate" value={settings.inflationRate * 100} onChange={(value) => update("inflationRate", Number(value) / 100)} max="25" step="0.1" suffix="%" />
        <NumericControl label="Projection period" value={settings.projectionYears} onChange={(value) => update("projectionYears", Number(value))} min="1" max="50" step="1" suffix="YEARS" />
      </div>
      <div className="projection-toggle-row">
        <label><input type="checkbox" checked={settings.continueContributions} onChange={(event) => update("continueContributions", event.target.checked)} /> Continue contributions</label>
        <label><input type="checkbox" checked={settings.reinvestIncome} onChange={(event) => update("reinvestIncome", event.target.checked)} /> Reinvest income</label>
        <label><input type="checkbox" checked={settings.includeWheelIncome} onChange={(event) => update("includeWheelIncome", event.target.checked)} /> Include Wheel income</label>
        <label className="projection-display-mode"><span>DISPLAY</span><select aria-label="Projection dollar display" value={settings.displayMode} onChange={(event) => update("displayMode", event.target.value)}><option value="today">Today’s dollars</option><option value="future">Future dollars</option></select></label>
      </div>
      <div className="projection-scenario-controls">
        {PROJECTION_SCENARIOS.map(({ id, label, accent }) => (
          <fieldset key={id}>
            <legend><i aria-hidden="true">{accent}</i>{label} assumptions</legend>
            {RATE_FIELDS.map(([field, fieldLabel]) => (
              <NumericControl key={field} label={fieldLabel} ariaLabel={`${label} ${fieldLabel.toLowerCase()}`} value={(settings.scenarios[id][field] * 100).toFixed(1)} onChange={(value) => updateScenario(id, field, value)} max="50" step="0.1" suffix="%" />
            ))}
          </fieldset>
        ))}
      </div>
      <p className="projection-assumption-note">These editable scenarios are planning assumptions, not guarantees. Gross option premium is not realized P&amp;L.</p>
    </section>
  );
}
