import {
  USE_CASES, CUSTOM_SERVERS_KEY, SELECTED_SERVER_KEY,
  PAGE_COPY, RESOURCE_COPY, RESOURCE_FIELDS
} from './js/config.mjs?v=1.9.1';
import {
  escapeHtml, truncate, normalizeServerUrl, profilesOf, identifyUseCase,
  resourceDisplay, formatDate, narrativeText, getCodingDisplay, formatUseCaseLabel
} from './js/utils.mjs?v=1.9.1';
import { requestJson } from './js/api.mjs';
import { buildManagedResource } from './js/resourceFactory.mjs';

const state = {
  config: null,
  servers: [],
  selectedServerUrl: null,
  managedResourceType: 'Organization',
  catalogs: { Organization: [], Patient: [], Practitioner: [] },
  catalogTotals: { Organization: 0, Patient: 0, Practitioner: 0 },
  patientSearchResults: [],
  guidedPdf: null,
  resource: null,
  fileName: null,
  validation: null,
  iti65Transaction: null,
  iti65PreparedKey: null,
  iti65TransactionStale: false,
  iti65TransactionValidation: null,
  iti65Debounce: null,
  binaryPreviewUrl: null,
  activeBinaryDownload: null,
  serverRevision: 0,
  explorerNextUrl: null,
  explorerRevision: 0,
  debounce: null
};

const el = Object.fromEntries([
  'pageTitle', 'pageDescription', 'serverSelect', 'connectionDot', 'testServerButton', 'openServersButton', 'menuButton',
  'jsonFileInput', 'formatButton', 'clearEditorButton', 'jsonEditor', 'editorMeta', 'syntaxBadge',
  'syntaxMessage', 'resourcePreview', 'downloadButton', 'validateButton', 'validationResult',
  'binaryPreviewDialog', 'binaryPreviewFrame', 'binaryPreviewTitle', 'binaryDownloadButton',
  'resourceUrlInput', 'loadUrlButton',
  'iti65ResourceSummary', 'prepareIti65Button', 'iti65TransactionEditor',
  'iti65TransactionMeta', 'iti65TransactionSyntax', 'iti65TransactionMessage', 'formatIti65Button', 'downloadIti65Button',
  'iti65ValidateButton', 'iti65SendButton', 'iti65TransactionValidation', 'iti65Result',
  'patientIdentifierTypeSelect', 'patientIdentifierAdvanced', 'patientIdentifierSystemInput', 'patientIdentifierInput', 'documentTypeFilter', 'documentStatusFilter', 'retrieveUrlInput', 'iti67Button', 'iti68Button',
  'queryStatus', 'queryResult', 'refreshLogsButton', 'logsList', 'toast',
  'serverNameInput', 'serverUrlConfigInput', 'addServerButton', 'serverTokenInput', 'serverList',
  'explorerServerSelect', 'explorerResourceType', 'explorerGlobalToggle', 'explorerSearchButton', 'explorerNextButton', 'explorerHelp', 'explorerResult',
  'refreshResourcesButton', 'resourceListTitle', 'resourceListMeta', 'managedResourceList', 'resourceFormTitle', 'managedResourceForm', 'managedResourceFields',
  'refreshGuidedContextButton', 'guidedCaseForm', 'guidedUseCase', 'guidedPatientMode', 'guidedPatient', 'guidedExistingPatientField', 'guidedNewPatientFields', 'guidedPractitioner', 'guidedOrganization', 'guidedDate', 'guidedReason',
  'guidedPatientIdentifier', 'guidedPatientIdentifierSystem', 'guidedPatientGiven', 'guidedPatientFamily', 'guidedPatientBirthDate', 'guidedPatientGender', 'searchGuidedPatientButton', 'guidedPatientSearchMeta', 'guidedSelectedPatient', 'guidedPatientResults',
  'guidedNpsFields', 'guidedLabFields', 'guidedNotifFields', 'guidedOncoFields', 'guidedPdfField', 'guidedPdfInput', 'guidedPdfMeta', 'previewGuidedPdfButton', 'generateGuidedButton',
  'npsDiagnosisCode', 'npsDiagnosisDisplay', 'npsDiagnosisDetail', 'npsAllergyCode', 'npsAllergyDisplay', 'npsAllergyDetail', 'npsMedicationCode', 'npsMedicationDisplay', 'npsMedicationDetail',
  'labTestCode', 'labTestDisplay', 'labResultText', 'notifDiagnosisCode', 'notifDiagnosisDisplay', 'notifDiagnosisDetail', 'notifSymptoms', 'oncoDiagnosisCode', 'oncoDiagnosisDisplay', 'oncoStage', 'oncoTumorSite', 'oncoTreatment',
  'newPatientGiven', 'newPatientFamily', 'newPatientSecondFamily', 'newPatientIdentifierValue', 'newPatientIdentifierType', 'newPatientIdentifierSystem', 'newPatientGender', 'newPatientBirthDate', 'newPatientPhone', 'newPatientEmail'
].map(id => [id, document.getElementById(id)]));

function showToast(message, error = false) {
  el.toast.textContent = message;
  el.toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.toast.className = 'toast'; }, 3500);
}

function selectedServer() {
  return state.servers.find(item => item.url === state.selectedServerUrl) || state.servers[0] || null;
}

function serverRequest(extra = {}) {
  return { serverUrl: selectedServer()?.url, token: el.serverTokenInput?.value || '', ...extra };
}

function serverContext() {
  return { revision: state.serverRevision, serverUrl: state.selectedServerUrl };
}

function isCurrentServerContext(context) {
  return context.revision === state.serverRevision && context.serverUrl === state.selectedServerUrl;
}

function readCustomServers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_SERVERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCustomServers() {
  const custom = state.servers.filter(item => !item.official).map(({ id, name, url }) => ({ id, name, url }));
  localStorage.setItem(CUSTOM_SERVERS_KEY, JSON.stringify(custom));
}

function renderServerList() {
  if (!state.servers.length) {
    el.serverList.className = 'server-list empty-state compact-empty';
    el.serverList.textContent = 'No hay servidores configurados.';
    return;
  }
  el.serverList.className = 'server-list';
  el.serverList.innerHTML = state.servers.map(server => {
    const role = server.role || 'general';
    const roleName = { general: 'FHIR general', registry: 'Registro / índices', repository: 'Repositorio documental' }[role] || 'FHIR general';
    const active = role === 'general' && server.url === state.selectedServerUrl;
    const action = role === 'general'
      ? `<button class="button ${active ? 'ghost' : 'secondary'} compact select-server" data-server-id="${escapeHtml(server.id)}">${active ? 'Activo' : 'Seleccionar'}</button>`
      : `<button class="button secondary compact explore-server" data-server-id="${escapeHtml(server.id)}">Explorar</button>`;
    return `<article class="server-item${active ? ' active' : ''}"><div><h4>${escapeHtml(server.name)} <span class="server-badge">${server.official ? 'Oficial' : 'Personalizado'}</span> <span class="server-badge">${roleName}</span></h4><p>${escapeHtml(server.url)}</p></div><div class="server-actions">${action}${server.official ? '' : `<button class="button ghost compact danger delete-server" data-server-id="${escapeHtml(server.id)}">Eliminar</button>`}</div></article>`;
  }).join('');
}

function resetServerDependentViews(server) {
  state.catalogs = { Organization: [], Patient: [], Practitioner: [] };
  state.catalogTotals = { Organization: 0, Patient: 0, Practitioner: 0 };
  state.patientSearchResults = [];
  state.validation = null;
  state.iti65TransactionValidation = null;
  renderResourceCounts();

  el.resourceListMeta.textContent = `Servidor activo: ${server.name}`;
  el.managedResourceList.className = 'managed-resource-list empty-state compact-empty';
  el.managedResourceList.textContent = 'El servidor cambió. Recargando recursos desde el nuevo sandbox…';
  renderManagedResourceForm();

  fillGuidedSelect(el.guidedPractitioner, [], 'Cargando profesionales del servidor activo…');
  fillGuidedSelect(el.guidedOrganization, [], 'Cargando organizaciones del servidor activo…');
  resetGuidedPatientSearch('El servidor cambió. Busca nuevamente al paciente en el sandbox activo.');

  el.queryStatus.className = 'badge neutral';
  el.queryStatus.textContent = 'Sin consulta';
  el.queryResult.className = 'empty-state';
  el.queryResult.textContent = 'La selección del sandbox cambió. Las consultas documentales anteriores se descartaron.';
  state.explorerRevision += 1;
  state.explorerNextUrl = null;
  el.explorerNextButton.disabled = true;
  el.explorerResult.className = 'empty-state compact-empty';
  el.explorerResult.textContent = 'El servidor FHIR activo cambió. Ejecuta una nueva consulta documental.';
  el.retrieveUrlInput.value = '';

  el.iti65Result.className = 'empty-state';
  el.iti65Result.textContent = 'Todavía no se ha publicado el documento cargado.';
  resetIti65TransactionValidation('El documento se conserva; vuelve a ejecutar <strong>$validate</strong> si fue modificado.');
  el.validationResult.className = 'validation-content empty-state compact-empty';
  el.validationResult.innerHTML = `Servidor cambiado a <strong>${escapeHtml(server.name)}</strong>. El JSON permanece en el editor; ejecuta <strong>$validate</strong> nuevamente contra este servidor.`;
  renderIti65Selection();
}

function reloadActiveServerPage() {
  const activePage = document.querySelector('.page.active')?.dataset.page;
  if (activePage === 'resources') loadManagedResources();
  if (activePage === 'guided') loadGuidedContext();
}

function selectServer(url) {
  const server = state.servers.find(item => item.url === url);
  if (!server) return;
  const changed = Boolean(state.selectedServerUrl && state.selectedServerUrl !== server.url);
  state.selectedServerUrl = server.url;
  if (changed) {
    state.serverRevision += 1;
    el.serverTokenInput.value = '';
    resetServerDependentViews(server);
  }
  localStorage.setItem(SELECTED_SERVER_KEY, server.url);
  el.serverSelect.value = server.url;
  el.connectionDot.className = 'connection-dot';
  renderServerList();
  if (changed) {
    reloadActiveServerPage();
    showToast(`Servidor activo: ${server.name}. Se descartaron los datos y resultados del servidor anterior.`);
  }
}

function loadServers(config) {
  const official = (config.fhirServers || [{ id: 'default', name: 'Sandbox FHIR principal', url: config.hapiFhirUrl }]).map(item => ({ ...item, official: true }));
  const custom = readCustomServers().map(item => ({ ...item, official: false }));
  state.servers = [...official, ...custom.map(item => ({ ...item, role: 'general' }))].filter((item, index, list) => list.findIndex(candidate => candidate.url === item.url) === index);
  el.serverSelect.innerHTML = state.servers.filter(item => (item.role || 'general') === 'general').map(item => `<option value="${escapeHtml(item.url)}">${escapeHtml(item.name)}</option>`).join('');
  const saved = localStorage.getItem(SELECTED_SERVER_KEY);
  const defaultServerUrl = config.defaultFhirServerUrl || config.hapiFhirUrl;
  selectServer(state.servers.some(item => item.url === saved && (item.role || 'general') === 'general') ? saved : defaultServerUrl);
  initializeExplorerServers();
}

function addCustomServer() {
  const name = el.serverNameInput.value.trim();
  if (!name) return showToast('Indica un nombre para el servidor.', true);
  let url;
  try { url = normalizeServerUrl(el.serverUrlConfigInput.value); }
  catch (error) { return showToast(error.message, true); }
  const existing = state.servers.find(item => item.url === url);
  if (existing) {
    selectServer(existing.url);
    return showToast('Ese servidor ya estaba registrado; quedó seleccionado.');
  }
  state.servers.push({ id: `custom-${Date.now()}`, name, url, role: 'general', official: false });
  saveCustomServers();
  el.serverSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(url)}">${escapeHtml(name)}</option>`);
  el.serverNameInput.value = '';
  el.serverUrlConfigInput.value = '';
  selectServer(url);
  showToast('Servidor agregado y seleccionado. Usa “Probar” para verificarlo.');
}

function handleServerListAction(event) {
  const selectButton = event.target.closest('.select-server');
  const deleteButton = event.target.closest('.delete-server');
  const explorerButton = event.target.closest('.explore-server');
  const target = selectButton || deleteButton || explorerButton;
  if (!target) return;
  const server = state.servers.find(item => item.id === target.dataset.serverId);
  if (!server) return;
  if (selectButton) return selectServer(server.url);
  if (explorerButton) { el.explorerServerSelect.value = server.id; updateExplorerType(); showPage('queries'); return; }
  state.servers = state.servers.filter(item => item.id !== server.id);
  saveCustomServers();
  el.serverSelect.querySelector(`option[value="${CSS.escape(server.url)}"]`)?.remove();
  if (state.selectedServerUrl === server.url) selectServer(state.servers[0]?.url);
  else renderServerList();
  showToast('Servidor personalizado eliminado.');
}

function formField(definition) {
  const [name, label, type, required, placeholder, options] = definition;
  if (type === 'select') return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}" ${required ? 'required' : ''}>${options.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join('')}</select></label>`;
  return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" ${required ? 'required' : ''} placeholder="${escapeHtml(placeholder || '')}" /></label>`;
}

function renderManagedResourceForm() {
  const copy = RESOURCE_COPY[state.managedResourceType];
  el.resourceListTitle.textContent = copy[0];
  el.resourceFormTitle.textContent = copy[1];
  el.managedResourceFields.innerHTML = RESOURCE_FIELDS[state.managedResourceType].map(formField).join('');
}

function renderResourceCounts() {
  document.querySelectorAll('[data-resource-count]').forEach(badge => {
    badge.textContent = String(state.catalogTotals[badge.dataset.resourceCount] || 0);
  });
}

function managedResourceSecondary(resource) {
  return [resource.identifier?.[0]?.value, resource.telecom?.find(item => item.system === 'email')?.value, resource.address?.[0]?.city].filter(Boolean).join(' · ');
}

function renderManagedResources() {
  const records = state.catalogs[state.managedResourceType] || [];
  el.resourceListMeta.textContent = `${records.length} recurso(s) · ${selectedServer()?.name || 'Servidor no seleccionado'}`;
  if (!records.length) {
    el.managedResourceList.className = 'managed-resource-list empty-state compact-empty';
    el.managedResourceList.textContent = 'No se encontraron recursos de este tipo.';
    return;
  }
  el.managedResourceList.className = 'managed-resource-list';
  el.managedResourceList.innerHTML = records.map(resource => `<article class="managed-resource-item"><div><h4>${escapeHtml(resourceDisplay(resource))}</h4><p>${escapeHtml(managedResourceSecondary(resource) || `${resource.resourceType}/${resource.id}`)}</p></div><button class="button ghost compact open-managed-resource" data-resource-id="${escapeHtml(resource.id)}">Abrir JSON</button></article>`).join('');
}

async function fetchCatalog(resourceType, context = serverContext()) {
  const payload = await requestJson('/api/fhir/resources/search', {
    method: 'POST',
    body: JSON.stringify(serverRequest({ resourceType, serverUrl: context.serverUrl }))
  });
  if (!isCurrentServerContext(context)) return null;
  const records = (payload.result.bundle?.entry || []).map(entry => entry.resource).filter(resource => resource?.resourceType === resourceType);
  state.catalogs[resourceType] = records;
  state.catalogTotals[resourceType] = Number.isFinite(payload.result.bundle?.total) ? payload.result.bundle.total : records.length;
  renderResourceCounts();
  return records;
}

async function loadManagedResources() {
  const context = serverContext();
  el.managedResourceList.className = 'managed-resource-list empty-state compact-empty';
  el.managedResourceList.textContent = 'Consultando el servidor FHIR…';
  try {
    await Promise.all(['Organization', 'Patient', 'Practitioner'].map(type => fetchCatalog(type, context)));
    if (!isCurrentServerContext(context)) return;
    renderManagedResourceForm();
    renderManagedResources();
  } catch (error) {
    if (!isCurrentServerContext(context)) return;
    el.managedResourceList.textContent = error.message;
    showToast(error.message, true);
  }
}

async function createManagedResource(event) {
  event.preventDefault();
  const context = serverContext();
  const data = Object.fromEntries(new FormData(el.managedResourceForm).entries());
  const resource = buildManagedResource(state.managedResourceType, data);
  const submit = el.managedResourceForm.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Creando…';
  try {
    const payload = await requestJson('/api/fhir/resources/create', {
      method: 'POST', body: JSON.stringify(serverRequest({ resourceType: state.managedResourceType, resource, serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return;
    const created = payload.result.resource?.resourceType ? payload.result.resource : resource;
    el.jsonEditor.value = JSON.stringify(created, null, 2); state.fileName = `${state.managedResourceType}-${created.id || 'nuevo'}.json`; parseEditor({ silent: true });
    el.managedResourceForm.reset();
    await loadManagedResources();
    showToast(`${state.managedResourceType} creado en ${selectedServer()?.name}.`);
  } catch (error) {
    if (isCurrentServerContext(context)) showToast(error.message, true);
  }
  finally { submit.disabled = false; submit.textContent = 'Crear en el servidor FHIR'; }
}

function handleManagedResourceList(event) {
  const button = event.target.closest('.open-managed-resource');
  if (!button) return;
  const resource = state.catalogs[state.managedResourceType].find(item => item.id === button.dataset.resourceId);
  if (!resource) return;
  el.jsonEditor.value = JSON.stringify(resource, null, 2); state.fileName = `${resource.resourceType}-${resource.id}.json`; parseEditor({ silent: true }); showPage('editor');
}

function changeManagedResourceType(type) {
  state.managedResourceType = type;
  document.querySelectorAll('.resource-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.resourceType === type));
  renderManagedResourceForm();
  loadManagedResources();
}

function fillGuidedSelect(select, records, placeholder) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${records.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(resourceDisplay(item))}</option>`).join('')}`;
}

async function loadGuidedContext() {
  const context = serverContext();
  el.refreshGuidedContextButton.disabled = true; el.refreshGuidedContextButton.textContent = 'Cargando…';
  try {
    const [practitioners, organizations] = await Promise.all([
      fetchCatalog('Practitioner', context), fetchCatalog('Organization', context)
    ]);
    if (!isCurrentServerContext(context)) return;
    fillGuidedSelect(el.guidedPractitioner, practitioners, 'Seleccionar profesional');
    fillGuidedSelect(el.guidedOrganization, organizations, 'Seleccionar organización');
    showToast('Profesionales y organizaciones cargados para la autoría guiada.');
  } catch (error) {
    if (isCurrentServerContext(context)) showToast(error.message, true);
  } finally {
    if (isCurrentServerContext(context)) {
      el.refreshGuidedContextButton.disabled = false;
      el.refreshGuidedContextButton.textContent = 'Cargar autores y organizaciones';
    }
  }
}

function patientIdentifiers(patient) {
  return (patient.identifier || []).map(identifier => [identifier.system, identifier.value].filter(Boolean).join(' | ')).filter(Boolean).join('; ') || 'Sin identificador';
}

function patientDemographicSummary(patient) {
  const contact = (patient.telecom || []).find(item => item.value)?.value;
  return [patientIdentifiers(patient), patient.birthDate, patient.gender, contact].filter(Boolean).join(' · ');
}

function resetGuidedPatientSearch(message = 'Ningún paciente seleccionado.') {
  el.guidedPatient.value = '';
  state.patientSearchResults = [];
  el.guidedSelectedPatient.className = 'selected-patient empty-state compact-empty';
  el.guidedSelectedPatient.textContent = message;
  el.guidedPatientResults.innerHTML = '';
  el.guidedPatientSearchMeta.textContent = 'Indica un identificador o al menos un nombre o apellido.';
}

function renderGuidedPatientResults() {
  const records = state.patientSearchResults;
  el.guidedPatientSearchMeta.textContent = `${records.length} candidato(s) devuelto(s) por ${selectedServer()?.name || 'el servidor activo'}.`;
  if (!records.length) {
    el.guidedPatientResults.innerHTML = '<div class="notice info">No se encontraron coincidencias. Puedes ampliar los criterios o incluir un PatientDO nuevo dentro del documento.</div>';
    return;
  }
  el.guidedPatientResults.innerHTML = records.map(patient => `<article class="patient-candidate${patient.id === el.guidedPatient.value ? ' selected' : ''}"><div><h4>${escapeHtml(resourceDisplay(patient))}</h4><p>${escapeHtml(patientDemographicSummary(patient))}</p></div><button class="button secondary compact select-guided-patient" type="button" data-patient-id="${escapeHtml(patient.id || '')}" ${patient.id ? '' : 'disabled'}>Seleccionar</button></article>`).join('');
}

function selectGuidedPatient(patientId) {
  const patient = state.patientSearchResults.find(item => item.id === patientId);
  if (!patient) return;
  el.guidedPatient.value = patient.id;
  el.guidedSelectedPatient.className = 'selected-patient';
  el.guidedSelectedPatient.innerHTML = `<strong>Paciente seleccionado: ${escapeHtml(resourceDisplay(patient))}</strong><span>${escapeHtml(patientDemographicSummary(patient))}</span>`;
  renderGuidedPatientResults();
}

async function searchGuidedPatient() {
  const criteria = {
    identifier: el.guidedPatientIdentifier.value.trim(), identifierSystem: el.guidedPatientIdentifierSystem.value.trim(),
    given: el.guidedPatientGiven.value.trim(), family: el.guidedPatientFamily.value.trim(),
    birthDate: el.guidedPatientBirthDate.value, gender: el.guidedPatientGender.value
  };
  if (!criteria.identifier && !criteria.given && !criteria.family) return showToast('Indica un identificador, nombre o apellido para buscar.', true);
  const context = serverContext();
  el.searchGuidedPatientButton.disabled = true; el.searchGuidedPatientButton.textContent = 'Buscando…';
  el.guidedPatientSearchMeta.textContent = 'Consultando candidatos en el servidor activo…';
  try {
    const payload = await requestJson('/api/fhir/patients/search', {
      method: 'POST', body: JSON.stringify(serverRequest({ criteria, serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return;
    state.patientSearchResults = (payload.result.bundle?.entry || []).map(entry => entry.resource).filter(resource => resource?.resourceType === 'Patient');
    el.guidedPatient.value = '';
    el.guidedSelectedPatient.className = 'selected-patient empty-state compact-empty';
    el.guidedSelectedPatient.textContent = 'Selecciona uno de los candidatos encontrados.';
    renderGuidedPatientResults();
  } catch (error) {
    if (!isCurrentServerContext(context)) return;
    state.patientSearchResults = [];
    el.guidedPatientResults.innerHTML = `<div class="notice warning"><strong>No fue posible buscar pacientes.</strong><br>${escapeHtml(error.message)}</div>`;
    el.guidedPatientSearchMeta.textContent = 'La consulta no se completó.';
    showToast(error.message, true);
  } finally {
    el.searchGuidedPatientButton.disabled = false; el.searchGuidedPatientButton.textContent = 'Buscar paciente';
  }
}

function handleGuidedPatientResults(event) {
  const button = event.target.closest('.select-guided-patient');
  if (button) selectGuidedPatient(button.dataset.patientId);
}

function showGuidedCaseFields() {
  const useCase = el.guidedUseCase.value;
  el.guidedNpsFields.hidden = useCase !== 'nps';
  el.guidedLabFields.hidden = useCase !== 'lab';
  el.guidedNotifFields.hidden = useCase !== 'notif';
  el.guidedOncoFields.hidden = useCase !== 'onco';
  el.guidedPdfField.hidden = useCase === 'nps';
}

function showGuidedPatientMode() {
  const isNew = el.guidedPatientMode.value === 'new';
  el.guidedExistingPatientField.hidden = isNew;
  el.guidedNewPatientFields.hidden = !isNew;
}

function readGuidedPdf(file) {
  state.guidedPdf = null;
  el.previewGuidedPdfButton.hidden = true;
  if (!file) { el.guidedPdfMeta.textContent = 'No se ha seleccionado un archivo.'; return; }
  if (file.type !== 'application/pdf' || file.size > 12 * 1024 * 1024) { el.guidedPdfInput.value = ''; return showToast('Selecciona un PDF de hasta 12 MB.', true); }
  const reader = new FileReader();
  reader.onload = () => {
    state.guidedPdf = { name: file.name, contentType: 'application/pdf', data: String(reader.result).split(',')[1] };
    el.guidedPdfMeta.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    el.previewGuidedPdfButton.hidden = false;
  };
  reader.onerror = () => showToast('No fue posible leer el PDF.', true);
  reader.readAsDataURL(file);
}

async function generateGuidedDocument(event) {
  event.preventDefault();
  const context = serverContext();
  const useCase = el.guidedUseCase.value;
  const patientMode = el.guidedPatientMode.value;
  if ((patientMode === 'existing' && !el.guidedPatient.value) || !el.guidedPractitioner.value || !el.guidedOrganization.value) return showToast('Completa el paciente, el profesional y la organización.', true);
  if (useCase !== 'nps' && !state.guidedPdf) return showToast('Este caso requiere adjuntar el documento PDF.', true);
  const input = {
    useCase, patientMode, patientId: el.guidedPatient.value, practitionerId: el.guidedPractitioner.value, organizationId: el.guidedOrganization.value,
    newPatient: patientMode === 'new' ? { given: el.newPatientGiven.value, family: el.newPatientFamily.value, secondFamily: el.newPatientSecondFamily.value, identifierValue: el.newPatientIdentifierValue.value, identifierType: el.newPatientIdentifierType.value, identifierSystem: el.newPatientIdentifierSystem.value, gender: el.newPatientGender.value, birthDate: el.newPatientBirthDate.value, phone: el.newPatientPhone.value, email: el.newPatientEmail.value } : undefined,
    encounterDate: el.guidedDate.value ? new Date(el.guidedDate.value).toISOString() : undefined, encounterReason: el.guidedReason.value,
    diagnosis: useCase === 'nps' ? { code: el.npsDiagnosisCode.value, display: el.npsDiagnosisDisplay.value, detail: el.npsDiagnosisDetail.value }
      : useCase === 'notif' ? { code: el.notifDiagnosisCode.value, display: el.notifDiagnosisDisplay.value, detail: el.notifDiagnosisDetail.value }
        : useCase === 'onco' ? { code: el.oncoDiagnosisCode.value, display: el.oncoDiagnosisDisplay.value, detail: [el.oncoStage.value, el.oncoTumorSite.value].filter(Boolean).join(' · ') }
          : {},
    allergy: { code: el.npsAllergyCode.value, display: el.npsAllergyDisplay.value, detail: el.npsAllergyDetail.value },
    medication: { code: el.npsMedicationCode.value, display: el.npsMedicationDisplay.value, detail: el.npsMedicationDetail.value },
    labTestCode: el.labTestCode.value, labTestDisplay: el.labTestDisplay.value, labResultText: el.labResultText.value,
    symptoms: el.notifSymptoms.value, stage: el.oncoStage.value, tumorSite: el.oncoTumorSite.value, treatment: el.oncoTreatment.value, pdf: state.guidedPdf
  };
  el.generateGuidedButton.disabled = true; el.generateGuidedButton.textContent = 'Generando…';
  try {
    const payload = await requestJson('/api/guided/build', {
      method: 'POST', body: JSON.stringify(serverRequest({ input, serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return;
    el.jsonEditor.value = JSON.stringify(payload.bundle, null, 2); state.fileName = `${useCase}-${payload.bundle.id}.json`; parseEditor({ silent: true }); showPage('editor');
    showToast('Bundle documental generado y cargado en el editor.');
  } catch (error) {
    if (isCurrentServerContext(context)) showToast(error.message, true);
  }
  finally { el.generateGuidedButton.disabled = false; el.generateGuidedButton.textContent = 'Generar JSON del caso'; }
}

function showPage(pageName) {
  document.querySelectorAll('[data-page]').forEach(page => {
    const active = page.dataset.page === pageName;
    page.classList.toggle('active', active);
    page.hidden = !active;
  });
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.pageTarget === pageName));
  const copy = PAGE_COPY[pageName] || PAGE_COPY.home;
  el.pageTitle.textContent = copy[0];
  el.pageDescription.textContent = copy[1];
  document.querySelector('.sidebar')?.classList.remove('open');
  if (pageName === 'iti65') {
    renderIti65Selection();
    if (isIti65Eligible(state.resource) && (!state.iti65Transaction || state.iti65TransactionStale)) prepareIti65Transaction();
  }
  if (pageName === 'activity') loadLogs();
  if (pageName === 'resources' && state.servers.length) loadManagedResources();
  if (pageName === 'guided' && state.servers.length && (!state.catalogs.Practitioner.length || !state.catalogs.Organization.length)) loadGuidedContext();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function flattenResource(value, path = '', output = []) {
  if (value === null || value === undefined) {
    output.push({ path, value: value === null ? 'null' : 'undefined' });
    return output;
  }
  if (typeof value !== 'object') {
    const cleanValue = path.endsWith('.data') ? `[contenido base64: ${String(value).length} caracteres]` : String(value);
    output.push({ path, value: cleanValue });
    return output;
  }
  if (Array.isArray(value)) {
    if (!value.length) output.push({ path, value: '[arreglo vacío]' });
    value.forEach((item, index) => flattenResource(item, `${path}[${index}]`, output));
    return output;
  }
  const entries = Object.entries(value);
  if (!entries.length) output.push({ path, value: '{objeto vacío}' });
  entries.forEach(([key, child]) => flattenResource(child, path ? `${path}.${key}` : key, output));
  return output;
}

function sanitizeNarrative(div) {
  if (!div) return '';
  const parsed = new DOMParser().parseFromString(String(div), 'text/html');
  const allowedTags = new Set(['DIV', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'A', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR']);
  [...parsed.body.querySelectorAll('*')].forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const allowed = name === 'title' || name === 'colspan' || name === 'rowspan' || (node.tagName === 'A' && name === 'href' && /^(https?:|mailto:|#)/i.test(value));
      if (!allowed) node.removeAttribute(attribute.name);
    });
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return parsed.body.innerHTML;
}

function collectNarratives(resource) {
  const narratives = [];
  const add = (item, label) => {
    if (item?.text?.div) narratives.push({ label, status: item.text.status || 'generated', html: sanitizeNarrative(item.text.div) });
  };
  add(resource, resource.resourceType);
  if (resource.resourceType === 'Bundle') {
    (resource.entry || []).forEach((entry, index) => {
      const item = entry?.resource;
      if (item) add(item, `${index + 1}. ${item.resourceType}${item.id ? `/${item.id}` : ''}`);
    });
  }
  return narratives;
}

function renderNarratives(resource) {
  const narratives = collectNarratives(resource);
  if (!narratives.length) return '<div class="preview-section"><h4>Narrativa FHIR</h4><p class="narrative-card muted">El recurso no contiene el elemento <code>text.div</code>.</p></div>';
  return `<div class="preview-section"><h4>Narrativa FHIR</h4><p class="section-help">Contenido XHTML de <code>text.div</code>, presentado de forma segura y conservando su estructura clínica.</p><div class="narrative-list">${narratives.map(item => `<details class="narrative-document" open><summary>${escapeHtml(item.label)} <span>${escapeHtml(item.status)}</span></summary><div class="fhir-narrative">${item.html}</div></details>`).join('')}</div></div>`;
}

function summaryItem(label, value) {
  return `<div class="summary-item"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? 'N/D')}</strong></div>`;
}

function referenceDisplay(reference, resourceMap = new Map()) {
  const value = reference?.reference || '';
  const target = resourceMap.get(value);
  const display = reference?.display || (target ? resourceDisplay(target) : '');
  return [display, value].filter(Boolean).join(display && value ? ' · ' : '') || 'N/D';
}

function renderCompositionSection(section, index, resourceMap = new Map()) {
  const title = section.title || getCodingDisplay(section.code) || `Sección ${index + 1}`;
  const code = section.code?.coding?.[0];
  const references = (section.entry || []).map(reference => `<li>${escapeHtml(referenceDisplay(reference, resourceMap))}</li>`).join('');
  const narrative = section.text?.div
    ? `<div class="composition-section-narrative">${sanitizeNarrative(section.text.div)}</div>`
    : `<p class="composition-empty">${escapeHtml(getCodingDisplay(section.emptyReason) !== 'N/D' ? getCodingDisplay(section.emptyReason) : 'Sin narrativa en esta sección.')}</p>`;
  const nested = (section.section || []).map((child, childIndex) => renderCompositionSection(child, childIndex, resourceMap)).join('');
  return `<article class="composition-section-card">
    <header><span class="composition-section-number">${index + 1}</span><div><h5>${escapeHtml(title)}</h5>${code ? `<code>${escapeHtml([code.system, code.code].filter(Boolean).join(' | '))}</code>` : ''}</div></header>
    ${narrative}
    <div class="composition-references"><strong>Referencias (${section.entry?.length || 0})</strong>${references ? `<ul>${references}</ul>` : '<span>Sin recursos referenciados</span>'}</div>
    ${nested ? `<div class="composition-subsections">${nested}</div>` : ''}
  </article>`;
}

function renderComposition(composition, resourceMap = new Map()) {
  const authors = (composition.author || []).map(item => referenceDisplay(item, resourceMap)).join('; ') || 'N/D';
  const attesters = (composition.attester || []).map(item => [item.mode, referenceDisplay(item.party, resourceMap)].filter(Boolean).join(' · ')).join('; ') || 'N/D';
  const sections = (composition.section || []).map((section, index) => renderCompositionSection(section, index, resourceMap)).join('');
  return `<div class="preview-section composition-preview"><h4>Composition · estructura clínica</h4>
    <div class="summary-grid composition-header">
      ${summaryItem('Título', composition.title)}${summaryItem('Estado', composition.status)}
      ${summaryItem('Tipo de documento', getCodingDisplay(composition.type))}${summaryItem('Fecha', formatDate(composition.date))}
      ${summaryItem('Paciente / sujeto', referenceDisplay(composition.subject, resourceMap))}${summaryItem('Encuentro', referenceDisplay(composition.encounter, resourceMap))}
      ${summaryItem('Autoría', authors)}${summaryItem('Custodio', referenceDisplay(composition.custodian, resourceMap))}
      ${summaryItem('Idioma', composition.language)}${summaryItem('Confidencialidad', composition.confidentiality || 'N/D')}
      ${summaryItem('Atestadores', attesters)}${summaryItem('Secciones clínicas', composition.section?.length || 0)}
    </div>
    ${composition.text?.div ? `<div class="composition-main-narrative"><h5>Narrativa general</h5><div class="fhir-narrative">${sanitizeNarrative(composition.text.div)}</div></div>` : ''}
    <div class="composition-sections"><h5>Secciones clínicas</h5>${sections || '<p class="composition-empty">La Composition no contiene secciones.</p>'}</div>
  </div>`;
}

function renderKnownResource(resource) {
  if (resource.resourceType === 'Patient') {
    const identifiers = (resource.identifier || []).map(item => `${item.system || 'sin system'} | ${item.value || 'sin value'}`).join('; ');
    const addresses = (resource.address || []).map(item => [item.line?.join(' '), item.city, item.state, item.country].filter(Boolean).join(', ')).join('; ');
    const emails = (resource.telecom || []).filter(item => item.system === 'email').map(item => item.value).filter(Boolean).join('; ');
    const phones = (resource.telecom || []).filter(item => ['phone', 'sms', 'fax'].includes(item.system)).map(item => `${item.use || item.system}: ${item.value}`).filter(Boolean).join('; ');
    const languages = (resource.communication || []).map(item => getCodingDisplay(item.language)).filter(value => value !== 'N/D').join('; ');
    return `<div class="preview-section"><h4>Datos del paciente</h4><div class="summary-grid">
      ${summaryItem('Nombre', resourceDisplay(resource))}${summaryItem('Sexo administrativo', resource.gender)}
      ${summaryItem('Fecha de nacimiento', resource.birthDate)}${summaryItem('Identificadores', identifiers || 'N/D')}
      ${summaryItem('Correo electrónico', emails || 'N/D')}${summaryItem('Teléfono', phones || 'N/D')}
      ${summaryItem('Dirección', addresses || 'N/D')}${summaryItem('Idioma', languages || 'N/D')}
      ${summaryItem('Estado civil', getCodingDisplay(resource.maritalStatus))}${summaryItem('Activo', resource.active === undefined ? 'N/D' : resource.active ? 'Sí' : 'No')}
    </div></div>`;
  }
  if (resource.resourceType === 'Organization') {
    return `<div class="preview-section"><h4>Organización</h4><div class="summary-grid">${summaryItem('Nombre', resource.name)}${summaryItem('Activo', resource.active === false ? 'No' : 'Sí')}${summaryItem('Identificador', resource.identifier?.[0]?.value)}${summaryItem('Contacto', resource.telecom?.[0]?.value)}</div></div>`;
  }
  if (resource.resourceType === 'Practitioner') {
    return `<div class="preview-section"><h4>Profesional</h4><div class="summary-grid">${summaryItem('Nombre', resourceDisplay(resource))}${summaryItem('Identificador', resource.identifier?.[0]?.value)}${summaryItem('Sexo', resource.gender)}${summaryItem('Activo', resource.active === false ? 'No' : 'Sí')}</div></div>`;
  }
  if (resource.resourceType === 'Composition') return renderComposition(resource);
  if (resource.resourceType === 'DocumentReference') {
    return `<div class="preview-section"><h4>Índice documental</h4><div class="summary-grid">${summaryItem('Estado', resource.status)}${summaryItem('Tipo', getCodingDisplay(resource.type))}${summaryItem('Paciente', resource.subject?.reference)}${summaryItem('Fecha', formatDate(resource.date))}${summaryItem('Documento', resource.content?.[0]?.attachment?.url)}${summaryItem('Formato', resource.content?.[0]?.attachment?.contentType)}</div></div>`;
  }
  if (resource.resourceType === 'List') {
    return `<div class="preview-section"><h4>Submission Set</h4><div class="summary-grid">${summaryItem('Estado', resource.status)}${summaryItem('Modo', resource.mode)}${summaryItem('Paciente', resource.subject?.reference)}${summaryItem('Documentos', resource.entry?.length || 0)}</div></div>`;
  }
  if (resource.resourceType === 'Binary') {
    return `<div class="preview-section"><h4>Contenido binario</h4><div class="summary-grid">${summaryItem('Tipo de contenido', resource.contentType)}${summaryItem('Tamaño aproximado', formatBinarySize(resource.data))}${summaryItem('Security context', resource.securityContext?.reference || 'N/D')}${summaryItem('Contenido', resource.data ? 'Incluido en Base64' : 'No incluido')}</div></div>`;
  }
  if (resource.resourceType === 'OperationOutcome') {
    return renderOperationOutcomeHtml({ outcome: resource, issues: (resource.issue || []).map((issue, index) => ({ ...issue, index: index + 1, diagnostics: issue.diagnostics || issue.details?.text, expression: issue.expression || [], location: issue.location || [] })) });
  }
  return '';
}

function formatBinarySize(data) {
  const base64 = String(data || '').replace(/\s/g, '');
  if (!base64) return '0 bytes';
  const padding = (base64.match(/=+$/)?.[0].length || 0);
  const bytes = Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function pdfBinaries(resource) {
  if (resource?.resourceType === 'Binary') return [{ key: 'root', binary: resource, label: `Binary/${resource.id || 'sin-id'}` }];
  if (resource?.resourceType !== 'Bundle') return [];
  return (resource.entry || []).map((entry, index) => ({
    key: String(index), binary: entry?.resource,
    label: `Binary/${entry?.resource?.id || index + 1}`
  })).filter(item => item.binary?.resourceType === 'Binary');
}

function renderBinaryDocuments(resource) {
  const binaries = pdfBinaries(resource);
  if (!binaries.length) return '';
  const items = binaries.map(item => {
    const contentType = String(item.binary.contentType || 'No declarado');
    const isPdf = contentType.split(';')[0].trim().toLowerCase() === 'application/pdf' && Boolean(item.binary.data);
    return `<article class="binary-card"><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(contentType)} · ${escapeHtml(formatBinarySize(item.binary.data))}</span></div><div class="button-row">${isPdf ? `<button class="button secondary compact binary-action" type="button" data-binary-key="${escapeHtml(item.key)}" data-binary-action="preview">Visualizar PDF</button><button class="button ghost compact binary-action" type="button" data-binary-key="${escapeHtml(item.key)}" data-binary-action="download">Descargar</button>` : '<span class="badge warning">Vista no disponible</span>'}</div></article>`;
  }).join('');
  return `<div class="preview-section"><h4>Documentos Binary</h4><p class="section-help">Los PDF incorporados como <code>Binary.data</code> pueden verificarse sin salir del editor.</p><div class="binary-list">${items}</div></div>`;
}

function binaryFromPreviewKey(key) {
  if (key === 'root' && state.resource?.resourceType === 'Binary') return state.resource;
  const index = Number(key);
  if (!Number.isInteger(index) || state.resource?.resourceType !== 'Bundle') return null;
  const resource = state.resource.entry?.[index]?.resource;
  return resource?.resourceType === 'Binary' ? resource : null;
}

function pdfBlob(binary) {
  const contentType = String(binary?.contentType || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/pdf') throw new Error('Este Binary no declara contentType application/pdf.');
  const base64 = String(binary?.data || '').replace(/\s/g, '');
  if (!base64) throw new Error('El Binary no contiene datos Base64.');
  if (base64.length > 24 * 1024 * 1024) throw new Error('El PDF supera el tamaño permitido para visualizarlo en el navegador.');
  let decoded;
  try { decoded = atob(base64); }
  catch { throw new Error('Binary.data no contiene Base64 válido.'); }
  if (!decoded.slice(0, 1024).includes('%PDF-')) throw new Error('El contenido no tiene la firma esperada de un archivo PDF.');
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return new Blob([bytes], { type: 'application/pdf' });
}

function closePdfPreview() {
  el.binaryPreviewFrame.removeAttribute('src');
  if (state.binaryPreviewUrl) URL.revokeObjectURL(state.binaryPreviewUrl);
  state.binaryPreviewUrl = null;
  state.activeBinaryDownload = null;
}

function openPdfPreview(binary, label = 'Documento PDF', fileName) {
  try {
    closePdfPreview();
    const blob = pdfBlob(binary);
    state.binaryPreviewUrl = URL.createObjectURL(blob);
    state.activeBinaryDownload = { binary, fileName: fileName || `${binary.id || 'documento-fhir'}.pdf` };
    el.binaryPreviewTitle.textContent = label;
    el.binaryPreviewFrame.src = state.binaryPreviewUrl;
    el.binaryPreviewDialog.showModal();
  } catch (error) { showToast(error.message, true); }
}

function downloadPdf(binary, fileName) {
  try {
    const blob = pdfBlob(binary);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName || `${binary.id || 'documento-fhir'}.pdf`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { showToast(error.message, true); }
}

function handleBinaryAction(event) {
  const button = event.target.closest('.binary-action');
  if (!button) return;
  const binary = binaryFromPreviewKey(button.dataset.binaryKey);
  if (!binary) return showToast('No se encontró el Binary seleccionado.', true);
  const fileName = `${binary.id || 'documento-fhir'}.pdf`;
  if (button.dataset.binaryAction === 'download') downloadPdf(binary, fileName);
  else openPdfPreview(binary, `Binary/${binary.id || 'sin-id'}`, fileName);
}

function renderBundle(bundle) {
  const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
  const counts = entries.reduce((acc, entry) => {
    const type = entry?.resource?.resourceType || 'Sin recurso';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const useCase = identifyUseCase(bundle);
  const composition = entries.find(entry => entry?.resource?.resourceType === 'Composition')?.resource;
  const patient = entries.find(entry => entry?.resource?.resourceType === 'Patient')?.resource;
  const resourceMap = new Map();
  entries.forEach(entry => {
    if (entry.fullUrl && entry.resource) resourceMap.set(entry.fullUrl, entry.resource);
    if (entry.resource?.resourceType && entry.resource?.id) resourceMap.set(`${entry.resource.resourceType}/${entry.resource.id}`, entry.resource);
  });
  const entryRows = entries.slice(0, 60).map((entry, index) => `<tr><td>${index + 1}</td><td><code>${escapeHtml(entry?.resource?.resourceType || '—')}</code></td><td>${escapeHtml(resourceDisplay(entry?.resource))}</td><td><code>${escapeHtml(entry.fullUrl || '—')}</code></td></tr>`).join('');
  return `
    <div class="preview-section"><h4>Resumen del Bundle</h4><div class="summary-grid">
      ${summaryItem('Tipo', bundle.type)}${summaryItem('Caso de uso', formatUseCaseLabel(useCase))}
      ${summaryItem('Entradas', entries.length)}${summaryItem('Fecha', formatDate(bundle.timestamp))}
      ${summaryItem('Título', composition?.title || 'N/D')}${summaryItem('Paciente', patient ? resourceDisplay(patient) : 'N/D')}
    </div></div>
    <div class="preview-section"><h4>Recursos incluidos</h4><div class="resource-counts">${Object.entries(counts).map(([type, count]) => `<span>${escapeHtml(type)} · ${count}</span>`).join('') || '<span>Sin entradas</span>'}</div></div>
    ${composition ? renderComposition(composition, resourceMap) : ''}
    <div class="preview-section"><h4>Estructura de entradas</h4><table class="data-table"><thead><tr><th>#</th><th>Tipo</th><th>Recurso</th><th>fullUrl</th></tr></thead><tbody>${entryRows || '<tr><td colspan="4">Sin entradas</td></tr>'}</tbody></table></div>`;
}

function renderGenericTable(resource) {
  const rows = flattenResource(resource);
  return `<div class="preview-section"><h4>Todos los campos FHIR</h4><p class="section-help">${rows.length} valores interpretados. La ruta conserva la ubicación exacta de cada campo dentro del JSON.</p><table class="data-table complete-fields"><thead><tr><th>Campo / ruta</th><th>Valor</th></tr></thead><tbody>${rows.map(item => `<tr><td><code>${escapeHtml(item.path)}</code></td><td>${escapeHtml(item.value)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderResourcePreview() {
  if (!state.resource) {
    el.resourcePreview.className = 'resource-preview empty-state';
    el.resourcePreview.innerHTML = '<div class="empty-icon">{ }</div><h3>Esperando un recurso FHIR</h3><p>El resultado se mostrará aquí sin cambiar de pantalla.</p>';
    return;
  }
  const resource = state.resource;
  const profiles = profilesOf(resource);
  const useCase = identifyUseCase(resource);
  el.resourcePreview.className = 'resource-preview';
  el.resourcePreview.innerHTML = `
    <div class="resource-hero"><div class="resource-type">${escapeHtml(resource.resourceType)}</div><p>ID: ${escapeHtml(resource.id || 'sin id')}${useCase ? ` · ${escapeHtml(formatUseCaseLabel(useCase))}` : ''}</p></div>
    <div class="profile-list">${profiles.length ? profiles.map(profile => `<div class="profile-chip" title="${escapeHtml(profile)}"><span>Perfil FHIR</span><code>${escapeHtml(profile)}</code></div>`).join('') : '<div class="profile-chip"><span>Perfil FHIR</span><code>Sin meta.profile declarado</code></div>'}</div>
    ${resource.resourceType === 'Bundle' ? renderBundle(resource) : renderKnownResource(resource)}
    ${renderBinaryDocuments(resource)}
    ${renderNarratives(resource)}
    ${renderGenericTable(resource)}`;
}

function setSyntaxState(kind, label, message = '') {
  el.syntaxBadge.className = `badge ${kind}`;
  el.syntaxBadge.textContent = label;
  el.syntaxMessage.className = `inline-message${kind === 'error' ? ' error' : ''}`;
  el.syntaxMessage.textContent = message;
}

function parseEditor({ silent = false } = {}) {
  const text = el.jsonEditor.value.trim();
  state.validation = null;
  resetValidationResult();
  if (!text) {
    state.resource = null; state.fileName = null;
    setSyntaxState('neutral', 'Sin contenido');
    el.editorMeta.textContent = 'Pega o carga un recurso';
    el.downloadButton.disabled = true; el.validateButton.disabled = true;
    renderResourcePreview(); renderIti65Selection();
    return null;
  }
  try {
    const resource = JSON.parse(text);
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) throw new Error('La raíz debe ser un objeto JSON.');
    if (!resource.resourceType || typeof resource.resourceType !== 'string') throw new Error('No se encontró resourceType. El objeto no puede interpretarse como recurso FHIR.');
    state.resource = resource;
    const size = new Blob([text]).size;
    setSyntaxState('success', 'JSON válido', `${resource.resourceType} · ${(size / 1024).toFixed(1)} KB`);
    el.editorMeta.textContent = `${resource.resourceType}${resource.id ? `/${resource.id}` : ''}`;
    el.downloadButton.disabled = false; el.validateButton.disabled = false;
    renderResourcePreview(); renderIti65Selection();
    return resource;
  } catch (error) {
    state.resource = null;
    setSyntaxState('error', 'Revisar JSON', error.message);
    el.editorMeta.textContent = 'Error de sintaxis o estructura';
    el.downloadButton.disabled = true; el.validateButton.disabled = true;
    renderResourcePreview(); renderIti65Selection();
    if (!silent) showToast(error.message, true);
    return null;
  }
}

function resetValidationResult() {
  el.validationResult.className = 'validation-content empty-state compact-empty';
  el.validationResult.innerHTML = 'Ejecuta <strong>$validate</strong> para comprobar FHIR R4, perfiles, terminología y referencias.';
}

function renderOperationOutcomeHtml(result) {
  const issues = result.issues || [];
  const counts = result.counts || issues.reduce((acc, issue) => {
    const severity = issue.severity || 'information'; acc[severity] = (acc[severity] || 0) + 1; return acc;
  }, { fatal: 0, error: 0, warning: 0, information: 0 });
  const valid = result.valid !== undefined ? result.valid : (counts.fatal || 0) + (counts.error || 0) === 0;
  const severityLabels = { fatal: 'Fatal', error: 'Error', warning: 'Advertencia', information: 'Información' };
  const guidance = issue => {
    const code = String(issue.code || '').toLowerCase();
    if (code === 'required') return 'Agrega el elemento obligatorio indicado en la ruta.';
    if (code === 'structure' || code === 'invalid') return 'Revisa la estructura y el tipo de dato del elemento señalado.';
    if (code === 'value' || code === 'code-invalid') return 'Verifica el valor o código contra el perfil y el ValueSet correspondiente.';
    if (code === 'not-found') return 'Comprueba que la referencia o el perfil pueda resolverse en el servidor.';
    if (code === 'business-rule' || code === 'invariant') return 'Revisa la regla del perfil nacional asociada a este elemento.';
    if (code === 'processing') return 'El servidor no pudo procesar este punto; revisa el diagnóstico y la ruta.';
    return 'Revisa el diagnóstico y corrige el elemento indicado antes del intercambio.';
  };
  const rawOutcome = result.outcome ? `<details class="preview-section"><summary>Ver OperationOutcome completo</summary><pre class="raw-response">${escapeHtml(JSON.stringify(result.outcome, null, 2))}</pre></details>` : '';
  return `<div class="validation-summary"><strong>${valid ? 'El servidor no reportó errores bloqueantes.' : 'El recurso tiene errores que deben corregirse.'}</strong>
    <span class="count-pill fatal">Fatales: ${counts.fatal || 0}</span><span class="count-pill error">Errores: ${counts.error || 0}</span><span class="count-pill warning">Advertencias: ${counts.warning || 0}</span><span class="count-pill information">Información: ${counts.information || 0}</span></div>
    <div class="issue-list">${issues.length ? issues.map(issue => `<article class="issue-card ${escapeHtml(issue.severity || 'information')}"><span class="issue-severity">${escapeHtml(severityLabels[issue.severity] || issue.severity || 'Info')}</span><div><p><strong>${escapeHtml(issue.code || 'issue')}:</strong> ${escapeHtml(issue.diagnostics || issue.details?.text || 'Sin diagnóstico')}</p><p class="issue-guidance">${escapeHtml(guidance(issue))}</p>${(issue.expression?.length || issue.location?.length) ? `<code class="issue-path">${escapeHtml([...(issue.expression || []), ...(issue.location || [])].join(' · '))}</code>` : ''}</div></article>`).join('') : '<div class="notice info">OperationOutcome sin incidencias.</div>'}</div>${rawOutcome}`;
}

function renderValidationResult(result) {
  el.validationResult.className = 'validation-content';
  el.validationResult.innerHTML = renderOperationOutcomeHtml(result);
}

async function validateCurrentResource({ openEditor = false } = {}) {
  const resource = parseEditor({ silent: true });
  if (!resource) return null;
  const context = serverContext();
  const buttons = [el.validateButton];
  buttons.forEach(button => { button.disabled = true; button.dataset.original = button.textContent; button.textContent = 'Validando…'; });
  el.validationResult.className = 'validation-content empty-state compact-empty';
  el.validationResult.textContent = `Enviando ${resource.resourceType} al servidor FHIR…`;
  try {
    const payload = await requestJson('/api/fhir/validate', {
      method: 'POST', body: JSON.stringify(serverRequest({ resource, serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return null;
    state.validation = payload.result;
    renderValidationResult(payload.result);
    showToast(payload.result.valid ? 'Validación completada sin errores bloqueantes.' : 'La validación encontró errores que deben corregirse.', !payload.result.valid);
    if (openEditor) showPage('editor');
    return payload.result;
  } catch (error) {
    if (!isCurrentServerContext(context)) return null;
    el.validationResult.className = 'validation-content';
    el.validationResult.innerHTML = error.details?.resourceType === 'OperationOutcome'
      ? renderOperationOutcomeHtml({ outcome: error.details, issues: error.details.issue || [] })
      : `<div class="notice warning"><strong>No fue posible ejecutar $validate.</strong><br>${escapeHtml(error.message)}</div>`;
    showToast(error.message, true);
    if (openEditor) showPage('editor');
    return null;
  } finally {
    buttons.forEach(button => { button.textContent = button.dataset.original || 'Validar'; });
    renderIti65Selection();
  }
}

function isIti65Eligible(resource) {
  return resource?.resourceType === 'Bundle' && resource.type === 'document' && Boolean(identifyUseCase(resource));
}

function iti65PreparationKey(resource = state.resource) {
  return resource ? JSON.stringify(resource) : null;
}

function resetIti65TransactionValidation(message = 'Ejecuta <strong>$validate</strong> sobre el Bundle documental antes de publicarlo.') {
  state.iti65TransactionValidation = null;
  el.iti65TransactionValidation.className = 'validation-content empty-state compact-empty';
  el.iti65TransactionValidation.innerHTML = message;
}

function setIti65TransactionSyntax(kind, label, message = '') {
  el.iti65TransactionSyntax.className = `badge ${kind}`;
  el.iti65TransactionSyntax.textContent = label;
  el.iti65TransactionMessage.className = `inline-message${kind === 'error' ? ' error' : ''}`;
  el.iti65TransactionMessage.textContent = message;
}

function updateIti65Actions() {
  const ready = Boolean(state.iti65Transaction) && !state.iti65TransactionStale;
  el.formatIti65Button.disabled = !state.iti65Transaction;
  el.downloadIti65Button.disabled = !state.iti65Transaction;
  el.iti65ValidateButton.disabled = !ready;
  el.iti65SendButton.disabled = !ready;
}

function parseIti65Transaction({ silent = false, resetValidation = true } = {}) {
  const text = el.iti65TransactionEditor.value.trim();
  if (resetValidation) resetIti65TransactionValidation();
  if (!text) {
    state.iti65Transaction = null;
    setIti65TransactionSyntax('neutral', 'Sin cargar');
    el.iti65TransactionMeta.textContent = 'Carga el documento desde el editor principal';
    updateIti65Actions();
    return null;
  }
  try {
    const transaction = JSON.parse(text);
    if (transaction?.resourceType !== 'Bundle' || transaction.type !== 'transaction' || !Array.isArray(transaction.entry) || transaction.entry.length !== 4 || !['List', 'DocumentReference', 'Bundle', 'Patient'].every(type => transaction.entry.some(entry => entry.resource?.resourceType === type))) {
      throw new Error('Se requiere un Bundle.type=transaction con List, DocumentReference, Bundle clínico y Patient.');
    }
    state.iti65Transaction = transaction;
    const size = new Blob([text]).size;
    setIti65TransactionSyntax(
      state.iti65TransactionStale ? 'warning' : 'success',
      state.iti65TransactionStale ? 'Reconstruir' : 'JSON válido',
      state.iti65TransactionStale
        ? 'El documento de origen cambió. Vuelve a cargarlo antes de publicarlo.'
        : `${transaction.entry?.length || 0} entradas · ${(size / 1024).toFixed(1)} KB`
    );
    el.iti65TransactionMeta.textContent = `Bundle/${transaction.id || 'sin-id'} · type=transaction · ${transaction.entry.length} entradas`; 
    updateIti65Actions();
    return transaction;
  } catch (error) {
    state.iti65Transaction = null;
    setIti65TransactionSyntax('error', 'Revisar JSON', error.message);
    el.iti65TransactionMeta.textContent = 'El Bundle documental contiene errores';
    updateIti65Actions();
    if (!silent) showToast(error.message, true);
    return null;
  }
}

function markIti65TransactionStale() {
  if (state.resource?.type !== 'document') return;
  if (!el.iti65TransactionEditor.value.trim()) return;
  state.iti65TransactionStale = true;
  parseIti65Transaction({ silent: true });
}

async function prepareIti65Transaction() {
  const resource = state.resource;
  if (!isIti65Eligible(resource)) return showToast('Carga un Bundle clínico de los cuatro tipos admitidos.', true);
  const button = el.prepareIti65Button;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Cargando…';
  setIti65TransactionSyntax('neutral', 'Revisando');
  el.iti65TransactionMessage.textContent = 'Generando transacción localmente; todavía no se ha enviado nada al mediador.';
  try {
    const payload = await requestJson('/api/documents/transaction/prepare', {
      method: 'POST',
      body: JSON.stringify({ resource })
    });
    const result = payload.result;
    state.iti65PreparedKey = iti65PreparationKey(resource);
    state.iti65TransactionStale = false;
    el.iti65TransactionEditor.value = JSON.stringify(result.transaction, null, 2);
    parseIti65Transaction({ silent: true });
    el.iti65TransactionMeta.textContent = `Bundle.type=transaction · ${result.transaction.entry.length} entradas · ${result.useCaseLabel || 'ITI-65'}`;
    showToast('Transacción ITI-65 generada. Revisa las cuatro entradas antes de publicar.');
  } catch (error) {
    state.iti65Transaction = null;
    state.iti65PreparedKey = null;
    state.iti65TransactionStale = false;
    el.iti65TransactionEditor.value = '';
    setIti65TransactionSyntax('error', 'No construido', error.message);
    el.iti65TransactionMeta.textContent = 'Corrige la configuración o el documento de origen';
    updateIti65Actions();
    showToast(error.message, true);
  } finally {
    button.textContent = original;
    renderIti65Selection();
  }
}

function formatIti65Transaction() {
  const transaction = parseIti65Transaction();
  if (!transaction) return;
  el.iti65TransactionEditor.value = JSON.stringify(transaction, null, 2);
  parseIti65Transaction({ silent: true });
}

function downloadIti65Transaction() {
  const transaction = parseIti65Transaction();
  if (!transaction) return;
  const blob = new Blob([`${JSON.stringify(transaction, null, 2)}\n`], { type: 'application/fhir+json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `iti65-transaction-${transaction.id || 'sin-id'}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function validateIti65Transaction() {
  const transaction = parseIti65Transaction();
  if (!transaction || state.iti65TransactionStale) return showToast('Vuelve a cargar o corrige el Bundle documental antes de validarlo.', true);
  const context = serverContext();
  const button = el.iti65ValidateButton;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Validando…';
  el.iti65TransactionValidation.className = 'validation-content empty-state compact-empty';
  el.iti65TransactionValidation.textContent = 'Validando el Bundle documental contra el servidor configurado para $validate…';
  try {
    const payload = await requestJson('/api/fhir/validate', {
      method: 'POST', body: JSON.stringify(serverRequest({ resource: transaction, serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return null;
    state.iti65TransactionValidation = payload.result;
    el.iti65TransactionValidation.className = 'validation-content';
    el.iti65TransactionValidation.innerHTML = renderOperationOutcomeHtml(payload.result);
    showToast(payload.result.valid ? 'Bundle documental validado sin errores bloqueantes.' : 'El documento contiene errores que deben corregirse.', !payload.result.valid);
    return payload.result;
  } catch (error) {
    if (!isCurrentServerContext(context)) return null;
    el.iti65TransactionValidation.className = 'validation-content';
    el.iti65TransactionValidation.innerHTML = error.details?.resourceType === 'OperationOutcome'
      ? renderOperationOutcomeHtml({ outcome: error.details, issues: error.details.issue || [] })
      : `<div class="notice warning"><strong>No fue posible validar el Bundle documental.</strong><br>${escapeHtml(error.message)}</div>`;
    showToast(error.message, true);
    return null;
  } finally {
    button.textContent = original;
    updateIti65Actions();
  }
}

function renderIti65Selection() {
  const resource = state.resource;
  const eligible = isIti65Eligible(resource);
  el.prepareIti65Button.disabled = !eligible;
  el.prepareIti65Button.textContent = 'Generar transacción ITI-65';
  if (state.iti65PreparedKey && state.iti65PreparedKey !== iti65PreparationKey(resource)) {
    state.iti65TransactionStale = true;
    parseIti65Transaction({ silent: true });
  }
  updateIti65Actions();
  if (!resource) {
    el.iti65ResourceSummary.className = 'resource-selection empty-state compact-empty';
    el.iti65ResourceSummary.textContent = 'Todavía no hay un recurso válido en el editor.';
    return;
  }
  const useCase = identifyUseCase(resource);
  const reason = resource.resourceType !== 'Bundle'
    ? 'La publicación requiere un Bundle.'
    : resource.type === 'document' && !useCase
      ? 'El tipo documental debe identificarse por perfil nacional o código LOINC.'
      : resource.type !== 'document'
        ? 'La publicación requiere Bundle.type=document.' : '';
  el.iti65ResourceSummary.className = 'resource-selection';
  el.iti65ResourceSummary.innerHTML = `<div class="selection-ok"><h4>${escapeHtml(resource.resourceType)}${resource.id ? `/${escapeHtml(resource.id)}` : ''}</h4><p>${eligible ? escapeHtml(formatUseCaseLabel(useCase)) : escapeHtml(reason)}</p><code>${escapeHtml(profilesOf(resource)[0] || 'Sin meta.profile')}</code></div>`;
}

async function sendIti65() {
  const resource = parseIti65Transaction({ silent: true, resetValidation: false });
  if (!resource || state.iti65TransactionStale) return showToast('Carga o corrige el Bundle documental antes de publicarlo.', true);
  const context = serverContext();
  el.iti65SendButton.disabled = true; el.iti65SendButton.textContent = 'Publicando…';
  el.iti65Result.className = 'empty-state'; el.iti65Result.textContent = 'Enviando el Bundle de transacción ITI-65 a OpenHIM…';
  try {
    const payload = await requestJson('/api/documents/transaction/publish', {
      method: 'POST',
      body: JSON.stringify({ transaction: resource })
    });
    if (!isCurrentServerContext(context)) return;
    const result = payload.result;
    el.iti65Result.className = '';
    el.iti65Result.innerHTML = `<div class="result-success"><h4>Publicación procesada · HTTP ${escapeHtml(result.status)}</h4><p>El mediador recibió la transacción ITI-65.</p></div>
      <details class="preview-section" open><summary>Ver respuesta del mediador</summary><pre class="raw-response">${escapeHtml(JSON.stringify(result.response, null, 2))}</pre></details>`;
    showToast('Documento publicado mediante el mediador nacional.');
  } catch (error) {
    if (!isCurrentServerContext(context)) return;
    el.iti65Result.className = '';
    el.iti65Result.innerHTML = error.details?.resourceType === 'OperationOutcome'
      ? `<div class="notice warning"><strong>Publicación rechazada por el mediador.</strong></div>${renderOperationOutcomeHtml({ issues: error.details.issue || [] })}`
      : `<div class="notice warning"><strong>No se completó la publicación.</strong><br>${escapeHtml(error.message)}</div>`;
    showToast(error.message, true);
  } finally {
    el.iti65SendButton.textContent = 'Publicar documento';
    renderIti65Selection();
  }
}

function initializeIdentifierTypes() {
  const systems = Array.isArray(state.config?.identifierSystems) ? state.config.identifierSystems : [];
  const customOption = '<option value="custom">Otro (URI personalizada)</option>';
  el.patientIdentifierTypeSelect.innerHTML = systems.map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)}</option>`).join('') + customOption;
  el.patientIdentifierTypeSelect.value = systems.some(item => item.code === 'cedula') ? 'cedula' : (systems[0]?.code || 'custom');
  updateIdentifierSystem();
}
function updateIdentifierSystem() {
  const item = state.config?.identifierSystems?.find(v => v.code === el.patientIdentifierTypeSelect.value);
  if (item?.system) {
    el.patientIdentifierSystemInput.value = item.system;
  } else {
    el.patientIdentifierSystemInput.value = '';
    el.patientIdentifierAdvanced.open = true;
  }
}
function initializeExplorerServers() {
  const servers = state.servers.filter(item => item.official && ['registry', 'repository'].includes(item.role));
  el.explorerServerSelect.innerHTML = servers.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${item.role === 'registry' ? 'Índice' : 'Repositorio'}</option>`).join('');
  if (servers.length) el.explorerServerSelect.value = servers.find(s => s.role === 'registry')?.id || servers[0].id;
  el.explorerSearchButton.disabled = !servers.length;
  el.explorerNextButton.disabled = true;
  el.explorerGlobalToggle.disabled = !state.config?.documentExplorer?.allowGlobal;
  updateExplorerType();
}
function updateExplorerType() {
  const server = state.servers.find(item => item.id === el.explorerServerSelect.value);
  const registry = server?.role === 'registry';
  for (const option of el.explorerResourceType.options) {
    option.disabled = registry && option.value !== 'DocumentReference';
  }
  if (registry) el.explorerResourceType.value = 'DocumentReference';
  const inventoryOn = Boolean(state.config?.documentExplorer?.allowGlobal);
  el.explorerHelp.textContent = `${registry ? 'Índice documental · DocumentReference.' : 'Repositorio documental · consulta según capacidades de este servidor.'} ${inventoryOn ? 'El inventario global está habilitado para este entorno de laboratorio.' : 'Inventario global deshabilitado: busca DocumentReference por paciente.'} El listado de Bundles o Binary requiere soporte de búsqueda del repositorio.`;
  el.explorerGlobalToggle.checked = false;
  state.explorerNextUrl = null;
  el.explorerNextButton.disabled = true;
}
function renderExplorerResults(result, append = false) {
  const rows = (result.entries || []).map(resource => {
    const title = resource.type?.coding?.[0]?.display || resource.type?.text || resource.resourceType;
    const content = resource.content?.[0]?.attachment?.url || '';
    const patient = resource.subject?.reference || resource.subject?.identifier?.value || '—';
    const date = resource.date || resource.meta?.lastUpdated || '—';
    const id = String(resource.id || '');
    const canRetrieve = /(?:^|\/)documents\/[a-f0-9]{40}(?:$|[?#])/i.test(content);
    return `<tr><td><strong>${escapeHtml(title)}</strong><br><code>${escapeHtml(id || 'sin ID')}</code></td><td>${escapeHtml(patient)}</td><td>${escapeHtml(formatDate(date))}</td><td><code>${escapeHtml(content || '—')}</code></td><td>${id ? `<button class="button secondary compact explorer-read" data-id="${escapeHtml(id)}" data-type="${escapeHtml(resource.resourceType)}">Ver recurso</button>` : ''}${canRetrieve ? `<button class="button ghost compact explorer-mediator-retrieve" data-url="${escapeHtml(content)}">ITI-68</button>` : ''}</td></tr>`;
  }).join('');
  const previousRows = append ? el.explorerResult.querySelector('tbody')?.innerHTML || '' : '';
  el.explorerResult.className = '';
  el.explorerResult.innerHTML = `<div class="validation-summary"><strong>${escapeHtml(result.serverName)} · ${escapeHtml(result.resourceType)}</strong><span>Esta página: ${result.count}${result.total === null ? '' : ` · Total informado: ${result.total}`}</span></div><div class="explorer-scroll"><table class="result-table"><thead><tr><th>Recurso</th><th>Paciente</th><th>Fecha</th><th>URL documental</th><th>Acción</th></tr></thead><tbody>${previousRows}${rows || (previousRows ? '' : '<tr><td colspan="5">No hay resultados para esta consulta.</td></tr>')}</tbody></table></div>`;
}
async function searchExplorer(next = false) {
  const serverId = el.explorerServerSelect.value;
  if (!serverId) return showToast('Configura un registro o repositorio documental.', true);
  const global = el.explorerGlobalToggle.checked;
  const patientSystem = global ? '' : el.patientIdentifierSystemInput.value.trim();
  const patientValue = global ? '' : el.patientIdentifierInput.value.trim();
  if (!global && (!patientSystem || !patientValue)) return showToast('Indica el identificador del paciente y su system.', true);
  const resourceType = el.explorerResourceType.value;
  if (!global && resourceType !== 'DocumentReference') return showToast('La búsqueda por paciente se realiza mediante DocumentReference. Selecciona ese recurso.', true);
  const requestedUrl = next ? state.explorerNextUrl : null;
  if (next && !requestedUrl) return;
  const rev = ++state.explorerRevision;
  el.explorerSearchButton.disabled = true;
  el.explorerNextButton.disabled = true;
  if (!next) {
    el.explorerResult.className = 'empty-state compact-empty';
    el.explorerResult.textContent = 'Consultando el servidor documental…';
  }
  try {
    const payload = await requestJson('/api/documents/explorer/search', { method: 'POST', body: JSON.stringify({ serverId, resourceType, patientSystem, patientValue,
      type: resourceType === 'DocumentReference' ? el.documentTypeFilter.value : '', status: resourceType === 'DocumentReference' ? el.documentStatusFilter.value : '', nextUrl: requestedUrl }) });
    if (rev !== state.explorerRevision) return;
    renderExplorerResults(payload.result, next);
    state.explorerNextUrl = payload.result.nextUrl;
    el.explorerNextButton.disabled = !state.explorerNextUrl;
  } catch(error) {
    if (rev !== state.explorerRevision) return;
    el.explorerResult.className = '';
    el.explorerResult.innerHTML = `<div class="notice warning"><strong>El inventario no pudo consultarse.</strong><br>${escapeHtml(error.message)}</div>`;
    showToast(error.message, true);
  } finally { if (rev === state.explorerRevision) el.explorerSearchButton.disabled = false; }
}
async function handleExplorerResult(event) {
  const retrieve = event.target.closest('.explorer-mediator-retrieve');
  if (retrieve) return retrieveIti68(retrieve.dataset.url);
  const readButton = event.target.closest('.explorer-read');
  if (!readButton) return;
  readButton.disabled = true;
  try {
    const payload = await requestJson('/api/documents/explorer/read', { method: 'POST', body: JSON.stringify({ serverId: el.explorerServerSelect.value, resourceType: readButton.dataset.type, id: readButton.dataset.id }) });
    el.jsonEditor.value = JSON.stringify(payload.result.resource, null, 2);
    state.fileName = `${readButton.dataset.type}-${readButton.dataset.id}.json`;
    parseEditor({ silent: true });
    showPage('editor');
    showToast('Recurso recuperado y abierto en el editor FHIR.');
  } catch(error) { showToast(error.message, true); }
  finally { readButton.disabled = false; }
}

function documentType(resource) {
  return getCodingDisplay(resource?.type);
}

function renderSearchResult(result) {
  const bundle = result.bundle;
  const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
  const resources = entries.map(entry => entry.resource).filter(Boolean);
  const rows = resources.map((resource, index) => {
    if (resource.resourceType === 'DocumentReference') {
      const url = resource.content?.[0]?.attachment?.url || '';
      return `<tr><td>${index + 1}</td><td>${escapeHtml(documentType(resource))}</td><td>${escapeHtml(resource.subject?.reference || '—')}</td><td>${escapeHtml(formatDate(resource.date))}</td><td><code>${escapeHtml(url || 'Sin URL')}</code></td><td>${url ? `<button class="button secondary compact retrieve-document" data-url="${escapeHtml(url)}">Recuperar</button>` : '—'}</td></tr>`;
    }
    return `<tr><td>${index + 1}</td><td>${escapeHtml(resource.resourceType)}</td><td>${escapeHtml(resource.subject?.reference || '—')}</td><td>${escapeHtml(formatDate(resource.date))}</td><td><code>${escapeHtml(resource.id || '—')}</code></td><td>—</td></tr>`;
  }).join('');
  el.queryResult.className = '';
  el.queryResult.innerHTML = `<div class="validation-summary"><strong>Búsqueda completada · ${resources.length} resultado(s)</strong><code>${escapeHtml(result.requestPath || '/DocumentReference')}</code></div>
    <table class="result-table"><thead><tr><th>#</th><th>Tipo de documento</th><th>Paciente</th><th>Fecha</th><th>URL de recuperación</th><th>Acción</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No se encontraron resultados.</td></tr>'}</tbody></table>
    <details class="preview-section"><summary>Ver Bundle searchset</summary><pre class="raw-response">${escapeHtml(JSON.stringify(bundle, null, 2))}</pre></details>`;
}

async function runSearch() {
  const patientSystem = el.patientIdentifierSystemInput.value.trim();
  const patientValue = el.patientIdentifierInput.value.trim();
  if (!patientSystem || !patientValue) { el.patientIdentifierAdvanced.open = true; return showToast('Indica el número de identificación y su system.', true); }
  const context = serverContext();
  const button = el.iti67Button;
  const endpoint = '/api/documents/search';
  button.disabled = true; const original = button.textContent; button.textContent = 'Consultando…';
  el.queryStatus.className = 'badge neutral'; el.queryStatus.textContent = 'Consultando';
  el.queryResult.className = 'empty-state'; el.queryResult.textContent = 'Consultando el índice documental nacional…';
  try {
    const payload = await requestJson(endpoint, {
      method: 'POST', body: JSON.stringify({ patientSystem, patientValue, type: el.documentTypeFilter.value, status: el.documentStatusFilter.value })
    });
    if (!isCurrentServerContext(context)) return;
    renderSearchResult(payload.result);
    el.queryStatus.className = 'badge success'; el.queryStatus.textContent = `HTTP ${payload.result.status}`;
  } catch (error) {
    if (!isCurrentServerContext(context)) return;
    el.queryResult.className = '';
    el.queryResult.innerHTML = `<div class="notice warning"><strong>La búsqueda no pudo completarse.</strong><br>${escapeHtml(error.message)}</div>`;
    el.queryStatus.className = 'badge error'; el.queryStatus.textContent = 'Error';
    showToast(error.message, true);
  } finally { button.disabled = false; button.textContent = original; }
}

async function retrieveIti68(value) {
  const retrieveUrl = String(value || el.retrieveUrlInput.value).trim();
  if (!retrieveUrl) return showToast('Indica el documentId o la URL devuelta por la búsqueda.', true);
  const context = serverContext();
  el.retrieveUrlInput.value = retrieveUrl;
  el.iti68Button.disabled = true; el.iti68Button.textContent = 'Recuperando…';
  el.queryStatus.className = 'badge neutral'; el.queryStatus.textContent = 'Recuperando';
  try {
    const payload = await requestJson('/api/documents/retrieve', {
      method: 'POST', body: JSON.stringify({ documentIdOrUrl: retrieveUrl })
    });
    if (!isCurrentServerContext(context)) return;
    const resource = payload.result.bundle;
    el.jsonEditor.value = JSON.stringify(resource, null, 2);
    state.fileName = `${payload.result.documentId || resource.id || 'documento'}.json`;
    parseEditor({ silent: true });
    showPage('editor');
    showToast('Documento recuperado y cargado en el editor/visor.');
  } catch (error) {
    if (!isCurrentServerContext(context)) return;
    el.queryResult.className = '';
    el.queryResult.innerHTML = `<div class="notice warning"><strong>No fue posible recuperar el documento.</strong><br>${escapeHtml(error.message)}</div>`;
    el.queryStatus.className = 'badge error'; el.queryStatus.textContent = 'Error';
    showToast(error.message, true);
  } finally { el.iti68Button.disabled = false; el.iti68Button.textContent = 'Recuperar documento'; }
}

async function loadLogs() {
  el.logsList.className = 'logs-list empty-state'; el.logsList.textContent = 'Cargando actividad…';
  try {
    const payload = await requestJson('/api/logs?limit=250');
    if (!payload.logs.length) {
      el.logsList.className = 'logs-list empty-state'; el.logsList.textContent = 'Todavía no hay actividad registrada.'; return;
    }
    el.logsList.className = 'logs-list';
    el.logsList.innerHTML = payload.logs.map(log => {
      const action = String(log.action || '');
      const actionView = /^documents\./i.test(action)
        ? `<a class="log-profile-link" href="${escapeHtml(state.config?.guideUrl || '#')}" target="_blank" rel="noreferrer"><strong>Intercambio documental</strong><code>${escapeHtml(action.replace(/^documents\./i, ''))}</code></a>`
        : `<code>${escapeHtml(action)}</code>`;
      return `<article class="log-item ${escapeHtml(log.level)}"><time>${escapeHtml(formatDate(log.timestamp))}</time><span class="log-status">${escapeHtml(log.status || log.level.toUpperCase())}</span>${actionView}<p>${escapeHtml(log.message)}${log.url ? `<br><code>${escapeHtml(log.method || '')} ${escapeHtml(log.url)}</code>` : ''}${log.durationMs ? `<br>${escapeHtml(log.durationMs)} ms` : ''}${log.error?.message ? `<br><strong>${escapeHtml(log.error.message)}</strong>` : ''}</p></article>`;
    }).join('');
  } catch (error) { el.logsList.className = 'logs-list empty-state'; el.logsList.textContent = error.message; }
}

async function testServer() {
  const context = serverContext();
  el.testServerButton.disabled = true; el.testServerButton.textContent = 'Probando…';
  try {
    const payload = await requestJson('/api/fhir/test', {
      method: 'POST', body: JSON.stringify(serverRequest({ serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return;
    el.connectionDot.className = 'connection-dot ok';
    showToast(`Servidor disponible · FHIR ${payload.result.fhirVersion || 'R4'}`);
  } catch (error) {
    if (!isCurrentServerContext(context)) return;
    el.connectionDot.className = 'connection-dot error'; showToast(error.message, true);
  } finally { el.testServerButton.disabled = false; el.testServerButton.textContent = 'Probar'; }
}

function readFile(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return showToast('El archivo supera el límite de 20 MB.', true);
  const reader = new FileReader();
  reader.onload = () => {
    el.jsonEditor.value = String(reader.result || '').replace(/^\uFEFF/, '');
    state.fileName = file.name;
    parseEditor();
  };
  reader.onerror = () => showToast('No fue posible leer el archivo.', true);
  reader.readAsText(file, 'utf-8');
}

async function loadResourceFromUrl() {
  const url = el.resourceUrlInput.value.trim();
  if (!url) return showToast('Pega la URL directa de un recurso FHIR.', true);
  const context = serverContext();
  el.loadUrlButton.disabled = true;
  el.loadUrlButton.textContent = 'Obteniendo…';
  try {
    const payload = await requestJson('/api/fhir/fetch', {
      method: 'POST',
      body: JSON.stringify(serverRequest({ url, serverUrl: context.serverUrl }))
    });
    if (!isCurrentServerContext(context)) return;
    const resource = payload.resource;
    el.jsonEditor.value = JSON.stringify(resource, null, 2);
    state.fileName = `${resource.resourceType}-${resource.id || 'remoto'}.json`;
    parseEditor({ silent: true });
    showToast(`${resource.resourceType}${resource.id ? `/${resource.id}` : ''} cargado desde la URL.`);
  } catch (error) {
    if (isCurrentServerContext(context)) showToast(error.message, true);
  } finally {
    el.loadUrlButton.disabled = false;
    el.loadUrlButton.textContent = 'Obtener recurso';
  }
}

function formatEditor() {
  const resource = parseEditor();
  if (resource) { el.jsonEditor.value = JSON.stringify(resource, null, 2); parseEditor({ silent: true }); }
}

function downloadResource() {
  if (!state.resource) return;
  const blob = new Blob([`${JSON.stringify(state.resource, null, 2)}\n`], { type: 'application/fhir+json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = state.fileName || `${state.resource.resourceType}-${state.resource.id || 'sin-id'}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function initialize() {
  document.querySelectorAll('[data-page-target]').forEach(control => control.addEventListener('click', () => showPage(control.dataset.pageTarget)));
  el.menuButton.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));
  el.jsonEditor.addEventListener('input', () => { clearTimeout(state.debounce); state.debounce = setTimeout(() => parseEditor({ silent: true }), 350); });
  el.iti65TransactionEditor.addEventListener('input', () => {
    clearTimeout(state.iti65Debounce);
    state.iti65TransactionValidation = null;
    state.iti65Debounce = setTimeout(() => parseIti65Transaction({ silent: true }), 350);
  });
  el.jsonEditor.addEventListener('dragover', event => event.preventDefault());
  el.jsonEditor.addEventListener('drop', event => { event.preventDefault(); readFile(event.dataTransfer.files?.[0]); });
  el.jsonFileInput.addEventListener('change', () => readFile(el.jsonFileInput.files?.[0]));
  el.loadUrlButton.addEventListener('click', loadResourceFromUrl);
  el.resourceUrlInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadResourceFromUrl(); } });
  el.formatButton.addEventListener('click', formatEditor);
  el.clearEditorButton.addEventListener('click', () => { el.jsonEditor.value = ''; parseEditor({ silent: true }); });
  el.downloadButton.addEventListener('click', downloadResource);
  el.resourcePreview.addEventListener('click', handleBinaryAction);
  el.previewGuidedPdfButton.addEventListener('click', () => {
    if (state.guidedPdf) openPdfPreview({ resourceType: 'Binary', contentType: state.guidedPdf.contentType, data: state.guidedPdf.data }, state.guidedPdf.name, state.guidedPdf.name);
  });
  el.binaryDownloadButton.addEventListener('click', () => {
    if (state.activeBinaryDownload) downloadPdf(state.activeBinaryDownload.binary, state.activeBinaryDownload.fileName);
  });
  el.binaryPreviewDialog.addEventListener('close', closePdfPreview);
  el.validateButton.addEventListener('click', () => validateCurrentResource());
  el.prepareIti65Button.addEventListener('click', prepareIti65Transaction);
  el.formatIti65Button.addEventListener('click', formatIti65Transaction);
  el.downloadIti65Button.addEventListener('click', downloadIti65Transaction);
  el.iti65ValidateButton.addEventListener('click', validateIti65Transaction);
  el.iti65SendButton.addEventListener('click', sendIti65);
  el.iti67Button.addEventListener('click', runSearch);
  el.patientIdentifierTypeSelect.addEventListener('change', updateIdentifierSystem);
  el.explorerServerSelect.addEventListener('change', updateExplorerType);
  el.explorerResourceType.addEventListener('change', () => { state.explorerNextUrl = null; el.explorerNextButton.disabled = true; });
  el.explorerGlobalToggle.addEventListener('change', () => { state.explorerNextUrl = null; el.explorerNextButton.disabled = true; });
  el.explorerSearchButton.addEventListener('click', () => searchExplorer(false));
  el.explorerNextButton.addEventListener('click', () => searchExplorer(true));
  el.explorerResult.addEventListener('click', handleExplorerResult);
  el.iti68Button.addEventListener('click', () => retrieveIti68());
  el.queryResult.addEventListener('click', event => { const button = event.target.closest('.retrieve-document'); if (button) retrieveIti68(button.dataset.url); });
  el.refreshLogsButton.addEventListener('click', loadLogs);
  el.testServerButton.addEventListener('click', testServer);
  el.serverSelect.addEventListener('change', () => selectServer(el.serverSelect.value));
  el.addServerButton.addEventListener('click', addCustomServer);
  el.serverUrlConfigInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomServer(); } });
  el.serverList.addEventListener('click', handleServerListAction);
  document.querySelectorAll('.resource-tab').forEach(tab => tab.addEventListener('click', () => changeManagedResourceType(tab.dataset.resourceType)));
  el.refreshResourcesButton.addEventListener('click', loadManagedResources);
  el.managedResourceForm.addEventListener('submit', createManagedResource);
  el.managedResourceList.addEventListener('click', handleManagedResourceList);
  el.refreshGuidedContextButton.addEventListener('click', loadGuidedContext);
  el.searchGuidedPatientButton.addEventListener('click', searchGuidedPatient);
  el.guidedPatientResults.addEventListener('click', handleGuidedPatientResults);
  [el.guidedPatientIdentifier, el.guidedPatientGiven, el.guidedPatientFamily].forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchGuidedPatient(); } }));
  el.guidedUseCase.addEventListener('change', showGuidedCaseFields);
  el.guidedPatientMode.addEventListener('change', showGuidedPatientMode);
  el.guidedPdfInput.addEventListener('change', () => readGuidedPdf(el.guidedPdfInput.files?.[0]));
  el.guidedCaseForm.addEventListener('submit', generateGuidedDocument);

  try {
    const payload = await requestJson('/api/config');
    state.config = payload;
    initializeIdentifierTypes();
    loadServers(payload);
    renderManagedResourceForm();
    showGuidedCaseFields();
    showGuidedPatientMode();
  } catch (error) {
    el.serverSelect.innerHTML = '<option>Configuración no disponible</option>';
    el.connectionDot.className = 'connection-dot error';
  }
  parseEditor({ silent: true });
}

initialize();
