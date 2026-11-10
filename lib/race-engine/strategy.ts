import{clamp}from"./random-generator.ts";
import{normalizeAttribute,type Config,type Entry,type State,type Weather,type StrategyPlan,type TyreCompound}from"./contracts.ts";
import{SeededRandom}from"./random-generator.ts";
function compound(c:Config,name:TyreCompound){const found=c.compounds.find(x=>x.compound===name);if(!found)throw Error("Missing tyre compound: "+name);return found;}
function wearRate(c:Config,e:Entry,name:TyreCompound){const t=compound(c,name),stress=c.circuit.segments.reduce((n,s)=>n+s.tyreStress*(s.lengthMeters/c.circuit.trackLengthMeters),0),driver=1-.2*normalizeAttribute(e.driverAttributes.tyreManagement),team=1-.2*normalizeAttribute(e.teamAttributes.teamTyreManagement),resistance=1-.2*normalizeAttribute(e.teamAttributes.tyreWearResistance);return t.baseDegradation*stress*driver*team*resistance;}
export function choosePitStrategy(c:Config,e:Entry,s:State,w:Weather,rng:SeededRandom):StrategyPlan|null{
 if(s.pitStops>=c.pit.requiredStops||c.totalLaps-s.completedLaps<2)return null;
 const quality=normalizeAttribute(e.teamAttributes.strategyQuality),baseError=c.strategy?.baseDecisionErrorMs??1800,decisionErrorMs=baseError*(1-.3*quality),efficiency=normalizeAttribute(e.teamAttributes.pitStopEfficiency),morale=normalizeAttribute(e.teamAttributes.teamMorale),pitTime=c.pit.basePitTimeMs*(1-.15*efficiency)+c.pit.pitLaneTimeMs+c.pit.executionTimeMs*(1+(1-morale)*.04);
 const minLap=Math.max(s.completedLaps+1,Math.ceil(c.totalLaps*.2)),maxLap=Math.min(c.totalLaps-1,Math.floor(c.totalLaps*.8));
 if(c.strategy?.mode==="FIXED"){const targetLap=clamp(c.strategy.fixedPitLap??Math.floor(c.totalLaps*.5),s.completedLaps+1,c.totalLaps-1),selected=c.pit.allowedCompounds.includes(c.strategy.fixedCompound??"MEDIUM")?(c.strategy.fixedCompound??"MEDIUM"):c.pit.allowedCompounds[0];return{targetLap,compound:selected,expectedTimeMs:c.circuit.referenceLapTimeMs*c.totalLaps+pitTime,decisionErrorMs:0};}
 const candidates:StrategyPlan[]=[];
 for(let targetLap=minLap;targetLap<=maxLap;targetLap++){
  const before=targetLap-s.completedLaps,after=c.totalLaps-targetLap,current=compound(c,s.tyre.compound),currentRate=wearRate(c,e,s.tyre.compound),projectedCurrent=s.tyre.wear+currentRate*before;
  for(const next of c.pit.allowedCompounds){
   const nextCompound=compound(c,next),projectedNext=wearRate(c,e,next)*after,tyrePenalty=Math.pow(projectedCurrent/current.maxUsableWear,2)*before*85+Math.pow(projectedNext/nextCompound.maxUsableWear,2)*after*85,weatherPenalty=Math.abs(w.rainIntensity-nextCompound.wetSuitability)*after*150,riskPenalty=Math.max(0,projectedCurrent-current.maxUsableWear)*4500+Math.max(0,projectedNext-nextCompound.maxUsableWear)*4500,noise=rng.between(-decisionErrorMs,decisionErrorMs),trackTime=c.circuit.referenceLapTimeMs*c.totalLaps,expectedTimeMs=trackTime+pitTime+tyrePenalty+weatherPenalty+riskPenalty+noise;
   candidates.push({targetLap,compound:next,expectedTimeMs,decisionErrorMs});
  }
 }
 candidates.sort((a,b)=>a.expectedTimeMs-b.expectedTimeMs||a.targetLap-b.targetLap||a.compound.localeCompare(b.compound));
 return candidates[0]??null;
}
