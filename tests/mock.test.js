import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { requestFhir, asFhirBundle } from '../lib/fhir.js';

test('consulta un índice FHIR local y devuelve DocumentReference',async()=>{
 const fake=http.createServer((req,res)=>{
  if(req.url.startsWith('/fhir/DocumentReference?')){
   const params=new URL(req.url,'http://localhost').searchParams;
   assert.equal(params.get('status'),'current');
   res.setHeader('content-type','application/fhir+json');res.end(JSON.stringify({resourceType:'Bundle',type:'searchset',entry:[{resource:{resourceType:'DocumentReference',id:'doc1',status:'current'}}]}));
  }else{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
 try{
  const addr=fake.address();const baseUrl=`http://127.0.0.1:${addr.port}/fhir`;
  const u=new URL(baseUrl+'/DocumentReference?patient.identifier=urn%3Atest%7C123&status=current');
  const result=asFhirBundle(await requestFhir({baseUrl},u));
  assert.equal(result.entry[0].resource.id,'doc1');
 } finally{await new Promise(resolve=>fake.close(resolve));}
});
