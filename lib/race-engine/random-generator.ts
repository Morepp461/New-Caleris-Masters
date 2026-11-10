export class SeededRandom{private state:number;constructor(seed:number){if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError("Race seed must be unsigned 32-bit.");this.state=(seed>>>0)||0x6d2b79f5}nextUint32(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state}next(){return this.nextUint32()/0x100000000}between(a:number,b:number){return a+(b-a)*this.next()}chance(p:number){return this.next()<Math.max(0,Math.min(1,p))}snapshot(){return this.state>>>0}restore(s:number){if(!Number.isInteger(s)||s<=0||s>0xffffffff)throw new RangeError("Invalid RNG state.");this.state=s>>>0}}
export const RANDOM_SUBSYSTEMS=["performance","weather","incidents","mechanical","overtaking","pitExecution","qualifying"] as const;
export type RandomSubsystem=typeof RANDOM_SUBSYSTEMS[number];
export type RandomStateSnapshot=Record<RandomSubsystem,number>;
function deriveSeed(seed:number,engineVersion:string,subsystem:RandomSubsystem){const value=seed+":"+engineVersion+":"+subsystem;let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)||0x6d2b79f5}
export class RandomStreams{
 private streams:Record<RandomSubsystem,SeededRandom>;
 constructor(seed:number,engineVersion:string,snapshot?:Partial<RandomStateSnapshot>){this.streams=Object.fromEntries(RANDOM_SUBSYSTEMS.map(k=>[k,new SeededRandom(deriveSeed(seed,engineVersion,k))])) as Record<RandomSubsystem,SeededRandom>;if(snapshot)this.restore(snapshot as Record<string,number>)}
 get(name:RandomSubsystem){return this.streams[name]}
 snapshot():RandomStateSnapshot{return Object.fromEntries(RANDOM_SUBSYSTEMS.map(k=>[k,this.streams[k].snapshot()])) as RandomStateSnapshot}
 restore(snapshot:Record<string,number>){for(const name of RANDOM_SUBSYSTEMS){const value=snapshot[name];if(value!==undefined)this.streams[name].restore(value);}}
}
export function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
