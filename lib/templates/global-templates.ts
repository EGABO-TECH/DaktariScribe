import type { TemplateDefinition } from './definition';

/**
 * Global templates seeded by db/seed.ts (spec §4.1).
 * Labels are English only for now. Other languages must be added by a fluent speaker,
 * never machine-translated.
 */
type Seed = { id: string; name: string; version: number; definition: TemplateDefinition };

const en = (s: string) => ({ eng: s });

export const GLOBAL_TEMPLATES: Seed[] = [
  {
    id: 'tpl_general_consultation',
    name: 'General consultation',
    version: 1,
    definition: {
      sections: [
        { key: 'presenting_complaint', label: en('Presenting complaint'), fields: [] },
        { key: 'history', label: en('History'), fields: [] },
        {
          key: 'vital_signs',
          label: en('Vital signs'),
          fields: [
            { key: 'temperature_c', label: en('Temperature'), type: 'number', unit: '°C', metric: true },
            { key: 'bp_systolic', label: en('Blood pressure (systolic)'), type: 'number', unit: 'mmHg', metric: true },
            { key: 'bp_diastolic', label: en('Blood pressure (diastolic)'), type: 'number', unit: 'mmHg', metric: true },
            { key: 'pulse_bpm', label: en('Pulse'), type: 'number', unit: 'bpm', metric: true },
            { key: 'resp_rate', label: en('Respiratory rate'), type: 'number', unit: '/min' },
            { key: 'spo2_pct', label: en('SpO2'), type: 'number', unit: '%' },
            { key: 'weight_kg', label: en('Weight'), type: 'number', unit: 'kg' },
          ],
        },
        { key: 'examination', label: en('Examination'), fields: [] },
        {
          key: 'investigations',
          label: en('Investigations'),
          fields: [
            { key: 'malaria_rdt', label: en('Malaria RDT'), type: 'choice', choices: ['Positive', 'Negative', 'Not done'], metric: true },
          ],
        },
        { key: 'assessment', label: en('Assessment / diagnosis'), fields: [] },
        { key: 'plan', label: en('Plan and treatment'), fields: [] },
        {
          key: 'follow_up',
          label: en('Follow-up'),
          fields: [
            { key: 'referred', label: en('Referred'), type: 'boolean', metric: true },
            { key: 'follow_up_date', label: en('Follow-up date'), type: 'date' },
          ],
        },
      ],
    },
  },
  {
    id: 'tpl_antenatal_visit',
    name: 'Antenatal visit',
    version: 1,
    definition: {
      sections: [
        {
          key: 'pregnancy',
          label: en('Pregnancy details'),
          fields: [
            { key: 'gestational_age_weeks', label: en('Gestational age'), type: 'number', unit: 'weeks', metric: true },
            { key: 'anc_visit_number', label: en('ANC visit number'), type: 'number', metric: true },
            { key: 'gravida', label: en('Gravida'), type: 'number' },
            { key: 'parity', label: en('Parity'), type: 'number' },
          ],
        },
        {
          key: 'vital_signs',
          label: en('Vital signs'),
          fields: [
            { key: 'bp_systolic', label: en('Blood pressure (systolic)'), type: 'number', unit: 'mmHg', metric: true },
            { key: 'bp_diastolic', label: en('Blood pressure (diastolic)'), type: 'number', unit: 'mmHg', metric: true },
            { key: 'weight_kg', label: en('Weight'), type: 'number', unit: 'kg' },
            { key: 'haemoglobin_gdl', label: en('Haemoglobin'), type: 'number', unit: 'g/dL', metric: true },
          ],
        },
        {
          key: 'screening',
          label: en('Screening'),
          fields: [
            { key: 'hiv_test', label: en('HIV test'), type: 'choice', choices: ['Positive', 'Negative', 'Not done', 'Known positive'], metric: true },
            { key: 'syphilis_test', label: en('Syphilis test'), type: 'choice', choices: ['Positive', 'Negative', 'Not done'], metric: true },
            { key: 'malaria_rdt', label: en('Malaria RDT'), type: 'choice', choices: ['Positive', 'Negative', 'Not done'], metric: true },
          ],
        },
        { key: 'complaints', label: en('Complaints and danger signs'), fields: [] },
        {
          key: 'interventions',
          label: en('Interventions'),
          fields: [
            { key: 'iptp_dose', label: en('IPTp dose given'), type: 'number', metric: true },
            { key: 'td_vaccine', label: en('Td vaccine given'), type: 'boolean', metric: true },
            { key: 'iron_folate', label: en('Iron / folic acid given'), type: 'boolean' },
          ],
        },
        {
          key: 'plan',
          label: en('Plan and next visit'),
          fields: [{ key: 'next_visit_date', label: en('Next visit date'), type: 'date' }],
        },
      ],
    },
  },
  {
    id: 'tpl_immunisation_session',
    name: 'Immunisation session',
    version: 1,
    definition: {
      sections: [
        {
          key: 'session',
          label: en('Session details'),
          fields: [
            { key: 'session_type', label: en('Session type'), type: 'choice', choices: ['Static', 'Outreach', 'Mobile'] },
            { key: 'children_vaccinated', label: en('Children vaccinated'), type: 'number', metric: true },
          ],
        },
        {
          key: 'doses',
          label: en('Doses given'),
          fields: [
            { key: 'bcg_doses', label: en('BCG'), type: 'number', metric: true },
            { key: 'opv_doses', label: en('OPV'), type: 'number', metric: true },
            { key: 'penta_doses', label: en('DPT-HepB-Hib'), type: 'number', metric: true },
            { key: 'pcv_doses', label: en('PCV'), type: 'number', metric: true },
            { key: 'measles_rubella_doses', label: en('Measles-Rubella'), type: 'number', metric: true },
          ],
        },
        {
          key: 'stock',
          label: en('Stock and cold chain'),
          fields: [{ key: 'cold_chain_ok', label: en('Cold chain maintained'), type: 'boolean' }],
        },
        {
          key: 'aefi',
          label: en('Adverse events following immunisation'),
          fields: [{ key: 'aefi_count', label: en('AEFI reported'), type: 'number', metric: true }],
        },
        { key: 'notes', label: en('Notes'), fields: [] },
      ],
    },
  },
  {
    id: 'tpl_community_survey',
    name: 'Community survey / interview',
    version: 1,
    definition: {
      sections: [
        {
          key: 'respondent',
          label: en('Respondent'),
          fields: [
            { key: 'age_years', label: en('Age'), type: 'number', unit: 'years', metric: true },
            { key: 'sex', label: en('Sex'), type: 'choice', choices: ['Female', 'Male', 'Other', 'Not stated'], metric: true },
            { key: 'household_size', label: en('Household size'), type: 'number', metric: true },
          ],
        },
        { key: 'responses', label: en('Responses'), fields: [] },
        { key: 'observations', label: en('Observations'), fields: [] },
        { key: 'follow_up', label: en('Follow-up actions'), fields: [] },
      ],
    },
  },
  {
    id: 'tpl_custom',
    name: 'Custom (free sections)',
    version: 1,
    definition: {
      sections: [{ key: 'notes', label: en('Notes'), fields: [] }],
    },
  },
];
