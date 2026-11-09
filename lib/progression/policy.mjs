export const QUEST_CATEGORIES = Object.freeze(["DAILY_CHECK_IN","TRAINING","QUALIFYING_PRACTICE","OVERTAKING","DEFENSE","TYRE_MANAGEMENT","CONSISTENCY","RACE_START","WET_WEATHER_PRACTICE","RACE_ANALYSIS","CIRCUIT_ANALYSIS","TYRE_ANALYSIS","STRATEGY_ANALYSIS","RACE_ATTENDANCE","PRE_RACE_BRIEFING","POST_RACE_REPORT","WEEKLY_TARGET","ACHIEVEMENT_CHALLENGE","COMMUNITY_CONTRIBUTION","TEAM_ROSTER_CONTRACT","TEAM_RACE_PREPARATION","TEAM_R_AND_D","TEAM_STRATEGY","TEAM_SPONSORSHIP","TEAM_COMMERCIAL","TEAM_DEVELOPMENT","TEAM_CASHFLOW","TEAM_ADMIN_COMPLIANCE"]);
export const QUEST_ROLES = Object.freeze(["DRIVER","TEAM_OWNER"]);
export const REWARD_TYPES = Object.freeze(["CP","DDP","TDP","XP","ACHIEVEMENT"]);
export const ASSIGNMENT_TARGETS = Object.freeze(["PLAYER","TEAM"]);
export const ASSIGNMENT_STATUSES = Object.freeze(["ASSIGNED","IN_PROGRESS","COMPLETED","CLAIMED","EXPIRED","REVIEW_REQUIRED","REJECTED"]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveInt = (value) => Number.isSafeInteger(value) && value > 0;
export function validateQuestDefinition(input) {
  if (!isObject(input)) return { ok:false, reason:"INVALID_QUEST" };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (name.length < 3 || name.length > 100 || description.length < 3 || description.length > 1000) return { ok:false, reason:"INVALID_QUEST_TEXT" };
  if (!QUEST_CATEGORIES.includes(input.questCategory)) return { ok:false, reason:"INVALID_QUEST_CATEGORY" };
  if (!["EASY","MEDIUM","HARD","ELITE"].includes(input.difficulty)) return { ok:false, reason:"INVALID_DIFFICULTY" };
  if (!Array.isArray(input.roleEligibility) || !input.roleEligibility.length || input.roleEligibility.some((role)=>!QUEST_ROLES.includes(role))) return { ok:false, reason:"INVALID_ROLE_ELIGIBILITY" };
  if (!Array.isArray(input.requirements) || !input.requirements.length || input.requirements.some((r)=>!isObject(r)||typeof r.key!=="string"||!r.key.trim()||!positiveInt(r.target))) return { ok:false, reason:"INVALID_REQUIREMENTS" };
  if (!isObject(input.rewards) || !Array.isArray(input.rewards.items) || !input.rewards.items.length || input.rewards.items.some((r)=>!isObject(r)||!REWARD_TYPES.includes(r.type)||!positiveInt(r.amount)||(r.type==="ACHIEVEMENT"&&typeof r.achievementId!=="string")||(r.eligibleRoles!==undefined&&(!Array.isArray(r.eligibleRoles)||r.eligibleRoles.length===0||r.eligibleRoles.some(role=>!QUEST_ROLES.includes(role)))))) return { ok:false, reason:"INVALID_REWARDS" };
  if (!Number.isSafeInteger(input.cooldownSeconds) || input.cooldownSeconds < 0) return { ok:false, reason:"INVALID_COOLDOWN" };
  if (typeof input.repeatable !== "boolean") return { ok:false, reason:"INVALID_REPEATABLE" };
  if (input.recurrence && !["ONCE","DAILY","WEEKLY","PER_EVENT","PER_SEASON"].includes(input.recurrence)) return { ok:false, reason:"INVALID_RECURRENCE" };
  if (input.repeatable === false && input.recurrence && input.recurrence !== "ONCE") return { ok:false, reason:"NON_REPEATABLE_RECURRENCE_CONFLICT" };
  if (input.expirySeconds !== null && input.expirySeconds !== undefined && (!Number.isSafeInteger(input.expirySeconds)||input.expirySeconds<=0)) return { ok:false, reason:"INVALID_EXPIRY" };
  if (input.evidenceRequired !== undefined && typeof input.evidenceRequired !== "boolean") return { ok:false, reason:"INVALID_EVIDENCE_POLICY" };
  if (input.rewardCaps !== undefined && (!isObject(input.rewardCaps)||Object.values(input.rewardCaps).some(v=>!Number.isSafeInteger(v)||v<0))) return { ok:false, reason:"INVALID_REWARD_CAPS" };
  return { ok:true, value:{ name, description, questCategory:input.questCategory, difficulty:input.difficulty, roleEligibility:[...new Set(input.roleEligibility)], requirements:input.requirements.map(r=>({...r,key:r.key.trim()})), rewards:{items:input.rewards.items.map(r=>({type:r.type,amount:r.amount,...(r.achievementId?{achievementId:r.achievementId}:{}),...(r.eligibleRoles?{eligibleRoles:[...new Set(r.eligibleRoles)]}:{})}))}, cooldownSeconds:input.cooldownSeconds, repeatable:input.repeatable, recurrence:input.recurrence??"ONCE", expirySeconds:input.expirySeconds??null, evidenceRequired:input.evidenceRequired??true, rewardCaps:input.rewardCaps??{}, active:input.active??true } };
}
export function calculateAccountLevel(totalXp, rules) {
  if (!Number.isSafeInteger(totalXp)||totalXp<0||!Array.isArray(rules)) return {level:1,nextLevelXp:null};
  const active=rules.filter(r=>r.status==="ACTIVE"&&Number.isSafeInteger(r.level)&&Number.isSafeInteger(r.required_total_xp)).sort((a,b)=>a.level-b.level);
  let level=1,nextLevelXp=null;
  for(const rule of active){if(totalXp>=rule.required_total_xp)level=Math.max(level,rule.level);else{nextLevelXp=rule.required_total_xp;break;}}
  return {level,nextLevelXp};
}
export function evaluateRequirements(requirements, progress) {
  if(!Array.isArray(requirements)||!isObject(progress))return {complete:false,completed:0,total:Array.isArray(requirements)?requirements.length:0};
  const completed=requirements.filter(r=>Number(progress[r.key]??0)>=r.target).length;
  return {complete:requirements.length>0&&completed===requirements.length,completed,total:requirements.length};
}
export function canClaimAssignment({status,expiresAt,now=new Date(),evidenceRequired=false,evidenceVerified=false,alreadyClaimed=false}) {
  if(alreadyClaimed)return {ok:false,reason:"ALREADY_CLAIMED"};
  if(status!=="COMPLETED")return {ok:false,reason:"QUEST_NOT_COMPLETED"};
  if(expiresAt && new Date(expiresAt).getTime()<=now.getTime())return {ok:false,reason:"QUEST_EXPIRED"};
  if(evidenceRequired&&!evidenceVerified)return {ok:false,reason:"EVIDENCE_REVIEW_REQUIRED"};
  return {ok:true};
}
export function isWithinCooldown(lastClaimAt,cooldownSeconds,now=new Date()) {
  if(!lastClaimAt||cooldownSeconds===0)return false;
  return now.getTime()<new Date(lastClaimAt).getTime()+cooldownSeconds*1000;
}
export function getUtcRecurrenceWindow(now=new Date(),recurrence="DAILY") {
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  if(recurrence==="WEEKLY"){const day=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()-day+1);}
  if(recurrence==="PER_SEASON"||recurrence==="PER_EVENT"||recurrence==="ONCE")return null;
  return date.toISOString().slice(0,10);
}
export function validateXpEvent({xpAmount,eventId,sourceType,sourceId}) {
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return Number.isSafeInteger(xpAmount)&&xpAmount>0&&typeof eventId==="string"&&uuid.test(eventId)&&typeof sourceType==="string"&&sourceType.length>0&&typeof sourceId==="string"&&uuid.test(sourceId);
}
export function normalizeRewardGrant(rewards) {
  if(!Array.isArray(rewards))throw new TypeError("Rewards must be an array.");
  return rewards.map(r=>{if(!REWARD_TYPES.includes(r.type)||!positiveInt(r.amount)||(r.type==="ACHIEVEMENT"&&typeof r.achievementId!=="string"))throw new TypeError("Invalid reward item.");return {type:r.type,amount:r.amount,...(r.achievementId?{achievement_id:r.achievementId}:{}),...(r.eligibleRoles?{eligible_roles:[...r.eligibleRoles]}:{})};});
}
