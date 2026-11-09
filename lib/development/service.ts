import { randomUUID } from "node:crypto";
import { Long } from "mongodb";
import { getMongoClient,getMongoDatabase } from "@/lib/db/mongodb";
import { withMongoTransaction } from "@/lib/db/transactions";
import { AppError } from "@/lib/server/errors";
import { canUpgrade,createDefaultDevelopmentRules,validateDevelopmentRules } from "./policy.mjs";
type Doc={_id:string;[key:string]:any};
const long=(n:number)=>Long.fromNumber(n);
export async function createDevelopmentRuleset(seasonId:string,actorId:string){
 const db=await getMongoDatabase();
 if(!await db.collection<Doc>("seasons").findOne({_id:seasonId}))throw new AppError("SEASON_NOT_FOUND","Season not found.",404);
 const latest=await db.collection<Doc>("development_rulesets").find({season_id:seasonId}).sort({version:-1}).limit(1).next();
 const version=Number(latest?.version??0)+1,id=randomUUID(),stamp=new Date();
 const rules=createDefaultDevelopmentRules(seasonId,version);
 await db.collection<Doc>("development_rulesets").insertOne({_id:id,...rules,created_by:actorId,created_at:stamp,updated_at:stamp});
 await db.collection<Doc>("audit_logs").insertOne({_id:randomUUID(),actor_type:"OPERATOR",actor_id:actorId,action:"DEVELOPMENT_RULESET_CREATED",target_type:"DEVELOPMENT_RULESET",target_id:id,reason:"Season-scoped draft created without default prices.",created_at:stamp,updated_at:stamp});
 return {rulesetId:id,version,status:"DRAFT",rules};
}
export async function updateDevelopmentRuleset(rulesetId:string,rules:Record<string,unknown>,actorId:string){
 const parsed=validateDevelopmentRules(rules);if(!parsed.ok)throw new AppError(parsed.reason??"INVALID_RULESET","Development rules are invalid.",400);
 const db=await getMongoDatabase(),existing=await db.collection<Doc>("development_rulesets").findOne({_id:rulesetId,status:"DRAFT"});
 if(!existing)throw new AppError("RULESET_NOT_DRAFT","Only draft development rulesets can be edited.",409);
 const stamp=new Date();
 const config={attribute_min:parsed.value.attribute_min,attribute_max:parsed.value.attribute_max,starting_values:parsed.value.starting_values,upgrade_costs:parsed.value.upgrade_costs,per_period_limits:parsed.value.per_period_limits,respec_policy:parsed.value.respec_policy,rnd:parsed.value.rnd};await db.collection<Doc>("development_rulesets").updateOne({_id:rulesetId,status:"DRAFT"},{$set:{...config,updated_by:actorId,updated_at:stamp}});
 await db.collection<Doc>("audit_logs").insertOne({_id:randomUUID(),actor_type:"OPERATOR",actor_id:actorId,action:"DEVELOPMENT_RULESET_UPDATED",target_type:"DEVELOPMENT_RULESET",target_id:rulesetId,reason:"Seasonal development pricing and limits updated.",before_state:existing,after_state:parsed.value,created_at:stamp,updated_at:stamp});
 return {rulesetId,updated:true};
}
export async function activateDevelopmentRuleset(rulesetId:string,actorId:string){
 const db=await getMongoDatabase(),client=await getMongoClient();
 return withMongoTransaction(client,async(session)=>{
  const rules=db.collection<Doc>("development_rulesets"),current=await rules.findOne({_id:rulesetId,status:"DRAFT"},{session});
  if(!current)throw new AppError("RULESET_NOT_DRAFT","Only a draft ruleset can be activated.",409);
  const parsed=validateDevelopmentRules(current);if(!parsed.ok)throw new AppError(parsed.reason??"INVALID_RULESET","Development rules are invalid.",400);
  await rules.updateMany({season_id:current.season_id,status:"ACTIVE"},{$set:{status:"SUPERSEDED",superseded_at:new Date(),updated_at:new Date()}},{session});
  await rules.updateOne({_id:rulesetId,status:"DRAFT"},{$set:{status:"ACTIVE",enabled:true,activated_by:actorId,activated_at:new Date(),updated_at:new Date()}},{session});
  await db.collection<Doc>("audit_logs").insertOne({_id:randomUUID(),actor_type:"OPERATOR",actor_id:actorId,action:"DEVELOPMENT_RULESET_ACTIVATED",target_type:"DEVELOPMENT_RULESET",target_id:rulesetId,reason:"Season-specific development ruleset activated.",created_at:new Date(),updated_at:new Date()},{session});
  return {rulesetId,seasonId:current.season_id,version:current.version,status:"ACTIVE"};
 });
}
export async function upgradeAttribute(input:{ownerType:"PLAYER"|"TEAM";ownerId:string;attributeKey:string;newValue:number;actorId:string;idempotencyKey:string;reason:string}){
 if(!/^[a-zA-Z0-9:_-]{8,160}$/.test(input.idempotencyKey))throw new AppError("INVALID_IDEMPOTENCY_KEY","A valid idempotency key is required.",400);
 if(typeof input.reason!=="string"||input.reason.trim().length<8)throw new AppError("REASON_REQUIRED","A reason is required.",400);
 const db=await getMongoDatabase(),client=await getMongoClient();
 return withMongoTransaction(client,async(session)=>{
  const tx=db.collection<Doc>("development_transactions"),prior=await tx.findOne({idempotency_key:input.idempotencyKey},{session});
  if(prior){if(prior.transaction_type!=="ATTRIBUTE_UPGRADE"||prior.owner_id!==input.ownerId||prior.attribute_key!==input.attributeKey||Number(prior.new_value)!==input.newValue)throw new AppError("IDEMPOTENCY_CONFLICT","Idempotency key belongs to another transaction.",409);return {transactionId:prior._id,replayed:true,newValue:prior.new_value};}
  const season=await db.collection<Doc>("seasons").findOne({status:"ACTIVE"},{sort:{season_number:-1},session});
  if(!season)throw new AppError("ACTIVE_SEASON_REQUIRED","An active season is required for development.",409);
  const rules=await db.collection<Doc>("development_rulesets").findOne({season_id:season._id,status:"ACTIVE",enabled:true},{session});
  if(!rules)throw new AppError("DEVELOPMENT_RULESET_NOT_ACTIVE","This season has no active development ruleset.",409);
  const collection=input.ownerType==="PLAYER"?"driver_profiles":"teams";
  const owner=input.ownerType==="PLAYER"?await db.collection<Doc>(collection).findOne({player_id:input.ownerId,profile_status:"ACTIVE"},{session}):await db.collection<Doc>(collection).findOne({_id:input.ownerId,status:"ACTIVE"},{session});
  if(!owner)throw new AppError("DEVELOPMENT_OWNER_NOT_FOUND","Active development owner not found.",404);
  const attributes=owner.attributes??{},current=Number(attributes[input.attributeKey]);
  const group=input.ownerType==="PLAYER"?"driver":"team",limit=rules.per_period_limits?.[group];
  const period=await db.collection<Doc>("economy_periods").findOne({season_id:season._id,status:"OPEN",start_at:{$lte:new Date()},end_at:{$gt:new Date()}},{session});
  if(limit!==null&&limit!==undefined&&!period)throw new AppError("DEVELOPMENT_PERIOD_REQUIRED","An open economy period is required to enforce this season's development limit.",409);
  const periodKey=period?String(period._id):"UNLIMITED:"+String(season._id);
  const count=await db.collection<Doc>("development_history").countDocuments({owner_type:input.ownerType,owner_id:input.ownerId,period_key:periodKey},{session});
  const decision=canUpgrade({ownerType:input.ownerType,attributeKey:input.attributeKey,currentValue:current,newValue:input.newValue,rules,periodUpgradeCount:count});
  if(!decision.ok)throw new AppError(decision.reason??"UPGRADE_NOT_ALLOWED","Attribute upgrade is not allowed.",409);
  const tokenType=decision.tokenType,wallet=await db.collection<Doc>("development_wallets").findOne({owner_type:input.ownerType,owner_id:input.ownerId,token_type:tokenType},{session});
  if(!wallet)throw new AppError("DEVELOPMENT_WALLET_NOT_FOUND","Required development wallet does not exist.",409);
  const before=BigInt(String(wallet.balance??0)),cost=BigInt(decision.cost);
  if(before<cost)throw new AppError("INSUFFICIENT_DEVELOPMENT_TOKENS","Insufficient development tokens.",409);
  const after=before-cost,stamp=new Date(),eventId=randomUUID(),transactionId=randomUUID();
  const debit=await db.collection<Doc>("development_wallets").updateOne({_id:wallet._id,version:wallet.version,balance:{$gte:long(decision.cost)}},{$inc:{balance:long(-decision.cost),version:Long.fromInt(1)},$set:{updated_at:stamp}},{session});
  if(debit.modifiedCount!==1)throw new AppError("WALLET_CONFLICT","Wallet changed during upgrade.",409);
  const update=await db.collection<Doc>(collection).updateOne({_id:owner._id,"attributes."+input.attributeKey:current},{$set:{["attributes."+input.attributeKey]:input.newValue,updated_at:stamp}},{session});
  if(update.modifiedCount!==1)throw new AppError("ATTRIBUTE_CONFLICT","Attribute changed during upgrade.",409);
  await tx.insertOne({_id:transactionId,wallet_id:wallet._id,owner_type:input.ownerType,owner_id:input.ownerId,token_type:tokenType,transaction_type:"ATTRIBUTE_UPGRADE",source_type:"ATTRIBUTE_UPGRADE",event_id:eventId,idempotency_key:input.idempotencyKey,actor_id:input.actorId,reason:input.reason.trim(),amount:long(decision.cost),balance_before:Long.fromString(before.toString()),balance_after:Long.fromString(after.toString()),attribute_key:input.attributeKey,old_value:current,new_value:input.newValue,season_id:season._id,ruleset_id:rules._id,ruleset_version:rules.version,created_at:stamp,updated_at:stamp},{session});
  await db.collection<Doc>("development_history").insertOne({_id:randomUUID(),owner_type:input.ownerType,owner_id:input.ownerId,attribute_key:input.attributeKey,old_value:current,new_value:input.newValue,token_type:tokenType,token_cost:long(decision.cost),event_id:eventId,season_id:season._id,ruleset_id:rules._id,ruleset_version:rules.version,period_key:periodKey,actor_id:input.actorId,created_at:stamp,updated_at:stamp},{session});
  await db.collection<Doc>("audit_logs").insertOne({_id:randomUUID(),actor_type:"PLAYER",actor_id:input.actorId,action:"ATTRIBUTE_UPGRADED",target_type:input.ownerType,target_id:input.ownerId,reason:input.reason.trim(),after_state:{attributeKey:input.attributeKey,oldValue:current,newValue:input.newValue,tokenType,cost:decision.cost,rulesetVersion:rules.version},created_at:stamp,updated_at:stamp},{session});
  await db.collection<Doc>("outbox_events").insertOne({_id:randomUUID(),event_type:"ATTRIBUTE_UPGRADED",aggregate_type:input.ownerType,aggregate_id:input.ownerId,payload:{attributeKey:input.attributeKey,oldValue:current,newValue:input.newValue,seasonId:season._id,rulesetVersion:rules.version},status:"PENDING",attempts:0,next_attempt_at:stamp,created_at:stamp,updated_at:stamp},{session});
  return {transactionId,replayed:false,oldValue:current,newValue:input.newValue,tokenType,cost:decision.cost,rulesetVersion:rules.version};
 });
}

export async function queueRndProject(input:{teamId:string;projectKey:string;actorId:string;idempotencyKey:string;reason:string}){
 if(!/^[a-zA-Z0-9:_-]{8,160}$/.test(input.idempotencyKey))throw new AppError("INVALID_IDEMPOTENCY_KEY","A valid idempotency key is required.",400);
 if(input.reason.trim().length<8)throw new AppError("REASON_REQUIRED","A reason is required.",400);
 const db=await getMongoDatabase(),client=await getMongoClient();
 return withMongoTransaction(client,async(session)=>{
  const tx=db.collection<Doc>("development_transactions"),prior=await tx.findOne({idempotency_key:input.idempotencyKey},{session});
  if(prior){if(prior.transaction_type!=="RND_PROJECT"||prior.owner_id!==input.teamId||prior.project_key!==input.projectKey)throw new AppError("IDEMPOTENCY_CONFLICT","Idempotency key belongs to another project.",409);return {projectId:prior.project_id,replayed:true};}
  const team=await db.collection<Doc>("teams").findOne({_id:input.teamId,owner_player_id:input.actorId,status:"ACTIVE"},{session});
  if(!team)throw new AppError("TEAM_OWNERSHIP_REQUIRED","Active team ownership is required.",403);
  const season=await db.collection<Doc>("seasons").findOne({status:"ACTIVE"},{sort:{season_number:-1},session});
  if(!season)throw new AppError("ACTIVE_SEASON_REQUIRED","An active season is required for R&D.",409);
  const rules=await db.collection<Doc>("development_rulesets").findOne({season_id:season._id,status:"ACTIVE",enabled:true,"rnd.enabled":true},{session});
  if(!rules)throw new AppError("RND_RULES_NOT_ACTIVE","R&D is not enabled for this season.",409);
  const project=rules.rnd.project_catalog.find((p:Doc)=>p.key===input.projectKey);
  if(!project)throw new AppError("RND_PROJECT_UNAVAILABLE","Project is not in the active season catalog.",404);
  const wallet=await db.collection<Doc>("development_wallets").findOne({owner_type:"TEAM",owner_id:input.teamId,token_type:"TDP"},{session});
  if(!wallet)throw new AppError("TDP_WALLET_NOT_FOUND","Team TDP wallet does not exist.",409);
  const balance=BigInt(String(wallet.balance??0)),cost=BigInt(project.tdp_cost);
  if(balance<cost)throw new AppError("INSUFFICIENT_TDP","Insufficient TDP for this R&D project.",409);
  const after=balance-cost,stamp=new Date(),projectId=randomUUID(),transactionId=randomUUID(),eventId=randomUUID();
  const debit=await db.collection<Doc>("development_wallets").updateOne({_id:wallet._id,version:wallet.version,balance:{$gte:long(project.tdp_cost)}},{$inc:{balance:long(-project.tdp_cost),version:Long.fromInt(1)},$set:{updated_at:stamp}},{session});
  if(debit.modifiedCount!==1)throw new AppError("WALLET_CONFLICT","TDP wallet changed during project queueing.",409);
  await db.collection<Doc>("rnd_projects").insertOne({_id:projectId,team_id:input.teamId,season_id:season._id,ruleset_id:rules._id,ruleset_version:rules.version,project_key:project.key,name:project.name,status:"QUEUED",tdp_cost:long(project.tdp_cost),duration_periods:project.duration_periods,queued_by:input.actorId,reason:input.reason.trim(),created_at:stamp,updated_at:stamp},{session});
  await tx.insertOne({_id:transactionId,wallet_id:wallet._id,owner_type:"TEAM",owner_id:input.teamId,token_type:"TDP",transaction_type:"RND_PROJECT",source_type:"RND_PROJECT",source_id:projectId,project_id:projectId,project_key:project.key,event_id:eventId,idempotency_key:input.idempotencyKey,actor_id:input.actorId,reason:input.reason.trim(),amount:long(project.tdp_cost),balance_before:Long.fromString(balance.toString()),balance_after:Long.fromString(after.toString()),season_id:season._id,ruleset_id:rules._id,ruleset_version:rules.version,created_at:stamp,updated_at:stamp},{session});
  await db.collection<Doc>("audit_logs").insertOne({_id:randomUUID(),actor_type:"PLAYER",actor_id:input.actorId,action:"RND_PROJECT_QUEUED",target_type:"RND_PROJECT",target_id:projectId,reason:input.reason.trim(),after_state:{teamId:input.teamId,projectKey:project.key,tdpCost:project.tdp_cost,rulesetVersion:rules.version},created_at:stamp,updated_at:stamp},{session});
  await db.collection<Doc>("outbox_events").insertOne({_id:randomUUID(),event_type:"RND_PROJECT_QUEUED",aggregate_type:"TEAM",aggregate_id:input.teamId,payload:{projectId,projectKey:project.key,seasonId:season._id,rulesetVersion:rules.version},status:"PENDING",attempts:0,next_attempt_at:stamp,created_at:stamp,updated_at:stamp},{session});
  return {projectId,replayed:false,status:"QUEUED",tdpCost:project.tdp_cost};
 });
}
