import fs from "node:fs";
import path from "node:path";
import "../src/load-env.mjs";
import { SmartSettlementOrchestrator } from "../src/financial/SmartSettlementOrchestrator.mjs";
import { OwnerSettlementEnforcer } from "../src/policy/owner-settlement.mjs";
import { SettlementLedger } from "../src/financial/SettlementLedger.mjs";
function parseArgs(argv){const args={};for(let i=2;i<argv.length;i++){const a=argv[i];if(!a.startsWith("--"))continue;const key=a.slice(2);const next=argv[i+1];if(!next||next.startsWith("--")){args[key]=true}else{args[key]=next;i++}}return args}
function parseAmountFromText(txt){const matches=txt.match(/([0-9]+(?:\.[0-9]+)?)/g);if(!matches||matches.length===0)return 0;return matches.map(Number).filter(n=>Number.isFinite(n)&&n>0).reduce((s,n)=>s+n,0)}
async function main(){const args=parseArgs(process.argv);const fileArg=args.file??args.path??args.batch??null;const currency=String(args.currency??process.env.SWARM_SETTLEMENT_CURRENCY??"USDT").toUpperCase();const amountArg=args.amount??null;let total=0;if(amountArg!=null){const n=Number(amountArg);if(Number.isFinite(n)&&n>0)total=n}
else if(fileArg){const fp=path.resolve(process.cwd(),String(fileArg));const raw=fs.readFileSync(fp,"utf8");total=parseAmountFromText(raw)}
if(!total||Number.isNaN(total)||total<=0){process.stdout.write(`${JSON.stringify({ok:false,error:"no_positive_amount"})}\n`);process.exitCode=1;return}
const orchestrator=new SmartSettlementOrchestrator();const ownerCfg=OwnerSettlementEnforcer.getPaymentConfiguration();const ledger=new SettlementLedger();const res=await orchestrator.routeAndExecute(Number(total.toFixed(2)),currency);const queued=res.filter(r=>String(r.status).toLowerCase().includes("queued")).length>0;process.stdout.write(`${JSON.stringify({ok:true,total:Number(total.toFixed(2)),currency,queued,owner_destinations:ownerCfg.settlement_destinations})}\n`)}
main().catch(e=>{process.stderr.write(`${JSON.stringify({ok:false,error:e?.message??String(e)})}\n`);process.exitCode=1});
