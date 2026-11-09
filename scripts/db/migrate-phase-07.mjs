import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
const database=process.env.MONGODB_DB, uri=process.env.MONGODB_URI, allowProduction=process.argv.includes("--allow-production");
const migrationId="006-progression-quest-level";
const definition={validators:["quests","quest_assignments","quest_progress","quest_claims","player_xp_events","account_level_rules"],indexes:[
["quests",{active:1,quest_category:1,role_eligibility:1},{name:"ix_quests_active_category_roles"}],
["quests",{name:1,version:1},{unique:true,name:"uq_quests_name_version"}],
["quest_assignments",{target_type:1,target_id:1,status:1,assigned_at:-1},{name:"ix_quest_assignments_target_status_date"}],
["quest_assignments",{quest_id:1,target_type:1,target_id:1,assigned_at:-1},{name:"ix_quest_assignments_quest_target_date"}],
["quest_progress",{assignment_id:1},{unique:true,name:"uq_quest_progress_assignment"}],
["quest_claims",{assignment_id:1},{unique:true,name:"uq_quest_claims_assignment"}],
["quest_claims",{claimed_by:1,claimed_at:-1},{name:"ix_quest_claims_player_date"}],
["player_xp_events",{event_id:1},{unique:true,name:"uq_player_xp_events_event"}],
["player_xp_events",{player_id:1,created_at:-1},{name:"ix_player_xp_events_player_date"}],
["account_level_rules",{level:1,version:1},{unique:true,name:"uq_account_level_rules_level_version"}],
["account_level_rules",{status:1,level:1},{name:"ix_account_level_rules_status_level"}]
]};
const checksum=createHash("sha256").update(JSON.stringify(definition)).digest("hex");
if(!uri||!database)throw new Error("MONGODB_URI and MONGODB_DB are required.");
if(!database.endsWith("_dev")&&!database.endsWith("_staging")&&!allowProduction)throw new Error("Production migration blocked; use a _dev or _staging database.");
const client=new MongoClient(uri,{maxPoolSize:2,serverSelectionTimeoutMS:10000,appName:"caleris-masters-phase-07-migration"});
const uuid={bsonType:"string",pattern:"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"};
const validators={
quests:{$jsonSchema:{bsonType:"object",required:["_id","name","description","role_eligibility","quest_category","difficulty","requirements","rewards","cooldown_seconds","repeatable","active","version","created_at","updated_at"],properties:{_id:uuid,name:{bsonType:"string",minLength:3,maxLength:100},description:{bsonType:"string",minLength:3,maxLength:1000},role_eligibility:{bsonType:"array",items:{enum:["DRIVER","TEAM_OWNER"]},minItems:1},quest_category:{bsonType:"string"},difficulty:{enum:["EASY","MEDIUM","HARD","ELITE"]},requirements:{bsonType:"array",minItems:1},rewards:{bsonType:"object"},cooldown_seconds:{bsonType:["int","long"],minimum:0},repeatable:{bsonType:"bool"},active:{bsonType:"bool"},version:{bsonType:"int",minimum:1},recurrence:{enum:["ONCE","DAILY","WEEKLY","PER_EVENT","PER_SEASON"]},expiry_seconds:{bsonType:["int","long","null"]},evidence_required:{bsonType:"bool"},reward_caps:{bsonType:"object"},created_at:{bsonType:"date"},updated_at:{bsonType:"date"}}}},
quest_assignments:{$jsonSchema:{bsonType:"object",required:["_id","quest_id","target_type","target_id","assigned_at","status","created_at","updated_at"],properties:{_id:uuid,quest_id:uuid,target_type:{enum:["PLAYER","TEAM"]},target_id:uuid,assigned_at:{bsonType:"date"},expires_at:{bsonType:["date","null"]},status:{enum:["ASSIGNED","IN_PROGRESS","COMPLETED","CLAIMED","EXPIRED","REVIEW_REQUIRED","REJECTED"]},recurrence_key:{bsonType:["string","null"]},created_at:{bsonType:"date"},updated_at:{bsonType:"date"}}}},
quest_progress:{$jsonSchema:{bsonType:"object",required:["_id","assignment_id","current_progress","completion_status","updated_at","created_at"],properties:{_id:uuid,assignment_id:uuid,current_progress:{bsonType:"object"},completion_status:{enum:["IN_PROGRESS","COMPLETED","REVIEW_REQUIRED"]},completed_at:{bsonType:["date","null"]},evidence:{bsonType:"array"},evidence_verified:{bsonType:"bool"},updated_at:{bsonType:"date"},created_at:{bsonType:"date"}}}},
quest_claims:{$jsonSchema:{bsonType:"object",required:["_id","assignment_id","claimed_by","rewards_granted","event_id","claimed_at","created_at","updated_at"],properties:{_id:uuid,assignment_id:uuid,claimed_by:uuid,rewards_granted:{bsonType:"array"},event_id:{bsonType:"string"},claimed_at:{bsonType:"date"},created_at:{bsonType:"date"},updated_at:{bsonType:"date"}}}},
player_xp_events:{$jsonSchema:{bsonType:"object",required:["_id","player_id","source_type","source_id","xp_amount","event_id","created_at","updated_at"],properties:{_id:uuid,player_id:uuid,source_type:{bsonType:"string"},source_id:{bsonType:"string"},xp_amount:{bsonType:"int",minimum:1},event_id:{bsonType:"string"},created_at:{bsonType:"date"},updated_at:{bsonType:"date"}}}},
account_level_rules:{$jsonSchema:{bsonType:"object",required:["_id","level","required_total_xp","unlocks","status","version","created_at","updated_at"],properties:{_id:uuid,level:{bsonType:"int",minimum:1},required_total_xp:{bsonType:["int","long"],minimum:0},unlocks:{bsonType:"array"},status:{enum:["ACTIVE","INACTIVE","DRAFT"]},version:{bsonType:"int",minimum:1},created_at:{bsonType:"date"},updated_at:{bsonType:"date"}}}}
};
try{
await client.connect();const db=client.db(database);const names=new Set((await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name));
for(const name of definition.validators)if(!names.has(name))throw new Error("Required baseline collection missing: "+name);
const migrations=db.collection("schema_migrations"),prior=await migrations.findOne({_id:migrationId});
if(prior){if(prior.checksum!==checksum)throw new Error("Migration checksum mismatch; applied migrations are immutable.");console.log("Migration already applied: "+migrationId);}
else{for(const[name,validator]of Object.entries(validators))await db.command({collMod:name,validator,validationLevel:"strict",validationAction:"error"});for(const[collection,keys,options]of definition.indexes)await db.collection(collection).createIndex(keys,options);const now=new Date();await migrations.insertOne({_id:migrationId,checksum,applied_at:now,database,collection_count:0,index_count:definition.indexes.length});console.log("Applied Phase 07 progression, quest and level migration.");}
}finally{await client.close();}
