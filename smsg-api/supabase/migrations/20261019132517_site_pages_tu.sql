-- Copy: informal "tu" instead of "Lei". Replaces only the exact old defaults, so staff edits stay untouched.
update public.site_settings set pages = replace(replace(replace(pages::text,
  'I suoi diritti', 'I tuoi diritti'),
  'Può chiedere di vedere, correggere o cancellare i suoi dati rivolgendosi alla sede.',
  'Puoi chiedere di vedere, correggere o cancellare i tuoi dati rivolgendoti alla sede.'),
  'Può sostenere la Società con il 5 per mille: nella dichiarazione dei redditi scriva il nostro codice fiscale',
  'Puoi sostenere la Società con il 5 per mille: nella dichiarazione dei redditi scrivi il nostro codice fiscale')::jsonb;
