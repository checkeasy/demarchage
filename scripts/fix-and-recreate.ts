import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WS = "83da732a-a933-4ed4-a815-3f975c8ff0c6";
const USER = "3ed6c90c-6954-4835-adb9-4c99355e4c21";

async function main() {
  // 1. Check column names
  const { data: step } = await supabase.from("sequence_steps").select("*").limit(1).single();
  console.log("sequence_steps columns:", Object.keys(step || {}));

  const { data: cp } = await supabase.from("campaign_prospects").select("*").limit(1).single();
  console.log("campaign_prospects columns:", Object.keys(cp || {}));

  // 2. Delete empty/broken campaigns
  const badIds = [
    "db2f23a1-0836-4cc0-b2e2-e43214b5acc6",
    "f95089b6-a06f-4ab7-a8c3-006246218b92",
    "d2ab4da8-bd25-48b2-930b-19dc4e6f3782",
    "880bae42-d28b-48a3-8c6b-8ee86e1e8835",
    "0fbea311-9625-42c8-b1db-2064be7cb462",
    "f92371a2-d7e8-4052-af8d-ca09166fbd26"
  ];
  for (const id of badIds) {
    await supabase.from("sequence_steps").delete().eq("campaign_id", id);
    await supabase.from("campaign_prospects").delete().eq("campaign_id", id);
    await supabase.from("campaigns").delete().eq("id", id);
  }
  console.log("Cleaned up", badIds.length, "broken campaigns");
}

main();
