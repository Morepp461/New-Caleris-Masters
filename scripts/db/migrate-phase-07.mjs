import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
const database=process.env.MONGODB_DB, uri=process.env.MONGODB_URI, allowProduction=process.argv.includes("--allow-production");
const migrationId="006-progression-quest-level";
const definition={indexes:[
["quests",{active:1,quest_category:1,role_eligibility:1},{name:"ix_quests_active_category_roles"}],
["quests",{name:1,version:1},{unique:true,name:"uq_quests_name_version"}],
["quest_assignments",{target_type:1,target_id:1,status:1,assigned_at:-1},{name:"ix_quest_assignments_target_status_date"}],
["quest_assignments",{status:1,expires_at:1},{name:"ix_quest_assignments_status_expiry"}],
["quest_assignments",{quest_id:1,target_type:1,target_id:1,assigned_at:-1},{name:"ix_quest_assignments_quest_target_date"}],
["quest_assignments",{quest_id:1,target_type:1,target_id:1,recurrence_key:1},{unique:true,name:"uq_quest_assignment_recurrence"}],
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
try{
await client.connect();const db=client.db(database);const names=new Set((await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name));
for(const name of ["quests","quest_assignments","quest_progress","quest_claims","player_xp_events","account_level_rules","schema_migrations"])if(!names.has(name))throw new Error("Required baseline collection missing: "+name);
const migrations=db.collection("schema_migrations"),prior=await migrations.findOne({_id:migrationId});
if(prior){if(prior.checksum!==checksum)throw new Error("Migration checksum mismatch; applied migrations are immutable.");console.log("Migration already applied: "+migrationId);}
else{for(const[collection,keys,options]of definition.indexes)await db.collection(collection).createIndex(keys,options);const now=new Date();await migrations.insertOne({_id:migrationId,checksum,applied_at:now,database,collection_count:0,index_count:definition.indexes.length});console.log("Applied Phase 07 progression, quest and level migration.");}
}finally{await client.close();}
