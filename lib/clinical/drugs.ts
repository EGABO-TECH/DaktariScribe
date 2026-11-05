/**
 * Drug lexicon used by the drug check (lib/verify/drugs.ts) and as STT keyterms.
 * Based on commonly used items from the Essential Medicines and Health Supplies List for
 * Uganda (EMHSLU). Lower-case generic names, plus common brand/short forms that appear in
 * field notes. Not exhaustive: unknown drug names in the OUTPUT are still caught when the
 * line's other checks fail; extend this list with clinical review.
 */
export const DRUG_NAMES: string[] = [
  'paracetamol', 'acetaminophen', 'ibuprofen', 'diclofenac', 'aspirin', 'morphine', 'tramadol', 'codeine',
  'amoxicillin', 'amoxicillin-clavulanate', 'augmentin', 'ampicillin', 'cloxacillin', 'flucloxacillin',
  'benzylpenicillin', 'benzathine penicillin', 'phenoxymethylpenicillin', 'ceftriaxone', 'cefixime', 'cefuroxime',
  'ciprofloxacin', 'levofloxacin', 'azithromycin', 'erythromycin', 'clarithromycin', 'doxycycline', 'tetracycline',
  'gentamicin', 'metronidazole', 'tinidazole', 'nitrofurantoin', 'cotrimoxazole', 'co-trimoxazole',
  'septrin', 'chloramphenicol', 'clindamycin', 'vancomycin',
  'artemether', 'lumefantrine', 'artemether-lumefantrine', 'coartem', 'artesunate', 'dihydroartemisinin',
  'piperaquine', 'dihydroartemisinin-piperaquine', 'quinine', 'chloroquine', 'primaquine',
  'sulfadoxine-pyrimethamine', 'fansidar', 'amodiaquine', 'artesunate-amodiaquine',
  'albendazole', 'mebendazole', 'praziquantel', 'ivermectin',
  'fluconazole', 'clotrimazole', 'nystatin', 'griseofulvin', 'miconazole',
  'acyclovir', 'aciclovir',
  'tenofovir', 'lamivudine', 'dolutegravir', 'efavirenz', 'zidovudine', 'nevirapine', 'abacavir',
  'lopinavir', 'ritonavir', 'atazanavir', 'tld',
  'isoniazid', 'rifampicin', 'pyrazinamide', 'ethambutol', 'streptomycin', 'rifapentine',
  'oral rehydration salts', 'zinc', 'ferrous sulphate', 'ferrous sulfate', 'folic acid', 'iron', 'vitamin a',
  'vitamin b complex', 'multivitamin', 'calcium', 'magnesium sulphate', 'magnesium sulfate',
  'oxytocin', 'misoprostol', 'ergometrine', 'methyldopa', 'nifedipine', 'hydralazine', 'labetalol',
  'amlodipine', 'enalapril', 'lisinopril', 'captopril', 'losartan', 'atenolol', 'propranolol',
  'hydrochlorothiazide', 'bendroflumethiazide', 'furosemide', 'frusemide', 'spironolactone',
  'metformin', 'glibenclamide', 'gliclazide', 'insulin', 'glucose', 'dextrose',
  'salbutamol', 'aminophylline', 'beclomethasone', 'prednisolone', 'hydrocortisone', 'dexamethasone',
  'adrenaline', 'epinephrine', 'chlorphenamine', 'chlorpheniramine', 'promethazine', 'cetirizine', 'loratadine',
  'omeprazole', 'ranitidine', 'cimetidine', 'magnesium trisilicate', 'antacid', 'hyoscine', 'buscopan',
  'metoclopramide', 'ondansetron', 'bisacodyl', 'lactulose', 'loperamide',
  'diazepam', 'phenobarbital', 'phenobarbitone', 'phenytoin', 'carbamazepine', 'sodium valproate', 'haloperidol',
  'chlorpromazine', 'amitriptyline', 'fluoxetine', 'risperidone',
  'lidocaine', 'lignocaine', 'ketamine',
  'tetanus toxoid', 'tetanus immunoglobulin', 'anti-rabies vaccine', 'medroxyprogesterone', 'depo-provera',
  'levonorgestrel', 'condoms', 'gentian violet', 'silver sulfadiazine', 'povidone-iodine', 'chlorhexidine',
  'tetracycline eye ointment', 'calamine', 'benzyl benzoate', 'permethrin', 'whitfield ointment',
];
