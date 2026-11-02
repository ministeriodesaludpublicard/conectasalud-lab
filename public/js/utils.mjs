import { USE_CASES } from './config.mjs';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export function truncate(value, max = 180) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function normalizeServerUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('La URL debe utilizar HTTP o HTTPS.');
  if (parsed.username || parsed.password) throw new Error('La URL no puede contener credenciales.');
  return parsed.toString().replace(/\/+$/, '');
}

export function profilesOf(resource) {
  return Array.isArray(resource?.meta?.profile) ? resource.meta.profile : [];
}

export function identifyUseCase(resource) {
  const profiles = profilesOf(resource);
<<<<<<< HEAD
  return USE_CASES.find(item => profiles.includes(item.profile)) || null;
=======
  const byProfile = USE_CASES.find(item => profiles.includes(item.profile));
  if (byProfile) return byProfile;
  const composition = resource?.entry?.find(entry => entry.resource?.resourceType === 'Composition')?.resource;
  return USE_CASES.find(item => (composition?.type?.coding || []).some(
    coding => coding.system === 'http://loinc.org' && coding.code === item.code
  )) || null;
}

/**
 * Etiqueta de caso de uso para la interfaz. LAB no tiene un track numerado
 * en la navegación actual; nunca debemos mostrar "Track undefined".
 * El mapa también protege ante configuraciones conservadas en caché.
 */
export function formatUseCaseLabel(useCase) {
  if (!useCase) return 'No identificado';
  const label = String(useCase.label ?? '').trim() || 'Caso de uso sin nombre';
  const expectedTrack = { nps: 1, notif: 2, onco: 3 }[useCase.key];
  const track = expectedTrack || (Number.isInteger(useCase.track) && useCase.track > 0 ? useCase.track : null);
  return track ? `Track ${track} · ${label}` : label;
>>>>>>> origin/master
}

export function getCodingDisplay(codeable) {
  return codeable?.text || codeable?.coding?.find(coding => coding.display)?.display || codeable?.coding?.[0]?.code || 'N/D';
}

export function resourceDisplay(resource) {
  if (!resource) return 'Sin recurso';
  if (resource.resourceType === 'Patient' || resource.resourceType === 'Practitioner') {
    const name = resource.name?.[0];
    const fullName = [...(name?.given || []), name?.family].filter(Boolean).join(' ');
    return fullName || resource.id || (resource.resourceType === 'Patient' ? 'Paciente sin nombre' : 'Profesional');
  }
  if (resource.resourceType === 'Organization') return resource.name || resource.id || 'Organización';
  if (resource.resourceType === 'Composition') return resource.title || resource.id || 'Composition';
  if (resource.resourceType === 'PractitionerRole') return getCodingDisplay(resource.code?.[0]) || resource.id || 'Rol profesional';
  return resource.id || resource.resourceType;
}

export function formatDate(value) {
  if (!value) return 'N/D';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function narrativeText(div) {
  if (!div) return '';
  const container = document.createElement('div');
  container.innerHTML = div;
  return container.textContent.replace(/\s+/g, ' ').trim();
}
