import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, serverByRole } from '../lib/config.js';
import { searchParams, resolveRetrievalUrl, resolveFhirUrl, asFhirBundle, FhirRequestError } from '../lib/fhir.js';

const envKeys=['FHIR_SERVERS_JSON','HAPI_FHIR_URL','IDENTIFIER_SYSTEMS_JSON'];
function withEnv(values,fn){const old=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));try{for(const k of envKeys){if(k in values)process.env[k]=values[k];else delete process.env[k];}return fn();}finally{for(const k of envKeys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}}
const valid=[{id:'r',name:'Registro',role:'registry',baseUrl:'https://indice.example.org/fhir'},{id:'d',name:'Repositorio',role:'repository',baseUrl:'https://docs.example.org/fhir',retrievalOrigins:['https://mediator.example.org']}];
test('servidores con roles separados',()=>withEnv({FHIR_SERVERS_JSON:JSON.stringify(valid)},()=>{
const c=readConfig();assert.equal(serverByRole(c,'r','registry').name,'Registro');assert.throws(()=>serverByRole(c,'r','repository'));}));
test('nunca devuelve tokens en configuración pública',()=>withEnv({FHIR_SERVERS_JSON:JSON.stringify(valid)},()=>{
const c=readConfig();assert.equal(c.servers[0].id,'r');}));
test('ITI-67 usa patient.identifier=system|value y status',()=>{const params=searchParams({value:'00100000001',system:'https://digital.msp.gob.do/fhir/sid/cedula'});assert.equal(params.get('patient.identifier'),'https://digital.msp.gob.do/fhir/sid/cedula|00100000001');assert.equal(params.get('status'),'current');});
test('ITI-67 admite referencia Patient sin identifier',()=>{const q=searchParams({patient:'Patient/abc',status:'superseded'});assert.equal(q.get('patient'),'Patient/abc');assert.equal(q.get('patient.identifier'),null)});
test('rechaza ITI-67 sin paciente',()=>assert.throws(()=>searchParams({value:'123'}),FhirRequestError));
test('nunca permite URL de página FHIR ajena',()=>{const s={baseUrl:'https://indice.example.org/fhir'};assert.throws(()=>resolveFhirUrl(s,'https://evil.example/DocumentReference?_count=25'));});
test('rechaza recuperación fuera del repositorio',()=>{const s={baseUrl:'https://docs.example.org/fhir',retrievalOrigins:['https://mediator.example.org']};assert.throws(()=>resolveRetrievalUrl(s,'http://169.254.169.254/latest'));});
test('admite URL opaca ITI-68 en origen declarado',()=>{const s={baseUrl:'https://docs.example.org/fhir',retrievalOrigins:['https://mediator.example.org']};assert.equal(resolveRetrievalUrl(s,'https://mediator.example.org/document/xyz').pathname,'/document/xyz');});
test('reconoce Bundle searchset',()=>assert.equal(asFhirBundle({body:Buffer.from('{"resourceType":"Bundle","type":"searchset","entry":[]}' )}).type,'searchset'));
