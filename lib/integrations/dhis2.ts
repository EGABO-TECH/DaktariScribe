/**
 * DHIS2 export (spec §7.7 — stub for a later phase).
 * Maps template metric fields to DHIS2 data elements in config and builds an aggregate
 * dataValueSet from SQL aggregates of confirmed metric values. Not wired to any UI yet.
 */
export type Dhis2Mapping = {
  dataSet: string;
  orgUnitBySite: Record<string, string>;
  /** fieldKey → { dataElement, categoryOptionCombo?, aggregate } */
  elements: Record<string, { dataElement: string; categoryOptionCombo?: string; aggregate: 'count' | 'sum' | 'avg' }>;
};

export type Dhis2DataValueSet = {
  dataSet: string;
  period: string; // e.g. 202608 (monthly)
  dataValues: { dataElement: string; orgUnit: string; categoryOptionCombo?: string; value: string }[];
};

export function buildDataValueSet(
  mapping: Dhis2Mapping,
  period: string,
  aggregates: { fieldKey: string; site: string; count: number; sum: number | null; avg: number | null }[],
): Dhis2DataValueSet {
  const dataValues = aggregates.flatMap((a) => {
    const el = mapping.elements[a.fieldKey];
    const orgUnit = mapping.orgUnitBySite[a.site];
    if (!el || !orgUnit) return [];
    const value = el.aggregate === 'count' ? a.count : el.aggregate === 'sum' ? a.sum : a.avg;
    if (value === null || value === undefined) return [];
    return [{ dataElement: el.dataElement, orgUnit, categoryOptionCombo: el.categoryOptionCombo, value: String(value) }];
  });
  return { dataSet: mapping.dataSet, period, dataValues };
}
