import { randomUUID } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
type PlayerRecord={_id:string;account_status:string;total_xp?:number;xp?:number;[key:string]:any};
type XpEventRecord={_id:string;[key:string]:any};
type LevelRuleRecord={_id:string;level:number;required_total_xp:number;status:string;[key:string]:any};
import { calculateAccountLevel, validateXpEvent } from "./policy.mjs";

export async function recordXpEvent(db:Db,session:ClientSession,input:{playerId:string;xpAmount:number;eventId:string;sourceType:string;sourceId:string}) {
  if(!validateXpEvent(input))throw new TypeError("Invalid XP event.");
  const events=db.collection<XpEventRecord>("player_xp_events");
  const existing=await events.findOne({event_id:input.eventId},{session});
  if(existing)return {recorded:false,duplicate:true,totalXp:null,level:null};
  const player=await db.collection<PlayerRecord>("players").findOne({_id:input.playerId,account_status:"ACTIVE"},{session});
  if(!player)throw new Error("Active player was not found.");
  const stamp=new Date(),totalXp=Number(player.total_xp??player.xp??0)+input.xpAmount;
  await events.insertOne({_id:randomUUID(),player_id:input.playerId,source_type:input.sourceType,source_id:input.sourceId,xp_amount:input.xpAmount,event_id:input.eventId,created_at:stamp,updated_at:stamp},{session});
  const rules=await db.collection<LevelRuleRecord>("account_level_rules").find({status:"ACTIVE"},{session}).sort({level:1}).toArray();
  const level=calculateAccountLevel(totalXp,rules);
  await db.collection<Document>("players").updateOne({_id:input.playerId,account_status:"ACTIVE"},{$inc:{total_xp:input.xpAmount,xp:input.xpAmount},$set:{level:level.level,updated_at:stamp}},{session});
  return {recorded:true,duplicate:false,totalXp,level:level.level,nextLevelXp:level.nextLevelXp};
}
