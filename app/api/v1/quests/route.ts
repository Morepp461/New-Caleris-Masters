import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getMongoDatabase, getMongoClient } from "@/lib/db/mongodb";
import { getSessionPrincipal } from "@/lib/identity/session";
import { requireOperator } from "@/lib/identity/permissions";
import { apiHandler } from "@/lib/server/api-handler";
import { success } from "@/lib/server/response";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/csrf";
import { requireJsonObject, readString } from "@/lib/server/validation";
import { validateQuestDefinition, canClaimAssignment, normalizeRewardGrant, isWithinCooldown, getUtcRecurrenceWindow, evaluateRequirements } from "@/lib/progression/policy.mjs";
import { recordXpEvent } from "@/lib/progression/xp-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Doc={_id:string;[key:string]:any};
const fail=(code:string,message:string,status=409)=>new AppError(code,message,status);
const now=()=>new Date();
const audit=async(db:Awaited<ReturnType<typeof getMongoDatabase>>,actorId:string,action:string,targetId:string,after?:unknown)=>db.collection<Doc>("audit_logs").insertOne({_id:randomUUID(),actor_type:"PLAYER",actor_id:actorId,action,target_type:"QUEST",target_id:targetId,...(after?{after_state:after}:{}),created_at:now(),updated_at:now()});

export const GET=apiHandler(async(request:NextRequest,_context,meta)=>{
 const principal=await getSessionPrincipal(request);
 if(!principal)throw new AppError("UNAUTHENTICATED","Authentication is required.",401);
 const db=await getMongoDatabase();
 if(principal.isOperator){
  const [quests,assignments,levels,progress]=await Promise.all([
   db.collection<Doc>("quests").find({}).sort({created_at:-1}).limit(200).toArray(),
   db.collection<Doc>("quest_assignments").find({}).sort({assigned_at:-1}).limit(200).toArray(),
   db.collection<Doc>("account_level_rules").find({}).sort({level:1,version:-1}).limit(200).toArray()
  ]);
  return success({operator:true,quests,assignments,levels},meta);
 }
 const player=await db.collection<Doc>("players").findOne({_id:principal.playerId,account_status:"ACTIVE"});
 if(!player)throw new AppError("PLAYER_NOT_FOUND","Active player profile was not found.",404);
 const role=String(player.active_role??"");
 const team=role==="TEAM_OWNER"?await db.collection<Doc>("teams").findOne({owner_player_id:principal.playerId,status:"ACTIVE"}):null;
 const targets=[{target_type:"PLAYER",target_id:principal.playerId},...(team?[{target_type:"TEAM",target_id:String(team._id)}]:[])];
 const [assignments,levels,xpEvents]=await Promise.all([
  db.collection<Doc>("quest_assignments").find({$or:targets}).sort({assigned_at:-1}).limit(100).toArray(),
  db.collection<Doc>("account_level_rules").find({status:"ACTIVE"}).sort({level:1}).toArray(),
  db.collection<Doc>("player_xp_events").find({player_id:principal.playerId}).sort({created_at:-1}).limit(20).toArray()
 ]);
 const ids=assignments.map(a=>a.quest_id);
 const quests=await db.collection<Doc>("quests").find({_id:{$in:ids}}).toArray();
 const progress=await db.collection<Doc>("quest_progress").find({assignment_id:{$in:assignments.map(a=>a._id)}}).toArray();
 const level=calculateAccountLevel(Number(player.total_xp??player.xp??0),levels);
 return success({operator:false,player:{displayName:player.display_name,activeRole:role,level:level.level,totalXp:Number(player.total_xp??player.xp??0),nextLevelXp:level.nextLevelXp},assignments,quests,progress,xpEvents},meta);
});

export const POST=apiHandler(async(request:NextRequest,_context,meta)=>{
 assertSameOrigin(request);
 const principal=await getSessionPrincipal(request);
 if(!principal)throw new AppError("UNAUTHENTICATED","Authentication is required.",401);
 const body=requireJsonObject(await request.json());
 const action=readString(body.action,"action",{max:40});
 const db=await getMongoDatabase();
 const actorId=principal.playerId;
 if(action==="CREATE_QUEST"){
  await requireOperator(principal);
  const parsed=validateQuestDefinition({name:body.name,description:body.description,questCategory:body.questCategory,difficulty:body.difficulty,roleEligibility:body.roleEligibility,requirements:body.requirements,rewards:body.rewards,cooldownSeconds:body.cooldownSeconds,repeatable:body.repeatable,recurrence:body.recurrence,expirySeconds:body.expirySeconds??null,evidenceRequired:body.evidenceRequired,rewardCaps:body.rewardCaps??{}});
  if(!parsed.ok)throw new AppError(parsed.reason??"INVALID_QUEST","Quest definition does not match the approved schema.",400);
  const existing=await db.collection<Doc>("quests").find({name:parsed.value.name}).sort({version:-1}).limit(1).next();
  const id=randomUUID(),stamp=now(),version=Number(existing?.version??0)+1;
  await db.collection<Doc>("quests").insertOne({_id:id,...parsed.value,version,created_at:stamp,updated_at:stamp,created_by:actorId,updated_by:actorId});
  await audit(db,actorId,"QUEST_CREATED",id,{version,questCategory:parsed.value.questCategory,roleEligibility:parsed.value.roleEligibility});
  return success({questId:id,version},meta,201);
 }
 if(action==="ASSIGN_QUEST"){
  await requireOperator(principal);
  const questId=readString(body.questId,"questId",{max:64}),targetType=readString(body.targetType,"targetType",{max:10}).toUpperCase(),targetId=readString(body.targetId,"targetId",{max:64});
  if(!["PLAYER","TEAM"].includes(targetType))throw new AppError("INVALID_TARGET_TYPE","Quest target must be PLAYER or TEAM.",400);
  const quest=await db.collection<Doc>("quests").findOne({_id:questId,active:true});
  if(!quest)throw new AppError("QUEST_NOT_AVAILABLE","Active quest not found.",404);
  if(targetType==="PLAYER"){
   const target=await db.collection<Doc>("players").findOne({_id:targetId,account_status:"ACTIVE"});
   if(!target||!quest.role_eligibility.includes(target.active_role))throw fail("QUEST_INELIGIBLE","Player role is not eligible for this quest.");
  }else{
   const team=await db.collection<Doc>("teams").findOne({_id:targetId,status:"ACTIVE"});
   if(!team)throw new AppError("TEAM_NOT_FOUND","Active team not found.",404);
   const owner=await db.collection<Doc>("players").findOne({_id:team.owner_player_id,account_status:"ACTIVE",active_role:"TEAM_OWNER"});
   if(!owner||!quest.role_eligibility.includes("TEAM_OWNER"))throw fail("QUEST_INELIGIBLE","Team Owner role is not eligible for this quest.");
  }
  const stamp=now();
  let recurrenceKey=typeof body.recurrenceKey==="string"?body.recurrenceKey:null;
  if(quest.recurrence==="DAILY"||quest.recurrence==="WEEKLY"){
   const window=getUtcRecurrenceWindow(stamp,String(quest.recurrence));
   recurrenceKey=String(quest.recurrence)+":"+window;
  }else if(quest.recurrence==="PER_SEASON"){
   const activeSeason=await db.collection<Doc>("seasons").findOne({status:"ACTIVE"},{sort:{season_number:-1}});
   if(!activeSeason)throw fail("ACTIVE_SEASON_REQUIRED","A season must be active for a per-season quest.");
   recurrenceKey="SEASON:"+String(activeSeason._id);
  }else if(quest.recurrence==="PER_EVENT"&&!recurrenceKey){
   throw new AppError("EVENT_REFERENCE_REQUIRED","A recurrence key is required for event-scoped quests.",400);
  }
  if(recurrenceKey&&await db.collection<Doc>("quest_assignments").findOne({quest_id:questId,target_type:targetType,target_id:targetId,recurrence_key:recurrenceKey}))throw fail("RECURRENCE_ALREADY_ASSIGNED","This quest cycle has already been assigned.");
  const previousAssignment=await db.collection<Doc>("quest_assignments").find({quest_id:questId,target_type:targetType,target_id:targetId,status:"CLAIMED"}).sort({assigned_at:-1}).limit(1).next();
  if(!quest.repeatable&&previousAssignment)throw fail("QUEST_ALREADY_COMPLETED","This non-repeatable quest was already completed.");
  if(previousAssignment&&Number(quest.cooldown_seconds)>0){
   const previousClaim=await db.collection<Doc>("quest_claims").findOne({assignment_id:previousAssignment._id});
   if(previousClaim&&isWithinCooldown(previousClaim.claimed_at,Number(quest.cooldown_seconds),stamp))throw fail("QUEST_COOLDOWN_ACTIVE","Quest cooldown has not elapsed.");
  }
  const expiresAt=quest.expiry_seconds?new Date(stamp.getTime()+Number(quest.expiry_seconds)*1000):null;
  const id=randomUUID();
  await db.collection<Doc>("quest_assignments").insertOne({_id:id,quest_id:questId,target_type:targetType,target_id:targetId,assigned_at:stamp,expires_at:expiresAt,status:"ASSIGNED",recurrence_key:recurrenceKey,created_at:stamp,updated_at:stamp});
  await db.collection<Doc>("quest_progress").insertOne({_id:randomUUID(),assignment_id:id,current_progress:{},completion_status:"IN_PROGRESS",evidence:[],evidence_verified:false,created_at:stamp,updated_at:stamp});
  await audit(db,actorId,"QUEST_ASSIGNED",id,{questId,targetType,targetId});
  return success({assignmentId:id,status:"ASSIGNED",expiresAt},meta,201);
 }
 if(action==="SUBMIT_EVIDENCE"){
  const assignmentId=readString(body.assignmentId,"assignmentId",{max:64});
  const assignment=await db.collection<Doc>("quest_assignments").findOne({_id:assignmentId,status:{$in:["ASSIGNED","IN_PROGRESS","REVIEW_REQUIRED"]}});
  if(!assignment)throw new AppError("ASSIGNMENT_NOT_FOUND","Active quest assignment was not found.",404);
  const player=await db.collection<Doc>("players").findOne({_id:actorId,account_status:"ACTIVE"});
  const team=assignment.target_type==="TEAM"?await db.collection<Doc>("teams").findOne({_id:assignment.target_id,owner_player_id:actorId,status:"ACTIVE"}):null;
  if(assignment.target_type==="PLAYER"?assignment.target_id!==actorId:!team)throw new AppError("FORBIDDEN","This quest assignment does not belong to your account.",403);
  const quest=await db.collection<Doc>("quests").findOne({_id:assignment.quest_id,active:true});
  if(!quest||!player||!quest.role_eligibility.includes(player.active_role))throw fail("QUEST_INELIGIBLE","Your current role is not eligible for this quest.");
  if(assignment.expires_at&&new Date(assignment.expires_at)<=now())throw fail("QUEST_EXPIRED","Quest assignment has expired.");
  const evidence=Array.isArray(body.evidence)?body.evidence.slice(0,10):[];
  if(quest.evidence_required&&evidence.length===0)throw new AppError("EVIDENCE_REQUIRED","Submit at least one evidence item.",400);
  const progress=await db.collection<Doc>("quest_progress").findOne({assignment_id:assignmentId});
  const submitted=body.progress&&typeof body.progress==="object"&&!Array.isArray(body.progress)?body.progress:{};
  const current:Record<string,number>={};
  for(const requirement of quest.requirements??[]){
   const value=Number((submitted as Record<string,unknown>)[String(requirement.key)]);
   if(Number.isSafeInteger(value)&&value>=0)current[String(requirement.key)]=Math.min(value,Number(requirement.target));
  }
  const idempotency=readString(body.idempotencyKey,"idempotencyKey",{min:8,max:128});
  if(progress?.last_submission_key===idempotency)return success({submitted:true,status:assignment.status},meta);
  const stamp=now();
  await db.collection<Doc>("quest_progress").updateOne({assignment_id:assignmentId},{$set:{current_progress:current,evidence:evidence.map((e:any)=>({type:String(e.type??"OTHER").slice(0,24),reference:String(e.reference??"").slice(0,500),submitted_at:stamp})),evidence_verified:false,completion_status:"REVIEW_REQUIRED",last_submission_key:idempotency,updated_at:stamp}});
  await db.collection<Doc>("quest_assignments").updateOne({_id:assignmentId},{$set:{status:"REVIEW_REQUIRED",updated_at:stamp}});
  await audit(db,actorId,"QUEST_EVIDENCE_SUBMITTED",assignmentId,{evidenceCount:evidence.length});
  return success({submitted:true,status:"REVIEW_REQUIRED"},meta,202);
 }
 if(action==="REVIEW_EVIDENCE"){
  await requireOperator(principal);
  const assignmentId=readString(body.assignmentId,"assignmentId",{max:64}),decision=readString(body.decision,"decision",{max:10}).toUpperCase();
  if(!["APPROVE","REJECT"].includes(decision))throw new AppError("INVALID_REVIEW_DECISION","Decision must be APPROVE or REJECT.",400);
  const assignment=await db.collection<Doc>("quest_assignments").findOne({_id:assignmentId,status:"REVIEW_REQUIRED"});
  const progress=await db.collection<Doc>("quest_progress").findOne({assignment_id:assignmentId});
  if(!assignment||!progress)throw new AppError("REVIEW_NOT_FOUND","Pending evidence review was not found.",404);
  const quest=await db.collection<Doc>("quests").findOne({_id:assignment.quest_id});
  if(!quest)throw new AppError("QUEST_NOT_FOUND","Quest definition was not found.",404);
  const requirementCheck=evaluateRequirements(quest.requirements??[],progress.current_progress??{});
  if(decision==="APPROVE"&&!requirementCheck.complete)throw fail("QUEST_REQUIREMENTS_NOT_MET","Submitted evidence does not satisfy every quest requirement.");
  const stamp=now(),approved=decision==="APPROVE";
  await db.collection<Doc>("quest_progress").updateOne({_id:progress._id,completion_status:"REVIEW_REQUIRED"},{$set:{evidence_verified:approved,completion_status:approved?"COMPLETED":"IN_PROGRESS",completed_at:approved?stamp:null,reviewed_by:actorId,reviewed_at:stamp,review_note:typeof body.note==="string"?body.note.slice(0,500):"",updated_at:stamp}});
  await db.collection<Doc>("quest_assignments").updateOne({_id:assignmentId,status:"REVIEW_REQUIRED"},{$set:{status:approved?"COMPLETED":"REJECTED",updated_at:stamp}});
  await audit(db,actorId,"QUEST_EVIDENCE_"+decision,assignmentId,{note:body.note??null});
  return success({assignmentId,status:approved?"COMPLETED":"REJECTED"},meta);
 }
 if(action==="UPSERT_LEVEL_RULE"){
  await requireOperator(principal);
  const level=Number(body.level),requiredTotalXp=Number(body.requiredTotalXp);
  if(!Number.isSafeInteger(level)||level<1||!Number.isSafeInteger(requiredTotalXp)||requiredTotalXp<0)throw new AppError("INVALID_LEVEL_RULE","Level and XP threshold must be non-negative integers.",400);
  const active=await db.collection<Doc>("account_level_rules").find({status:"ACTIVE"}).sort({level:1}).toArray();
  const lower=active.filter(r=>Number(r.level)<level).at(-1),higher=active.find(r=>Number(r.level)>level);
  if((lower&&requiredTotalXp<=Number(lower.required_total_xp))||(higher&&requiredTotalXp>=Number(higher.required_total_xp)))throw fail("NON_MONOTONIC_LEVEL_THRESHOLD","XP thresholds must increase strictly with each level.");
  const previous=active.find(r=>Number(r.level)===level),version=Number(previous?.version??0)+1,stamp=now(),id=randomUUID();
  if(previous)await db.collection<Doc>("account_level_rules").updateOne({_id:previous._id,status:"ACTIVE"},{$set:{status:"INACTIVE",updated_at:stamp}});
  const unlocks=Array.isArray(body.unlocks)?body.unlocks.filter((v:any)=>typeof v==="string").slice(0,50):[];
  await db.collection<Doc>("account_level_rules").insertOne({_id:id,level,required_total_xp:requiredTotalXp,unlocks,status:"ACTIVE",version,created_at:stamp,updated_at:stamp,updated_by:actorId});
  await audit(db,actorId,"ACCOUNT_LEVEL_RULE_UPSERTED",id,{level,requiredTotalXp,version});
  return success({ruleId:id,level,version},meta,201);
 }
 if(action==="CLAIM_REWARD"){
  const assignmentId=readString(body.assignmentId,"assignmentId",{max:64});
  const assignment=await db.collection<Doc>("quest_assignments").findOne({_id:assignmentId,status:"COMPLETED"});
  if(!assignment)throw new AppError("QUEST_NOT_COMPLETED","Quest is not ready to claim.",409);
  const team=assignment.target_type==="TEAM"?await db.collection<Doc>("teams").findOne({_id:assignment.target_id,owner_player_id:actorId,status:"ACTIVE"}):null;
  if(assignment.target_type==="PLAYER"?assignment.target_id!==actorId:!team)throw new AppError("FORBIDDEN","This quest assignment does not belong to your account.",403);
  const quest=await db.collection<Doc>("quests").findOne({_id:assignment.quest_id});
  const progress=await db.collection<Doc>("quest_progress").findOne({assignment_id:assignmentId});
  const player=await db.collection<Doc>("players").findOne({_id:actorId,account_status:"ACTIVE"});
  if(!quest||!progress||!player)throw new AppError("QUEST_NOT_FOUND","Quest definition, progress or active player was not found.",404);
  if(!quest.role_eligibility.includes(player.active_role)|| (assignment.target_type==="TEAM"&&player.active_role!=="TEAM_OWNER"))throw new AppError("QUEST_INELIGIBLE","Your current role is not eligible to claim this reward.",403);
  const decision=canClaimAssignment({status:String(assignment.status),expiresAt:assignment.expires_at??null,evidenceRequired:Boolean(quest.evidence_required),evidenceVerified:Boolean(progress.evidence_verified)});
  if(!decision.ok)throw fail(decision.reason??"CLAIM_BLOCKED","Quest reward cannot be claimed.");
  const rewards=normalizeRewardGrant(quest.rewards?.items??[]);
  for(const reward of rewards){
   const cap=Number(quest.reward_caps?.[reward.type]??0);
   if(cap>0&&reward.amount>cap)throw fail("REWARD_CAP_EXCEEDED","Configured per-claim reward cap would be exceeded.");
   const dailyCap=Number(quest.reward_caps?.["DAILY_"+reward.type]??0);
   if(dailyCap>0){
    const dayStart=new Date(Date.UTC(now().getUTCFullYear(),now().getUTCMonth(),now().getUTCDate()));
    const totals=await db.collection<Doc>("quest_claims").aggregate([{$match:{claimed_by:actorId,claimed_at:{$gte:dayStart}}},{$unwind:"$rewards_granted"},{$match:{"rewards_granted.type":reward.type}},{$group:{_id:null,total:{$sum:"$rewards_granted.amount"}}}]).toArray();
    if(Number(totals[0]?.total??0)+reward.amount>dailyCap)throw fail("DAILY_REWARD_CAP_REACHED","Configured daily reward cap would be exceeded.");
   }
   const seasonCap=Number(quest.reward_caps?.["SEASON_"+reward.type]??0);
   if(seasonCap>0){
    const activeSeason=await db.collection<Doc>("seasons").findOne({status:"ACTIVE"},{sort:{season_number:-1}});
    if(activeSeason){
     const seasonStart=activeSeason.start_date?new Date(activeSeason.start_date):new Date(0);
     const totals=await db.collection<Doc>("quest_claims").aggregate([{$match:{claimed_by:actorId,claimed_at:{$gte:seasonStart}}},{$unwind:"$rewards_granted"},{$match:{"rewards_granted.type":reward.type}},{$group:{_id:null,total:{$sum:"$rewards_granted.amount"}}}]).toArray();
     if(Number(totals[0]?.total??0)+reward.amount>seasonCap)throw fail("SEASON_REWARD_CAP_REACHED","Configured season reward cap would be exceeded.");
    }
   }
  }
  const eventId="quest-claim:"+assignmentId,stamp=now(),client=await getMongoClient(),session=client.startSession();
  let granted:any[]=[];
  try{
   await session.withTransaction(async()=>{
    const claims=db.collection<Doc>("quest_claims");
    if(await claims.findOne({assignment_id:assignmentId},{session}))throw fail("ALREADY_CLAIMED","This quest assignment has already been claimed.");
    const player=await db.collection<Doc>("players").findOne({_id:actorId,account_status:"ACTIVE"},{session});
    if(!player)throw new AppError("PLAYER_NOT_FOUND","Active player was not found.",404);
    const xp=rewards.filter(r=>r.type==="XP").reduce((sum,r)=>sum+r.amount,0);
    if(xp>0)await recordXpEvent(db,session,{playerId:actorId,xpAmount:xp,eventId,sourceType:"QUEST_CLAIM",sourceId:assignmentId});
    granted=rewards.map(r=>({...r,settlement_status:r.type==="XP"?"GRANTED":r.type==="ACHIEVEMENT"?"PENDING_ACHIEVEMENT":"PENDING_PHASE_08"}));
    await claims.insertOne({_id:randomUUID(),assignment_id:assignmentId,claimed_by:actorId,rewards_granted:granted,event_id:eventId,claimed_at:stamp,created_at:stamp,updated_at:stamp},{session});
    await db.collection<Doc>("quest_assignments").updateOne({_id:assignmentId,status:"COMPLETED"},{$set:{status:"CLAIMED",updated_at:stamp}},{session});
   });
  }catch(error){if((error as {code?:number}).code===11000)throw fail("ALREADY_CLAIMED","This quest assignment has already been claimed.");throw error;}finally{await session.endSession();}
  await audit(db,actorId,"QUEST_REWARD_CLAIMED",assignmentId,{rewards:granted,eventId});
  return success({assignmentId,rewards:granted,eventId},meta,201);
 }
 throw new AppError("UNKNOWN_QUEST_ACTION","Unsupported quest action.",400);
},{scope:"progression-quests"});
