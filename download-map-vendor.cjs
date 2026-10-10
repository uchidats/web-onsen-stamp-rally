const fs=require('node:fs');
const files={
'vendor/leaflet/leaflet.js':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
'vendor/leaflet/leaflet.css':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
'vendor/leaflet/LICENSE':'https://unpkg.com/leaflet@1.9.4/LICENSE',
'vendor/markercluster/leaflet.markercluster.js':'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
'vendor/markercluster/MarkerCluster.css':'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
'vendor/markercluster/LICENSE':'https://unpkg.com/leaflet.markercluster@1.5.3/MIT-LICENCE.txt'
};
(async()=>{for(const [p,u] of Object.entries(files)){const r=await fetch(u);if(!r.ok)throw Error(r.status+' '+u);fs.mkdirSync(p.slice(0,p.lastIndexOf('/')),{recursive:true});fs.writeFileSync(p,Buffer.from(await r.arrayBuffer()));console.log(p)}})().catch(e=>{console.error(e);process.exitCode=1});
