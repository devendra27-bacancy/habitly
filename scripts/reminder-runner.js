"use strict";

const { runFromCli } = require("./reminder-service");

runFromCli().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
