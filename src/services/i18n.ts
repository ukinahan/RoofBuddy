/**
 * Lightweight i18n. No external deps.
 *
 * Usage (function form so it picks up the live locale):
 *   const t = useT();
 *   <Text>{t('home.empty.title')}</Text>
 *
 * Add new keys to STRINGS below — English is the source of truth.
 * Missing translations fall back to the English string.
 */

import { useEffect, useState, useCallback } from 'react';
import { Language, loadLocale } from './locale';

type Dict = Record<string, string>;

const EN: Dict = {
  // Tabs
  'tabs.jobs': 'Jobs',
  'tabs.inspections': 'Inspections',
  'tabs.customers': 'Customers',
  'tabs.settings': 'Settings',

  // Home / Inspections list
  'home.title': 'Inspections',
  'home.search.placeholder': 'Search by customer, address, ref, date…',
  'home.empty.title': 'No Inspections Yet',
  'home.empty.subtitle': 'Tap the button below to start your first roof inspection.',
  'home.empty.search.title': 'No Matches',
  'home.fab.new': '+ New Inspection',

  // New Inspection
  'new.title': 'New Inspection',
  'new.section.customer': 'CUSTOMER',
  'new.section.inspector': 'INSPECTOR',
  'new.section.notes': 'NOTES',
  'new.field.customerName': 'Customer Name *',
  'new.field.customerEmail': 'Customer Email (optional)',
  'new.field.address': '{postcode} *',
  'new.field.ref': 'Ref: (e.g. project name)',
  'new.field.scope': 'Scope of Works (e.g. Roof Survey)',
  'new.field.inspector': 'Inspector Name',
  'new.field.notes': 'General notes about this inspection (optional)',
  'new.button.create': 'Start Taking Photos →',
  'new.button.creating': 'Creating…',
  'new.pickCustomer': 'Pick existing customer',
  'new.newCustomer': 'New customer',

  // Inspection detail
  'inspection.button.camera': 'Camera',
  'inspection.button.library': 'Library',
  'inspection.button.quote': 'Quote',
  'inspection.button.report': 'Report',
  'inspection.empty': 'No photos yet. Tap a button below to add photos.',

  // Photo detail
  'photo.mode.view': 'View',
  'photo.mode.draw': 'Draw',
  'photo.severity.title': 'Severity Level',
  'photo.severity.none': 'None',
  'photo.severity.low': 'Low',
  'photo.severity.medium': 'Medium',
  'photo.severity.high': 'High',
  'photo.notes.title': 'Inspector Notes',
  'photo.notes.placeholder': 'Add notes about this photo…',
  'photo.notes.save': 'Save Notes',
  'photo.next': 'Next →',
  'photo.prev': '← Prev',
  'photo.position': 'Photo {n} of {total}',

  // Customers
  'customers.title': 'Customers',
  'customers.empty': 'No customers yet. Customers are created automatically when you add an inspection.',
  'customers.search.placeholder': 'Search customers…',
  'customers.detail.inspections': 'Inspections',
  'customers.detail.add': '+ New Inspection',

  // Jobs / schedule
  'jobs.title': 'Jobs',
  'jobs.section.today': 'Today',
  'jobs.section.upcoming': 'Upcoming',
  'jobs.section.recent': 'Recent',
  'jobs.empty': 'No jobs scheduled. Create an inspection to add a job.',

  // Settings
  'settings.title': 'Settings',
  'settings.section.locale': 'Region & Language',
  'settings.field.region': 'Region',
  'settings.field.language': 'Language',
  'settings.field.units': 'Units',
  'settings.field.currency': 'Currency',
  'settings.units.metric': 'Metric (m, m²)',
  'settings.units.imperial': 'Imperial (ft, ft²)',
  'settings.section.company': 'Company Profile',
  'settings.openCompany': 'Edit Company Profile',
  'settings.section.about': 'About',
  'settings.about.version': 'Version',

  // Generic
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.required': 'Required',
};

const GA: Dict = {
  'tabs.jobs': 'Jabanna',
  'tabs.inspections': 'Iniúchtaí',
  'tabs.customers': 'Custaiméirí',
  'tabs.settings': 'Socruithe',
  'home.title': 'Iniúchtaí',
  'home.search.placeholder': 'Cuardaigh de réir custaiméara, seoladh…',
  'home.empty.title': 'Níl Aon Iniúchadh Fós',
  'home.fab.new': '+ Iniúchadh Nua',
  'new.button.create': 'Tóg Grianghraif →',
  'inspection.button.camera': 'Ceamara',
  'inspection.button.library': 'Leabharlann',
  'inspection.button.quote': 'Luachan',
  'inspection.button.report': 'Tuairisc',
  'photo.mode.view': 'Féach',
  'photo.mode.draw': 'Tarraing',
  'photo.severity.title': 'Leibhéal Tromchúise',
  'photo.severity.none': 'Aon',
  'photo.severity.low': 'Íseal',
  'photo.severity.medium': 'Meánach',
  'photo.severity.high': 'Ard',
  'photo.notes.title': 'Nótaí Iniúchóra',
  'photo.notes.save': 'Sábháil Nótaí',
  'customers.title': 'Custaiméirí',
  'jobs.title': 'Jabanna',
  'settings.title': 'Socruithe',
  'common.cancel': 'Cealaigh',
  'common.delete': 'Scrios',
  'common.save': 'Sábháil',
};

const ES: Dict = {
  'tabs.jobs': 'Trabajos',
  'tabs.inspections': 'Inspecciones',
  'tabs.customers': 'Clientes',
  'tabs.settings': 'Ajustes',
  'home.title': 'Inspecciones',
  'home.search.placeholder': 'Buscar por cliente, dirección, fecha…',
  'home.empty.title': 'Aún no hay inspecciones',
  'home.empty.subtitle': 'Toca el botón de abajo para iniciar tu primera inspección.',
  'home.fab.new': '+ Nueva Inspección',
  'new.title': 'Nueva Inspección',
  'new.section.customer': 'CLIENTE',
  'new.section.inspector': 'INSPECTOR',
  'new.section.notes': 'NOTAS',
  'new.field.customerName': 'Nombre del Cliente *',
  'new.field.customerEmail': 'Email del Cliente (opcional)',
  'new.field.address': '{postcode} *',
  'new.field.ref': 'Ref: (p. ej. nombre del proyecto)',
  'new.field.scope': 'Alcance del Trabajo',
  'new.field.inspector': 'Nombre del Inspector',
  'new.button.create': 'Empezar a Tomar Fotos →',
  'inspection.button.camera': 'Cámara',
  'inspection.button.library': 'Galería',
  'inspection.button.quote': 'Presupuesto',
  'inspection.button.report': 'Informe',
  'inspection.empty': 'Aún no hay fotos. Toca un botón abajo para añadir.',
  'photo.mode.view': 'Ver',
  'photo.mode.draw': 'Dibujar',
  'photo.severity.title': 'Nivel de Gravedad',
  'photo.severity.none': 'Ninguno',
  'photo.severity.low': 'Bajo',
  'photo.severity.medium': 'Medio',
  'photo.severity.high': 'Alto',
  'photo.notes.title': 'Notas del Inspector',
  'photo.notes.save': 'Guardar Notas',
  'customers.title': 'Clientes',
  'jobs.title': 'Trabajos',
  'jobs.section.today': 'Hoy',
  'jobs.section.upcoming': 'Próximos',
  'jobs.section.recent': 'Recientes',
  'settings.title': 'Ajustes',
  'settings.section.locale': 'Región e Idioma',
  'settings.field.region': 'Región',
  'settings.field.language': 'Idioma',
  'settings.field.units': 'Unidades',
  'settings.field.currency': 'Moneda',
  'settings.units.metric': 'Métrico (m, m²)',
  'settings.units.imperial': 'Imperial (ft, ft²)',
  'settings.openCompany': 'Editar Perfil de Empresa',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.save': 'Guardar',
};

const DICTS: Record<Language, Dict> = { en: EN, ga: GA, es: ES };

export function translate(lang: Language, key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[lang] || EN;
  let s = dict[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/** Hook that re-renders when language changes (poll-on-focus pattern is fine here). */
export function useT() {
  const [lang, setLang] = useState<Language>('en');
  useEffect(() => {
    let mounted = true;
    loadLocale().then((l) => { if (mounted) setLang(l.language); });
    return () => { mounted = false; };
  }, []);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );
  return t;
}
