/**
 * NewScenario.tsx
 * Used to create a new scenario for a training.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

export interface NewScenarioProps {
  scenarioId: string;
}

export default function NewScenario({ scenarioId }: NewScenarioProps) {
  return <div>NewScenario{scenarioId}</div>;
}