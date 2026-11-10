import{performance}from"node:perf_hooks";import{mkdir,writeFile}from"node:fs/promises";
import{createPrototypeConfig,simulateRace}from"../../lib/race-engine/index.ts";
const base=createPrototypeConfig();base.totalLaps=78;base.incidents.baseProbability=0;base.incidents.mechanicalFailureBaseProbability=0;base.checkpointIntervalLaps=20;
const results=[];
for(const size of [20,40,60]){
 const entries=Array.from({length:size},(_,i)=>{const source=base.entries[i%20];return{...source,driverId:"bench-driver-"+(i+1),driverName:"Benchmark "+(i+1),teamId:"bench-team-"+((i%10)+1),teamName:"Benchmark Team "+((i%10)+1)};});
 const c={...base,raceId:"benchmark-"+size,seed:20261110+size,entries};
 const samples=[];
 for(let n=0;n<3;n++){const start=performance.now();const result=simulateRace({...c,seed:c.seed+n});samples.push(performance.now()-start);if(result.classification.length!==size)throw Error("Benchmark classification mismatch.");}
 const avg=samples.reduce((a,b)=>a+b,0)/samples.length,segments=size*c.totalLaps*c.circuit.segments.length;
 results.push({drivers:size,laps:c.totalLaps,segments,samplesMs:samples.map(x=>Number(x.toFixed(2))),averageMs:Number(avg.toFixed(2)),segmentsPerSecond:Math.round(segments/(avg/1000))});
}
const report={engineVersion:"CMRE-1.0.0-prototype",runtime:process.version,note:"GitHub Actions runtime benchmark; remeasure on the Phase 11 worker.",results};await mkdir("artifacts",{recursive:true});await writeFile("artifacts/phase-10-benchmark-report.json",JSON.stringify(report,null,2)+"\\n");console.log(JSON.stringify(report,null,2));
