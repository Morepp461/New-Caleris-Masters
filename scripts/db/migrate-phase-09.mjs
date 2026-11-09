import {createHash} from "node:crypto";
import {MongoClient} from "mongodb";
const database=process.env.MONGODB_DB,uri=process.env.MONGODB_URI,allowProduction=process.argv.includes("--allow-production");
const migrationId="009-attributes-development-rnd";
const indexes=[
 ["development_rulesets",{season_id:1,version:1},{unique:true,name:"uq_development_rulesets_season_version"}],
 ["development_rulesets",{season_id:1,status:1,version:-1},{name:"ix_development_rulesets_season_status_version"}],
 ["development_rulesets",{season_id:1,status:1},{unique:true,name:"uq_development_rulesets_one_active_per_season",partialFilterExpression:{status:"ACTIVE"}}],
 ["development_history",{owner_type:1,owner_id:1,created_at:-1},{name:"ix_development_history_owner_date"}],
 ["development_history",{season_id:1,period_key:1,owner_type:1,owner_id:1},{name:"ix_development_history_period_limit"}],
 ["development_transactions",{owner_type:1,owner_id:1,transaction_type:1,created_at:-1},{name:"ix_development_transactions_owner_type_date"}],
 ["rnd_projects",{team_id:1,status:1,created_at:-1},{name:"ix_rnd_projects_team_status_date"}],
 ["rnd_projects",{team_id:1,season_id:1,project_key:1},{name:"ix_rnd_projects_team_season_key"}]
];
const definition={indexes};
const checksum=createHash("sha256").update(JSON.stringify(definition)).digest("hex");
if(!uri||!database)throw new Error("MONGODB_URI and MONGODB_DB are required.");
if(!database.endsWith("_dev")&&!database.endsWith("_staging")&&!allowProduction)throw new Error("Production migration blocked; use _dev or _staging.");
const client=new MongoClient(uri,{maxPoolSize:2,serverSelectionTimeoutMS:10000,appName:"caleris-masters-phase-09-migration"});
try{
 await client.connect();const db=client.db(database),migrations=db.collection("schema_migrations"),prior=await migrations.findOne({_id:migrationId});
 if(prior){if(prior.checksum!==checksum)throw new Error("Migration checksum mismatch; applied migrations are immutable.");console.log("Migration already applied: "+migrationId);}
 else{
  const names=new Set((await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name));
  for(const name of ["development_rulesets","rnd_projects"]){if(!names.has(name))await db.createCollection(name,{validator:{$jsonSchema:{bsonType:"object",required:["_id","created_at","updated_at"],properties:{_id:{bsonType:"string",pattern:"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"},created_at:{bsonType:"date"},updated_at:{bsonType:"date"}},additionalProperties:true}},validationLevel:"strict",validationAction:"error"});}
  for(const [collection,keys,options] of indexes)await db.collection(collection).createIndex(keys,options);
  const info=await db.listCollections({name:"development_transactions"},{nameOnly:false}).next();
  const validator=info?.options?.validator??{$jsonSchema:{bsonType:"object",properties:{}}};
  if(validator.$jsonSchema){validator.$jsonSchema.properties??={};Object.assign(validator.$jsonSchema.properties,{attribute_key:{bsonType:"string"},old_value:{bsonType:"int"},new_value:{bsonType:"int"},season_id:{bsonType:"string"},ruleset_id:{bsonType:"string"},ruleset_version:{bsonType:["int","long"]},project_id:{bsonType:"string"},project_key:{bsonType:"string"}});await db.command({collMod:"development_transactions",validator,validationLevel:"strict",validationAction:"error"});}
  await migrations.insertOne({_id:migrationId,checksum,applied_at:new Date(),database,index_count:indexes.length,collections_created:["development_rulesets","rnd_projects"],seeds_created:0});
  console.log("Applied Phase 09 schema and indexes: "+indexes.length+".");
 }
}finally{await client.close();}
