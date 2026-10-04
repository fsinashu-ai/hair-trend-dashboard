import { DatabaseSync } from "node:sqlite";

const workflowId = process.argv[2];
const weekStartUtc = process.argv[3];

if (!workflowId || !weekStartUtc) {
  process.stderr.write("workflowId and weekStartUtc are required.\n");
  process.exit(2);
}

const database = new DatabaseSync("/home/node/.n8n/database.sqlite", {
  readOnly: true,
});
const row = database
  .prepare(
    "select 1 from execution_entity where workflowId = ? and status = 'success' and startedAt >= ? limit 1",
  )
  .get(workflowId, weekStartUtc);

process.stdout.write(row ? "yes" : "no");
