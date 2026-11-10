import test from"node:test";import assert from"node:assert/strict";import{simulateRace,replayMatches,serializeCheckpoint,restoreCheckpoint,validateCircuit,DRIVER_ATTRIBUTE_KEYS,TEAM_ATTRIBUTE_KEYS}from"../lib/race-engine/index.ts";
const da=Object.fromEntries(DRIVER_ATTRIBUTE_KEYS.map(k=>[k,100])),ta=Object.fromEntries(TEAM_ATTRIBUTE_KEYS.map(k=>[k,100]));
const seg=(id)=>({segmentId:id,lengthMeters:500,referenceTimeMs:30000,cornerType:"MEDIUM",engineFactor:.5,aeroFactor:.5,lowSpeedFactor:.5,highSpeedFactor:.5,tractionFactor:.5,gripFactor:.5,tyreStress:.5,brakingIntensity:.5,drsZone:id==="B",overtakeDifficulty:.4,incidentRisk:.2});
const circuit={circuitId:"test",version:1,name:"Test Circuit",country:"Test",trackLengthMeters:1000,referenceLapTimeMs:60000,dataStatus:"CALIBRATION_DRAFT",segments:[seg("A"),seg("B")]};
const entry=id=>({driverId:id,driverName:id,teamId:"T"+id,teamName:"Team "+id,driverAttributes:{...da},teamAttributes:{...ta},startingCompound:"MEDIUM"});
const config=()=>({raceId:"R1",seed:12345,totalLaps:3,circuit,entries:[entry("D1"),entry("D2")],compounds:[{compound:"MEDIUM",initialGrip:1,baseDegradation:.2,optimalTemperature:90,operatingWindow:30,wetSuitability:.8,maxUsableWear:100,degradationCurvePower:1.5}],weather:[{lap:0,kind:"DRY",rainIntensity:0,ambientTemperature:25,trackTemperature:32,trackGrip:1,visibility:1}],dynamicWeather:false,pit:{requiredStops:0,basePitTimeMs:2000,pitLaneTimeMs:15000,executionTimeMs:2500,allowedCompounds:["SOFT","MEDIUM","HARD"]},drs:{enabled:true,detectionGapMs:1000,baseEffect:.003,maxEffect:.01},ers:{enabled:true,initialEnergy:10,energyPerLap:2,baseEffect:.001},incidents:{baseProbability:0,mechanicalFailureBaseProbability:0,safetyCarProbability:0},performanceCap:{min:-.05,max:.12}});
test("circuit validator checks exact segment sums",()=>{assert.deepEqual(validateCircuit(circuit),[]);assert.match(validateCircuit({...circuit,trackLengthMeters:900})[0],/sum to circuit length/);});
test("same seed and input reproduce event stream and classification",()=>{const c=config(),a=simulateRace(c),b=simulateRace(c);assert.deepEqual(a.events,b.events);assert.deepEqual(a.classification,b.classification);assert.equal(replayMatches(c,a),true);});
test("race completes and checkpoints each lap",()=>{const x=simulateRace(config());assert.equal(x.classification.length,2);assert.equal(x.classification[0].completedLaps,3);assert.equal(x.checkpoints.length,4);assert.equal(x.qualifying.length,2);});
test("checkpoint serializes and restores",()=>{const x=simulateRace(config()).checkpoints[1];assert.deepEqual(restoreCheckpoint(serializeCheckpoint(x)),x);});
test("canonical attribute contracts contain 16 driver and 16 team attributes",()=>{assert.equal(DRIVER_ATTRIBUTE_KEYS.length,16);assert.equal(TEAM_ATTRIBUTE_KEYS.length,16);});
test("out-of-range attributes are rejected",()=>{const c=config();c.entries[0].driverAttributes.racePace=201;assert.throws(()=>simulateRace(c),/CMRE attributes/);});

import { createMonacoCircuit2026, createPrototypeConfig, simulateUntilLap, resumeRace, runMonteCarlo, measureAttributeSensitivity, attributeEffectVector, RandomStreams, RANDOM_SUBSYSTEMS, ENGINE_VERSION, normalizeAttribute, serializeResult, choosePitStrategy, SeededRandom, compareRaceStates } from "../lib/race-engine/index.ts";

test("Monaco profile reconciles official sector geometry and turn order",()=>{
 const c=createMonacoCircuit2026();
 assert.equal(c.trackLengthMeters,3337);
 assert.deepEqual(c.segments.map(x=>x.lengthMeters),[1051,1419,867]);
 assert.deepEqual(c.segments.flatMap(x=>x.turnNumbers??[]),Array.from({length:19},(_,i)=>i+1));
 assert.equal(c.dataStatus,"CALIBRATION_DRAFT");
 assert.equal(c.referenceTimeStatus,"PROVISIONAL_MODEL");
 assert.equal(c.overtakeMode?.straightModeAllowed,false);
 assert.deepEqual(c.sectorMarkers?.map(x=>x.distanceMeters),[1051,2470]);
});

test("prototype baseline contains 20 drivers and 10 teams and records pit stops",()=>{
 const c=createPrototypeConfig();c.totalLaps=4;
 const r=simulateRace(c);
 assert.equal(c.entries.length,20);
 assert.equal(new Set(c.entries.map(x=>x.teamId)).size,10);
 assert.equal(r.classification.length,20);
 assert.ok(r.metrics.pitStops>=20);
 assert.ok(r.events.some(x=>x.type==="PIT_ENTRY"));assert.ok(r.events.some(x=>x.type==="PIT_SERVICE_STARTED"));assert.ok(r.events.some(x=>x.type==="TYRE_CHANGED"));assert.ok(r.events.some(x=>x.type==="PIT_EXIT"));assert.ok(r.events.some(x=>x.type==="PIT_STOP_COMPLETED"));
 assert.ok(r.events.some(x=>x.type==="LAP_COMPLETED"));
 assert.ok(r.events.some(x=>x.type==="SECTOR_COMPLETED"));
});

test("checkpoint recovery resumes from serialized RNG and state",()=>{
 const c=config();c.totalLaps=4;
 const full=simulateRace(c);
 const cp=restoreCheckpoint(serializeCheckpoint(simulateUntilLap(c,2)));
 const resumed=resumeRace(c,cp);
 assert.deepEqual(resumed.events,full.events);
 assert.deepEqual(resumed.classification,full.classification);
 assert.equal(replayMatches(c,full),true);
});

test("checkpoint rejects a changed input snapshot",()=>{
 const c=config();const cp=simulateUntilLap(c,1);c.seed++;
 assert.throws(()=>resumeRace(c,cp),/Checkpoint/);
});

test("all 32 canonical attributes expose an explicit effect vector",()=>{
 const c=config(),e=c.entries[0],s=c.circuit.segments[0];
 const w={...c.weather[0],rainIntensity:.6,trackGrip:.8};
 const base=attributeEffectVector(e,s,w,true,.5,.5);
 for(const key of DRIVER_ATTRIBUTE_KEYS){
  const changed={...e,driverAttributes:{...e.driverAttributes,[key]:200}};
  assert.notDeepEqual(attributeEffectVector(changed,s,w,true,.5,.5).driver,base.driver,key);
 }
 for(const key of TEAM_ATTRIBUTE_KEYS){
  const changed={...e,teamAttributes:{...e.teamAttributes,[key]:200}};
  assert.notDeepEqual(attributeEffectVector(changed,s,w,true,.5,.5).team,base.team);
 }
});

test("incident, safety car and mechanical failure paths emit events",()=>{
 const c=config();c.incidents={baseProbability:1,mechanicalFailureBaseProbability:1,safetyCarProbability:1};
 c.circuit={...c.circuit,segments:c.circuit.segments.map(x=>({...x,incidentRisk:1}))};
 const r=simulateRace(c);
 assert.ok(r.events.some(x=>x.type==="INCIDENT_CREATED"));
 assert.ok(r.events.some(x=>x.type==="SAFETY_CAR_DEPLOYED"));
 assert.ok(r.events.some(x=>x.type==="MECHANICAL_FAILURE"));
 assert.ok(r.events.some(x=>x.type==="DRIVER_RETIRED"));
});

test("Monte Carlo runs 1,000 paired seeds and normalizes win probabilities",()=>{
 const c=config();c.totalLaps=1;c.pit.requiredStops=0;
 c.incidents={baseProbability:0,mechanicalFailureBaseProbability:0,safetyCarProbability:0};
 const report=runMonteCarlo(c,1000);
 assert.equal(report.runs,1000);
 assert.ok(Math.abs(Object.values(report.winRate).reduce((a,b)=>a+b,0)-1)<1e-9);
 assert.ok(Number.isFinite(report.averageRaceTimeMs));assert.ok(report.averageLapTimeMs>0);assert.ok(Number.isFinite(report.averageTyreWear));assert.ok(Number.isFinite(report.averagePitLossMs));assert.ok(Number.isFinite(report.averageMechanicalFailures));
});

test("paired sensitivity shows higher driver race pace improves mean time",()=>{
 const c=config();c.totalLaps=1;c.pit.requiredStops=0;
 c.incidents={baseProbability:0,mechanicalFailureBaseProbability:0,safetyCarProbability:0};
 const result=measureAttributeSensitivity(c,"DRIVER","D1","racePace",1000);
 assert.ok(result.deltaMs<0);assert.ok(Number.isFinite(result.baselineMetrics.averageLapTimeMs));assert.ok(Number.isFinite(result.perturbedMetrics.averageTyreWear));assert.ok(Number.isFinite(result.deltaMetrics.averagePitLossMs));
});

test("dynamic weather, DRS and ERS are emitted as sector-level race events",()=>{
 const c=config();c.dynamicWeather=true;c.weather=[{...c.weather[0]},{lap:1,kind:"LIGHT_RAIN",rainIntensity:.25,ambientTemperature:24,trackTemperature:27,trackGrip:.9,visibility:.9}];
 c.drs={...c.drs,enabled:true,detectionGapMs:100000};
 c.circuit={...c.circuit,segments:c.circuit.segments.map(x=>({...x,drsZone:true}))};
 const r=simulateRace(c);
 assert.ok(r.events.some(x=>x.type==="WEATHER_CHANGED"));
 assert.ok(r.events.some(x=>x.type==="SECTOR_COMPLETED"&&x.payload.ersDeployment>0));
 assert.ok(r.events.some(x=>x.type==="SECTOR_COMPLETED"&&x.payload.drsActive===true));
});

test("overtake attempts and outcomes are part of the deterministic event stream",()=>{
 const c=config();c.circuit={...c.circuit,segments:c.circuit.segments.map(x=>({...x,overtakeDifficulty:.1}))};
 const r=simulateRace(c);
 assert.ok(r.events.some(x=>x.type==="OVERTAKE_ATTEMPTED"));
 assert.ok(r.events.some(x=>x.type==="OVERTAKE_COMPLETED"||x.type==="OVERTAKE_FAILED"));
 assert.equal(r.metrics.overtakes,r.events.filter(x=>x.type==="OVERTAKE_COMPLETED").length);
});

test("all subsystem random streams are isolated and checkpointed",()=>{
 const streams=new RandomStreams(77,ENGINE_VERSION),before=streams.snapshot();
 streams.get("performance").next();
 const after=streams.snapshot();
 assert.notEqual(after.performance,before.performance);
 for(const key of RANDOM_SUBSYSTEMS.filter(x=>x!=="performance"))assert.equal(after[key],before[key]);
 const cp=simulateUntilLap(config(),1);
 assert.deepEqual(Object.keys(cp.rngStates).sort(),[...RANDOM_SUBSYSTEMS].sort());
 assert.equal(cp.raceControl.redFlag,false);assert.equal(cp.status,"RUNNING");assert.ok(cp.latestCheckpointId);
});

test("attribute normalization covers min, midpoint, max and invalid boundaries",()=>{
 assert.equal(normalizeAttribute(50),0);
 assert.equal(normalizeAttribute(125),.5);
 assert.equal(normalizeAttribute(200),1);
 assert.throws(()=>normalizeAttribute(49),/CMRE attributes/);
 assert.throws(()=>normalizeAttribute(201),/CMRE attributes/);
 for(const key of DRIVER_ATTRIBUTE_KEYS)for(const value of [50,125,200]){const c=config();c.entries[0].driverAttributes[key]=value;assert.doesNotThrow(()=>simulateRace(c));}
 for(const key of TEAM_ATTRIBUTE_KEYS)for(const value of [50,125,200]){const c=config();c.entries[0].teamAttributes[key]=value;assert.doesNotThrow(()=>simulateRace(c));}
 for(const key of DRIVER_ATTRIBUTE_KEYS)for(const value of [49,201]){const c=config();c.entries[0].driverAttributes[key]=value;assert.throws(()=>simulateRace(c),/CMRE attributes/);}
 for(const key of TEAM_ATTRIBUTE_KEYS)for(const value of [49,201]){const c=config();c.entries[0].teamAttributes[key]=value;assert.throws(()=>simulateRace(c),/CMRE attributes/);}
});

test("checkpoint and event records include component wear, race control and stable ordering",()=>{
 const c=createPrototypeConfig();c.totalLaps=3;
 const r=simulateRace(c),cp=r.finalCheckpoint;
 assert.ok(cp.state[0].mechanical.engineCondition>=0&&cp.state[0].mechanical.engineCondition<=1);
 assert.ok(cp.state[0].mechanical.gearboxCondition>=0&&cp.state[0].mechanical.gearboxCondition<=1);
 assert.ok(cp.state[0].tyre.grip>0);
 assert.ok(cp.state[0].incidentHistory instanceof Array);
 assert.ok(cp.raceControl);assert.equal(cp.status,"COMPLETED");assert.ok(cp.latestCheckpointId);
 assert.equal(r.events[0].type,"RACE_STARTED");assert.ok(r.events.every((e,i)=>e.sequence===i+1&&e.eventId===c.raceId+":"+e.sequence));assert.ok(r.events.every((e,i)=>i===0||r.events[i-1].simulationTimeMs<=e.simulationTimeMs));
 assert.ok(r.events.every(e=>typeof e.priority==="number"&&e.createdAt.length>0));
 assert.ok(r.events.some(e=>e.type==="PIT_STOP_COMPLETED"));
});

test("attribute effect vectors remain finite at minimum, midpoint and maximum",()=>{
 const c=config(),e=c.entries[0],s=c.circuit.segments[0],w={...c.weather[0],rainIntensity:.6,trackGrip:.8};
 for(const value of [50,125,200]){
  for(const key of DRIVER_ATTRIBUTE_KEYS){const x={...e,driverAttributes:{...e.driverAttributes,[key]:value}},v=attributeEffectVector(x,s,w,true,.5,.5).driver;assert.ok(Object.values(v).every(Number.isFinite));}
  for(const key of TEAM_ATTRIBUTE_KEYS){const x={...e,teamAttributes:{...e.teamAttributes,[key]:value}},v=attributeEffectVector(x,s,w,true,.5,.5).team;assert.ok(Object.values(v).every(Number.isFinite));}
 }
});

test("circuit segments and weather change simulated performance",()=>{
 const dry=createPrototypeConfig();dry.totalLaps=2;dry.pit.requiredStops=0;dry.incidents={baseProbability:0,mechanicalFailureBaseProbability:0,safetyCarProbability:0};
 const dryResult=simulateRace(dry);
 const altered={...dry,circuit:{...dry.circuit,segments:dry.circuit.segments.map(s=>({...s,engineFactor:s.engineFactor*1.4,gripFactor:s.gripFactor*.6}))}};
 const alteredResult=simulateRace(altered);
 assert.notEqual(dryResult.classification[0].totalTimeMs,alteredResult.classification[0].totalTimeMs);
 const wet={...dry,weather:[{...dry.weather[0],kind:"HEAVY_RAIN",rainIntensity:.9,trackGrip:.72,visibility:.6}]};
 const wetResult=simulateRace(wet);
 assert.notEqual(dryResult.classification[0].totalTimeMs,wetResult.classification[0].totalTimeMs);
});

test("seeded random weather transitions are replayable",()=>{
 const c=createPrototypeConfig();c.totalLaps=4;c.dynamicWeather=true;c.weatherTransitionChancePerLap=1;
 c.weather=[
  {...c.weather[0],kind:"DRY",rainIntensity:0,trackGrip:1},
  {...c.weather[0],kind:"LIGHT_RAIN",rainIntensity:.25,trackGrip:.94},
  {...c.weather[0],kind:"MEDIUM_RAIN",rainIntensity:.55,trackGrip:.84},
  {...c.weather[0],kind:"HEAVY_RAIN",rainIntensity:.9,trackGrip:.72}
 ];
 const a=simulateRace(c),b=simulateRace(c);
 assert.deepEqual(a.events,b.events);
 assert.ok(a.events.some(e=>e.type==="WEATHER_CHANGED"));
});

test("simulation result can be exported as stable JSON",()=>{
 const r=simulateRace(config()),parsed=JSON.parse(serializeResult(r));
 assert.equal(parsed.raceId,r.raceId);
 assert.deepEqual(parsed.classification,r.classification);
});

test("expected-value strategy selects a legal pit window and responds to strategy quality",()=>{
 const c=createPrototypeConfig();c.totalLaps=8;
 const cp=simulateUntilLap(c,1),state=cp.state[0],entry=c.entries.find(x=>x.driverId===state.driverId);
 const plan=choosePitStrategy(c,entry,state,cp.weather,new SeededRandom(123));
 assert.ok(plan.targetLap>state.completedLaps&&plan.targetLap<c.totalLaps);
 assert.ok(c.pit.allowedCompounds.includes(plan.compound));
 assert.ok(Number.isFinite(plan.expectedTimeMs));
 assert.ok(plan.decisionErrorMs>0);
 const expert={...entry,teamAttributes:{...entry.teamAttributes,strategyQuality:200}};
 const expertPlan=choosePitStrategy(c,expert,state,cp.weather,new SeededRandom(123));
 assert.ok(expertPlan.decisionErrorMs<plan.decisionErrorMs);
});

test("fixed team strategy is honored and pit efficiency reduces expected service cost",()=>{
 const c=createPrototypeConfig();c.totalLaps=8;c.strategy={mode:"FIXED",fixedPitLap:4,fixedCompound:"HARD"};
 const cp=simulateUntilLap(c,1),state=cp.state[0],entry=c.entries.find(x=>x.driverId===state.driverId);
 const plan=choosePitStrategy(c,entry,state,cp.weather,new SeededRandom(12));
 assert.equal(plan.targetLap,4);
 assert.equal(plan.compound,"HARD");
 const efficient={...entry,teamAttributes:{...entry.teamAttributes,pitStopEfficiency:200}};
 const faster=choosePitStrategy(c,efficient,state,cp.weather,new SeededRandom(12));
 assert.ok(faster.expectedTimeMs<plan.expectedTimeMs);
});

test("classification ties resolve deterministically by grid position and driver ID",()=>{
 const c=config(),r=simulateRace(c),a={...r.finalCheckpoint.state[0]},b={...r.finalCheckpoint.state[1]};
 a.retired=false;b.retired=false;a.completedLaps=b.completedLaps;a.totalTimeMs=b.totalTimeMs;a.gridPosition=2;b.gridPosition=1;
 assert.ok(compareRaceStates(a,b)>0);
 b.gridPosition=2;b.driverId="A-DRIVER";a.driverId="Z-DRIVER";
 assert.ok(compareRaceStates(a,b)>0);
});

test("lap, tyre and pit-loss metrics are present on a completed race",()=>{
 const c=createPrototypeConfig();c.totalLaps=4;
 const r=simulateRace(c);
 assert.ok(r.metrics.averageLapTimeMs>0);
 assert.ok(r.metrics.averageTyreWear>=0);
 assert.ok(r.metrics.pitLossMs>0);
 assert.ok(r.finalCheckpoint.state.every(s=>s.lapTimeHistory.length===4));
});
