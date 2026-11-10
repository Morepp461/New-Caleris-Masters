import{mkdir,writeFile}from"node:fs/promises";
import{runMonteCarlo,measureAttributeSensitivity,createPrototypeConfig,DRIVER_ATTRIBUTE_KEYS,TEAM_ATTRIBUTE_KEYS}from"../../lib/race-engine/index.ts";
const arg=process.argv.find(x=>x.startsWith("--runs=")),runs=arg?Number(arg.split("=")[1]):1000;
if(!Number.isInteger(runs)||runs<1000||runs>10000)throw Error("Calibration requires 1,000–10,000 runs per comparison.");
const config=createPrototypeConfig();config.totalLaps=6;config.checkpointIntervalLaps=6;
const monteCarlo=runMonteCarlo(config,runs);
const wet={...config,weather:[{...config.weather[0],kind:"MEDIUM_RAIN",rainIntensity:.55,trackGrip:.84,visibility:.8}]};
const scenarios=[
 {owner:"DRIVER",id:config.entries[0].driverId,key:"racePace",context:"race pace"},
 {owner:"TEAM",id:config.entries[0].teamId,key:"enginePower",context:"engine-sensitive sector pace"},
 {owner:"DRIVER",id:config.entries[0].driverId,key:"wetWeatherSkill",context:"wet weather"},
 {owner:"DRIVER",id:config.entries[0].driverId,key:"tyreManagement",context:"tyre stint"},
 {owner:"TEAM",id:config.entries[0].teamId,key:"pitStopEfficiency",context:"pit service"}
];
const sensitivity=scenarios.map(x=>({...x,...measureAttributeSensitivity(x.key==="wetWeatherSkill"?wet:config,x.owner,x.id,x.key,runs)}));
const report={version:1,engineVersion:"CMRE-1.0.0-prototype",runsPerComparison:runs,grid:{drivers:config.entries.length,teams:new Set(config.entries.map(x=>x.teamId)).size,laps:config.totalLaps},monteCarlo,sensitivity,attributeCoverage:{driver:DRIVER_ATTRIBUTE_KEYS.length,team:TEAM_ATTRIBUTE_KEYS.length,total:DRIVER_ATTRIBUTE_KEYS.length+TEAM_ATTRIBUTE_KEYS.length,unitEffectVectorTests:true},limitations:["Monaco profile is sector-level; per-corner surveyed geometry is not included.","Sector reference times and sector performance factors are provisional calibration inputs.","This report is not production balance approval."]};
await mkdir("artifacts",{recursive:true});await writeFile("artifacts/phase-10-balance-report.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({grid:report.grid,runsPerComparison:runs,monteCarlo,sensitivity},null,2));
